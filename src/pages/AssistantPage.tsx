import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AssistantActionResult,
  AssistantState,
  ChatMessage,
  ProposedAlarmData,
  ProposedRoutineItem,
} from '../types/assistant';
import { Alarm } from '../types/alarm';
import { ScheduleRoutine } from '../types/schedule';
import { AppSettings } from '../types/settings';
import { storageService } from '../services/storageService';
import {
  applyAlarmProposal,
  applyDeleteProposal,
  applyRoutinePlanProposal,
  runAssistantTurn,
} from '../services/assistantService';
import {
  speakText,
  stopVoicePlayback,
  subscribeVoicePlayback,
  VoicePlaybackSnapshot,
} from '../services/geminiVoice';
import { PageHeader } from '../components/layout/PageHeader';
import { AiIcon } from '../components/common/AiIcon';
import {
  ActionResultCard,
  FormattedPlainText,
  ProposalCard,
} from '../components/assistant/AssistantCards';
import { hapticsService } from '../services/hapticsService';
import {
  Mic,
  MicOff,
  ArrowUp,
  AlarmClock,
  Trash2,
  MoreVertical,
  RefreshCw,
  AlertCircle,
  Sun,
  BookOpen,
  CloudSun,
  Volume2,
  Loader2,
  RotateCcw,
} from 'lucide-react';

