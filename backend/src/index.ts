import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import type { Content, FunctionDeclaration, Part } from '@google/genai';
import { isValidUuid, signInstallToken, verifyBearerToken } from './auth.js';
import { GeminiService, GeminiUpstreamError } from './gemini.js';
import {
  ALLOWED_TOOL_SET,
  normalizePersona,
} from './prompt.js';
import { QUOTA_LIMITS, QuotaService } from './quota.js';

const REQUIRED_ENV_VARS = [
  'GEMINI_TEXT_KEY',
  'GEMINI_VOICE_KEY',
  'TOKEN_SIGNING_SECRET',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'ALLOWED_ORIGINS',
] as const;

function cleanEnvValue(raw: string | undefined): string {
  if (!raw) return '';
  let cleaned = raw.trim();
  while (
    cleaned.length >= 2 &&
    ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'")))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned.replace(/^["']+|["']+$/g, '').trim();
}

function parseModelListEnv(raw: string | undefined): string[] | undefined {
  const cleaned = cleanEnvValue(raw);
  if (!cleaned) return undefined;
  const list = cleaned
    .split(',')
    .map((entry) => cleanEnvValue(entry))
    .filter(Boolean);
  return list.length > 0 ? list : undefined;
}

function readRequiredEnv(): Record<(typeof REQUIRED_ENV_VARS)[number], string> {
  const missing: string[] = [];
  const envMap = {} as Record<(typeof REQUIRED_ENV_VARS)[number], string>;

  for (const name of REQUIRED_ENV_VARS) {
    const val = cleanEnvValue(process.env[name]);
    if (!val) {
      missing.push(name);
    } else {
      envMap[name] = val;
    }
  }

  if (missing.length > 0) {
    console.error(
      `FATAL: Missing required environment variable(s): ${missing.join(', ')}`
    );
    process.exit(1);
  }

  return envMap;
}

const ENV = readRequiredEnv();

console.log(
  `Text key: length ${ENV.GEMINI_TEXT_KEY.length}, starts with AIza: ${ENV.GEMINI_TEXT_KEY.startsWith('AIza')}`
);
console.log(
  `Voice key: length ${ENV.GEMINI_VOICE_KEY.length}, starts with AIza: ${ENV.GEMINI_VOICE_KEY.startsWith('AIza')}`
);

export const APP_CONFIG = {
  minAppVersion: '1.0.0',
  aiEnabled: true,
  quotas: {
    chatPerDay: QUOTA_LIMITS.chatPerInstallPerDay,
    speakPerDay: QUOTA_LIMITS.speakPerInstallPerDay,
    ipPerDay: QUOTA_LIMITS.requestsPerIpPerDay,
    registerPerIpPerDay: QUOTA_LIMITS.registerPerIpPerDay,
  },
  maxMessageChars: 2000,
} as const;

const MAX_BODY_BYTES = 20 * 1024; // 20 KB
const MAX_MESSAGES = 10;
const MAX_SPEAK_CHARS = 600;

const configuredOrigins = new Set(
  ENV.ALLOWED_ORIGINS.split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean)
);

function isOriginAllowed(origin: string): boolean {
  const normalized = origin.trim().replace(/\/+$/, '');
  if (!normalized) return false;
  if (normalized === 'https://localhost' || normalized === 'capacitor://localhost') {
    return true;
  }
  if (/^http:\/\/localhost(:\d+)?$/i.test(normalized)) {
    return true;
  }
  if (/^http:\/\/127\.0\.0\.1(:\d+)?$/i.test(normalized)) {
    return true;
  }
  return configuredOrigins.has(normalized);
}

type ErrorCode =
  | 'unauthorized'
  | 'quota_exceeded'
  | 'invalid_request'
  | 'ai_disabled'
  | 'upstream_error'
  | 'timeout';

