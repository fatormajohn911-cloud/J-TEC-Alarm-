package com.aiwake.app.plugin

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import com.aiwake.app.MainActivity
import com.aiwake.app.R

object AlarmNotificationHelper {
    const val CHANNEL_ALARMS = "ai_wake_alarms"
    const val CHANNEL_UPCOMING = "ai_wake_upcoming"
    const val CHANNEL_BRIEFING = "ai_wake_briefing"

    const val NOTIFICATION_ID_ALARM = 40401
    const val NOTIFICATION_ID_UPCOMING = 40402

    fun createNotificationChannels(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            // 1. Alarms channel: high importance, bypass DND, alarm sound
            val alarmsChannel = NotificationChannel(
                CHANNEL_ALARMS,
                "Alarms",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Urgent alarms that ring over lock screens"
                setBypassDnd(true)
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 200, 500, 200, 500)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                val alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                setSound(
                    alarmSound,
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
            }

            // 2. Upcoming alarm channel: low importance, silent ongoing reminder
            val upcomingChannel = NotificationChannel(
                CHANNEL_UPCOMING,
                "Upcoming alarm",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Silent reminder shown 2 hours before an alarm rings"
                setSound(null, null)
                enableVibration(false)
                setShowBadge(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }

            // 3. Briefing channel: default importance
            val briefingChannel = NotificationChannel(
                CHANNEL_BRIEFING,
                "Briefing",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Morning wake-up briefing preparation updates"
            }

            notificationManager.createNotificationChannel(alarmsChannel)
            notificationManager.createNotificationChannel(upcomingChannel)
            notificationManager.createNotificationChannel(briefingChannel)
        }
    }

    fun showUpcomingNotification(
        context: Context,
        alarmId: String,
        timeFormatted: String,
        label: String
    ) {
        createNotificationChannels(context)

        val openAppIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val openPendingIntent = PendingIntent.getActivity(
            context,
            (alarmId + "_upcoming_open").hashCode(),
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val skipIntent = Intent(context, AlarmReceiver::class.java).apply {
            action = AlarmScheduler.ACTION_SKIP_ONCE
            putExtra("ALARM_ID", alarmId)
        }
        val skipPendingIntent = PendingIntent.getBroadcast(
            context,
            (alarmId + "_skip_once").hashCode(),
            skipIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val displayLabel = if (label.isNotBlank()) label else "Alarm"
        val notification = NotificationCompat.Builder(context, CHANNEL_UPCOMING)
            .setSmallIcon(R.drawable.ic_stat_ai_wake)
            .setContentTitle("Next alarm: $timeFormatted")
            .setContentText(displayLabel)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setSilent(true)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(openPendingIntent)
            .addAction(0, "Skip once", skipPendingIntent)
            .build()

        val notificationManager =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID_UPCOMING, notification)
    }

    fun cancelUpcomingNotification(context: Context) {
        val notificationManager =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.cancel(NOTIFICATION_ID_UPCOMING)
    }

    fun cancelAlarmNotification(context: Context) {
        val notificationManager =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.cancel(NOTIFICATION_ID_ALARM)
    }

    fun buildAlarmNotification(
        context: Context,
        alarmId: String,
        label: String,
        snoozeMinutes: Int = 9
    ): Notification {
        createNotificationChannels(context)

        // Full-Screen Intent to display MainActivity over lock screen
        val fullScreenIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("RINGING_ALARM_ID", alarmId)
        }
        val fullScreenPendingIntent = PendingIntent.getActivity(
            context,
            alarmId.hashCode(),
            fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Direct broadcast Dismiss action (works without opening the app)
        val dismissIntent = Intent(context, AlarmReceiver::class.java).apply {
            action = AlarmScheduler.ACTION_DISMISS_ALARM
            putExtra("ALARM_ID", alarmId)
        }
        val dismissPendingIntent = PendingIntent.getBroadcast(
            context,
            (alarmId + "_dismiss").hashCode(),
            dismissIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Direct broadcast Snooze action (works without opening the app)
        val snoozeIntent = Intent(context, AlarmReceiver::class.java).apply {
            action = AlarmScheduler.ACTION_SNOOZE_ALARM
            putExtra("ALARM_ID", alarmId)
            putExtra("ALARM_LABEL", label)
            putExtra("ALARM_SNOOZE_MINUTES", snoozeMinutes)
        }
        val snoozePendingIntent = PendingIntent.getBroadcast(
            context,
            (alarmId + "_snooze").hashCode(),
            snoozeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val safeLabel = if (label.isNotBlank()) label else "Wake Up Alarm"

        return NotificationCompat.Builder(context, CHANNEL_ALARMS)
            .setSmallIcon(R.drawable.ic_stat_ai_wake)
            .setContentTitle("AI Wake — $safeLabel")
            .setContentText("Alarm ringing · Snooze or dismiss")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(fullScreenPendingIntent)
            .setOngoing(true)
            .setAutoCancel(false)
            .addAction(0, "Snooze ${snoozeMinutes}m", snoozePendingIntent)
            .addAction(0, "Dismiss", dismissPendingIntent)
            .build()
    }
}
