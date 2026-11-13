export type BackendReachabilityStatus =
  | 'unconfigured'
  | 'waking'
  | 'reachable'
  | 'unreachable';

export interface BackendConfig {
  minAppVersion: string;
  aiEnabled: boolean;
  quotas?: {
    chatPerDay?: number;
    speakPerDay?: number;
    ipPerDay?: number;
    registerPerIpPerDay?: number;
  };
  maxMessageChars?: number;
}

export interface BackendStateSnapshot {
  configured: boolean;
  baseUrlHost: string;
  status: BackendReachabilityStatus;
  registered: boolean;
  chatRemaining: number | null;
  speakRemaining: number | null;
  config: BackendConfig | null;
  updateRequired: boolean;
  lastCheckedAt: number | null;
}

export class BackendApiError extends Error {
  status: number | null;
  code: string;
  resetAt?: string;

  constructor(params: {
    message: string;
    code: string;
    status?: number | null;
    resetAt?: string;
  }) {
    super(params.message);
    this.name = 'BackendApiError';
    this.code = params.code;
    this.status = params.status ?? null;
    this.resetAt = params.resetAt;
  }
}

const INSTALL_ID_STORAGE_KEY = 'ai_wake_install_id_v1';
const DEVICE_TOKEN_STORAGE_KEY = 'ai_wake_device_token_v1';

const RAW_API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)
    ?.trim()
    .replace(/\/+$/, '') || '';

const FIRST_REQUEST_TIMEOUT_MS = 60_000;
const SUBSEQUENT_REQUEST_TIMEOUT_MS = 25_000;
const SLOW_WAIT_THRESHOLD_MS = 4_000;

let hasCompletedFirstApiCall = false;
let registrationPromise: Promise<string> | null = null;
let warmUpPromise: Promise<BackendReachabilityStatus> | null = null;

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, val: string): void {
  try {
    localStorage.setItem(key, val);
  } catch {
    // ignore storage errors
  }
}

function removeStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function generateUuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function hasBackendConfigured(): boolean {
  return Boolean(RAW_API_BASE_URL);
}

export function getApiBaseUrl(): string {
  return RAW_API_BASE_URL;
}

export function getApiBaseUrlHost(): string {
  if (!RAW_API_BASE_URL) return 'Not configured';
  try {
    return new URL(RAW_API_BASE_URL).host;
  } catch {
    return RAW_API_BASE_URL;
  }
}

export function getOrCreateInstallId(): string {
  const existing = readStorage(INSTALL_ID_STORAGE_KEY)?.trim();
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (existing && uuidRegex.test(existing)) {
    return existing;
  }
  const created = generateUuidV4();
  writeStorage(INSTALL_ID_STORAGE_KEY, created);
  return created;
}

export function isDeviceRegistered(): boolean {
  return Boolean(readStorage(DEVICE_TOKEN_STORAGE_KEY)?.trim());
}

export function compareSemver(current: string, minimum: string): number {
  const parse = (v: string) =>
    v
      .replace(/^v/i, '')
      .split('-')[0]
      .split('.')
      .map((n) => parseInt(n, 10) || 0);
  const a = parse(current);
  const b = parse(minimum);
  const len = Math.max(a.length, b.length, 3);
  for (let i = 0; i < len; i++) {
    const va = a[i] ?? 0;
    const vb = b[i] ?? 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }
  return 0;
}

function getCurrentAppVersion(): string {
  return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';
}

let stateSnapshot: BackendStateSnapshot = {
  configured: hasBackendConfigured(),
  baseUrlHost: getApiBaseUrlHost(),
  status: hasBackendConfigured() ? 'waking' : 'unconfigured',
  registered: isDeviceRegistered(),
  chatRemaining: null,
  speakRemaining: null,
  config: null,
  updateRequired: false,
  lastCheckedAt: null,
};

const stateListeners = new Set<(snapshot: BackendStateSnapshot) => void>();

function updateBackendState(partial: Partial<BackendStateSnapshot>): void {
  stateSnapshot = {
    ...stateSnapshot,
    ...partial,
  };
  stateListeners.forEach((cb) => cb(stateSnapshot));
}

export function getBackendStateSnapshot(): BackendStateSnapshot {
  return stateSnapshot;
}

export function subscribeBackendState(
  listener: (snapshot: BackendStateSnapshot) => void
): () => void {
  stateListeners.add(listener);
  listener(stateSnapshot);
  return () => {
    stateListeners.delete(listener);
  };
}