function errorJson(
  code: ErrorCode,
  message: string,
  status: number,
  extra?: Record<string, unknown>
) {
  return new Response(
    JSON.stringify({
      error: {
        code,
        message,
        ...extra,
      },
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return 'unknown';
}

async function readJsonBodyLimited(
  req: Request
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; res: Response }> {
  const contentLengthHeader = req.headers.get('content-length');
  if (contentLengthHeader) {
    const len = Number(contentLengthHeader);
    if (Number.isFinite(len) && len > MAX_BODY_BYTES) {
      return {
        ok: false,
        res: errorJson(
          'invalid_request',
          'Request body exceeds 20 KB limit.',
          413
        ),
      };
    }
  }

  let rawText: string;
  try {
    rawText = await req.text();
  } catch {
    return {
      ok: false,
      res: errorJson('invalid_request', 'Unable to read request body.', 400),
    };
  }

  if (Buffer.byteLength(rawText, 'utf8') > MAX_BODY_BYTES) {
    return {
      ok: false,
      res: errorJson(
        'invalid_request',
        'Request body exceeds 20 KB limit.',
        413
      ),
    };
  }

  try {
    const parsed = JSON.parse(rawText) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        ok: false,
        res: errorJson('invalid_request', 'JSON object body required.', 400),
      };
    }
    return { ok: true, data: parsed as Record<string, unknown> };
  } catch {
    return {
      ok: false,
      res: errorJson('invalid_request', 'Invalid JSON body.', 400),
    };
  }
}

function validateAndSanitizeMessages(
  rawMessages: unknown
): { ok: true; messages: Content[] } | { ok: false; message: string } {
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return { ok: false, message: 'messages must be a non-empty array.' };
  }
  if (rawMessages.length > MAX_MESSAGES) {
    return {
      ok: false,
      message: `messages cannot exceed ${MAX_MESSAGES} items.`,
    };
  }

  const sanitized: Content[] = [];
  for (const item of rawMessages) {
    if (!item || typeof item !== 'object') {
      return { ok: false, message: 'Each message must be an object.' };
    }
    const msg = item as { role?: unknown; parts?: unknown };
    const role = msg.role === 'model' ? 'model' : msg.role === 'user' ? 'user' : null;
    if (!role) {
      return { ok: false, message: 'Message role must be user or model.' };
    }
    if (!Array.isArray(msg.parts) || msg.parts.length === 0) {
      return { ok: false, message: 'Each message must contain parts.' };
    }

    const sanitizedParts: Part[] = [];
    for (const partItem of msg.parts) {
      if (!partItem || typeof partItem !== 'object') {
        return { ok: false, message: 'Invalid message part.' };
      }
      const p = partItem as Record<string, unknown>;
      if (typeof p.text === 'string') {
        if (p.text.length > APP_CONFIG.maxMessageChars) {
          return {
            ok: false,
            message: `Message text exceeds ${APP_CONFIG.maxMessageChars} characters.`,
          };
        }
        sanitizedParts.push({ text: p.text });
      } else if (p.functionCall && typeof p.functionCall === 'object') {
        const fc = p.functionCall as {
          id?: unknown;
          name?: unknown;
          args?: unknown;
        };
        if (typeof fc.name !== 'string' || !ALLOWED_TOOL_SET.has(fc.name)) {
          return {
            ok: false,
            message: 'Unsupported tool name in message history.',
          };
        }
        sanitizedParts.push({
          functionCall: {
            ...(typeof fc.id === 'string' ? { id: fc.id } : {}),
            name: fc.name,
            args:
              fc.args && typeof fc.args === 'object'
                ? (fc.args as Record<string, unknown>)
                : {},
          },
          ...(typeof p.thoughtSignature === 'string'
            ? { thoughtSignature: p.thoughtSignature }
            : {}),
        });
      } else if (p.functionResponse && typeof p.functionResponse === 'object') {
        const fr = p.functionResponse as {
          id?: unknown;
          name?: unknown;
          response?: unknown;
        };
        if (typeof fr.name !== 'string' || !ALLOWED_TOOL_SET.has(fr.name)) {
          return {
            ok: false,
            message: 'Unsupported tool name in functionResponse.',
          };
        }
        sanitizedParts.push({
          functionResponse: {
            ...(typeof fr.id === 'string' ? { id: fr.id } : {}),
            name: fr.name,
            response:
              fr.response && typeof fr.response === 'object'
                ? (fr.response as Record<string, unknown>)
                : {},
          },
        });
      } else {
        return { ok: false, message: 'Unsupported message part type.' };
      }
    }

    sanitized.push({ role, parts: sanitizedParts });
  }

  return { ok: true, messages: sanitized };
}

