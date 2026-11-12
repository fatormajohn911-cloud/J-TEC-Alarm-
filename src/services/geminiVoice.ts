import { GoogleGenAI } from '@google/genai';

export type VoicePersona = 'warm' | 'coach' | 'executive';

const STATIC_VOICE_KEY = (import.meta.env.VITE_GEMINI_VOICE_KEY as string | undefined)?.trim();
const VOICE_MODEL = 'gemini-3.8-flash-lite-tts';
const VOICE_PERSONA_CONFIG: Record<VoicePersona, { voiceName: string; style: string }> = {
  warm: {
    voiceName: 'Zephyr',
    style: 'Warm, serene, gentle and soothing morning companion voice with calm natural pacing',
  },
  coach: {
    voiceName: 'Fenrir',
    style: 'Upbeat, energetic, encouraging morning fitness coach voice with confident clarity',
  },
  executive: {
    voiceName: 'Kore',
    style: 'Crisp, composed, articulate executive briefing voice with steady focus',
  },
};

export type VoicePlaybackPhase = 'idle' | 'loading' | 'playing';

export interface VoicePlaybackSnapshot {
  activeKey: string | null;
  phase: VoicePlaybackPhase;
}

interface VoiceCacheRecord {
  key: string;
  audioBuffer: ArrayBuffer;
  mimeType: string;
  byteSize: number;
  createdAt: number;
  lastAccessedAt: number;
}

const DB_NAME = 'ai_wake_voice_cache_db';
const DB_VERSION = 1;
const STORE_NAME = 'audio_clips';
const MAX_CACHE_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_SPEECH_CHARS = 600;

const PERSONA_SAMPLE_TEXT: Record<VoicePersona, string> = {
  warm: 'Good morning. Take a calm breath and ease gently into your day.',
  coach: "Rise and shine! Today is full of momentum — let's make it count!",
  executive: 'Good morning. Your morning schedule is aligned and ready to begin.',
};

let currentAudioElement: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;
let currentSnapshot: VoicePlaybackSnapshot = { activeKey: null, phase: 'idle' };
let activeRequestToken = 0;

const listeners = new Set<(snapshot: VoicePlaybackSnapshot) => void>();

function notifyListeners(next: VoicePlaybackSnapshot) {
  currentSnapshot = next;
  listeners.forEach((cb) => cb(next));
}

export function subscribeVoicePlayback(
  listener: (snapshot: VoicePlaybackSnapshot) => void
): () => void {
  listeners.add(listener);
  listener(currentSnapshot);
  return () => {
    listeners.delete(listener);
  };
}

export function getVoicePlaybackSnapshot(): VoicePlaybackSnapshot {
  return currentSnapshot;
}

export function stripMarkdownForSpeech(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*[-*•◦]\s+/gm, '')
    .replace(/[*#`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function prepareTextForSpeech(raw: string): string {
  const cleaned = stripMarkdownForSpeech(raw);
  if (cleaned.length <= MAX_SPEECH_CHARS) {
    return cleaned;
  }

  const slice = cleaned.slice(0, MAX_SPEECH_CHARS - 20);
  const lastSentenceEnd = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? ')
  );

  if (lastSentenceEnd > 140) {
    return slice.slice(0, lastSentenceEnd + 1).trim();
  }

  const lastSpace = slice.lastIndexOf(' ');
  const trimmed = lastSpace > 100 ? slice.slice(0, lastSpace) : slice;
  return `${trimmed.trim()}.`;
}

