package com.aiwake.app.plugin

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager

/**
 * Triggered by Android AlarmManager when an exact alarm clock fires.
 */
class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "AIWake:AlarmReceiverWakeLock"
        )
        wakeLock.acquire(60 * 1000L /* 1 minute */)

        val alarmId = intent.getStringExtra("ALARM_ID") ?: "default_alarm"
        val label = intent.getStringExtra("ALARM_LABEL") ?: "Wake Up Alarm"
        val soundId = intent.getStringExtra("ALARM_SOUND") ?: "aurora"
        val aiBriefing = intent.getBooleanExtra("ALARM_AI_BRIEFING", true)

        val serviceIntent = Intent(context, AlarmService::class.java).apply {
            putExtra("ALARM_ID", alarmId)
            putExtra("ALARM_LABEL", label)
            putExtra("ALARM_SOUND", soundId)
            putExtra("ALARM_AI_BRIEFING", aiBriefing)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }
    }
}