function validateAndSanitizeTools(
  rawTools: unknown
): { ok: true; tools: FunctionDeclaration[] } | { ok: false; message: string } {
  if (rawTools === undefined || rawTools === null) {
    return { ok: true, tools: [] };
  }
  if (!Array.isArray(rawTools)) {
    return { ok: false, message: 'tools must be an array.' };
  }

  const tools: FunctionDeclaration[] = [];
  for (const t of rawTools) {
    if (!t || typeof t !== 'object') {
      return { ok: false, message: 'Invalid tool declaration.' };
    }
    const decl = t as FunctionDeclaration;
    if (typeof decl.name !== 'string' || !ALLOWED_TOOL_SET.has(decl.name)) {
      return {
        ok: false,
        message: `Tool "${String(decl.name || '')}" is not permitted.`,
      };
    }
    tools.push({
      name: decl.name,
      description:
        typeof decl.description === 'string'
          ? decl.description.slice(0, 400)
          : '',
      ...(decl.parameters ? { parameters: decl.parameters } : {}),
    });
  }

  return { ok: true, tools };
}

const quotaService = new QuotaService(
  ENV.UPSTASH_REDIS_REST_URL,
  ENV.UPSTASH_REDIS_REST_TOKEN
);
const geminiService = new GeminiService(
  ENV.GEMINI_TEXT_KEY,
  ENV.GEMINI_VOICE_KEY,
  {
    chatModels: parseModelListEnv(process.env.CHAT_MODELS),
    guardModels: parseModelListEnv(process.env.GUARD_MODELS),
    voiceModels: parseModelListEnv(process.env.VOICE_MODELS),
  }
);

const app = new Hono();

// Privacy-safe request timing logger (never logs bodies, prompts, tokens, or secrets)
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const durationMs = Date.now() - start;
  console.log(`${c.req.method} ${c.req.path} ${c.res.status} ${durationMs}ms`);
});

// Strict CORS middleware with OPTIONS preflight support
app.use('*', async (c, next) => {
  const origin = c.req.header('origin');
  const allowed = origin ? isOriginAllowed(origin) : false;

  if (c.req.method === 'OPTIONS') {
    const headers: Record<string, string> = {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Expose-Headers': 'X-Quota-Remaining',
      'Access-Control-Max-Age': '86400',
    };
    if (origin && allowed) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Vary'] = 'Origin';
    }
    return new Response(null, { status: 204, headers });
  }

  await next();

  if (origin && allowed) {
    c.res.headers.set('Access-Control-Allow-Origin', origin);
    c.res.headers.set('Vary', 'Origin');
    c.res.headers.set('Access-Control-Expose-Headers', 'X-Quota-Remaining');
  }
});

const v1 = new Hono();

// 1. GET /v1/health
v1.get('/health', (c) => {
  return c.json({
    ok: true,
    serverTime: new Date().toISOString(),
  });
});

// 2. GET /v1/config
v1.get('/config', (c) => {
  return c.json(APP_CONFIG);
});

// 3. POST /v1/register
v1.post('/register', async (c) => {
  const parsedBody = await readJsonBodyLimited(c.req.raw);
  if (!parsedBody.ok) return parsedBody.res;

  const installId = parsedBody.data.installId;
  if (!isValidUuid(installId)) {
    return errorJson(
      'invalid_request',
      'installId must be a valid UUID.',
      400
    );
  }

  const ip = getClientIp(c.req.raw.headers);
  try {
    const quota = await quotaService.checkRegisterQuota(ip);
    if (!quota.allowed) {
      return errorJson(
        'quota_exceeded',
        quota.reason || 'Daily registration limit reached.',
        429,
        { resetAt: quota.resetAt }
      );
    }

    const token = await signInstallToken(installId.trim(), ENV.TOKEN_SIGNING_SECRET);
    c.header('X-Quota-Remaining', String(quota.remaining));
    return c.json({
      token,
      expiresInDays: 30,
    });
  } catch {
    return errorJson(
      'upstream_error',
      'Unable to issue device token right now.',
      500
    );
  }
});

