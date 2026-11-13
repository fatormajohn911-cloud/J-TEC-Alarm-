import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  type Content,
  type FunctionDeclaration,
  type Part,
  type SafetySetting,
} from '@google/genai';
import {
  buildServerSystemInstruction,
  PERSONA_VOICE_MAP,
  POLITE_DECLINE,
  type VoicePersonaKey,
} from './prompt.js';

const DEFAULT_CHAT_MODELS = ['gemini-3.5-flash', 'gemini-2.5-flash'];
const DEFAULT_GUARD_MODELS = ['gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'];
const DEFAULT_VOICE_MODELS = [
  'gemini-3.1-flash-tts-preview',
  'gemini-2.5-flash-preview-tts',
];

const UPSTREAM_TIMEOUT_MS = 20_000;

export type UpstreamCallType = 'chat' | 'guard' | 'speak';

export interface GeminiModelOverrides {
  chatModels?: string[];
  guardModels?: string[];
  voiceModels?: string[];
}

const SAFETY_SETTINGS: SafetySetting[] = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

export class GeminiUpstreamError extends Error {
  errorCode: 'timeout' | 'upstream_error';
  upstreamStatus: number | null;

  constructor(
    errorCode: 'timeout' | 'upstream_error',
    message: string,
    upstreamStatus: number | null = null
  ) {
    super(message);
    this.errorCode = errorCode;
    this.upstreamStatus = upstreamStatus;
  }
}

function getHttpStatusFromError(err: unknown): number | null {
  if (err && typeof err === 'object') {
    const rec = err as { status?: unknown; statusCode?: unknown };
    if (typeof rec.status === 'number') return rec.status;
    if (typeof rec.statusCode === 'number') return rec.statusCode;
  }
  const msg = err instanceof Error ? err.message : String(err || '');
  const match = msg.match(/\b(4\d\d|5\d\d)\b/);
  return match ? Number(match[1]) : null;
}

function sanitizeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || 'Unknown error');
  return raw
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, '[REDACTED]')
    .replace(/([?&]key=)[^&\s"']+/gi, '$1[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, 200);
}

function logUpstreamFailure(
  call: UpstreamCallType,
  model: string,
  status: number | null,
  err: unknown
): void {
  const shortMsg = sanitizeErrorMessage(err);
  console.error(
    `[gemini] call=${call} model=${model} status=${status ?? 'none'} error=${shortMsg}`
  );
}

function isTimeoutError(err: unknown): boolean {
  if (!err) return false;
  const name = err instanceof Error ? err.name : '';
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    name === 'TimeoutError' ||
    name === 'AbortError' ||
    msg.includes('aborted') ||
    msg.includes('timed out') ||
    msg.includes('timeout')
  );
}

function isModelUnavailableError(status: number | null, err: unknown): boolean {
  if (status === 404) return true;
  const msg = (err instanceof Error ? err.message : String(err || '')).toLowerCase();
  return (
    msg.includes('not found') ||
    msg.includes('not_found') ||
    msg.includes('deprecated') ||
    msg.includes('not supported') ||
    msg.includes('unsupported') ||
    msg.includes('is no longer available')
  );
}

async function callWithTimeoutAndRetry<T>(
  callType: Exclude<UpstreamCallType, 'guard'>,
  model: string,
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs = UPSTREAM_TIMEOUT_MS
): Promise<{ result: T } | { shouldTryNextModel: true; err: GeminiUpstreamError }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const result = await operation(controller.signal);
      clearTimeout(timer);
      return { result };
    } catch (err) {
      clearTimeout(timer);
      const status = getHttpStatusFromError(err);
      logUpstreamFailure(callType, model, status, err);

      if (isModelUnavailableError(status, err)) {
        return {
          shouldTryNextModel: true,
          err: new GeminiUpstreamError(
            'upstream_error',
            'Unable to get a response from the AI service right now.',
            status
          ),
        };
      }

      if (isTimeoutError(err) || controller.signal.aborted) {
        if (attempt === 0) continue;
        throw new GeminiUpstreamError(
          'timeout',
          'The AI service timed out. Please try again.',
          status ?? 504
        );
      }

      if (status !== null && status >= 500 && status < 600 && attempt === 0) {
        continue;
      }

      throw new GeminiUpstreamError(
        'upstream_error',
        'Unable to get a response from the AI service right now.',
        status
      );
    }
  }

  throw new GeminiUpstreamError(
    'upstream_error',
    'Unable to get a response from the AI service right now.',
    null
  );
}