function hashCacheKey(spokenText: string, persona: VoicePersona): string {
  const input = `${persona}::${spokenText}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= code + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `v1_${(h1 >>> 0).toString(16)}_${(h2 >>> 0).toString(16)}_${input.length}`;
}

function openCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open voice cache DB'));
  });
}

async function getCachedClip(key: string): Promise<VoiceCacheRecord | null> {
  try {
    const db = await openCacheDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(key);
      getReq.onsuccess = () => {
        const rec = getReq.result as VoiceCacheRecord | undefined;
        if (rec && rec.audioBuffer) {
          rec.lastAccessedAt = Date.now();
          try {
            store.put(rec);
          } catch {
            // ignore touch error
          }
          resolve(rec);
        } else {
          resolve(null);
        }
      };
      getReq.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
      tx.onerror = () => db.close();
    });
  } catch {
    return null;
  }
}

async function evictIfOverLimit(db: IDBDatabase): Promise<void> {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getAllReq = store.getAll();
    getAllReq.onsuccess = () => {
      const records = (getAllReq.result as VoiceCacheRecord[]) || [];
      let total = records.reduce((sum, r) => sum + (r.byteSize || 0), 0);
      if (total <= MAX_CACHE_BYTES) {
        resolve();
        return;
      }
      records.sort((a, b) => (a.lastAccessedAt || 0) - (b.lastAccessedAt || 0));
      for (const rec of records) {
        if (total <= MAX_CACHE_BYTES) break;
        store.delete(rec.key);
        total -= rec.byteSize || 0;
      }
      resolve();
    };
    getAllReq.onerror = () => resolve();
  });
}

async function storeCachedClip(record: VoiceCacheRecord): Promise<void> {
  try {
    const db = await openCacheDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(record);
      tx.oncomplete = async () => {
        await evictIfOverLimit(db);
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // ignore cache write failure
  }
}

export async function getVoiceCacheStats(): Promise<{
  totalBytes: number;
  clipCount: number;
}> {
  try {
    const db = await openCacheDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const records = (req.result as VoiceCacheRecord[]) || [];
        const totalBytes = records.reduce((sum, r) => sum + (r.byteSize || 0), 0);
        resolve({ totalBytes, clipCount: records.length });
      };
      req.onerror = () => resolve({ totalBytes: 0, clipCount: 0 });
      tx.oncomplete = () => db.close();
    });
  } catch {
    return { totalBytes: 0, clipCount: 0 };
  }
}

export async function clearVoiceCache(): Promise<void> {
  try {
    const db = await openCacheDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // ignore
  }
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
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

function wrapPcmInWavHeader(
  pcmBytes: Uint8Array,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;

  const writeAscii = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + pcmBytes.length, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(36, 'data');
  view.setUint32(40, pcmBytes.length, true);

  const wavBytes = new Uint8Array(44 + pcmBytes.length);
  wavBytes.set(new Uint8Array(header), 0);
  wavBytes.set(pcmBytes, 44);
  return wavBytes;
}

function ensurePlayableAudioBuffer(
  base64: string,
  mimeType: string
): { buffer: ArrayBuffer; finalMimeType: string } {
  const rawBytes = base64ToBytes(base64);

  // If PCM / headerless or non-RIFF wav/l16, wrap in WAV header
  const needsWavHeader =
    mimeType.includes('l16') ||
    mimeType.includes('pcm') ||
    (mimeType.includes('wav') && !hasRiffWavHeader(rawBytes));

  const finalBytes = needsWavHeader ? wrapPcmInWavHeader(rawBytes) : rawBytes;
  const exactCopy = new Uint8Array(finalBytes.length);
  exactCopy.set(finalBytes);

  return {
    buffer: exactCopy.buffer,
    finalMimeType: needsWavHeader ? 'audio/wav' : mimeType || 'audio/wav',
  };
}

export function stopVoicePlayback(): void {
  activeRequestToken++;
  if (currentAudioElement) {
    try {
      currentAudioElement.pause();
      currentAudioElement.currentTime = 0;
    } catch {
      // ignore
    }
    currentAudioElement = null;
  }
  if (currentObjectUrl) {
    try {
      URL.revokeObjectURL(currentObjectUrl);
    } catch {
      // ignore
    }
    currentObjectUrl = null;
  }
  if (currentSnapshot.activeKey !== null || currentSnapshot.phase !== 'idle') {
    notifyListeners({ activeKey: null, phase: 'idle' });
  }
}

export async function getOrGenerateVoiceBlob(
  rawText: string,
  persona: VoicePersona = 'warm'
): Promise<Blob> {
  const spokenText = prepareTextForSpeech(rawText);
  if (!spokenText) {
    throw new Error('Cannot synthesize empty text.');
  }

  const cacheKey = hashCacheKey(spokenText, persona);
  const cached = await getCachedClip(cacheKey);
  if (cached) {
    return new Blob([cached.audioBuffer], { type: cached.mimeType || 'audio/wav' });
  }

  let audioBase64: string | undefined;
  let mimeType = 'audio/wav';

  try {
    const response = await fetch('/api/voice/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: spokenText, persona }),
    });

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      if (response.ok) {
        const data = (await response.json()) as {
          audioBase64?: string;
          mimeType?: string;
        };
        audioBase64 = data.audioBase64;
        mimeType = data.mimeType || 'audio/wav';
      } else {
        const errData = (await response.json().catch(() => ({}))) as {
          code?: string;
          error?: string;
        };
        if (errData.code !== 'MISSING_KEY' && response.status !== 404 && response.status !== 503) {
          throw new Error(errData.error || `Voice TTS error (${response.status})`);
        }
      }
    }
  } catch (err) {
    if (!STATIC_VOICE_KEY) {
      throw err instanceof Error
        ? err
        : new Error('Voice API key is not configured on the server.');
    }
  }

  if (!audioBase64 && STATIC_VOICE_KEY) {
    const voiceCfg = VOICE_PERSONA_CONFIG[persona] || VOICE_PERSONA_CONFIG.warm;
    const ai = new GoogleGenAI({ apiKey: STATIC_VOICE_KEY });
    const response = await ai.models.generateContent({
      model: VOICE_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${voiceCfg.style}: ${spokenText}`,
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceCfg.voiceName,
            },
          },
        },
      },
    });
    const inlinePart = response.candidates?.[0]?.content?.parts?.find(
      (p) => p.inlineData?.data
    )?.inlineData;
    audioBase64 = inlinePart?.data;
    mimeType = inlinePart?.mimeType || 'audio/wav';
  }

  if (!audioBase64) {
    throw new Error('Voice API key is not configured or no audio was returned.');
  }

  const { buffer, finalMimeType } = ensurePlayableAudioBuffer(audioBase64, mimeType);

  const now = Date.now();
  await storeCachedClip({
    key: cacheKey,
    audioBuffer: buffer,
    mimeType: finalMimeType,
    byteSize: buffer.byteLength,
    createdAt: now,
    lastAccessedAt: now,
  });

  return new Blob([buffer], { type: finalMimeType });
}