function parseErrorPayload(
  rawJson: unknown,
  status: number
): { code: string; message: string; resetAt?: string } {
  const rec = rawJson as {
    error?: { code?: string; message?: string; resetAt?: string } | string;
    code?: string;
    message?: string;
  } | null;

  if (rec?.error && typeof rec.error === 'object') {
    const code = rec.error.code || 'upstream_error';
    const resetAt = rec.error.resetAt;
    if (code === 'quota_exceeded') {
      return {
        code,
        message: "You've reached today's AI limit. It resets tomorrow.",
        resetAt,
      };
    }
    return {
      code,
      message: rec.error.message || `Request failed (${status}).`,
      resetAt,
    };
  }

  const code = rec?.code || (status === 429 ? 'quota_exceeded' : 'upstream_error');
  const message =
    code === 'quota_exceeded'
      ? "You've reached today's AI limit. It resets tomorrow."
      : typeof rec?.error === 'string'
      ? rec.error
      : rec?.message || `Request failed (${status}).`;

  return { code, message };
}

function isNetworkFailureError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof DOMException && err.name === 'AbortError') return false;
  if (err instanceof TypeError) return true;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network error') ||
    msg.includes('load failed') ||
    msg.includes('network request failed')
  );
}

async function fetchWithTimeoutAndRetry(
  url: string,
  init: RequestInit,
  options: {
    timeoutMs: number;
    onSlowWait?: (isSlow: boolean) => void;
    retryOnNetworkError?: boolean;
  }
): Promise<Response> {
  const { timeoutMs, onSlowWait, retryOnNetworkError = true } = options;

  let slowTimer: number | null = null;
  let notifiedSlow = false;
  if (onSlowWait) {
    slowTimer = window.setTimeout(() => {
      notifiedSlow = true;
      onSlowWait(true);
    }, SLOW_WAIT_THRESHOLD_MS);
  }

  try {
    const maxAttempts = retryOnNetworkError ? 2 : 1;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(url, {
          ...init,
          signal: controller.signal,
        });
        window.clearTimeout(timeoutId);
        return res;
      } catch (err) {
        window.clearTimeout(timeoutId);
        lastError = err;

        if (controller.signal.aborted) {
          throw new BackendApiError({
            code: 'timeout',
            status: 504,
            message: 'The AI server took too long to respond. Please try again.',
          });
        }

        if (isNetworkFailureError(err) && attempt < maxAttempts - 1) {
          continue;
        }
        throw err;
      }
    }

    throw lastError;
  } finally {
    if (slowTimer !== null) {
      window.clearTimeout(slowTimer);
    }
    if (notifiedSlow && onSlowWait) {
      onSlowWait(false);
    }
  }
}

export async function warmUpBackend(): Promise<BackendReachabilityStatus> {
  if (!RAW_API_BASE_URL) {
    updateBackendState({
      configured: false,
      baseUrlHost: 'Not configured',
      status: 'unconfigured',
    });
    return 'unconfigured';
  }

  if (warmUpPromise) {
    return warmUpPromise;
  }

  updateBackendState({ status: 'waking' });

  warmUpPromise = (async (): Promise<BackendReachabilityStatus> => {
    try {
      const res = await fetchWithTimeoutAndRetry(
        `${RAW_API_BASE_URL}/v1/health`,
        { method: 'GET' },
        { timeoutMs: FIRST_REQUEST_TIMEOUT_MS, retryOnNetworkError: true }
      );

      if (res.ok) {
        hasCompletedFirstApiCall = true;
        updateBackendState({
          status: 'reachable',
          lastCheckedAt: Date.now(),
        });
        return 'reachable';
      }

      updateBackendState({
        status: 'unreachable',
        lastCheckedAt: Date.now(),
      });
      return 'unreachable';
    } catch {
      updateBackendState({
        status: 'unreachable',
        lastCheckedAt: Date.now(),
      });
      return 'unreachable';
    } finally {
      warmUpPromise = null;
    }
  })();

  return warmUpPromise;
}

