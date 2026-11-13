import { Capacitor } from '@capacitor/core';

export type AiErrorCategory =
  | 'no_internet'
  | 'missing_key'
  | 'invalid_key'
  | 'quota_exceeded'
  | 'key_restricted'
  | 'network_error'
  | 'unknown';

export interface ParsedAiError {
  category: AiErrorCategory;
  plainReason: string;
  httpStatus: number | null;
  apiMessage: string;
}

const API_KEY_PATTERN = /AIza[0-9A-Za-z_-]{10,}/g;
const QUERY_KEY_PATTERN = /([?&]key=)[^&\s"']+/gi;

export function sanitizeApiErrorText(text: string): string {
  return text
    .replace(API_KEY_PATTERN, '[REDACTED_KEY]')
    .replace(QUERY_KEY_PATTERN, '$1[REDACTED_KEY]')
    .trim();
}

function tryExtractNestedJsonError(raw: string): {
  code?: number;
  message?: string;
  statusText?: string;
} {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return {};
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      error?: {
        code?: number;
        message?: string;
        status?: string;
      };
      code?: number | string;
      message?: string;
      status?: string;
    };
    if (parsed.error && typeof parsed.error === 'object') {
      return {
        code: typeof parsed.error.code === 'number' ? parsed.error.code : undefined,
        message: typeof parsed.error.message === 'string' ? parsed.error.message : undefined,
        statusText: typeof parsed.error.status === 'string' ? parsed.error.status : undefined,
      };
    }
    return {
      code: typeof parsed.code === 'number' ? parsed.code : undefined,
      message:
        typeof parsed.message === 'string'
          ? parsed.message
          : typeof parsed.error === 'string'
          ? parsed.error
          : undefined,
      statusText: typeof parsed.status === 'string' ? parsed.status : undefined,
    };
  } catch {
    return {};
  }
}

function extractHttpStatus(err: unknown, rawText: string, jsonCode?: number): number | null {
  if (err && typeof err === 'object') {
    const rec = err as { status?: unknown; httpStatus?: unknown; statusCode?: unknown };
    for (const candidate of [rec.httpStatus, rec.status, rec.statusCode]) {
      if (typeof candidate === 'number' && candidate >= 400 && candidate < 600) {
        return candidate;
      }
    }
  }
  if (typeof jsonCode === 'number' && jsonCode >= 400 && jsonCode < 600) {
    return jsonCode;
  }
  const match = rawText.match(/\b(400|401|403|404|408|429|500|502|503|504)\b/);
  if (match) {
    return Number(match[1]);
  }
  return null;
}

