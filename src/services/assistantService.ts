import { Alarm } from '../types/alarm';
import { ScheduleCategory, ScheduleRoutine } from '../types/schedule';
import { AppSettings } from '../types/settings';
import {
  AssistantActionResult,
  AssistantProposal,
  ChatMessage,
  ProposedAlarmData,
  ProposedDeleteData,
  ProposedRoutineItem,
} from '../types/assistant';
import { storageService } from './storageService';
import { requestAssistantTurn } from './geminiText';

const DAY_NAMES_FULL = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const WEATHER_CACHE_KEY = 'ai_wake_weather_cache_v1';
const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_HISTORY_MESSAGES = 10;

interface CachedWeatherEntry {
  cacheKey: string;
  timestamp: number;
  data: Record<string, unknown>;
}

let inMemoryWeatherCache: CachedWeatherEntry | null = null;

export function formatTimeDisplay(time24: string, timeFormat24h: boolean): string {
  const parts = time24.split(':').map(Number);
  const h = Number.isFinite(parts[0]) ? parts[0] : 7;
  const m = Number.isFinite(parts[1]) ? parts[1] : 0;
  if (timeFormat24h) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

export function formatDaysLabel(days: number[]): string {
  if (!days || days.length === 0) return 'Once';
  const sorted = Array.from(new Set(days))
    .filter((d) => d >= 0 && d <= 6)
    .sort((a, b) => a - b);
  if (sorted.length === 7) return 'Every day';
  if (sorted.length === 5 && sorted.join(',') === '1,2,3,4,5') return 'Weekdays';
  if (sorted.length === 2 && sorted.join(',') === '0,6') return 'Weekends';
  return sorted.map((d) => DAY_NAMES_SHORT[d]).join(', ');
}

export function formatTotalDuration(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function normalizeTime24(raw: unknown, fallback = '07:00'): string {
  if (typeof raw !== 'string') return fallback;
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const h = Math.min(23, Math.max(0, parseInt(match[1], 10)));
  const m = Math.min(59, Math.max(0, parseInt(match[2], 10)));
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function normalizeDays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    )
  ).sort((a, b) => a - b);
}

function inferRoutineCategory(title: string, time: string): ScheduleCategory {
  const lower = title.toLowerCase();
  if (/study|work|focus|class|lecture|exam|read|code|project/.test(lower)) return 'work';
  if (/gym|run|walk|stretch|yoga|workout|water|hydrat|health|meditat|sleep/.test(lower)) {
    return 'health';
  }
  if (/wind|evening|night|bed|sunset|journal/.test(lower)) return 'evening';
  const hour = parseInt(time.split(':')[0] || '8', 10);
  if (hour >= 5 && hour < 11) return 'morning_routine';
  if (hour >= 20) return 'evening';
  return 'task';
}

function describeWeatherCode(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code === 1) return 'Mainly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 55) return 'Light drizzle';
  if (code >= 56 && code <= 57) return 'Freezing drizzle';
  if (code >= 61 && code <= 65) return 'Rain';
  if (code >= 66 && code <= 67) return 'Freezing rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code >= 85 && code <= 86) return 'Snow showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Mixed conditions';
}

function getCachedWeather(cacheKey: string): Record<string, unknown> | null {
  const now = Date.now();
  if (
    inMemoryWeatherCache &&
    inMemoryWeatherCache.cacheKey === cacheKey &&
    now - inMemoryWeatherCache.timestamp < WEATHER_CACHE_TTL_MS
  ) {
    return inMemoryWeatherCache.data;
  }

  try {
    const raw = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedWeatherEntry;
    if (
      parsed &&
      parsed.cacheKey === cacheKey &&
      now - parsed.timestamp < WEATHER_CACHE_TTL_MS
    ) {
      inMemoryWeatherCache = parsed;
      return parsed.data;
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

function saveCachedWeather(cacheKey: string, data: Record<string, unknown>): void {
  const entry: CachedWeatherEntry = {
    cacheKey,
    timestamp: Date.now(),
    data,
  };
  inMemoryWeatherCache = entry;
  try {
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // ignore quota errors
  }
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation unavailable'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 5000,
      maximumAge: 300000,
    });
  });
}