function hasRiffWavHeader(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x41 && // A
    bytes[10] === 0x56 && // V
    bytes[11] === 0x45 // E
  );
}

function wrapPcmInWav(
  pcmBytes: Uint8Array,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): Uint8Array {
  const header = Buffer.alloc(44);
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBytes.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmBytes.length, 40);

  return Buffer.concat([header, pcmBytes]);
}

export class GeminiService {
  private textAi: GoogleGenAI;
  private voiceAi: GoogleGenAI;
  private chatModels: string[];
  private guardModels: string[];
  private voiceModels: string[];
  private preferredModel: Partial<Record<UpstreamCallType, string>> = {};
  private loggedFirstModel = new Set<UpstreamCallType>();

  constructor(
    textKey: string,
    voiceKey: string,
    modelOverrides?: GeminiModelOverrides
  ) {
    const httpOptions = {
      timeout: UPSTREAM_TIMEOUT_MS,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    };
    this.textAi = new GoogleGenAI({ apiKey: textKey, httpOptions });
    this.voiceAi = new GoogleGenAI({ apiKey: voiceKey, httpOptions });
    this.chatModels =
      modelOverrides?.chatModels && modelOverrides.chatModels.length > 0
        ? modelOverrides.chatModels
        : [...DEFAULT_CHAT_MODELS];
    this.guardModels =
      modelOverrides?.guardModels && modelOverrides.guardModels.length > 0
        ? modelOverrides.guardModels
        : [...DEFAULT_GUARD_MODELS];
    this.voiceModels =
      modelOverrides?.voiceModels && modelOverrides.voiceModels.length > 0
        ? modelOverrides.voiceModels
        : [...DEFAULT_VOICE_MODELS];
  }

  private getOrderedModels(callType: UpstreamCallType): string[] {
    const baseList =
      callType === 'chat'
        ? this.chatModels
        : callType === 'guard'
        ? this.guardModels
        : this.voiceModels;
    const preferred = this.preferredModel[callType];
    if (!preferred || !baseList.includes(preferred)) {
      return baseList;
    }
    return [preferred, ...baseList.filter((m) => m !== preferred)];
  }

  private recordWorkingModel(callType: UpstreamCallType, model: string): void {
    this.preferredModel[callType] = model;
    if (!this.loggedFirstModel.has(callType)) {
      this.loggedFirstModel.add(callType);
      console.log(`[gemini] First successful ${callType} model: ${model}`);
    }
  }

  private async runScopeGuard(latestUserMessage: string): Promise<'IN' | 'OUT'> {
    const trimmed = latestUserMessage.trim();
    if (!trimmed) return 'IN';

    const candidates = this.getOrderedModels('guard');

    for (let i = 0; i < candidates.length; i++) {
      const model = candidates[i];
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);

      try {
        const res = await this.textAi.models.generateContent({
          model,
          contents: `Classify this user message for an alarm & morning-routine assistant app.
Reply ONLY with "IN" or "OUT".
IN = alarms, wake-up times, sleep, naps, morning routines, schedules, habits, study blocks, planning the day, morning motivation, weather, greetings, or short follow-up confirmations/clarifications.
OUT = clearly unrelated requests like programming/coding, writing essays/emails, homework answers, general trivia, math problems, or recipes.
Message: ${trimmed.slice(0, 600)}`,
          config: {
            maxOutputTokens: 5,
            safetySettings: SAFETY_SETTINGS,
            abortSignal: controller.signal,
          },
        });
        clearTimeout(timer);
        this.recordWorkingModel('guard', model);
        const verdict = (res.text || '').trim().toUpperCase();
        if (verdict.startsWith('OUT')) return 'OUT';
        return 'IN';
      } catch (err) {
        clearTimeout(timer);
        const status = getHttpStatusFromError(err);
        logUpstreamFailure('guard', model, status, err);

        if (isModelUnavailableError(status, err) && i < candidates.length - 1) {
          continue;
        }
        // Fail open to IN on any error
        return 'IN';
      }
    }

