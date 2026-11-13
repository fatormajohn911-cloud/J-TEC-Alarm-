package com.aiwake.app.plugin

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

/**
 * AI Wake Native Capacitor Plugin
 * Handles exact alarm scheduling via AlarmManager.setAlarmClock(), 3 notification channels,
 * WorkManager offline briefing preparation, and Android reliability permission checks.
 */
@CapacitorPlugin(
    name = "AlarmPlugin",
    permissions = [
        Permission(
            alias = "notifications",
            strings = [Manifest.permission.POST_NOTIFICATIONS]
        )
    ]
)
class AlarmPlugin : Plugin() {

    override fun load() {
        super.load()
        AlarmNotificationHelper.createNotificationChannels(context)
    }

    @PluginMethod
    fun scheduleAlarm(call: PluginCall) {
        val alarmId = call.getString("id")
        val timeStr = call.getString("time")
        val label = call.getString("label", "Alarm") ?: "Alarm"
        val soundId = call.getString("soundId", "aurora") ?: "aurora"
        val volume = call.getInt("volume", 85) ?: 85
        val vibrate = call.getBoolean("vibrate", true) ?: true
        val snoozeIntervalMinutes = call.getInt("snoozeIntervalMinutes", 9) ?: 9
        val snoozeLimit = call.getInt("snoozeLimit", 3) ?: 3
        val aiBriefing = call.getBoolean("aiBriefing", true) ?: true
        val aiVoiceStyle = call.getString("aiVoiceStyle", "warm") ?: "warm"

        if (alarmId.isNullOrEmpty() || timeStr.isNullOrEmpty()) {
            call.reject("Missing required parameters: id or time")
            return
        }

        try {
            val daysJson = call.getArray("days", JSArray()) ?: JSArray()
            val days = mutableListOf<Int>()
            for (i in 0 until daysJson.length()) {
                days.add(daysJson.optInt(i))
            }

            val storedAlarm = StoredAlarm(
                id = alarmId,
                time = timeStr,
                days = days,
                label = label,
                soundId = soundId,
                volume = volume,
                vibrate = vibrate,
                snoozeIntervalMinutes = snoozeIntervalMinutes,
                snoozeLimit = snoozeLimit,
                aiBriefing = aiBriefing,
                aiVoiceStyle = aiVoiceStyle,
                enabled = true,
                briefingReady = AlarmStore.hasBriefingAudio(context, alarmId)
            )

            val scheduledMillis = AlarmScheduler.scheduleAlarm(context, storedAlarm)

            val result = JSObject().apply {
                put("success", true)
                put("scheduledTimeMillis", scheduledMillis)
                put("briefingReady", storedAlarm.briefingReady)
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
            AlarmScheduler.cancelAlarm(context, alarmId, removeFromStore = true)
            call.resolve(JSObject().apply { put("success", true) })
        } catch (e: Exception) {
            call.reject("Failed to cancel alarm: ${e.localizedMessage}", e)
        }
    }

    @PluginMethod
    fun getScheduledAlarms(call: PluginCall) {
        val list = AlarmStore.getAllAlarms(context)
        val arr = JSArray()
        for (alarm in list) {
            val obj = alarm.toJson()
            obj.put("briefingReady", AlarmStore.hasBriefingAudio(context, alarm.id))
            arr.put(obj)
        }
        call.resolve(JSObject().apply { put("alarms", arr) })
    }

    @PluginMethod
    fun getBriefingStatus(call: PluginCall) {
        val alarmId = call.getString("id")
        if (alarmId.isNullOrEmpty()) {
            call.resolve(JSObject().apply { put("ready", false) })
            return
        }
        val ready = AlarmStore.hasBriefingAudio(context, alarmId)
        call.resolve(JSObject().apply { put("ready", ready) })
    }

    @PluginMethod
    fun syncBriefingContext(call: PluginCall) {
        val userName = call.getString("userName", "Friend") ?: "Friend"
        val routinesJson = call.getArray("routines", JSArray())?.toString() ?: "[]"
        val serverUrl = call.getString("serverUrl", "") ?: ""
        val includeWeather = call.getBoolean("includeWeather", true) ?: true
        val includeCalendar = call.getBoolean("includeCalendar", true) ?: true
        val includeMotivation = call.getBoolean("includeMotivation", true) ?: true
        val voiceStyle = call.getString("voiceStyle", "warm") ?: "warm"

        AlarmStore.saveBriefingContext(
            context = context,
            userName = userName,
            routinesJson = routinesJson,
            serverUrl = serverUrl,
            includeWeather = includeWeather,
            includeCalendar = includeCalendar,
            includeMotivation = includeMotivation,
            voiceStyle = voiceStyle
        )
        call.resolve(JSObject().apply { put("success", true) })
    }

    @PluginMethod
    fun checkPermissions(call: PluginCall) {
        call.resolve(buildPermissionSnapshot())
    }

    private fun buildPermissionSnapshot(): JSObject {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val notificationManager =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val canScheduleExact = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            alarmManager.canScheduleExactAlarms()
        } else {
            true
        }

        val isIgnoringBattery = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            powerManager.isIgnoringBatteryOptimizations(context.packageName)
        } else {
            true
        }

        val hasNotifications = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }

        val hasFullScreenIntent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            notificationManager.canUseFullScreenIntent()
        } else {
            true
        }

        return JSObject().apply {
            put("exactAlarm", canScheduleExact)
            put("batteryExempt", isIgnoringBattery)
            put("notifications", hasNotifications)
            put("fullScreenIntent", hasFullScreenIntent)
        }
    }

    @PluginMethod
    fun requestNotificationPermission(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val state = getPermissionState("notifications")
            if (state != PermissionState.GRANTED) {
                requestPermissionForAlias("notifications", call, "notificationsPermsCallback")
                return
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        }
        call.resolve(JSObject().apply { put("granted", true) })
    }

    @PermissionCallback
    private fun notificationsPermsCallback(call: PluginCall) {
        val granted = getPermissionState("notifications") == PermissionState.GRANTED
        if (!granted && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        }
        call.resolve(JSObject().apply { put("granted", granted) })
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
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val granted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            alarmManager.canScheduleExactAlarms()
        } else {
            true
        }
        call.resolve(JSObject().apply { put("granted", granted) })
    }

    @PluginMethod
    fun requestFullScreenIntentPermission(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            val intent = Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT).apply {
                data = Uri.parse("package:${context.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        }
        val notificationManager =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val granted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            notificationManager.canUseFullScreenIntent()
        } else {
            true
        }
        call.resolve(JSObject().apply { put("granted", granted) })
    }

    @PluginMethod
    fun requestBatteryOptimizationExemption(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:${context.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        }
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val granted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            powerManager.isIgnoringBatteryOptimizations(context.packageName)
        } else {
            true
        }
        call.resolve(JSObject().apply { put("granted", granted) })
    }

    @PluginMethod
    fun testTriggerAlarm(call: PluginCall) {
        val alarmId = call.getString("id", "test_alarm") ?: "test_alarm"
        val intent = Intent(context, AlarmReceiver::class.java).apply {
            action = AlarmScheduler.ACTION_TRIGGER_ALARM
            putExtra("ALARM_ID", alarmId)
            putExtra("ALARM_LABEL", "Test Wake Alarm")
        }
        context.sendBroadcast(intent)
        call.resolve(JSObject().apply { put("success", true) })
    }
}