export async function fetchBackendConfig(): Promise<BackendConfig | null> {
  if (!RAW_API_BASE_URL) {
    return null;
  }

  try {
    const res = await fetchWithTimeoutAndRetry(
      `${RAW_API_BASE_URL}/v1/config`,
      { method: 'GET' },
      {
        timeoutMs: hasCompletedFirstApiCall
          ? SUBSEQUENT_REQUEST_TIMEOUT_MS
          : FIRST_REQUEST_TIMEOUT_MS,
        retryOnNetworkError: true,
      }
    );

    if (!res.ok) {
      return null;
    }

    const cfg = (await res.json()) as BackendConfig;
    hasCompletedFirstApiCall = true;
    const minVer = typeof cfg.minAppVersion === 'string' ? cfg.minAppVersion : '1.0.0';
    const needsUpdate = compareSemver(getCurrentAppVersion(), minVer) < 0;

    updateBackendState({
      status: 'reachable',
      config: cfg,
      updateRequired: needsUpdate,
      lastCheckedAt: Date.now(),
    });
    return cfg;
  } catch {
    return null;
  }
}

export async function ensureRegistered(forceRefresh = false): Promise<string> {
  if (!RAW_API_BASE_URL) {
    throw new BackendApiError({
      code: 'unconfigured',
      message: 'Backend API base URL is not configured.',
    });
  }

  if (!forceRefresh) {
    const cachedToken = readStorage(DEVICE_TOKEN_STORAGE_KEY)?.trim();
    if (cachedToken) {
      return cachedToken;
    }
  } else {
    removeStorage(DEVICE_TOKEN_STORAGE_KEY);
    updateBackendState({ registered: false });
  }

  if (registrationPromise && !forceRefresh) {
    return registrationPromise;
  }

  registrationPromise = (async () => {
    const installId = getOrCreateInstallId();
    const timeoutMs = hasCompletedFirstApiCall
      ? SUBSEQUENT_REQUEST_TIMEOUT_MS
      : FIRST_REQUEST_TIMEOUT_MS;

    const res = await fetchWithTimeoutAndRetry(
      `${RAW_API_BASE_URL}/v1/register`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installId }),
      },
      { timeoutMs, retryOnNetworkError: true }
    );

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      const parsed = parseErrorPayload(errJson, res.status);
      throw new BackendApiError({
        code: parsed.code,
        message: parsed.message,
        status: res.status,
        resetAt: parsed.resetAt,
      });
    }

    const data = (await res.json()) as { token?: string };
    const token = data.token?.trim();
    if (!token) {
      throw new BackendApiError({
        code: 'upstream_error',
        status: 502,
        message: 'Server returned an invalid registration response.',
      });
    }

    hasCompletedFirstApiCall = true;
    writeStorage(DEVICE_TOKEN_STORAGE_KEY, token);
    updateBackendState({
      registered: true,
      status: 'reachable',
      lastCheckedAt: Date.now(),
    });
    return token;
  })();

  try {
    return await registrationPromise;
  } finally {
    registrationPromise = null;
  }
}

