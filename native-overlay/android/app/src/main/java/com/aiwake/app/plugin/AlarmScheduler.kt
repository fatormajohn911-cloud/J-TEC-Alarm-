package com.aiwake.app.plugin

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.work.Constraints
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.aiwake.app.MainActivity
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

object AlarmScheduler {
    const val ACTION_TRIGGER_ALARM = "com.aiwake.app.ACTION_TRIGGER_ALARM"
    const val ACTION_SHOW_UPCOMING = "com.aiwake.app.ACTION_SHOW_UPCOMING"
    const val ACTION_SKIP_ONCE = "com.aiwake.app.ACTION_SKIP_ONCE"
    const val ACTION_SNOOZE_ALARM = "com.aiwake.app.ACTION_SNOOZE_ALARM"
    const val ACTION_DISMISS_ALARM = "com.aiwake.app.ACTION_DISMISS_ALARM"

    private const val TWO_HOURS_MILLIS = 2L * 60L * 60L * 1000L
    private const val ONE_HOUR_MILLIS = 60L * 60L * 1000L

    fun calculateNextTriggerMillis(
        timeStr: String,
        days: List<Int>,
        skipImmediate: Boolean = false
    ): Long {
        val parts = timeStr.split(":")
        val hour = parts.getOrNull(0)?.toIntOrNull() ?: 7
        val minute = parts.getOrNull(1)?.toIntOrNull() ?: 0

        val now = Calendar.getInstance()

        if (days.isEmpty()) {
            val candidate = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, hour)
                set(Calendar.MINUTE, minute)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
                if (!after(now)) {
                    add(Calendar.DAY_OF_YEAR, 1)
                }
                if (skipImmediate) {
                    add(Calendar.DAY_OF_YEAR, 1)
                }
            }
            return candidate.timeInMillis
        }

        var earliestMillis = Long.MAX_VALUE
        for (jsDay in days) {
            val targetCalDow = (jsDay % 7) + 1
            val candidate = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, hour)
                set(Calendar.MINUTE, minute)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)

                val currentCalDow = get(Calendar.DAY_OF_WEEK)
                var dayOffset = targetCalDow - currentCalDow
                if (dayOffset < 0) dayOffset += 7
                add(Calendar.DAY_OF_YEAR, dayOffset)

                if (!after(now)) {
                    add(Calendar.DAY_OF_YEAR, 7)
                }
            }
            if (candidate.timeInMillis < earliestMillis) {
                earliestMillis = candidate.timeInMillis
            }
        }

        if (skipImmediate && earliestMillis != Long.MAX_VALUE) {
            var secondEarliest = Long.MAX_VALUE
            for (jsDay in days) {
                val targetCalDow = (jsDay % 7) + 1
                val candidate = Calendar.getInstance().apply {
                    set(Calendar.HOUR_OF_DAY, hour)
                    set(Calendar.MINUTE, minute)
                    set(Calendar.SECOND, 0)
                    set(Calendar.MILLISECOND, 0)
                    val currentCalDow = get(Calendar.DAY_OF_WEEK)
                    var dayOffset = targetCalDow - currentCalDow
                    if (dayOffset < 0) dayOffset += 7
                    add(Calendar.DAY_OF_YEAR, dayOffset)
                    if (!after(now)) {
                        add(Calendar.DAY_OF_YEAR, 7)
                    }
                    if (timeInMillis <= earliestMillis) {
                        add(Calendar.DAY_OF_YEAR, 7)
                    }
                }
                if (candidate.timeInMillis < secondEarliest) {
                    secondEarliest = candidate.timeInMillis
                }
            }
            return secondEarliest
        }

        return earliestMillis
    }

    fun scheduleAlarm(context: Context, alarm: StoredAlarm, skipImmediate: Boolean = false): Long {
        AlarmNotificationHelper.createNotificationChannels(context)
        AlarmStore.saveOrUpdateAlarm(context, alarm)

        if (!alarm.enabled) {
            cancelAlarm(context, alarm.id, removeFromStore = false)
            return -1L
        }

        val triggerAtMillis = calculateNextTriggerMillis(alarm.time, alarm.days, skipImmediate)
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        val triggerIntent = Intent(context, AlarmReceiver::class.java).apply {
            action = ACTION_TRIGGER_ALARM
            putExtra("ALARM_ID", alarm.id)
            putExtra("ALARM_LABEL", alarm.label)
            putExtra("ALARM_SOUND", alarm.soundId)
            putExtra("ALARM_VOLUME", alarm.volume)
            putExtra("ALARM_VIBRATE", alarm.vibrate)
            putExtra("ALARM_SNOOZE_MINUTES", alarm.snoozeIntervalMinutes)
            putExtra("ALARM_AI_BRIEFING", alarm.aiBriefing)
            putExtra("ALARM_AI_VOICE_STYLE", alarm.aiVoiceStyle)
        }
        val triggerPending = PendingIntent.getBroadcast(
            context,
            alarm.id.hashCode(),
            triggerIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val showIntent = Intent(context, MainActivity::class.java)
        val showPending = PendingIntent.getActivity(
            context,
            alarm.id.hashCode(),
            showIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val alarmClockInfo = AlarmManager.AlarmClockInfo(triggerAtMillis, showPending)
        alarmManager.setAlarmClock(alarmClockInfo, triggerPending)

        scheduleUpcomingReminder(context, alarm, triggerAtMillis)

        if (alarm.aiBriefing) {
            scheduleBriefingPrep(context, alarm.id, triggerAtMillis)
        } else {
            cancelBriefingPrep(context, alarm.id)
        }

        return triggerAtMillis
    }

    fun scheduleSnooze(
        context: Context,
        alarmId: String,
        label: String,
        snoozeMinutes: Int
    ) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val stored = AlarmStore.getAlarm(context, alarmId)
        val triggerAtMillis = System.currentTimeMillis() + snoozeMinutes * 60L * 1000L

        val triggerIntent = Intent(context, AlarmReceiver::class.java).apply {
            action = ACTION_TRIGGER_ALARM
            putExtra("ALARM_ID", alarmId)
            putExtra("ALARM_LABEL", label.ifBlank { stored?.label ?: "Snoozed Alarm" })
            putExtra("ALARM_SOUND", stored?.soundId ?: "aurora")
            putExtra("ALARM_VOLUME", stored?.volume ?: 85)
            putExtra("ALARM_VIBRATE", stored?.vibrate ?: true)
            putExtra("ALARM_SNOOZE_MINUTES", snoozeMinutes)
            putExtra("ALARM_AI_BRIEFING", stored?.aiBriefing ?: false)
            putExtra("ALARM_AI_VOICE_STYLE", stored?.aiVoiceStyle ?: "warm")
            putExtra("ALARM_IS_SNOOZE", true)
        }
        val triggerPending = PendingIntent.getBroadcast(
            context,
            (alarmId + "_snooze_trigger").hashCode(),
            triggerIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val showPending = PendingIntent.getActivity(
            context,
            (alarmId + "_snooze_show").hashCode(),
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        alarmManager.setAlarmClock(AlarmManager.AlarmClockInfo(triggerAtMillis, showPending), triggerPending)
    }

    private fun scheduleUpcomingReminder(
        context: Context,
        alarm: StoredAlarm,
        triggerAtMillis: Long
    ) {
        val now = System.currentTimeMillis()
        val upcomingTimeFormatted = formatTimeForDisplay(triggerAtMillis)
        val showUpcomingAt = triggerAtMillis - TWO_HOURS_MILLIS

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val upcomingIntent = Intent(context, AlarmReceiver::class.java).apply {
            action = ACTION_SHOW_UPCOMING
            putExtra("ALARM_ID", alarm.id)
            putExtra("ALARM_LABEL", alarm.label)
            putExtra("ALARM_TIME_FORMATTED", upcomingTimeFormatted)
        }
        val upcomingPending = PendingIntent.getBroadcast(
            context,
            (alarm.id + "_upcoming").hashCode(),
            upcomingIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        alarmManager.cancel(upcomingPending)

        if (showUpcomingAt <= now) {
            AlarmNotificationHelper.showUpcomingNotification(
                context,
                alarm.id,
                upcomingTimeFormatted,
                alarm.label
            )
        } else {
            AlarmNotificationHelper.cancelUpcomingNotification(context)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    showUpcomingAt,
                    upcomingPending
                )
            } else {
                alarmManager.set(AlarmManager.RTC_WAKEUP, showUpcomingAt, upcomingPending)
            }
        }
    }

    private fun scheduleBriefingPrep(context: Context, alarmId: String, triggerAtMillis: Long) {
        val now = System.currentTimeMillis()
        val delayMillis = maxOf(0L, triggerAtMillis - ONE_HOUR_MILLIS - now)

        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val input = Data.Builder()
            .putString(BriefingWorker.KEY_ALARM_ID, alarmId)
            .build()

        val workRequest = OneTimeWorkRequestBuilder<BriefingWorker>()
            .setConstraints(constraints)
            .setInitialDelay(delayMillis, TimeUnit.MILLISECONDS)
            .setInputData(input)
            .addTag("briefing_$alarmId")
            .build()

        WorkManager.getInstance(context.applicationContext).enqueueUniqueWork(
            "briefing_$alarmId",
            ExistingWorkPolicy.REPLACE,
            workRequest
        )
    }

    private fun cancelBriefingPrep(context: Context, alarmId: String) {
        WorkManager.getInstance(context.applicationContext).cancelUniqueWork("briefing_$alarmId")
    }

    fun skipOnce(context: Context, alarmId: String) {
        AlarmNotificationHelper.cancelUpcomingNotification(context)
        val alarm = AlarmStore.getAlarm(context, alarmId) ?: return

        cancelAlarm(context, alarmId, removeFromStore = false)

        if (alarm.days.isEmpty()) {
            AlarmStore.setAlarmEnabled(context, alarmId, false)
        } else {
            scheduleAlarm(context, alarm, skipImmediate = true)
        }
    }

    fun cancelAlarm(context: Context, alarmId: String, removeFromStore: Boolean = true) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        val triggerIntent = Intent(context, AlarmReceiver::class.java).apply {
            action = ACTION_TRIGGER_ALARM
        }
        PendingIntent.getBroadcast(
            context,
            alarmId.hashCode(),
            triggerIntent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )?.let {
            alarmManager.cancel(it)
            it.cancel()
        }

        PendingIntent.getBroadcast(
            context,
            (alarmId + "_snooze_trigger").hashCode(),
            triggerIntent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )?.let {
            alarmManager.cancel(it)
            it.cancel()
        }

        val upcomingIntent = Intent(context, AlarmReceiver::class.java).apply {
            action = ACTION_SHOW_UPCOMING
        }
        PendingIntent.getBroadcast(
            context,
            (alarmId + "_upcoming").hashCode(),
            upcomingIntent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )?.let {
            alarmManager.cancel(it)
            it.cancel()
        }

        AlarmNotificationHelper.cancelUpcomingNotification(context)
        cancelBriefingPrep(context, alarmId)

        if (removeFromStore) {
            AlarmStore.removeAlarm(context, alarmId)
        }
    }

    fun rescheduleAll(context: Context) {
        AlarmNotificationHelper.createNotificationChannels(context)
        val stored = AlarmStore.getAllAlarms(context)
        for (alarm in stored) {
            if (alarm.enabled) {
                scheduleAlarm(context, alarm, skipImmediate = false)
            }
        }
    }

    fun formatTimeForDisplay(millis: Long): String {
        return SimpleDateFormat("h:mm a", Locale.getDefault()).format(Date(millis))
    }
}
