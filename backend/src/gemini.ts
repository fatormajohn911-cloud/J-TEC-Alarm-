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

const CHAT_MODEL = 'gemini-2.5-flash';
const SCOPE_GUARD_MODEL = 'gemini-2.5-flash-lite';
const VOICE_MODEL = 'gemini-2.5-flash-preview-tts';
const UPSTREAM_TIMEOUT_MS = 20_000;

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

  constructor(errorCode: 'timeout' | 'upstream_error', message: string) {
    super(message);
    this.errorCode = errorCode;
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

async function callWithTimeoutAndRetry<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs = UPSTREAM_TIMEOUT_MS
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const result = await operation(controller.signal);
      clearTimeout(timer);
      return result;
    } catch (err) {
      clearTimeout(timer);
      if (isTimeoutError(err) || controller.signal.aborted) {
        if (attempt === 0) continue;
        throw new GeminiUpstreamError(
          'timeout',
          'The AI service timed out. Please try again.'
        );
      }
      const status = getHttpStatusFromError(err);
      if (status !== null && status >= 500 && status < 600 && attempt === 0) {
        continue;
      }
      throw new GeminiUpstreamError(
        'upstream_error',
        'Unable to get a response from the AI service right now.'
      );
    }
  }
  throw new GeminiUpstreamError(
    'upstream_error',
    'Unable to get a response from the AI service right now.'
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

  constructor(textKey: string, voiceKey: string) {
    const httpOptions = {
      timeout: UPSTREAM_TIMEOUT_MS,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    };
    this.textAi = new GoogleGenAI({ apiKey: textKey, httpOptions });
    this.voiceAi = new GoogleGenAI({ apiKey: voiceKey, httpOptions });
  }

  private async runScopeGuard(latestUserMessage: string): Promise<'IN' | 'OUT'> {
    const trimmed = latestUserMessage.trim();
    if (!trimmed) return 'IN';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await this.textAi.models.generateContent({
        model: SCOPE_GUARD_MODEL,
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
      const verdict = (res.text || '').trim().toUpperCase();
      if (verdict.startsWith('OUT')) return 'OUT';
      return 'IN';
    } catch {
      clearTimeout(timer);
      // Fail open to IN on any error
      return 'IN';
    }
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

    const response = await callWithTimeoutAndRetry((signal) =>
      this.textAi.models.generateContent({
        model: CHAT_MODEL,
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

    const response = await callWithTimeoutAndRetry((signal) =>
      this.voiceAi.models.generateContent({
        model: VOICE_MODEL,
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

    const inlinePart = response.candidates?.[0]?.content?.parts?.find(
      (p) => p.inlineData?.data
    )?.inlineData;

    if (!inlinePart?.data) {
      throw new GeminiUpstreamError(
        'upstream_error',
        'Voice service returned an empty audio response.'
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