export function parseAiErrorDetails(err: unknown): ParsedAiError {
  if (err instanceof AiRequestError) {
    return err.details;
  }

  const rawOriginal =
    err instanceof Error
      ? err.message
      : err && typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string'
      ? String((err as { message: string }).message)
      : String(err || 'Unknown error');

  const rawSanitized = sanitizeApiErrorText(rawOriginal);
  const jsonInfo = tryExtractNestedJsonError(rawSanitized);
  const httpStatus = extractHttpStatus(err, rawSanitized, jsonInfo.code);

  const errCode =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';

  const cleanApiMsg = sanitizeApiErrorText(
    jsonInfo.message ||
      (rawSanitized.startsWith('{') ? '' : rawSanitized.split('\n')[0]) ||
      jsonInfo.statusText ||
      rawSanitized
  ).slice(0, 300);

  const combinedUpper = `${errCode} ${jsonInfo.statusText || ''} ${cleanApiMsg} ${rawSanitized}`.toUpperCase();

  const isOffline =
    typeof navigator !== 'undefined' && navigator.onLine === false;
  const isNetworkFailure =
    combinedUpper.includes('FAILED TO FETCH') ||
    combinedUpper.includes('NETWORKERROR') ||
    combinedUpper.includes('NETWORK ERROR') ||
    combinedUpper.includes('LOAD FAILED') ||
    combinedUpper.includes('ERR_INTERNET_DISCONNECTED') ||
    combinedUpper.includes('ERR_NAME_NOT_RESOLVED') ||
    combinedUpper.includes('ENOTFOUND') ||
    combinedUpper.includes('ECONNREFUSED') ||
    combinedUpper.includes('TIMED OUT');

  if (isOffline || isNetworkFailure) {
    return {
      category: 'no_internet',
      plainReason: isOffline
        ? 'No internet connection. Connect to Wi-Fi or mobile data and try again.'
        : 'No internet or unable to reach the API server. Check your connection and try again.',
      httpStatus,
      apiMessage: cleanApiMsg || 'Network request failed',
    };
  }

  if (errCode === 'unconfigured' || errCode === 'MISSING_KEY' || combinedUpper.includes('NOT CONFIGURED') || combinedUpper.includes('KEY IS MISSING')) {
    return {
      category: 'missing_key',
      plainReason: 'AI is not configured on this build. Add a developer API key in Settings > Developer / API Keys or configure VITE_API_BASE_URL.',
      httpStatus,
      apiMessage: cleanApiMsg || 'API is not configured.',
    };
  }

  if (errCode === 'ai_disabled') {
    return {
      category: 'unknown',
      plainReason: 'AI features are temporarily paused by the server.',
      httpStatus: httpStatus ?? 503,
      apiMessage: cleanApiMsg || 'AI features are temporarily disabled.',
    };
  }

  if (errCode === 'timeout' || httpStatus === 504) {
    return {
      category: 'network_error',
      plainReason: 'The AI server took too long to respond (it may be waking up). Please try again.',
      httpStatus: httpStatus ?? 504,
      apiMessage: cleanApiMsg || 'Request timed out.',
    };
  }

  if (
    errCode === 'quota_exceeded' ||
    httpStatus === 429 ||
    combinedUpper.includes('RESOURCE_EXHAUSTED') ||
    combinedUpper.includes('QUOTA') ||
    combinedUpper.includes('RATE LIMIT') ||
    combinedUpper.includes('RATE_LIMIT')
  ) {
    return {
      category: 'quota_exceeded',
      plainReason:
        errCode === 'quota_exceeded'
          ? "You've reached today's AI limit. It resets tomorrow."
          : 'Quota exceeded. Wait a bit or try again tomorrow.',
      httpStatus: httpStatus ?? 429,
      apiMessage: cleanApiMsg || 'Quota exceeded.',
    };
  }

  const looksLikeRestriction =
    combinedUpper.includes('REFERER') ||
    combinedUpper.includes('REFERRER') ||
    combinedUpper.includes('HTTP_REFERRER') ||
    combinedUpper.includes('API_KEY_HTTP_REFERRER_BLOCKED') ||
    combinedUpper.includes('API_KEY_ANDROID_APP_BLOCKED') ||
    combinedUpper.includes('API_KEY_IOS_APP_BLOCKED') ||
    combinedUpper.includes('API_KEY_IP_ADDRESS_BLOCKED') ||
    combinedUpper.includes('API_KEY_SERVICE_BLOCKED') ||
    combinedUpper.includes('REQUESTS FROM REFERER') ||
    combinedUpper.includes('ARE BLOCKED') ||
    combinedUpper.includes('IP ADDRESS') ||
    combinedUpper.includes('RESTRICTION');

  if (
    looksLikeRestriction ||
    (httpStatus === 403 && !combinedUpper.includes('API_KEY_INVALID') && !combinedUpper.includes('API KEY NOT VALID'))
  ) {
    return {
      category: 'key_restricted',
      plainReason:
        'Blocked by API key restrictions (HTTP referrer, app package, or API restrictions on this key).',
      httpStatus: httpStatus ?? 403,
      apiMessage: cleanApiMsg || 'Permission denied / request blocked.',
    };
  }

  if (
    httpStatus === 401 ||
    combinedUpper.includes('API_KEY_INVALID') ||
    combinedUpper.includes('API KEY NOT VALID') ||
    combinedUpper.includes('INVALID API KEY') ||
    combinedUpper.includes('UNAUTHENTICATED') ||
    (httpStatus === 400 && combinedUpper.includes('API KEY'))
  ) {
    return {
      category: 'invalid_key',
      plainReason: 'Invalid API key. Double-check the key saved in Settings > Developer / API Keys.',
      httpStatus: httpStatus ?? 400,
      apiMessage: cleanApiMsg || 'API key not valid.',
    };
  }

  if (combinedUpper.includes('PERMISSION_DENIED')) {
    return {
      category: 'key_restricted',
      plainReason: 'Blocked by API key restrictions or missing API permissions.',
      httpStatus: httpStatus ?? 403,
      apiMessage: cleanApiMsg || 'Permission denied.',
    };
  }

  return {
    category: 'unknown',
    plainReason: httpStatus
      ? `API returned HTTP ${httpStatus}. Check the API message below.`
      : 'Request failed before receiving a valid response.',
    httpStatus,
    apiMessage: cleanApiMsg || 'Unknown API error.',
  };
}

export class AiRequestError extends Error {
  code?: string;
  details: ParsedAiError;

  constructor(err: unknown, code?: string) {
    const parsed = parseAiErrorDetails(err);
    super(parsed.plainReason);
    this.name = 'AiRequestError';
    this.code = code;
    this.details = parsed;
  }
}

export function buildCopyableAiErrorReport(
  requestType: 'text' | 'voice' | 'network_check',
  details: ParsedAiError
): string {
  const platform = Capacitor.isNativePlatform() ? 'Android' : 'Web';
  const origin =
    typeof window !== 'undefined' && window.location
      ? window.location.origin
      : 'unknown';
  const online =
    typeof navigator !== 'undefined' ? String(navigator.onLine) : 'unknown';
  const buildId = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';
  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';

  return [
    `AI Wake Diagnostic Report`,
    `Request: ${requestType}`,
    `Reason: ${details.plainReason}`,
    `HTTP Status: ${details.httpStatus !== null ? details.httpStatus : 'N/A'}`,
    `API Message: ${details.apiMessage}`,
    `Platform: ${platform}`,
    `Origin: ${origin}`,
    `Online: ${online}`,
    `Version: v${appVersion} (build #${buildId})`,
  ].join('\n');
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback below
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
