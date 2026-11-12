# AI Wake — Intelligent Android Alarm Clock & Assistant

AI Wake is an intelligent, privacy-first Android alarm clock and personal wake-up assistant built with **React**, **TypeScript**, **Capacitor**, and custom **Kotlin native plugins**. It is engineered to bridge modern web UI fluidity with rock-solid Android `AlarmManager` reliability.

---

## 1. Phase 1 Architecture Overview

```
src/
├── components/
│   ├── layout/            # AppHeader, BottomNavigation, NotificationDrawer, AndroidStatusBarMock
│   ├── alarm/             # AlarmCard, AlarmFormModal
│   ├── assistant/         # Assistant conversational interface & structured parser cards
│   ├── schedule/          # Schedule timeline, AddRoutineModal
│   └── common/            # DigitalClock (live ticking & glow), ToggleSwitch, audio synthesizers
├── pages/
│   ├── HomePage.tsx       # Live digital clock, next alarm countdown, quick nap, today routines
│   ├── AssistantPage.tsx  # Natural language prompt interface, listening/thinking/speaking states
│   ├── SchedulePage.tsx   # Day-of-week routine scheduler & habit alignment
│   ├── AlarmsPage.tsx     # Full alarm CRUD, repeat days, sound preview, test ring launcher
│   ├── SettingsPage.tsx   # Clock formats, AI voice style, Android permissions & reliability
│   └── AlarmRingingScreen.tsx # Dedicated full-screen ringing experience with soundwaves & briefing
├── services/
│   ├── nativeAlarmPlugin.ts # Capacitor plugin TypeScript bridge + Web Audio API fallback engine
│   └── storageService.ts    # Local-first persistence layer for alarms, routines, and settings
├── hooks/
│   ├── useAlarms.ts       # Accurate countdown math, CRUD, and native plugin dispatch
│   ├── useClock.ts        # Tabular live clock hook with 12h/24h and greeting calculation
│   ├── useSchedule.ts     # Daily routines and checklist management
│   └── useSettings.ts     # Global user preferences & permission states
└── types/                 # Domain interfaces for alarms, routines, assistant, and settings

android/
└── app/src/main/
    ├── AndroidManifest.xml # Exact alarm, full-screen intent, wakelock, and boot permissions
    └── java/com/aiwake/app/
        ├── MainActivity.kt # BridgeActivity with lock-screen wake flags & plugin registration
        └── plugin/
            ├── AlarmPlugin.kt            # CapacitorPlugin exposing scheduleAlarm, checkPermissions
            ├── AlarmReceiver.kt          # BroadcastReceiver triggered by AlarmManager
            ├── AlarmService.kt           # Foreground Service playing ringtone & vibration
            ├── AlarmNotificationHelper.kt# High-priority channel & full-screen lock intent
            └── BootReceiver.kt           # Restores scheduled alarms on Android reboot
```

---

## 2. Android Native Alarm Reliability Strategy

Android 12+ (API 31+) and OEM battery optimizations (e.g. Samsung OneUI, Xiaomi MIUI) aggressively kill background timers. AI Wake solves this with native Android best practices:

1. **`AlarmManager.setAlarmClock()`**: Uses exact hardware alarms that punch through Android Doze mode and show the official alarm icon in the Android status bar.
2. **`USE_FULL_SCREEN_INTENT` & `showWhenLocked`**: Allows the alarm ringing screen to display directly over the device lock screen without requiring user fingerprint or PIN first.
3. **`PARTIAL_WAKE_LOCK`**: `AlarmReceiver` acquires a CPU wake lock immediately upon receipt to guarantee the CPU does not sleep before starting `AlarmService`.
4. **Foreground Service**: `AlarmService` runs as a `mediaPlayback` foreground service with high-priority notifications to avoid being killed by the Android system.
5. **`RECEIVE_BOOT_COMPLETED`**: `BootReceiver` automatically reschedules all active alarms when the phone restarts.

---

## 3. Five Core Application Screens & Special Ringing Screen

1. **Home**:
   - Large live digital clock with tabular figures, date, and dynamic time-of-day greeting.
   - Next upcoming alarm card with live countdown (`Rings in 6h 32m`) and toggle.
   - Quick power nap actions (+20m Nap, +45m Rest, Custom).
   - AI assistant entry card and today's schedule preview.
2. **AI Assistant**:
   - Conversational layout with message bubbles.
   - Visual state indicators: *Idle*, *Listening*, *Thinking*, *Speaking*.
   - Structured alarm cards parsed from natural language, with a 1-tap "Confirm & Save Alarm" action.
3. **Daily Schedule**:
   - Day-of-week switcher (Sun–Sat) with checklist completion and category filters.
   - Routines tied to morning wake-up protocols (hydration, sunlight, focus blocks).
4. **Alarms**:
   - Complete alarm management (create, edit, delete, toggle).
   - Day recurrence selectors (M, T, W, T, F, S, S), snooze intervals, and ringtone preview.
   - Dedicated "Test Ring" button on each alarm to launch the ringing experience.
5. **Settings & Reliability**:
   - Clock preferences (12/24 hour, live seconds toggle).
   - Simulated Android device frame preview toggle.
   - AI voice persona selection (Warm & Serene, Morning Coach, Executive Briefing).
   - Android system permissions audit (`SCHEDULE_EXACT_ALARM`, `IGNORE_BATTERY_OPTIMIZATIONS`).
6. **Special Screen: Full-Screen Alarm Ringing Experience**:
   - Completely replaces header and bottom navigation.
   - Displays massive readable digital clock and alarm label.
   - Animated audio soundwave frequency visualizer.
   - Spoken AI morning briefing transcript with simulated step-by-step delivery.
   - High-contrast Dismiss and Snooze controls.

---

## 4. Development & Android Build Instructions

### Run the Web Preview Locally
```bash
npm install
npm run dev
```

### Build Web Distribution
```bash
npm run build
```

### Package into Android via Capacitor
```bash
# Add Android native platform (first time)
npx cap add android

# Sync web assets and Kotlin plugin code into the Android project
npx cap sync android

# Open project in Android Studio to build APK or run on connected device/emulator
npx cap open android
```

---

## 5. Phase 2 Roadmap

- **Gemini 2.0 Voice Briefings**: Synthesizes real-time weather, commute traffic, and calendar events into personalized audio wake-up messages.
- **Android SpeechRecognizer Integration**: Hands-free voice commands to snooze, dismiss, or schedule alarms.
- **Sleep Quality Tracking**: Integration with Android Health Connect.