async function fetchOpenMeteoForecast(
  lat: number,
  lon: number,
  locationLabel: string,
  cacheKey: string
): Promise<Record<string, unknown>> {
  const cached = getCachedWeather(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}` +
    `&longitude=${encodeURIComponent(lon)}` +
    `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&hourly=temperature_2m,weather_code,precipitation_probability` +
    `&timezone=auto&forecast_days=3`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Open-Meteo request failed (${res.status})`);
  }
  const data = await res.json();

  const current = data.current || {};
  const daily = data.daily || {};
  const hourly = data.hourly || {};

  const tomorrowMorningHours: Array<{
    time: string;
    tempC: number;
    condition: string;
    precipProb: number;
  }> = [];
  if (Array.isArray(hourly.time) && Array.isArray(daily.time) && daily.time[1]) {
    const tomorrowDate = daily.time[1];
    for (let i = 0; i < hourly.time.length; i++) {
      const t = hourly.time[i] as string;
      if (
        t.startsWith(tomorrowDate) &&
        (t.endsWith('07:00') || t.endsWith('08:00') || t.endsWith('09:00'))
      ) {
        tomorrowMorningHours.push({
          time: t.slice(11, 16),
          tempC: hourly.temperature_2m?.[i],
          condition: describeWeatherCode(Number(hourly.weather_code?.[i] ?? 0)),
          precipProb: hourly.precipitation_probability?.[i] ?? 0,
        });
      }
    }
  }

  const payload = {
    success: true,
    location: locationLabel,
    timezone: data.timezone,
    units: { temperature: '°C', windSpeed: 'km/h' },
    current: {
      temperatureC: current.temperature_2m,
      feelsLikeC: current.apparent_temperature,
      condition: describeWeatherCode(Number(current.weather_code ?? 0)),
      windKmh: current.wind_speed_10m,
    },
    dailyForecast: (daily.time || []).map((date: string, idx: number) => ({
      date,
      condition: describeWeatherCode(Number(daily.weather_code?.[idx] ?? 0)),
      tempMaxC: daily.temperature_2m_max?.[idx],
      tempMinC: daily.temperature_2m_min?.[idx],
      precipChancePercent: daily.precipitation_probability_max?.[idx],
    })),
    tomorrowMorning: tomorrowMorningHours,
  };

  saveCachedWeather(cacheKey, payload);
  return payload;
}