// 4. POST /v1/chat
v1.post('/chat', async (c) => {
  if (!APP_CONFIG.aiEnabled) {
    return errorJson(
      'ai_disabled',
      'AI features are temporarily disabled.',
      503
    );
  }

  const auth = await verifyBearerToken(
    c.req.header('authorization'),
    ENV.TOKEN_SIGNING_SECRET
  );
  if (!auth) {
    return errorJson(
      'unauthorized',
      'Missing or invalid authentication token.',
      401
    );
  }

  const parsedBody = await readJsonBodyLimited(c.req.raw);
  if (!parsedBody.ok) return parsedBody.res;

  const msgResult = validateAndSanitizeMessages(parsedBody.data.messages);
  if (!msgResult.ok) {
    return errorJson('invalid_request', msgResult.message, 400);
  }

  const toolsResult = validateAndSanitizeTools(parsedBody.data.tools);
  if (!toolsResult.ok) {
    return errorJson('invalid_request', toolsResult.message, 400);
  }

  const ip = getClientIp(c.req.raw.headers);
  let remainingQuota = 0;

  try {
    const quota = await quotaService.checkAiRequestQuota(
      'chat',
      auth.installId,
      ip
    );
    if (!quota.allowed) {
      return errorJson(
        'quota_exceeded',
        quota.reason || 'Daily AI chat quota exceeded.',
        429,
        { resetAt: quota.resetAt }
      );
    }
    remainingQuota = quota.remaining;
  } catch {
    return errorJson(
      'upstream_error',
      'Unable to verify quota right now.',
      503
    );
  }

  try {
    const result = await geminiService.runChat({
      messages: msgResult.messages,
      context: parsedBody.data.context,
      tools: toolsResult.tools,
    });

    c.header('X-Quota-Remaining', String(remainingQuota));
    return c.json({
      parts: result.parts,
      modelContent: result.modelContent,
    });
  } catch (err) {
    if (err instanceof GeminiUpstreamError) {
      return errorJson(
        err.errorCode,
        err.message,
        err.errorCode === 'timeout' ? 504 : 502,
        { upstreamStatus: err.upstreamStatus }
      );
    }
    return errorJson(
      'upstream_error',
      'Unable to complete AI chat request.',
      502
    );
  }
});

// 5. POST /v1/speak
v1.post('/speak', async (c) => {
  if (!APP_CONFIG.aiEnabled) {
    return errorJson(
      'ai_disabled',
      'AI features are temporarily disabled.',
      503
    );
  }

  const auth = await verifyBearerToken(
    c.req.header('authorization'),
    ENV.TOKEN_SIGNING_SECRET
  );
  if (!auth) {
    return errorJson(
      'unauthorized',
      'Missing or invalid authentication token.',
      401
    );
  }

  const parsedBody = await readJsonBodyLimited(c.req.raw);
  if (!parsedBody.ok) return parsedBody.res;

  const rawText = parsedBody.data.text;
  if (typeof rawText !== 'string' || !rawText.trim()) {
    return errorJson('invalid_request', 'text must be a non-empty string.', 400);
  }
  const text = rawText.trim();
  if (text.length > MAX_SPEAK_CHARS) {
    return errorJson(
      'invalid_request',
      `text cannot exceed ${MAX_SPEAK_CHARS} characters.`,
      400
    );
  }

  const persona = normalizePersona(parsedBody.data.persona);
  if (!persona) {
    return errorJson('invalid_request', 'Invalid voice persona.', 400);
  }

  const ip = getClientIp(c.req.raw.headers);
  let remainingQuota = 0;

  try {
    const quota = await quotaService.checkAiRequestQuota(
      'speak',
      auth.installId,
      ip
    );
    if (!quota.allowed) {
      return errorJson(
        'quota_exceeded',
        quota.reason || 'Daily AI voice quota exceeded.',
        429,
        { resetAt: quota.resetAt }
      );
    }
    remainingQuota = quota.remaining;
  } catch {
    return errorJson(
      'upstream_error',
      'Unable to verify quota right now.',
      503
    );
  }

  try {
    const { audioBytes, contentType } = await geminiService.runSpeak({
      text,
      persona,
    });
    const audioArrayBuffer = new ArrayBuffer(audioBytes.byteLength);
    new Uint8Array(audioArrayBuffer).set(audioBytes);
    return new Response(audioArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
        'X-Quota-Remaining': String(remainingQuota),
      },
    });
  } catch (err) {
    if (err instanceof GeminiUpstreamError) {
      return errorJson(
        err.errorCode,
        err.message,
        err.errorCode === 'timeout' ? 504 : 502,
        { upstreamStatus: err.upstreamStatus }
      );
    }
    return errorJson(
      'upstream_error',
      'Unable to synthesize voice audio right now.',
      502
    );
  }
});

app.route('/v1', v1);

app.notFound(() => errorJson('invalid_request', 'Endpoint not found.', 404));

const port = Number(cleanEnvValue(process.env.PORT) || 3000);
serve({
  fetch: app.fetch,
  port,
  hostname: '0.0.0.0',
});
console.log(`aiwake-api listening on port ${port}`);