export async function speakText(options: {
  text: string;
  persona?: VoicePersona;
  speechRate?: number;
  playbackId?: string;
  onEnded?: () => void;
}): Promise<void> {
  const {
    text,
    persona = 'warm',
    speechRate = 1.0,
    playbackId = 'default',
    onEnded,
  } = options;

  stopVoicePlayback();
  const requestToken = ++activeRequestToken;
  notifyListeners({ activeKey: playbackId, phase: 'loading' });

  try {
    const blob = await getOrGenerateVoiceBlob(text, persona);

    // Bail out if another clip or stop happened while fetching
    if (requestToken !== activeRequestToken) {
      return;
    }

    const blobUrl = URL.createObjectURL(blob);
    currentObjectUrl = blobUrl;

    const audio = new Audio(blobUrl);
    audio.playbackRate = Math.min(1.5, Math.max(0.7, speechRate));
    currentAudioElement = audio;

    notifyListeners({ activeKey: playbackId, phase: 'playing' });

    await new Promise<void>((resolve, reject) => {
      audio.onended = () => {
        if (requestToken === activeRequestToken) {
          stopVoicePlayback();
        }
        onEnded?.();
        resolve();
      };
      audio.onerror = () => {
        if (requestToken === activeRequestToken) {
          stopVoicePlayback();
        }
        onEnded?.();
        reject(new Error('Audio playback failed.'));
      };
      audio.play().catch((err) => {
        if (requestToken === activeRequestToken) {
          stopVoicePlayback();
        }
        onEnded?.();
        reject(err);
      });
    });
  } catch (err) {
    if (requestToken === activeRequestToken) {
      stopVoicePlayback();
    }
    throw err;
  }
}

export async function playTestTone(
  persona: VoicePersona = 'warm',
  speechRate: number = 1.0,
  onEnded?: () => void
): Promise<void> {
  const sampleText = PERSONA_SAMPLE_TEXT[persona] || PERSONA_SAMPLE_TEXT.warm;
  return speakText({
    text: sampleText,
    persona,
    speechRate,
    playbackId: 'settings_test_tone',
    onEnded,
  });
}
