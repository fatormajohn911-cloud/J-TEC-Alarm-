package com.aiwake.app.plugin

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager

/**
 * Handles exact alarm triggers, 2-hour upcoming reminders, "Skip once",
 * and lock-screen notification Snooze/Dismiss actions without opening the app.
 */
class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        val alarmId = intent.getStringExtra("ALARM_ID") ?: "default_alarm"

        when (action) {
            AlarmScheduler.ACTION_SHOW_UPCOMING -> {
                val label = intent.getStringExtra("ALARM_LABEL") ?: "Alarm"
                val timeFormatted = intent.getStringExtra("ALARM_TIME_FORMATTED") ?: ""
                if (timeFormatted.isNotEmpty()) {
                    AlarmNotificationHelper.showUpcomingNotification(
                        context,
                        alarmId,
                        timeFormatted,
                        label
                    )
                }
            }

            AlarmScheduler.ACTION_SKIP_ONCE -> {
                AlarmScheduler.skipOnce(context, alarmId)
            }

            AlarmScheduler.ACTION_DISMISS_ALARM -> {
                AlarmNotificationHelper.cancelAlarmNotification(context)
                AlarmNotificationHelper.cancelUpcomingNotification(context)
                val stopIntent = Intent(context, AlarmService::class.java).apply {
                    this.action = "ACTION_DISMISS"
                }
                context.startService(stopIntent)
            }

            AlarmScheduler.ACTION_SNOOZE_ALARM -> {
                val label = intent.getStringExtra("ALARM_LABEL") ?: "Alarm"
                val snoozeMinutes = intent.getIntExtra("ALARM_SNOOZE_MINUTES", 9)
                AlarmNotificationHelper.cancelAlarmNotification(context)
                val snoozeIntent = Intent(context, AlarmService::class.java).apply {
                    this.action = "ACTION_SNOOZE"
                }
                context.startService(snoozeIntent)
                AlarmScheduler.scheduleSnooze(context, alarmId, label, snoozeMinutes)
            }

            else -> {
                val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
                val wakeLock = powerManager.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
                    "AIWake:AlarmReceiverWakeLock"
                )
                wakeLock.acquire(60 * 1000L)

                AlarmNotificationHelper.cancelUpcomingNotification(context)

                val label = intent.getStringExtra("ALARM_LABEL") ?: "Wake Up Alarm"
                val soundId = intent.getStringExtra("ALARM_SOUND") ?: "aurora"
                val volume = intent.getIntExtra("ALARM_VOLUME", 85)
                val vibrate = intent.getBooleanExtra("ALARM_VIBRATE", true)
                val snoozeMinutes = intent.getIntExtra("ALARM_SNOOZE_MINUTES", 9)
                val aiBriefing = intent.getBooleanExtra("ALARM_AI_BRIEFING", true)
                val isSnooze = intent.getBooleanExtra("ALARM_IS_SNOOZE", false)

                val serviceIntent = Intent(context, AlarmService::class.java).apply {
                    putExtra("ALARM_ID", alarmId)
                    putExtra("ALARM_LABEL", label)
                    putExtra("ALARM_SOUND", soundId)
                    putExtra("ALARM_VOLUME", volume)
                    putExtra("ALARM_VIBRATE", vibrate)
                    putExtra("ALARM_SNOOZE_MINUTES", snoozeMinutes)
                    putExtra("ALARM_AI_BRIEFING", aiBriefing)
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent)
                } else {
                    context.startService(serviceIntent)
                }

                if (!isSnooze) {
                    val stored = AlarmStore.getAlarm(context, alarmId)
                    if (stored != null && stored.enabled) {
                        if (stored.days.isEmpty()) {
                            AlarmStore.setAlarmEnabled(context, alarmId, false)
                        } else {
                            AlarmScheduler.scheduleAlarm(context, stored, skipImmediate = false)
                        }
                    }
                }
            }
        }
    }
}
