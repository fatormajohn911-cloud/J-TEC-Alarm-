import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AssistantState, ChatMessage } from '../types/assistant';
import { Alarm } from '../types/alarm';
import { storageService } from '../services/storageService';
import { PageHeader } from '../components/layout/PageHeader';
import { hapticsService } from '../services/hapticsService';
import {
  Mic,
  MicOff,
  Send,
  CheckCircle2,
  Clock,
  AlarmClock,
} from 'lucide-react';

interface AssistantPageProps {
  onBack: () => void;
  onAddAlarm: (alarm: Omit<Alarm, 'id' | 'createdAt'>) => void;
  onNavigateToAlarms?: () => void;
}

const SUGGESTION_CHIPS = [
  'Wake me at 6:30 on weekdays',
  'Set a 20 min nap',
  'What can AI Wake do?',
  'Schedule 8:00 AM gentle awake',
];

export const AssistantPage: React.FC<AssistantPageProps> = ({
  onBack,
  onAddAlarm,
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

    hapticsService.light();

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

    setAssistantState('thinking');

    setTimeout(() => {
      // Analyze text: distinguish alarm requests vs conversational questions
      const hasAlarmIntent =
        /\b(alarm|wake|nap|timer|clock|\d{1,2}:\d{2}|\d{1,2}\s*(am|pm))\b/i.test(text);

      let assistantReplyText = '';
      let parsedAlarmData: Partial<Alarm> | undefined = undefined;

      if (hasAlarmIntent) {
        let parsedTime = '07:00';
        let parsedLabel = 'Smart Wake Alarm';
        let parsedDays = [1, 2, 3, 4, 5];

        if (/6:30/i.test(text)) {
          parsedTime = '06:30';
          parsedLabel = 'Morning Workout & Briefing';
          parsedDays = [1, 2, 3, 4, 5];
        } else if (/20\s*min|nap/i.test(text)) {
          const future = new Date(Date.now() + 20 * 60000);
          parsedTime = `${future.getHours().toString().padStart(2, '0')}:${future.getMinutes().toString().padStart(2, '0')}`;
          parsedLabel = 'Power Recharge Nap';
          parsedDays = [];
        } else if (/8:00|sat/i.test(text)) {
          parsedTime = '08:00';
          parsedLabel = 'Gentle Weekend Awake';
          parsedDays = [6];
        }

        assistantReplyText = `I have parsed your wake request: "${text}". Here is the confirmation card ready to save to your alarms:`;
        parsedAlarmData = {
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
        };
      } else {
        // Conversational non-alarm response!
        assistantReplyText =
          "I can help you set recurring alarms, schedule quick power naps, manage your morning wake routine, and configure your daily spoken AI briefing. Just ask me to set an alarm for any time!";
      }

      const assistantMsg: ChatMessage = {
        id: `msg_ai_${Date.now()}`,
        sender: 'assistant',
        text: assistantReplyText,
        timestamp: Date.now(),
        parsedAlarm: parsedAlarmData,
        actionSuggested: parsedAlarmData ? 'confirm_alarm' : undefined,
      };

      setAssistantState('speaking');

      setMessages((prev) => {
        const updated = [...prev, assistantMsg];
        storageService.saveChatHistory(updated);
        return updated;
      });

      setTimeout(() => {
        setAssistantState('idle');
      }, 2000);
    }, 1100);
  };

  const handleToggleMic = () => {
    if (assistantState === 'idle') {
      hapticsService.medium();
      setAssistantState('listening');
      setTimeout(() => {
        setAssistantState('idle');
        handleSendMessage('Wake me at 6:30 on weekdays');
      }, 2500);
    } else {
      hapticsService.light();
      setAssistantState('idle');
    }
  };

  const handleConfirmAlarm = (msgId: string, parsed: Partial<Alarm>) => {
    hapticsService.success();
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
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-white text-[#1E1B4B] flex flex-col justify-between">
      {/* Top Bar with Back Button */}
      <PageHeader
        title="AI Assistant"
        subtitle="Natural language alarm management"
        onBack={onBack}
      />

      {/* Main Chat Feed */}
      <div className="mx-auto w-full max-w-xl px-4 py-3 flex-1 flex flex-col justify-between overflow-hidden">
        <div className="flex-1 space-y-4 overflow-y-auto pr-1 pb-4">
          {/* Centered Date Separator */}
          <div className="flex items-center justify-center my-2">
            <span className="text-[11px] font-bold text-[#6B7280] bg-[#F3F3F5] px-3 py-1 rounded-full">
              Today
            </span>
          </div>

          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-md rounded-[22px] p-4 text-xs sm:text-sm leading-relaxed shadow-xs ${
                    isUser
                      ? 'bg-[#3B3D78] text-white rounded-tr-xs'
                      : 'bg-[#F3F3F5] text-[#1E1B4B] rounded-tl-xs'
                  }`}
                >
                  <p className="font-medium">{msg.text}</p>

                  {/* ONLY show structured alarm confirmation card when parsedAlarm exists! */}
                  {msg.parsedAlarm && (
                    <div className="mt-3 rounded-2xl bg-white p-4 shadow-sm border border-gray-100 text-[#1E1B4B]">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                        <span className="text-xs font-bold text-[#9C1C7C]">
                          Structured Alarm
                        </span>
                        <span className="font-mono-numbers text-base font-extrabold text-[#9C1C7C]">
                          {msg.parsedAlarm.time}
                        </span>
                      </div>

                      <div className="mt-2 text-xs font-bold text-[#1E1B4B]">
                        {msg.parsedAlarm.label}
                      </div>

                      <div className="mt-1 flex items-center gap-2 text-[11px] text-[#6B7280]">
                        <span>
                          {msg.parsedAlarm.days && msg.parsedAlarm.days.length > 0
                            ? 'Weekdays'
                            : 'One-time'}
                        </span>
                        <span>·</span>
                        <span>{msg.parsedAlarm.aiBriefing ? 'AI Briefing' : 'Standard'}</span>
                      </div>

                      <div className="mt-3 pt-2 border-t border-gray-100">
                        {savedSuccessId === msg.id ? (
                          <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-600 font-bold py-1">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Alarm Saved to Schedule!</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleConfirmAlarm(msg.id, msg.parsedAlarm!)}
                            className="w-full min-h-[42px] rounded-xl bg-[#9C1C7C] hover:bg-[#86176a] py-2 text-xs font-bold text-white transition-colors shadow-sm"
                          >
                            Confirm & Save Alarm
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Typing Indicator while thinking */}
          {assistantState === 'thinking' && (
            <div className="flex items-center gap-2.5 bg-[#F3F3F5] px-4 py-3 rounded-2xl w-fit">
              <span className="text-xs font-bold text-[#6B7280]">AI Wake is thinking</span>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#9C1C7C] animate-pulse" />
                <span className="h-2 w-2 rounded-full bg-[#9C1C7C] animate-pulse [animation-delay:200ms]" />
                <span className="h-2 w-2 rounded-full bg-[#9C1C7C] animate-pulse [animation-delay:400ms]" />
              </div>
            </div>
          )}

          {assistantState === 'listening' && (
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-red-50 border border-red-100">
              <Mic className="h-5 w-5 text-red-500 animate-pulse" />
              <div className="flex-1">
                <span className="text-xs font-bold text-red-600">Listening to voice command...</span>
                <div className="mt-1 flex items-center gap-1">
                  {[12, 24, 18, 30, 16, 28, 14].map((h, i) => (
                    <span
                      key={i}
                      style={{ height: `${h}px` }}
                      className="w-1 bg-red-500 rounded-full animate-bounce"
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Suggestion Chips Above Input */}
        <div className="pt-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
            {SUGGESTION_CHIPS.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(chip)}
                className="shrink-0 rounded-full bg-[#F3F3F5] hover:bg-gray-200 px-3.5 py-1.5 text-xs font-bold text-[#3B3D78] transition-colors shadow-xs active:scale-95"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Fixed Input Bar at the Bottom */}
          <div className="flex items-center gap-2 border-t border-gray-100 pt-3 pb-safe">
            <button
              type="button"
              onClick={handleToggleMic}
              aria-label={assistantState === 'listening' ? 'Stop mic' : 'Start mic'}
              className={`flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full transition-colors ${
                assistantState === 'listening'
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-[#F3F3F5] text-[#3B3D78] hover:bg-gray-200'
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
              placeholder="Ask AI: 'Wake me at 6:45 AM tomorrow'..."
              className="min-h-[48px] flex-1 rounded-full bg-[#F3F3F5] px-4 text-xs sm:text-sm text-[#1E1B4B] placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-[#9C1C7C] focus:outline-none transition-all"
            />

            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim()}
              aria-label="Send message"
              className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-[#3B3D78] hover:bg-[#2E2F6B] disabled:opacity-40 text-white transition-colors shadow-sm"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