interface AssistantPageProps {
  alarms: Alarm[];
  routines: ScheduleRoutine[];
  settings: AppSettings;
  onBack: () => void;
  onAddAlarm: (alarm: Omit<Alarm, 'id' | 'createdAt'>) => Promise<Alarm>;
  onUpdateAlarm: (alarm: Alarm) => Promise<void>;
  onDeleteAlarm: (id: string) => Promise<void>;
  onToggleAlarm: (id: string) => Promise<void>;
  onAddRoutine: (routine: Omit<ScheduleRoutine, 'id'>) => ScheduleRoutine;
  onDeleteRoutine: (id: string) => void;
  onViewAlarm: (alarmId: string) => void;
  onViewSchedule: (dayOfWeek?: number) => void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

const WELCOME_CARDS = [
  {
    title: 'Set a wake-up alarm',
    subtitle: '7:00 AM on weekdays',
    prompt: 'Wake me at 7:00 AM on weekdays',
    icon: AlarmClock,
    accent: 'bg-[#3B3D78]/10 text-[#3B3D78]',
  },
  {
    title: 'Plan my morning',
    subtitle: 'Build a refreshing routine',
    prompt: 'Plan a healthy morning routine starting at 7:00 AM',
    icon: Sun,
    accent: 'bg-[#F5B800]/15 text-[#B45309]',
  },
  {
    title: 'Build a study schedule',
    subtitle: 'Daily 4pm–6pm focus block',
    prompt: 'Plan my study time 4pm to 6pm every day',
    icon: BookOpen,
    accent: 'bg-[#9C1C7C]/10 text-[#9C1C7C]',
  },
  {
    title: 'Weather for tomorrow',
    subtitle: 'Morning forecast check',
    prompt: "What's the weather for my morning tomorrow?",
    icon: CloudSun,
    accent: 'bg-[#12A6A0]/15 text-[#0F766E]',
  },
];

const QUICK_CHIPS = [
  'Wake me at 7',
  'Set alarm 6:30 weekdays',
  'Plan my morning',
  'Study 4pm to 6pm daily',
  "What's the morning weather?",
];

const TEN_MINUTES_MS = 10 * 60 * 1000;

function isDifferentCalendarDay(tsA: number, tsB: number): boolean {
  const a = new Date(tsA);
  const b = new Date(tsB);
  return (
    a.getFullYear() !== b.getFullYear() ||
    a.getMonth() !== b.getMonth() ||
    a.getDate() !== b.getDate()
  );
}

function formatSeparatorTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = !isDifferentCalendarDay(timestamp, now.getTime());
  const timeStr = date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  if (isToday) return timeStr;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${timeStr}`;
}

export const AssistantPage: React.FC<AssistantPageProps> = ({
  alarms,
  routines,
  settings,
  onBack,
  onAddAlarm,
  onUpdateAlarm,
  onDeleteAlarm,
  onToggleAlarm,
  onAddRoutine,
  onDeleteRoutine,
  onViewAlarm,
  onViewSchedule,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    storageService.getChatHistory()
  );
  const [inputText, setInputText] = useState('');
  const [assistantState, setAssistantState] = useState<AssistantState>('idle');
  const [thinkingStatus, setThinkingStatus] = useState<string>('Thinking…');
  const [errorInfo, setErrorInfo] = useState<{
    message: string;
    retryHistory: ChatMessage[];
  } | null>(null);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [voicePlayback, setVoicePlayback] = useState<VoicePlaybackSnapshot>({
    activeKey: null,
    phase: 'idle',
  });
  const [speakerErrorId, setSpeakerErrorId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const inFlightRef = useRef(false);

  const latestPropsRef = useRef({
    alarms,
    routines,
    settings,
    onAddAlarm,
    onUpdateAlarm,
    onDeleteAlarm,
    onToggleAlarm,
    onAddRoutine,
    onDeleteRoutine,
  });
  latestPropsRef.current = {
    alarms,
    routines,
    settings,
    onAddAlarm,
    onUpdateAlarm,
    onDeleteAlarm,
    onToggleAlarm,
    onAddRoutine,
    onDeleteRoutine,
  };

  useEffect(() => {
    storageService.saveChatHistory(messages);
  }, [messages]);

  useEffect(() => {
    const unsub = subscribeVoicePlayback(setVoicePlayback);
    return () => {
      unsub();
      stopVoicePlayback();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, assistantState, thinkingStatus, errorInfo]);

  // Single-line by default (40px), grows smoothly only when user types more up to 4 lines
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    if (!inputText) {
      el.style.height = '40px';
      return;
    }
    el.style.height = '40px';
    const nextHeight = Math.min(el.scrollHeight, 104);
    el.style.height = `${Math.max(40, nextHeight)}px`;
  }, [inputText]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isMenuOpen]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  const executeAssistantRequest = async (historyToSend: ChatMessage[]) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setErrorInfo(null);
    setThinkingStatus('Thinking…');
    setAssistantState('thinking');

    try {
      const { replyText, proposals, actions } = await runAssistantTurn(
        historyToSend,
        latestPropsRef.current,
        (status) => setThinkingStatus(status)
      );

      const assistantMsg: ChatMessage = {
        id: `msg_ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        sender: 'assistant',
        text: replyText,
        timestamp: Date.now(),
        proposals: proposals.length > 0 ? proposals : undefined,
        actions: actions.length > 0 ? actions : undefined,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setAssistantState('idle');
    } catch (err) {
      console.error('Assistant turn failed:', err);
      setAssistantState('idle');
      setErrorInfo({
        message:
          err instanceof Error && err.message.includes('API key')
            ? err.message
            : "Couldn't reach the assistant. Try again",
        retryHistory: historyToSend,
      });
    } finally {
      inFlightRef.current = false;
    }
  };

  const handleSendMessage = async (textOverride?: string) => {
    if (inFlightRef.current || assistantState === 'thinking') return;
    const raw = textOverride !== undefined ? textOverride : inputText;
    const text = raw.trim();
    if (!text) return;

    hapticsService.light();
    setVoiceNote(null);

    const userMsg: ChatMessage = {
      id: `msg_user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sender: 'user',
      text,
      timestamp: Date.now(),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInputText('');

    await executeAssistantRequest(nextHistory);
  };

  const handleRetry = async () => {
    if (!errorInfo || inFlightRef.current) return;
    hapticsService.light();
    await executeAssistantRequest(errorInfo.retryHistory);
  };

  const handleClearChat = () => {
    hapticsService.medium();
    stopVoicePlayback();
    setIsMenuOpen(false);
    setErrorInfo(null);
    setVoiceNote(null);
    setSpeakerErrorId(null);
    setMessages([]);
    storageService.clearChatHistory();
  };

  const handleToggleSpeaker = async (msg: ChatMessage) => {
    hapticsService.light();
    setSpeakerErrorId(null);

    if (
      voicePlayback.activeKey === msg.id &&
      (voicePlayback.phase === 'playing' || voicePlayback.phase === 'loading')
    ) {
      stopVoicePlayback();
      return;
    }

    try {
      await speakText({
        text: msg.text,
        persona: settings.aiVoiceStyle,
        speechRate: settings.speechRate,
        playbackId: msg.id,
      });
    } catch {
      setSpeakerErrorId(msg.id);
    }
  };

  const handleToggleMic = () => {
    if (assistantState === 'listening') {
      hapticsService.light();
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      setAssistantState('idle');
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      setVoiceNote('Voice input is not supported in this browser — please type below.');
      setTimeout(() => setVoiceNote(null), 4000);
      return;
    }

    hapticsService.medium();
    setVoiceNote(null);
    const recognition = new SpeechRec();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';
    recognitionRef.current = recognition;

    let finalTranscript = '';

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript || '';
        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }
      const combined = (finalTranscript || interim).trim();
      if (combined) {
        setInputText(combined);
      }
    };

    recognition.onerror = (event) => {
      setAssistantState('idle');
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setVoiceNote('Microphone access was denied. Enable mic permission or type below.');
        setTimeout(() => setVoiceNote(null), 4000);
      }
    };

    recognition.onend = () => {
      setAssistantState((curr) => (curr === 'listening' ? 'idle' : curr));
      const spoken = finalTranscript.trim();
      if (spoken) {
        handleSendMessage(spoken);
      }
    };

    try {
      setAssistantState('listening');
      recognition.start();
    } catch {
      setAssistantState('idle');
      setVoiceNote('Could not start voice recognition.');
      setTimeout(() => setVoiceNote(null), 3500);
    }
  };

  // Proposal lifecycle handlers
  const handleApproveAlarmProposal = async (
    msgId: string,
    proposalId: string,
    alarmData: ProposedAlarmData
  ) => {
    try {
      const action = await applyAlarmProposal(alarmData, latestPropsRef.current);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                proposals: m.proposals?.map((p) =>
                  p.id === proposalId
                    ? { ...p, status: 'approved', alarmData, appliedAction: action }
                    : p
                ),
              }
            : m
        )
      );
    } catch (err) {
      console.error('Failed to apply alarm proposal:', err);
    }
  };

  const handleApproveRoutinePlanProposal = (
    msgId: string,
    proposalId: string,
    items: ProposedRoutineItem[]
  ) => {
    if (items.length === 0) return;
    try {
      const action = applyRoutinePlanProposal(items, latestPropsRef.current);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                proposals: m.proposals?.map((p) =>
                  p.id === proposalId
                    ? {
                        ...p,
                        status: 'approved',
                        routineItems: items,
                        appliedAction: action,
                      }
                    : p
                ),
              }
            : m
        )
      );
    } catch (err) {
      console.error('Failed to apply routine plan:', err);
    }
  };

  const handleApproveDeleteProposal = async (
    msgId: string,
    proposalId: string
  ) => {
    const targetMsg = messages.find((m) => m.id === msgId);
    const targetProp = targetMsg?.proposals?.find((p) => p.id === proposalId);
    if (!targetProp?.deleteData) return;

    try {
      const action = await applyDeleteProposal(
        targetProp.deleteData,
        latestPropsRef.current
      );
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                proposals: m.proposals?.map((p) =>
                  p.id === proposalId
                    ? { ...p, status: 'approved', appliedAction: action }
                    : p
                ),
              }
            : m
        )
      );
    } catch (err) {
      console.error('Failed to apply delete proposal:', err);
    }
  };

  const handleCancelProposal = (msgId: string, proposalId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? {
              ...m,
              proposals: m.proposals?.map((p) =>
                p.id === proposalId ? { ...p, status: 'cancelled' } : p
              ),
            }
          : m
      )
    );
  };

  const handleUpdateProposalItems = (
    msgId: string,
    proposalId: string,
    items: ProposedRoutineItem[]
  ) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? {
              ...m,
              proposals: m.proposals?.map((p) =>
                p.id === proposalId ? { ...p, routineItems: items } : p
              ),
            }
          : m
      )
    );
  };

  const handleUndoAction = async (msgId: string, action: AssistantActionResult) => {
    if (action.undone) return;
    hapticsService.light();

    try {
      const payload = action.undoPayload;
      if (payload.kind === 'delete_alarm') {
        await onDeleteAlarm(payload.alarmId);
      } else if (payload.kind === 'restore_alarm') {
        await onUpdateAlarm(payload.previousAlarm);
      } else if (payload.kind === 'recreate_alarm') {
        const a = payload.deletedAlarm;
        await onAddAlarm({
          time: a.time,
          label: a.label,
          days: a.days,
          enabled: a.enabled,
          soundId: a.soundId,
          volume: a.volume,
          vibrate: a.vibrate,
          snoozeIntervalMinutes: a.snoozeIntervalMinutes,
          snoozeLimit: a.snoozeLimit,
          aiBriefing: a.aiBriefing,
          aiVoiceStyle: a.aiVoiceStyle,
        });
      } else if (payload.kind === 'delete_routines') {
        for (const rId of payload.routineIds) {
          onDeleteRoutine(rId);
        }
      } else if (payload.kind === 'recreate_routine') {
        const r = payload.deletedRoutine;
        onAddRoutine({
          title: r.title,
          time: r.time,
          durationMinutes: r.durationMinutes,
          category: r.category,
          completed: r.completed,
          dayOfWeek: r.dayOfWeek,
          notes: r.notes,
          linkedToAlarmId: r.linkedToAlarmId,
        });
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                actions: m.actions?.map((a) =>
                  a.id === action.id ? { ...a, undone: true } : a
                ),
                proposals: m.proposals?.map((p) =>
                  p.appliedAction?.id === action.id
                    ? {
                        ...p,
                        appliedAction: { ...p.appliedAction, undone: true },
                      }
                    : p
                ),
              }
            : m
        )
      );
    } catch (err) {
      console.error('Failed to undo action:', err);
    }
  };

  // Sort ascending by timestamp, compute >10m/day-change timestamps and top-aligned sender groups
  const renderedMessages = useMemo(() => {
    const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);
    return sorted.map((msg, index) => {
      const prev = index > 0 ? sorted[index - 1] : null;
      const showTimeSeparator =
        !prev ||
        msg.timestamp - prev.timestamp > TEN_MINUTES_MS ||
        isDifferentCalendarDay(prev.timestamp, msg.timestamp);
      const isFirstInSenderGroup =
        !prev ||
        prev.sender !== msg.sender ||
        showTimeSeparator;

      return { msg, showTimeSeparator, isFirstInSenderGroup };
    });
  }, [messages]);

  const userName = (settings.userName || '').trim() || 'there';
  const isReplying = assistantState === 'thinking';
  const hasUserMessage = messages.some((m) => m.sender === 'user');
  const canSend = inputText.trim().length > 0 && !isReplying;

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white text-[#1E1B4B]">
      {/* Indigo Top Header with Back Button & Clear Chat Menu */}
      <PageHeader
        title="AI Assistant"
        subtitle="Personal wake & routine helper"
        onBack={onBack}
        rightAction={
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => {
                hapticsService.light();
                setIsMenuOpen((v) => !v);
              }}
              aria-label="Assistant menu"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white"
            >
              <MoreVertical className="h-5 w-5" />
            </button>

            <AnimatePresence>
              {isMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.14 }}
                  className="absolute right-0 mt-2 w-44 rounded-2xl bg-white shadow-xl border border-gray-100 py-1.5 z-50"
                >
                  <button
                    type="button"
                    onClick={handleClearChat}
                    disabled={messages.length === 0}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                  >
                    <Trash2 className="h-4 w-4 shrink-0" />
                    <span>Clear chat</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        }
      />

      {/* Scrollable Messages Area */}
      <main className="main-scroll-area w-full bg-white">
        <div className="mx-auto w-full max-w-xl px-4 py-4">
          {renderedMessages.length === 0 ? (
            /* Empty Welcome State */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className="flex flex-col items-center pt-6 pb-4 text-center"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#3B3D78] text-white shadow-lg shadow-indigo-900/20">
                <AiIcon className="h-8 w-8" />
              </div>

              <h2 className="mt-4 text-xl font-extrabold tracking-tight text-[#1E1B4B]">
                Hi {userName}, what can I set up for you?
              </h2>
              <p className="mt-1.5 text-xs text-[#6B7280] max-w-xs leading-relaxed">
                Ask me to create or edit alarms, plan your morning routine, organize study blocks, or check morning weather.
              </p>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
                {WELCOME_CARDS.map((card) => {
                  const CardIcon = card.icon;
                  return (
                    <button
                      key={card.title}
                      type="button"
                      onClick={() => handleSendMessage(card.prompt)}
                      className="touch-pan-y flex items-center gap-3 rounded-[20px] border border-gray-100 bg-white p-3.5 shadow-[0_4px_14px_rgba(30,27,75,0.05)] hover:border-[#3B3D78]/30 hover:bg-[#F9FAFB] active:scale-[0.98] transition-all"
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${card.accent}`}
                      >
                        <CardIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-[#1E1B4B] leading-snug break-words">
                          {card.title}
                        </div>
                        <div className="text-[11px] text-[#6B7280] leading-snug break-words">
                          {card.subtitle}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            /* Sorted & Grouped Message List */
            <div>
              {renderedMessages.map(
                ({ msg, showTimeSeparator, isFirstInSenderGroup }) => {
                  const isUser = msg.sender === 'user';
                  const isThisPlaying =
                    voicePlayback.activeKey === msg.id &&
                    voicePlayback.phase === 'playing';
                  const isThisLoading =
                    voicePlayback.activeKey === msg.id &&
                    voicePlayback.phase === 'loading';
                  const isThisError = speakerErrorId === msg.id;

                  return (
                    <React.Fragment key={msg.id}>
                      {showTimeSeparator && (
                        <div className="flex justify-center pt-4 pb-2">
                          <span className="rounded-full bg-[#F3F3F5] px-3 py-0.5 text-[10px] font-bold text-[#6B7280] tracking-wide">
                            {formatSeparatorTime(msg.timestamp)}
                          </span>
                        </div>
                      )}

                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18 }}
                        className={`flex items-start gap-2 ${
                          isFirstInSenderGroup && !showTimeSeparator ? 'mt-3' : 'mt-1.5'
                        } ${isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        {/* Top-aligned AI avatar on first bubble of group */}
                        {!isUser &&
                          (isFirstInSenderGroup ? (
                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3B3D78] text-white shadow-xs">
                              <AiIcon className="h-4 w-4" />
                            </div>
                          ) : (
                            <div className="w-8 shrink-0" aria-hidden="true" />
                          ))}

                        <div
                          className={`flex flex-col max-w-[85%] ${
                            isUser ? 'items-end' : 'items-start'
                          }`}
                        >
                          {/* Bubble */}
                          <div
                            className={`rounded-[20px] px-4 py-2.5 text-[13px] sm:text-sm shadow-xs ${
                              isUser
                                ? 'bg-[#3B3D78] text-white'
                                : 'bg-[#F3F3F5] text-[#1E1B4B]'
                            }`}
                          >
                            {isUser ? (
                              <p className="whitespace-pre-wrap break-words leading-relaxed">
                                {msg.text}
                              </p>
                            ) : (
                              <FormattedPlainText text={msg.text} />
                            )}
                          </div>

                          {/* Proposal Cards (when Ask before applying is ON) */}
                          {!isUser && msg.proposals && msg.proposals.length > 0 && (
                            <div className="mt-2 w-full space-y-2">
                              {msg.proposals.map((prop) => (
                                <ProposalCard
                                  key={prop.id}
                                  proposal={prop}
                                  timeFormat24h={settings.timeFormat24h}
                                  onApproveAlarm={(propId, alarmData) =>
                                    handleApproveAlarmProposal(
                                      msg.id,
                                      propId,
                                      alarmData
                                    )
                                  }
                                  onApproveRoutinePlan={(propId, items) =>
                                    handleApproveRoutinePlanProposal(
                                      msg.id,
                                      propId,
                                      items
                                    )
                                  }
                                  onApproveDelete={(propId) =>
                                    handleApproveDeleteProposal(msg.id, propId)
                                  }
                                  onCancelProposal={(propId) =>
                                    handleCancelProposal(msg.id, propId)
                                  }
                                  onUpdateProposalItems={(propId, items) =>
                                    handleUpdateProposalItems(msg.id, propId, items)
                                  }
                                  onUndoAction={(action) =>
                                    handleUndoAction(msg.id, action)
                                  }
                                  onViewAlarm={onViewAlarm}
                                  onViewSchedule={onViewSchedule}
                                />
                              ))}
                            </div>
                          )}

                          {/* Direct Action Cards (when Ask before applying is OFF) */}
                          {!isUser && msg.actions && msg.actions.length > 0 && (
                            <div className="mt-2 w-full space-y-2">
                              {msg.actions.map((action) => (
                                <ActionResultCard
                                  key={action.id}
                                  action={action}
                                  onUndo={(act) => handleUndoAction(msg.id, act)}
                                  onViewAlarm={onViewAlarm}
                                  onViewSchedule={onViewSchedule}
                                />
                              ))}
                            </div>
                          )}

                          {/* Cached Speaker Button under every AI text message */}
                          {!isUser && msg.text.trim().length > 0 && (
                            <div className="mt-1 flex items-center">
                              <button
                                type="button"
                                onClick={() => handleToggleSpeaker(msg)}
                                aria-label={
                                  isThisPlaying
                                    ? 'Pause voice playback'
                                    : 'Listen to message'
                                }
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                                  isThisError
                                    ? 'text-red-600 hover:bg-red-50'
                                    : isThisPlaying
                                    ? 'bg-[#3B3D78]/10 text-[#3B3D78]'
                                    : 'text-[#6B7280] hover:bg-[#F3F3F5] hover:text-[#1E1B4B]'
                                }`}
                              >
                                {isThisLoading ? (
                                  <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#3B3D78]" />
                                    <span>Loading…</span>
                                  </>
                                ) : isThisPlaying ? (
                                  <>
                                    <span className="flex items-end gap-0.5 h-3">
                                      <span className="w-0.5 h-2 bg-[#3B3D78] rounded-full animate-pulse" />
                                      <span className="w-0.5 h-3 bg-[#3B3D78] rounded-full animate-pulse [animation-delay:150ms]" />
                                      <span className="w-0.5 h-1.5 bg-[#3B3D78] rounded-full animate-pulse [animation-delay:300ms]" />
                                    </span>
                                    <span>Playing</span>
                                  </>
                                ) : isThisError ? (
                                  <>
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    <span>Retry audio</span>
                                  </>
                                ) : (
                                  <>
                                    <Volume2 className="h-3.5 w-3.5" />
                                    <span>Listen</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </React.Fragment>
                  );
                }
              )}
            </div>
          )}

          {/* Smart Thinking Status Bubble */}
          {assistantState === 'thinking' && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 flex items-start gap-2 justify-start"
            >
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3B3D78] text-white shadow-xs">
                <AiIcon className="h-4 w-4" />
              </div>
              <div className="rounded-[20px] bg-[#F3F3F5] px-4 py-3 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1" aria-hidden="true">
                    <span className="h-2 w-2 rounded-full bg-[#3B3D78]/75 animate-pulse" />
                    <span className="h-2 w-2 rounded-full bg-[#3B3D78]/75 animate-pulse [animation-delay:200ms]" />
                    <span className="h-2 w-2 rounded-full bg-[#3B3D78]/75 animate-pulse [animation-delay:400ms]" />
                  </div>
                  <span className="text-xs font-semibold text-[#6B7280]">
                    {thinkingStatus}
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Friendly Error State with Retry */}
          {errorInfo && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-red-100 bg-red-50/80 px-3.5 py-2.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                <span className="text-xs font-semibold text-red-700 leading-snug break-words">
                  {errorInfo.message}
                </span>
              </div>
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-red-600 shadow-xs border border-red-100 hover:bg-red-100/40 active:scale-95 transition-all"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Retry</span>
              </button>
            </motion.div>
          )}

          {/* Voice Note Banner */}
          {voiceNote && (
            <div className="mt-2 rounded-xl bg-[#F3F3F5] px-3 py-2 text-[11px] font-medium text-[#6B7280] text-center">
              {voiceNote}
            </div>
          )}

          <div ref={messagesEndRef} className="h-2" />
        </div>
      </main>

      {/* Bottom Composer Pinned Outside Scroll Area */}
      <div className="shrink-0 bg-white pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] border-t border-gray-100">
        {/* Horizontal Suggestion Chips: hidden after first user message & while replying */}
        {!hasUserMessage && !isReplying && (
          <div className="mx-auto w-full max-w-xl">
            <div className="flex items-center gap-2 overflow-x-auto px-4 pb-2.5 touch-pan-x">
              {QUICK_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleSendMessage(chip)}
                  className="shrink-0 rounded-full bg-[#F3F3F5] hover:bg-gray-200 px-3.5 py-1.5 text-xs font-semibold text-[#3B3D78] transition-colors active:scale-95"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Row */}
        <div className="mx-auto w-full max-w-xl px-4">
          <div className="flex items-end gap-2">
            {/* Mic Button (Web Speech API) */}
            <button
              type="button"
              onClick={handleToggleMic}
              aria-label={
                assistantState === 'listening'
                  ? 'Stop voice input'
                  : 'Start voice input'
              }
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all ${
                assistantState === 'listening'
                  ? 'bg-red-500 text-white animate-pulse shadow-md shadow-red-500/30'
                  : 'bg-[#F3F3F5] text-[#3B3D78] hover:bg-gray-200 active:scale-95'
              }`}
            >
              {assistantState === 'listening' ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </button>

            {/* Single-line input that grows up to 4 lines as user types */}
            <div className="flex-1 min-w-0 rounded-[24px] bg-[#F3F3F5] px-4 py-1 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#3B3D78]/30 transition-all">
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (canSend) handleSendMessage();
                  }
                }}
                placeholder="Ask about your mornings and routines"
                className="block w-full h-10 max-h-[104px] overflow-y-auto resize-none bg-transparent py-2 text-xs sm:text-sm leading-5 text-[#1E1B4B] placeholder:text-gray-400 placeholder:whitespace-nowrap focus:outline-none"
              />
            </div>

            {/* Send Button: solid indigo when text present, soft gray when empty/waiting */}
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!canSend}
              aria-label="Send message"
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all ${
                canSend
                  ? 'bg-[#3B3D78] hover:bg-[#2E2F6B] text-white shadow-md active:scale-95'
                  : 'bg-[#F3F3F5] text-gray-400 cursor-not-allowed'
              }`}
            >
              <ArrowUp className="h-5 w-5 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