async function performAuthenticatedBackendRequest(
  path: string,
  body: unknown,
  options?: { onSlowWait?: (isSlow: boolean) => void }
): Promise<Response> {
  if (!RAW_API_BASE_URL) {
    throw new BackendApiError({
      code: 'unconfigured',
      message: 'Backend API base URL is not configured.',
    });
  }

  const timeoutMs = hasCompletedFirstApiCall
    ? SUBSEQUENT_REQUEST_TIMEOUT_MS
    : FIRST_REQUEST_TIMEOUT_MS;

  let token = await ensureRegistered(false);

  for (let authAttempt = 0; authAttempt < 2; authAttempt++) {
    let res: Response;
    try {
      res = await fetchWithTimeoutAndRetry(
        `${RAW_API_BASE_URL}${path}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        },
        {
          timeoutMs,
          onSlowWait: options?.onSlowWait,
          retryOnNetworkError: true,
        }
      );
    } catch (err) {
      if (err instanceof BackendApiError && err.code === 'timeout') {
        throw err;
      }
      if (isNetworkFailureError(err)) {
        updateBackendState({ status: 'unreachable', lastCheckedAt: Date.now() });
      }
      throw err;
    }

    if (res.status === 401 && authAttempt === 0) {
      token = await ensureRegistered(true);
      continue;
    }

    return res;
  }

  throw new BackendApiError({
    code: 'unauthorized',
    status: 401,
    message: 'Unable to authenticate this device.',
  });
}

export async function postChat(
  payload: {
    messages: unknown[];
    context?: Record<string, unknown>;
    tools?: unknown[];
  },
  options?: { onSlowWait?: (isSlow: boolean) => void }
): Promise<{
  parts: Array<{
    text?: string;
    functionCall?: {
      id?: string;
      name?: string;
      args?: Record<string, unknown>;
    };
    thoughtSignature?: string;
  }>;
  modelContent?: unknown;
}> {
  const res = await performAuthenticatedBackendRequest('/v1/chat', payload, options);

  if (!res.ok) {
    const errJson = await res.json().catch(() => null);
    const parsed = parseErrorPayload(errJson, res.status);
    if (parsed.code === 'quota_exceeded') {
      updateBackendState({ chatRemaining: 0 });
    } else if (parsed.code === 'ai_disabled' && stateSnapshot.config) {
      updateBackendState({
        config: { ...stateSnapshot.config, aiEnabled: false },
      });
    }
    throw new BackendApiError({
      code: parsed.code,
      message: parsed.message,
      status: res.status,
      resetAt: parsed.resetAt,
    });
  }

  hasCompletedFirstApiCall = true;
  const remainingHeader = res.headers.get('x-quota-remaining');
  const remaining =
    remainingHeader !== null && /^\d+$/.test(remainingHeader.trim())
      ? Number(remainingHeader.trim())
      : stateSnapshot.chatRemaining;

  updateBackendState({
    status: 'reachable',
    chatRemaining: remaining,
    lastCheckedAt: Date.now(),
  });

  return (await res.json()) as {
    parts: Array<{
      text?: string;
      functionCall?: {
        id?: string;
        name?: string;
        args?: Record<string, unknown>;
      };
      thoughtSignature?: string;
    }>;
    modelContent?: unknown;
  };
}

export async function postSpeak(
  payload: {
    text: string;
    persona: string;
  },
  options?: { onSlowWait?: (isSlow: boolean) => void }
): Promise<Blob> {
  const res = await performAuthenticatedBackendRequest('/v1/speak', payload, options);

  if (!res.ok) {
    const errJson = await res.json().catch(() => null);
    const parsed = parseErrorPayload(errJson, res.status);
    if (parsed.code === 'quota_exceeded') {
      updateBackendState({ speakRemaining: 0 });
    } else if (parsed.code === 'ai_disabled' && stateSnapshot.config) {
      updateBackendState({
        config: { ...stateSnapshot.config, aiEnabled: false },
      });
    }
    throw new BackendApiError({
      code: parsed.code,
      message: parsed.message,
      status: res.status,
      resetAt: parsed.resetAt,
    });
  }

  hasCompletedFirstApiCall = true;
  const remainingHeader = res.headers.get('x-quota-remaining');
  const remaining =
    remainingHeader !== null && /^\d+$/.test(remainingHeader.trim())
      ? Number(remainingHeader.trim())
      : stateSnapshot.speakRemaining;

  updateBackendState({
    status: 'reachable',
    speakRemaining: remaining,
    lastCheckedAt: Date.now(),
  });

  return await res.blob();
}

export async function checkBackendNetworkHealth(): Promise<{
  ok: boolean;
  message: string;
  httpStatus?: number | null;
  apiMessage?: string;
}> {
  try {
    const res = await fetchWithTimeoutAndRetry(
      `${RAW_API_BASE_URL}/v1/health`,
      { method: 'GET' },
      { timeoutMs: FIRST_REQUEST_TIMEOUT_MS, retryOnNetworkError: true }
    );
    if (!res.ok) {
      updateBackendState({ status: 'unreachable', lastCheckedAt: Date.now() });
      return {
        ok: false,
        message: `Backend returned HTTP ${res.status}.`,
        httpStatus: res.status,
        apiMessage: `HTTP ${res.status}`,
      };
    }

    hasCompletedFirstApiCall = true;
    await fetchBackendConfig();
    await ensureRegistered(false);

    updateBackendState({
      status: 'reachable',
      lastCheckedAt: Date.now(),
    });

    return {
      ok: true,
      message: `OK — Connected to ${getApiBaseUrlHost()}.`,
    };
  } catch (err) {
    updateBackendState({ status: 'unreachable', lastCheckedAt: Date.now() });
    const msg = err instanceof Error ? err.message : String(err);
    const httpStatus = err instanceof BackendApiError ? err.status : null;
    return {
      ok: false,
      message: msg,
      httpStatus,
      apiMessage: msg,
    };
  }
}
