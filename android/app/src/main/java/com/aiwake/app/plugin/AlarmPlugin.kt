package com.aiwake.app.plugin

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.util.Calendar

/**
 * AI Wake Native Capacitor Plugin
 * Interfaces with Android AlarmManager using exact alarm scheduling (`setAlarmClock`).
 */
@CapacitorPlugin(name = "AlarmPlugin")
class AlarmPlugin : Plugin() {

    @PluginMethod
    fun scheduleAlarm(call: PluginCall) {
        val alarmId = call.getString("id")
        val timeStr = call.getString("time") // "HH:MM"
        val label = call.getString("label", "Alarm")
        val soundId = call.getString("soundId", "aurora")
        val aiBriefing = call.getBoolean("aiBriefing", true)

        if (alarmId.isNullOrEmpty() || timeStr.isNullOrEmpty()) {
            call.reject("Missing required parameters: id or time")
            return
        }

        try {
            val parts = timeStr.split(":")
            val hour = parts[0].toInt()
            val minute = parts[1].toInt()

            val calendar = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, hour)
                set(Calendar.MINUTE, minute)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
                if (before(Calendar.getInstance())) {
                    add(Calendar.DAY_OF_YEAR, 1)
                }
            }

            val context = context
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            val intent = Intent(context, AlarmReceiver::class.java).apply {
                action = "com.aiwake.app.ACTION_TRIGGER_ALARM"
                putExtra("ALARM_ID", alarmId)
                putExtra("ALARM_LABEL", label)
                putExtra("ALARM_SOUND", soundId)
                putExtra("ALARM_AI_BRIEFING", aiBriefing)
            }

            val requestCode = alarmId.hashCode()
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            // Create showIntent pointing to MainActivity
            val showIntent = Intent(context, com.aiwake.app.MainActivity::class.java)
            val showPendingIntent = PendingIntent.getActivity(
                context,
                requestCode,
                showIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            // AlarmClockInfo guarantees execution even under aggressive Android Doze mode
            val alarmClockInfo = AlarmManager.AlarmClockInfo(calendar.timeInMillis, showPendingIntent)
            alarmManager.setAlarmClock(alarmClockInfo, pendingIntent)

            val result = JSObject().apply {
                put("success", true)
                put("scheduledTimeMillis", calendar.timeInMillis)
            }
            call.resolve(result)
        } catch (e: Exception) {
            call.reject("Failed to schedule alarm: ${e.localizedMessage}", e)
        }
    }

    @PluginMethod
    fun cancelAlarm(call: PluginCall) {
        val alarmId = call.getString("id")
        if (alarmId.isNullOrEmpty()) {
            call.reject("Missing alarm id")
            return
        }

        try {
            val context = context
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(context, AlarmReceiver::class.java).apply {
                action = "com.aiwake.app.ACTION_TRIGGER_ALARM"
            }
            val requestCode = alarmId.hashCode()
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
            )

            if (pendingIntent != null) {
                alarmManager.cancel(pendingIntent)
                pendingIntent.cancel()
            }

            val result = JSObject().apply {
                put("success", true)
            }
            call.resolve(result)
        } catch (e: Exception) {
            call.reject("Failed to cancel alarm: ${e.localizedMessage}", e)
        }
    }

    @PluginMethod
    fun checkPermissions(call: PluginCall) {
        val context = context
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager

        val canScheduleExact = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            alarmManager.canScheduleExactAlarms()
        } else {
            true
        }

        val isIgnoringBattery = powerManager.isIgnoringBatteryOptimizations(context.packageName)

        val result = JSObject().apply {
            put("exactAlarm", canScheduleExact)
            put("batteryExempt", isIgnoringBattery)
            put("notifications", true)
            put("fullScreenIntent", true)
        }
        call.resolve(result)
    }

    @PluginMethod
    fun requestExactAlarmPermission(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                data = Uri.parse("package:${context.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        }
        call.resolve(JSObject().apply { put("granted", true) })
    }

    @PluginMethod
    fun requestBatteryOptimizationExemption(call: PluginCall) {
        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
            data = Uri.parse("package:${context.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        call.resolve(JSObject().apply { put("granted", true) })
    }

    @PluginMethod
    fun testTriggerAlarm(call: PluginCall) {
        val alarmId = call.getString("id", "test_alarm")
        val intent = Intent(context, AlarmReceiver::class.java).apply {
            action = "com.aiwake.app.ACTION_TRIGGER_ALARM"
            putExtra("ALARM_ID", alarmId)
            putExtra("ALARM_LABEL", "Test Wake Alarm")
        }
        context.sendBroadcast(intent)
        call.resolve(JSObject().apply { put("success", true) })
    }
}