    return 'IN';
  }

  async runChat(params: {
    messages: Content[];
    context: unknown;
    tools: FunctionDeclaration[];
  }): Promise<{ parts: Part[]; modelContent?: Content }> {
    const lastMessage = params.messages[params.messages.length - 1];
    const hasFunctionResponse = Boolean(
      lastMessage?.parts?.some((p) => Boolean(p.functionResponse))
    );
    const lastText =
      lastMessage?.role === 'user' && !hasFunctionResponse
        ? (lastMessage.parts || [])
            .map((p) => (typeof p.text === 'string' ? p.text : ''))
            .join(' ')
            .trim()
        : '';

    if (lastText) {
      const verdict = await this.runScopeGuard(lastText);
      if (verdict === 'OUT') {
        const parts: Part[] = [{ text: POLITE_DECLINE }];
        return {
          parts,
          modelContent: {
            role: 'model',
            parts,
          },
        };
      }
    }

    const systemInstruction = buildServerSystemInstruction(params.context);
    const candidates = this.getOrderedModels('chat');
    let lastFallbackErr: GeminiUpstreamError | null = null;
    let response: Awaited<ReturnType<GoogleGenAI['models']['generateContent']>> | null =
      null;

    for (let i = 0; i < candidates.length; i++) {
      const model = candidates[i];
      const attemptResult = await callWithTimeoutAndRetry('chat', model, (signal) =>
        this.textAi.models.generateContent({
          model,
          contents: params.messages,
          config: {
            systemInstruction,
            maxOutputTokens: 400,
            safetySettings: SAFETY_SETTINGS,
            ...(params.tools.length > 0
              ? { tools: [{ functionDeclarations: params.tools }] }
              : {}),
            abortSignal: signal,
          },
        })
      );

      if ('shouldTryNextModel' in attemptResult) {
        lastFallbackErr = attemptResult.err;
        continue;
      }

      this.recordWorkingModel('chat', model);
      response = attemptResult.result;
      break;
    }

    if (!response) {
      throw (
        lastFallbackErr ||
        new GeminiUpstreamError(
          'upstream_error',
          'Unable to get a response from the AI service right now.',
          null
        )
      );
    }

    const modelContent = response.candidates?.[0]?.content;
    const rawParts = modelContent?.parts || [];
    const safeParts: Part[] = rawParts.filter(
      (p) => typeof p.text === 'string' || Boolean(p.functionCall)
    );

    return {
      parts:
        safeParts.length > 0
          ? safeParts
          : [{ text: (response.text || '').trim() }],
      modelContent: modelContent || {
        role: 'model',
        parts: safeParts,
      },
    };
  }

  async runSpeak(params: {
    text: string;
    persona: VoicePersonaKey;
  }): Promise<{ audioBytes: Uint8Array; contentType: string }> {
    const voiceCfg = PERSONA_VOICE_MAP[params.persona] || PERSONA_VOICE_MAP.warm;
    const candidates = this.getOrderedModels('speak');
    let lastFallbackErr: GeminiUpstreamError | null = null;
    let response: Awaited<ReturnType<GoogleGenAI['models']['generateContent']>> | null =
      null;

    for (let i = 0; i < candidates.length; i++) {
      const model = candidates[i];
      const attemptResult = await callWithTimeoutAndRetry('speak', model, (signal) =>
        this.voiceAi.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [{ text: `${voiceCfg.style}: ${params.text}` }],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            safetySettings: SAFETY_SETTINGS,
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voiceCfg.voiceName,
                },
              },
            },
            abortSignal: signal,
          },
        })
      );

      if ('shouldTryNextModel' in attemptResult) {
        lastFallbackErr = attemptResult.err;
        continue;
      }

      this.recordWorkingModel('speak', model);
      response = attemptResult.result;
      break;
    }

    if (!response) {
      throw (
        lastFallbackErr ||
        new GeminiUpstreamError(
          'upstream_error',
          'Unable to get a response from the AI service right now.',
          null
        )
      );
    }

    const inlinePart = response.candidates?.[0]?.content?.parts?.find(
      (p) => p.inlineData?.data
    )?.inlineData;

    if (!inlinePart?.data) {
      throw new GeminiUpstreamError(
        'upstream_error',
        'Voice service returned an empty audio response.',
        null
      );
    }

    const rawBytes = Buffer.from(inlinePart.data, 'base64');
    const mimeType = (inlinePart.mimeType || 'audio/wav').toLowerCase();
    const needsWavHeader =
      mimeType.includes('l16') ||
      mimeType.includes('pcm') ||
      (mimeType.includes('wav') && !hasRiffWavHeader(rawBytes)) ||
      !hasRiffWavHeader(rawBytes);

    const finalBytes = needsWavHeader ? wrapPcmInWav(rawBytes) : rawBytes;
    return {
      audioBytes: finalBytes,
      contentType: 'audio/wav',
    };
  }
}