async function executeGetWeather(cityArg?: string): Promise<Record<string, unknown>> {
  const requestedCity = typeof cityArg === 'string' ? cityArg.trim() : '';

  const lookupCity = async (cityName: string) => {
    const cacheKey = `city:${cityName.toLowerCase()}`;
    const cached = getCachedWeather(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }

    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`
    );
    if (!geoRes.ok) {
      throw new Error('Failed to geocode city');
    }
    const geoData = await geoRes.json();
    const match = geoData.results?.[0];
    if (!match) {
      return {
        success: false,
        error: `Could not find a city named "${cityName}". Ask the user to clarify the city name.`,
      };
    }
    const resolvedLabel = [match.name, match.admin1, match.country]
      .filter(Boolean)
      .join(', ');
    storageService.saveWeatherCity(match.name);
    return await fetchOpenMeteoForecast(
      match.latitude,
      match.longitude,
      resolvedLabel,
      cacheKey
    );
  };

  if (requestedCity) {
    return await lookupCity(requestedCity);
  }

  // Check geolocation cache or live position
  try {
    const pos = await getCurrentPosition();
    const latRounded = pos.coords.latitude.toFixed(2);
    const lonRounded = pos.coords.longitude.toFixed(2);
    return await fetchOpenMeteoForecast(
      pos.coords.latitude,
      pos.coords.longitude,
      'Your current location',
      `geo:${latRounded},${lonRounded}`
    );
  } catch {
    const savedCity = storageService.getWeatherCity();
    if (savedCity) {
      return await lookupCity(savedCity);
    }
    return {
      success: false,
      needsCity: true,
      error:
        'Device location permission was denied or unavailable, and no city is saved yet. Ask the user once for their city name so you can look up the weather and save it.',
    };
  }
}

export interface AssistantToolHandlers {
  alarms: Alarm[];
  routines: ScheduleRoutine[];
  settings: AppSettings;
  onAddAlarm: (alarm: Omit<Alarm, 'id' | 'createdAt'>) => Promise<Alarm>;
  onUpdateAlarm: (alarm: Alarm) => Promise<void>;
  onDeleteAlarm: (id: string) => Promise<void>;
  onToggleAlarm: (id: string) => Promise<void>;
  onAddRoutine: (routine: Omit<ScheduleRoutine, 'id'>) => ScheduleRoutine;
  onDeleteRoutine: (id: string) => void;
}

interface FunctionCallItem {
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
}

interface GeminiPart {
  text?: string;
  functionCall?: FunctionCallItem;
  functionResponse?: {
    id?: string;
    name: string;
    response: Record<string, unknown>;
  };
  thoughtSignature?: string;
  [key: string]: unknown;
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

function buildGeminiContentsFromHistory(history: ChatMessage[]): GeminiContent[] {
  // Token savings: send only the last 10 messages
  const recent = history.slice(-MAX_HISTORY_MESSAGES);
  const contents: GeminiContent[] = [];

  for (const msg of recent) {
    if (msg.sender === 'user') {
      contents.push({
        role: 'user',
        parts: [{ text: msg.text }],
      });
    } else {
      const summaries: string[] = [];
      if (msg.actions && msg.actions.length > 0) {
        summaries.push(
          ...msg.actions.map((a) => `${a.title}${a.undone ? ' (undone)' : ''}`)
        );
      }
      if (msg.proposals && msg.proposals.length > 0) {
        summaries.push(
          ...msg.proposals.map(
            (p) =>
              `${p.kind} (${p.status}${p.appliedAction ? `: ${p.appliedAction.title}` : ''})`
          )
        );
      }
      const note =
        summaries.length > 0 ? `\n[Context: ${summaries.join('; ')}]` : '';
      contents.push({
        role: 'model',
        parts: [{ text: `${msg.text}${note}`.trim() }],
      });
    }
  }

  return contents;
}

function statusTextForTool(toolName?: string): string {
  switch (toolName) {
    case 'set_alarm':
    case 'update_alarm':
    case 'toggle_alarm':
    case 'delete_alarm':
      return 'Setting up your alarm…';
    case 'add_routine':
    case 'delete_routine':
      return 'Planning your schedule…';
    case 'get_weather':
      return 'Checking the weather…';
    case 'list_alarms':
      return 'Reading your alarms…';
    default:
      return 'Thinking…';
  }
}

export async function applyAlarmProposal(
  alarmData: ProposedAlarmData,
  handlers: AssistantToolHandlers
): Promise<AssistantActionResult> {
  const timeDisplay = formatTimeDisplay(
    alarmData.time,
    handlers.settings.timeFormat24h
  );
  const daysDisplay = formatDaysLabel(alarmData.days);

  if (alarmData.mode === 'create') {
    const created = await handlers.onAddAlarm({
      time: alarmData.time,
      label: alarmData.label,
      days: alarmData.days,
      enabled: true,
      soundId: 'aurora',
      volume: 85,
      vibrate: true,
      snoozeIntervalMinutes: alarmData.snoozeIntervalMinutes,
      snoozeLimit: handlers.settings.snoozeLimit || 3,
      aiBriefing: alarmData.aiBriefing,
      aiVoiceStyle: handlers.settings.aiVoiceStyle || 'warm',
    });

    return {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'set_alarm',
      title: `Alarm set · ${timeDisplay} · ${daysDisplay}`,
      subtitle: created.label,
      alarmId: created.id,
      undoPayload: { kind: 'delete_alarm', alarmId: created.id },
    };
  }

  const existing =
    handlers.alarms.find((a) => a.id === alarmData.targetAlarmId) ||
    alarmData.previousAlarm;

  if (!existing) {
    throw new Error('Alarm no longer exists.');
  }

  if (alarmData.mode === 'toggle') {
    if (existing.enabled !== alarmData.enabled) {
      await handlers.onToggleAlarm(existing.id);
    }
    return {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'toggle_alarm',
      title: `Alarm ${alarmData.enabled ? 'enabled' : 'paused'} · ${timeDisplay}`,
      subtitle: existing.label,
      alarmId: existing.id,
      undoPayload: { kind: 'restore_alarm', previousAlarm: existing },
    };
  }

  const updated: Alarm = {
    ...existing,
    time: alarmData.time,
    label: alarmData.label,
    days: alarmData.days,
    snoozeIntervalMinutes: alarmData.snoozeIntervalMinutes,
    aiBriefing: alarmData.aiBriefing,
    enabled: alarmData.enabled,
  };

  await handlers.onUpdateAlarm(updated);

  return {
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: 'update_alarm',
    title: `Alarm updated · ${timeDisplay} · ${daysDisplay}`,
    subtitle: updated.label,
    alarmId: updated.id,
    undoPayload: { kind: 'restore_alarm', previousAlarm: existing },
  };
}

export function applyRoutinePlanProposal(
  items: ProposedRoutineItem[],
  handlers: AssistantToolHandlers
): AssistantActionResult {
  const createdIds: string[] = [];
  let totalMinutes = 0;

  for (const item of items) {
    const targetDays =
      item.days && item.days.length > 0 ? item.days : [new Date().getDay()];
    totalMinutes += item.durationMinutes;

    for (const day of targetDays) {
      const created = handlers.onAddRoutine({
        title: item.title,
        time: item.time,
        durationMinutes: item.durationMinutes,
        category: item.category,
        completed: false,
        dayOfWeek: day,
      });
      createdIds.push(created.id);
    }
  }

  const firstItem = items[0];
  const firstDay =
    firstItem && firstItem.days.length > 0
      ? firstItem.days[0]
      : new Date().getDay();

  return {
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: 'add_routine',
    title: 'Added to your schedule',
    subtitle: `${items.length} ${items.length === 1 ? 'task' : 'tasks'} · ${formatTotalDuration(totalMinutes)}`,
    routineDay: firstDay,
    undoPayload: { kind: 'delete_routines', routineIds: createdIds },
  };
}

export async function applyDeleteProposal(
  deleteData: ProposedDeleteData,
  handlers: AssistantToolHandlers
): Promise<AssistantActionResult> {
  if (deleteData.targetType === 'alarm') {
    const existing =
      handlers.alarms.find((a) => a.id === deleteData.targetId) ||
      deleteData.alarmSnapshot;
    if (!existing) {
      throw new Error('Alarm no longer exists.');
    }
    await handlers.onDeleteAlarm(existing.id);

    const timeDisplay = formatTimeDisplay(
      existing.time,
      handlers.settings.timeFormat24h
    );
    return {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'delete_alarm',
      title: `Alarm deleted · ${timeDisplay}`,
      subtitle: existing.label,
      undoPayload: { kind: 'recreate_alarm', deletedAlarm: existing },
    };
  }

  const existing =
    handlers.routines.find((r) => r.id === deleteData.targetId) ||
    deleteData.routineSnapshot;
  if (!existing) {
    throw new Error('Routine no longer exists.');
  }
  handlers.onDeleteRoutine(existing.id);

  const timeDisplay = formatTimeDisplay(
    existing.time,
    handlers.settings.timeFormat24h
  );
  return {
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: 'delete_routine',
    title: `Routine removed · ${timeDisplay}`,
    subtitle: existing.title,
    routineDay: existing.dayOfWeek,
    undoPayload: { kind: 'recreate_routine', deletedRoutine: existing },
  };
}

export async function runAssistantTurn(
  chatHistoryWithNewUserMessage: ChatMessage[],
  handlers: AssistantToolHandlers,
  onStatusChange?: (statusText: string) => void
): Promise<{
  replyText: string;
  proposals: AssistantProposal[];
  actions: AssistantActionResult[];
}> {
  let workingAlarms = [...handlers.alarms];
  let workingRoutines = [...handlers.routines];
  const proposals: AssistantProposal[] = [];
  const actions: AssistantActionResult[] = [];
  const askBeforeApplying = handlers.settings.askBeforeApplyingChanges !== false;

  let contents: GeminiContent[] = buildGeminiContentsFromHistory(
    chatHistoryWithNewUserMessage
  );

  const buildCompactContext = () => {
    const now = new Date();
    const dayOfWeekIndex = now.getDay();
    const timezone =
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    const todayRelevantAlarms = workingAlarms.filter(
      (a) => a.days.length === 0 || a.days.includes(dayOfWeekIndex)
    );
    const todayRoutines = workingRoutines.filter(
      (r) => r.dayOfWeek === dayOfWeekIndex
    );

    return {
      currentDateTime: now.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: !handlers.settings.timeFormat24h,
      }),
      dayOfWeekName: DAY_NAMES_FULL[dayOfWeekIndex],
      dayOfWeekIndex,
      timezone,
      userName: handlers.settings.userName || 'Friend',
      savedCity: storageService.getWeatherCity(),
      timeFormat24h: handlers.settings.timeFormat24h,
      askBeforeApplyingChanges: askBeforeApplying,
      alarms: todayRelevantAlarms.map((a) => ({
        line: `${a.id}|${a.time}|${a.label}|[${a.days.join(',')}]|${a.enabled ? 'on' : 'off'}`,
      })),
      todayRoutines: todayRoutines.map((r) => ({
        line: `${r.id}|${r.time}|${r.title}|${r.durationMinutes}m`,
      })),
    };
  };

  const executeSingleTool = async (
    call: FunctionCallItem,
    stagedRoutineBatch: ProposedRoutineItem[]
  ): Promise<Record<string, unknown>> => {
    const name = call.name || '';
    const args = call.args || {};

    switch (name) {
      case 'set_alarm': {
        const time = normalizeTime24(args.time, '07:00');
        const label =
          typeof args.label === 'string' && args.label.trim()
            ? args.label.trim()
            : 'Alarm';
        const days = normalizeDays(args.repeat_days);
        const snoozeMinutes =
          typeof args.snooze_minutes === 'number' && args.snooze_minutes > 0
            ? Math.round(args.snooze_minutes)
            : handlers.settings.defaultSnoozeMinutes || 9;
        const aiBriefing =
          typeof args.ai_briefing === 'boolean' ? args.ai_briefing : true;

        const proposed: ProposedAlarmData = {
          mode: 'create',
          time,
          label,
          days,
          snoozeIntervalMinutes: snoozeMinutes,
          aiBriefing,
          enabled: true,
        };

        if (askBeforeApplying) {
          proposals.push({
            id: `prop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            kind: 'alarm_proposal',
            status: 'pending',
            alarmData: proposed,
          });
          return {
            status: 'staged_for_approval',
            proposedAlarm: proposed,
          };
        }

        const action = await applyAlarmProposal(proposed, handlers);
        actions.push(action);
        return { success: true, alarmId: action.alarmId, time, label, days };
      }

      case 'update_alarm': {
        const targetId = typeof args.id === 'string' ? args.id : '';
        const existing = workingAlarms.find((a) => a.id === targetId);
        if (!existing) {
          return { success: false, error: `No alarm found with id "${targetId}".` };
        }

        const proposed: ProposedAlarmData = {
          mode: 'update',
          targetAlarmId: existing.id,
          previousAlarm: existing,
          time:
            args.time !== undefined
              ? normalizeTime24(args.time, existing.time)
              : existing.time,
          label:
            typeof args.label === 'string' && args.label.trim()
              ? args.label.trim()
              : existing.label,
          days:
            args.repeat_days !== undefined
              ? normalizeDays(args.repeat_days)
              : existing.days,
          snoozeIntervalMinutes:
            typeof args.snooze_minutes === 'number' && args.snooze_minutes > 0
              ? Math.round(args.snooze_minutes)
              : existing.snoozeIntervalMinutes,
          aiBriefing:
            typeof args.ai_briefing === 'boolean'
              ? args.ai_briefing
              : existing.aiBriefing,
          enabled:
            typeof args.enabled === 'boolean' ? args.enabled : existing.enabled,
        };

        if (askBeforeApplying) {
          proposals.push({
            id: `prop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            kind: 'alarm_proposal',
            status: 'pending',
            alarmData: proposed,
          });
          return {
            status: 'staged_for_approval',
            proposedUpdate: proposed,
          };
        }

        const action = await applyAlarmProposal(proposed, handlers);
        actions.push(action);
        workingAlarms = workingAlarms.map((a) =>
          a.id === existing.id
            ? {
                ...existing,
                time: proposed.time,
                label: proposed.label,
                days: proposed.days,
                snoozeIntervalMinutes: proposed.snoozeIntervalMinutes,
                aiBriefing: proposed.aiBriefing,
                enabled: proposed.enabled,
              }
            : a
        );
        return { success: true, id: existing.id };
      }

      case 'toggle_alarm': {
        const targetId = typeof args.id === 'string' ? args.id : '';
        const enabled = Boolean(args.enabled);
        const existing = workingAlarms.find((a) => a.id === targetId);
        if (!existing) {
          return { success: false, error: `No alarm found with id "${targetId}".` };
        }

        const proposed: ProposedAlarmData = {
          mode: 'toggle',
          targetAlarmId: existing.id,
          previousAlarm: existing,
          time: existing.time,
          label: existing.label,
          days: existing.days,
          snoozeIntervalMinutes: existing.snoozeIntervalMinutes,
          aiBriefing: existing.aiBriefing,
          enabled,
        };

        if (askBeforeApplying) {
          proposals.push({
            id: `prop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            kind: 'alarm_proposal',
            status: 'pending',
            alarmData: proposed,
          });
          return { status: 'staged_for_approval', targetId, enabled };
        }

        const action = await applyAlarmProposal(proposed, handlers);
        actions.push(action);
        workingAlarms = workingAlarms.map((a) =>
          a.id === targetId ? { ...a, enabled } : a
        );
        return { success: true, id: targetId, enabled };
      }

      case 'delete_alarm': {
        const targetId = typeof args.id === 'string' ? args.id : '';
        const existing = workingAlarms.find((a) => a.id === targetId);
        if (!existing) {
          return { success: false, error: `No alarm found with id "${targetId}".` };
        }

        const timeDisplay = formatTimeDisplay(
          existing.time,
          handlers.settings.timeFormat24h
        );
        const deleteData: ProposedDeleteData = {
          targetType: 'alarm',
          targetId: existing.id,
          title: `Delete ${timeDisplay} alarm`,
          subtitle: `${existing.label} · ${formatDaysLabel(existing.days)}`,
          alarmSnapshot: existing,
        };

        if (askBeforeApplying) {
          proposals.push({
            id: `prop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            kind: 'delete_proposal',
            status: 'pending',
            deleteData,
          });
          return { status: 'staged_for_approval', targetId };
        }

        const action = await applyDeleteProposal(deleteData, handlers);
        actions.push(action);
        workingAlarms = workingAlarms.filter((a) => a.id !== targetId);
        return { success: true, deletedId: targetId };
      }

      case 'list_alarms': {
        const filter = typeof args.filter === 'string' ? args.filter : 'all';
        const filtered = workingAlarms.filter((a) => {
          if (filter === 'enabled') return a.enabled;
          if (filter === 'disabled') return !a.enabled;
          return true;
        });
        return {
          success: true,
          count: filtered.length,
          alarms: filtered.map((a) => ({
            id: a.id,
            time: a.time,
            timeDisplay: formatTimeDisplay(a.time, handlers.settings.timeFormat24h),
            label: a.label,
            days: formatDaysLabel(a.days),
            enabled: a.enabled,
            snoozeMinutes: a.snoozeIntervalMinutes,
          })),
        };
      }

      case 'add_routine': {
        const title =
          typeof args.title === 'string' && args.title.trim()
            ? args.title.trim()
            : 'Daily Routine';
        const time = normalizeTime24(args.time, '08:00');
        const requestedDays = normalizeDays(args.days);
        const targetDays =
          requestedDays.length > 0 ? requestedDays : [new Date().getDay()];
        const durationMinutes =
          typeof args.duration_minutes === 'number' && args.duration_minutes > 0
            ? Math.round(args.duration_minutes)
            : 30;
        const category = inferRoutineCategory(title, time);

        const item: ProposedRoutineItem = {
          id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          title,
          time,
          days: targetDays,
          durationMinutes,
          category,
        };

        stagedRoutineBatch.push(item);

        if (askBeforeApplying) {
          return {
            status: 'staged_for_approval',
            routineItem: item,
          };
        }

        return {
          success: true,
          routineItem: item,
        };
      }

      case 'delete_routine': {
        const targetId = typeof args.id === 'string' ? args.id : '';
        const existing = workingRoutines.find((r) => r.id === targetId);
        if (!existing) {
          return { success: false, error: `No routine found with id "${targetId}".` };
        }

        const timeDisplay = formatTimeDisplay(
          existing.time,
          handlers.settings.timeFormat24h
        );
        const deleteData: ProposedDeleteData = {
          targetType: 'routine',
          targetId: existing.id,
          title: `Delete "${existing.title}"`,
          subtitle: `${timeDisplay} · ${existing.durationMinutes}m · ${DAY_NAMES_SHORT[existing.dayOfWeek]}`,
          routineSnapshot: existing,
        };

        if (askBeforeApplying) {
          proposals.push({
            id: `prop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            kind: 'delete_proposal',
            status: 'pending',
            deleteData,
          });
          return { status: 'staged_for_approval', targetId };
        }

        const action = await applyDeleteProposal(deleteData, handlers);
        actions.push(action);
        workingRoutines = workingRoutines.filter((r) => r.id !== targetId);
        return { success: true, deletedId: targetId };
      }

      case 'get_weather': {
        const city = typeof args.city === 'string' ? args.city : undefined;
        return await executeGetWeather(city);
      }

      default:
        return { success: false, error: `Unknown tool: ${name}` };
    }
  };

  const MAX_TOOL_ROUNDS = 6;
  const accumulatedRoutineItems: ProposedRoutineItem[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    onStatusChange?.('Thinking…');

    const data = await requestAssistantTurn({
      contents,
      context: buildCompactContext(),
    });

    if (
      data.status === 'tool_calls' &&
      data.functionCalls &&
      data.functionCalls.length > 0 &&
      data.modelContent
    ) {
      const responseParts: GeminiPart[] = [];

      for (const call of data.functionCalls) {
        onStatusChange?.(statusTextForTool(call.name));
        const result = await executeSingleTool(call, accumulatedRoutineItems);
        responseParts.push({
          functionResponse: {
            id: call.id,
            name: call.name || '',
            response: result,
          },
        });
      }

      contents = [
        ...contents,
        data.modelContent as GeminiContent,
        {
          role: 'user',
          parts: responseParts,
        },
      ];
      continue;
    }

    // Group any accumulated routine items into one routine_plan proposal (or auto-apply if OFF)
    if (accumulatedRoutineItems.length > 0) {
      const sortedItems = [...accumulatedRoutineItems].sort((a, b) =>
        a.time.localeCompare(b.time)
      );
      if (askBeforeApplying) {
        proposals.push({
          id: `prop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          kind: 'routine_plan',
          status: 'pending',
          routineItems: sortedItems,
        });
      } else {
        const action = applyRoutinePlanProposal(sortedItems, handlers);
        actions.push(action);
      }
    }

    const finalReply =
      data.text ||
      (proposals.length > 0
        ? 'Here is the plan I prepared for you. Review and approve when ready.'
        : actions.length > 0
        ? `Done! I updated that for you, ${handlers.settings.userName || 'friend'}.`
        : "I'm ready whenever you'd like to set an alarm or plan your day.");

    return {
      replyText: finalReply,
      proposals,
      actions,
    };
  }

  if (accumulatedRoutineItems.length > 0) {
    const sortedItems = [...accumulatedRoutineItems].sort((a, b) =>
      a.time.localeCompare(b.time)
    );
    if (askBeforeApplying) {
      proposals.push({
        id: `prop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        kind: 'routine_plan',
        status: 'pending',
        routineItems: sortedItems,
      });
    } else {
      const action = applyRoutinePlanProposal(sortedItems, handlers);
      actions.push(action);
    }
  }

  return {
    replyText:
      proposals.length > 0
        ? 'Here is the plan I put together for you.'
        : `All set, ${handlers.settings.userName || 'friend'}!`,
    proposals,
    actions,
  };
}
