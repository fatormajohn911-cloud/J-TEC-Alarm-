import React, { useState } from 'react';
import { AssistantState, ChatMessage } from '../types/assistant';
import { Alarm } from '../types/alarm';
import { storageService } from '../services/storageService';
import {
  Sparkles,
  Mic,
  MicOff,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Volume2,
  Calendar,
  Layers,
} from 'lucide-react';

interface AssistantPageProps {
  onAddAlarm: (alarm: Omit<Alarm, 'id' | 'createdAt'>) => void;
  onNavigateToAlarms: () => void;
}

const SAMPLE_PROMPTS = [
  'Set an alarm for 6:30 AM weekdays with AI briefing',
  'Schedule a 25-minute power recharge nap',
  'Wake me up gently at 8:00 AM on Saturday',
];

export const AssistantPage: React.FC<AssistantPageProps> = ({
  onAddAlarm,
  onNavigateToAlarms,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    storageService.getChatHistory()
  );
  const [inputText, setInputText] = useState('');
  const [assistantState, setAssistantState] = useState<AssistantState>('idle');
  const [savedSuccessId, setSavedSuccessId] = useState<string | null>(null);

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: Date.now(),
    };

    setMessages((prev) => {
      const updated = [...prev, userMsg];
      storageService.saveChatHistory(updated);
      return updated;
    });
    setInputText('');

    // Trigger Thinking -> Structured Response pipeline
    setAssistantState('thinking');

    setTimeout(() => {
      // Analyze text for demo parse
      let parsedTime = '07:00';
      let parsedLabel = 'Smart Wake Alarm';
      let parsedDays = [1, 2, 3, 4, 5];

      const match630 = /6:30/i.test(text);
      const matchNap = /nap|25/i.test(text);
      const matchSat = /sat|8:00/i.test(text);

      if (match630) {
        parsedTime = '06:30';
        parsedLabel = 'Morning Workout & Briefing';
        parsedDays = [1, 2, 3, 4, 5];
      } else if (matchNap) {
        parsedTime = '14:30';
        parsedLabel = 'Power Recharge Nap';
        parsedDays = [];
      } else if (matchSat) {
        parsedTime = '08:00';
        parsedLabel = 'Gentle Weekend Awake';
        parsedDays = [6];
      }

      const assistantMsg: ChatMessage = {
        id: `msg_ai_${Date.now()}`,
        sender: 'assistant',
        text: `I parsed your command: "${text}". Here is the structured alarm ready to stage:`,
        timestamp: Date.now(),
        parsedAlarm: {
          time: parsedTime,
          label: parsedLabel,
          days: parsedDays,
          enabled: true,
          soundId: 'aurora',
          volume: 85,
          vibrate: true,
          snoozeIntervalMinutes: 9,
          snoozeLimit: 3,
          aiBriefing: true,
        },
        actionSuggested: 'confirm_alarm',
      };

      setAssistantState('speaking');

      setMessages((prev) => {
        const updated = [...prev, assistantMsg];
        storageService.saveChatHistory(updated);
        return updated;
      });

      setTimeout(() => {
        setAssistantState('idle');
      }, 2500);
    }, 1200);
  };

  const handleToggleMic = () => {
    if (assistantState === 'idle') {
      setAssistantState('listening');
      // Simulate listening for 2.5s then send
      setTimeout(() => {
        setAssistantState('idle');
        handleSendMessage('Set an alarm for 6:30 AM weekdays with AI briefing');
      }, 2500);
    } else {
      setAssistantState('idle');
    }
  };

  const handleConfirmAlarm = (msgId: string, parsed: Partial<Alarm>) => {
    onAddAlarm({
      time: parsed.time || '07:00',
      label: parsed.label || 'AI Scheduled Alarm',
      days: parsed.days || [1, 2, 3, 4, 5],
      enabled: true,
      soundId: parsed.soundId || 'aurora',
      volume: parsed.volume || 85,
      vibrate: parsed.vibrate ?? true,
      snoozeIntervalMinutes: parsed.snoozeIntervalMinutes || 9,
      snoozeLimit: parsed.snoozeLimit || 3,
      aiBriefing: parsed.aiBriefing ?? true,
      aiVoiceStyle: 'warm',
    });
    setSavedSuccessId(msgId);
    setTimeout(() => setSavedSuccessId(null), 3000);
  };

  return (
    <div className="flex h-[calc(100vh-136px)] flex-col justify-between pb-4">
      {/* State Indicator Banner */}
      <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/80 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div
            className={`h-2.5 w-2.5 rounded-full ${
              assistantState === 'listening'
                ? 'bg-rose-500 animate-ping'
                : assistantState === 'thinking'
                ? 'bg-amber-400 animate-pulse'
                : assistantState === 'speaking'
                ? 'bg-purple-400 animate-pulse'
                : 'bg-zinc-600'
            }`}
          />
          <span className="text-xs font-semibold text-zinc-300 capitalize">
            {assistantState === 'idle'
              ? 'Assistant Ready'
              : `${assistantState}...`}
          </span>
        </div>

        {/* State visual preview switcher for testing the UI states */}
        <div className="flex items-center gap-1 text-[11px] text-zinc-400">
          <span className="hidden sm:inline">UI State:</span>
          {(['idle', 'listening', 'thinking', 'speaking'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setAssistantState(s)}
              className={`rounded px-1.5 py-0.5 capitalize transition-colors ${
                assistantState === s
                  ? 'bg-purple-900/60 text-purple-300 font-semibold'
                  : 'hover:text-zinc-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
        {/* Phase 1 Architecture Notice */}
        <div className="rounded-2xl border border-purple-900/40 bg-purple-950/20 p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-4 w-4 text-purple-400 shrink-0" />
            <div className="text-xs text-zinc-300 leading-relaxed">
              <span className="font-semibold text-purple-300">Phase 1 Architecture Foundation:</span>
              <p className="mt-1 text-zinc-400">
                Natural-language parser UI, speech visualizers, and alarm confirmation schemas are fully wired. In Phase 2, live voice input will connect directly to the Gemini 2.0 streaming pipeline and Android SpeechRecognizer.
              </p>
            </div>
          </div>
        </div>

        {/* Message Bubble Feed */}
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-md rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                  isUser
                    ? 'bg-purple-600 text-white rounded-tr-sm shadow-md'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-sm'
                }`}
              >
                <p>{msg.text}</p>

                {/* Structured Alarm Confirmation Card */}
                {msg.parsedAlarm && (
                  <div className="mt-3 rounded-xl border border-zinc-700 bg-zinc-950/80 p-3.5 text-zinc-100">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                      <span className="text-xs font-semibold text-purple-300">
                        Structured Alarm Card
                      </span>
                      <span className="font-mono-numbers text-sm font-bold text-zinc-50">
                        {msg.parsedAlarm.time}
                      </span>
                    </div>

                    <div className="mt-2 text-xs font-medium text-zinc-200">
                      {msg.parsedAlarm.label}
                    </div>

                    <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-400">
                      <span>
                        {msg.parsedAlarm.days && msg.parsedAlarm.days.length > 0
                          ? 'Weekdays'
                          : 'One-time'}
                      </span>
                      <span>·</span>
                      <span>{msg.parsedAlarm.aiBriefing ? 'AI Briefing enabled' : 'Standard'}</span>
                    </div>

                    <div className="mt-3 flex items-center gap-2 pt-2 border-t border-zinc-800">
                      {savedSuccessId === msg.id ? (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold py-1">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Alarm Added to List!</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleConfirmAlarm(msg.id, msg.parsedAlarm!)}
                          className="w-full min-h-[38px] rounded-lg bg-purple-600 hover:bg-purple-500 py-1.5 text-xs font-semibold text-white transition-colors"
                        >
                          Confirm & Save Alarm
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <span className="mt-1 text-[10px] text-zinc-400 px-1">
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          );
        })}

        {/* Listening / Thinking animation block */}
        {assistantState === 'listening' && (
          <div className="flex items-center gap-3 rounded-2xl border border-rose-900/50 bg-rose-950/20 p-4">
            <Mic className="h-5 w-5 text-rose-400 animate-pulse" />
            <div className="flex-1">
              <span className="text-xs font-semibold text-rose-200">Listening to voice command...</span>
              <div className="mt-1 flex items-center gap-1">
                {[12, 24, 18, 30, 16, 28, 14].map((h, i) => (
                  <span
                    key={i}
                    style={{ height: `${h}px` }}
                    className="w-1 bg-rose-400 rounded-full animate-bounce"
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {assistantState === 'thinking' && (
          <div className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-400">
            <Sparkles className="h-4 w-4 text-purple-400 animate-spin" />
            <span>Parsing schedule parameters & intent...</span>
          </div>
        )}
      </div>

      {/* Suggested prompts strip */}
      <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {SAMPLE_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSendMessage(prompt)}
            className="shrink-0 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-1.5 text-zinc-300 hover:border-purple-600/50 hover:text-white transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <div className="mt-2 flex items-center gap-2 border-t border-zinc-800/80 pt-3">
        <button
          type="button"
          onClick={handleToggleMic}
          aria-label={assistantState === 'listening' ? 'Stop listening' : 'Start microphone listening'}
          className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl transition-colors ${
            assistantState === 'listening'
              ? 'bg-rose-600 text-white animate-pulse'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
          }`}
        >
          {assistantState === 'listening' ? (
            <MicOff className="h-5 w-5" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSendMessage();
          }}
          placeholder="Type an alarm command or routine..."
          className="min-h-[44px] flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-4 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-purple-500 focus:outline-none"
        />

        <button
          type="button"
          onClick={() => handleSendMessage()}
          disabled={!inputText.trim()}
          aria-label="Send message"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white transition-colors"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
