package com.aiwake.app.plugin

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

data class StoredAlarm(
    val id: String,
    val time: String,
    val days: List<Int>,
    val label: String,
    val soundId: String,
    val volume: Int,
    val vibrate: Boolean,
    val snoozeIntervalMinutes: Int,
    val snoozeLimit: Int,
    val aiBriefing: Boolean,
    val aiVoiceStyle: String,
    val enabled: Boolean,
    val briefingReady: Boolean = false
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("id", id)
        put("time", time)
        put("days", JSONArray(days))
        put("label", label)
        put("soundId", soundId)
        put("volume", volume)
        put("vibrate", vibrate)
        put("snoozeIntervalMinutes", snoozeIntervalMinutes)
        put("snoozeLimit", snoozeLimit)
        put("aiBriefing", aiBriefing)
        put("aiVoiceStyle", aiVoiceStyle)
        put("enabled", enabled)
        put("briefingReady", briefingReady)
    }

    companion object {
        fun fromJson(obj: JSONObject): StoredAlarm {
            val daysArr = obj.optJSONArray("days") ?: JSONArray()
            val days = mutableListOf<Int>()
            for (i in 0 until daysArr.length()) {
                days.add(daysArr.optInt(i))
            }
            return StoredAlarm(
                id = obj.optString("id"),
                time = obj.optString("time", "07:00"),
                days = days,
                label = obj.optString("label", "Alarm"),
                soundId = obj.optString("soundId", "aurora"),
                volume = obj.optInt("volume", 85),
                vibrate = obj.optBoolean("vibrate", true),
                snoozeIntervalMinutes = obj.optInt("snoozeIntervalMinutes", 9),
                snoozeLimit = obj.optInt("snoozeLimit", 3),
                aiBriefing = obj.optBoolean("aiBriefing", true),
                aiVoiceStyle = obj.optString("aiVoiceStyle", "warm"),
                enabled = obj.optBoolean("enabled", true),
                briefingReady = obj.optBoolean("briefingReady", false)
            )
        }
    }
}

object AlarmStore {
    private const val PREFS_NAME = "ai_wake_native_prefs"
    private const val KEY_ALARMS = "stored_alarms_json"
    private const val KEY_USER_NAME = "briefing_user_name"
    private const val KEY_ROUTINES = "briefing_routines_json"
    private const val KEY_SERVER_URL = "briefing_server_url"
    private const val KEY_INCLUDE_WEATHER = "briefing_include_weather"
    private const val KEY_INCLUDE_CALENDAR = "briefing_include_calendar"
    private const val KEY_INCLUDE_MOTIVATION = "briefing_include_motivation"
    private const val KEY_DEFAULT_VOICE = "briefing_default_voice"

    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    @Synchronized
    fun getAllAlarms(context: Context): List<StoredAlarm> {
        val raw = prefs(context).getString(KEY_ALARMS, "[]") ?: "[]"
        return try {
            val arr = JSONArray(raw)
            val list = mutableListOf<StoredAlarm>()
            for (i in 0 until arr.length()) {
                val item = arr.optJSONObject(i) ?: continue
                if (item.optString("id").isNotEmpty()) {
                    list.add(StoredAlarm.fromJson(item))
                }
            }
            list
        } catch (_: Exception) {
            emptyList()
        }
    }

    @Synchronized
    fun getAlarm(context: Context, alarmId: String): StoredAlarm? {
        return getAllAlarms(context).firstOrNull { it.id == alarmId }
    }

    @Synchronized
    fun saveOrUpdateAlarm(context: Context, alarm: StoredAlarm) {
        val current = getAllAlarms(context).filterNot { it.id == alarm.id }.toMutableList()
        current.add(alarm)
        persistList(context, current)
    }

    @Synchronized
    fun removeAlarm(context: Context, alarmId: String) {
        val current = getAllAlarms(context).filterNot { it.id == alarmId }
        persistList(context, current)
        deleteBriefingAudio(context, alarmId)
    }

    @Synchronized
    fun setAlarmEnabled(context: Context, alarmId: String, enabled: Boolean) {
        val current = getAllAlarms(context).map {
            if (it.id == alarmId) it.copy(enabled = enabled) else it
        }
        persistList(context, current)
    }

    @Synchronized
    fun setBriefingReady(context: Context, alarmId: String, ready: Boolean) {
        val current = getAllAlarms(context).map {
            if (it.id == alarmId) it.copy(briefingReady = ready) else it
        }
        persistList(context, current)
    }

    private fun persistList(context: Context, alarms: List<StoredAlarm>) {
        val arr = JSONArray()
        alarms.forEach { arr.put(it.toJson()) }
        prefs(context).edit().putString(KEY_ALARMS, arr.toString()).apply()
    }

    fun getBriefingAudioFile(context: Context, alarmId: String): File {
        return File(context.applicationContext.filesDir, "briefing_${alarmId}.wav")
    }

    fun hasBriefingAudio(context: Context, alarmId: String): Boolean {
        val file = getBriefingAudioFile(context, alarmId)
        return file.exists() && file.length() > 44L
    }

    fun deleteBriefingAudio(context: Context, alarmId: String) {
        try {
            val file = getBriefingAudioFile(context, alarmId)
            if (file.exists()) {
                file.delete()
            }
        } catch (_: Exception) {
        }
    }

    fun clearAllBriefingAudio(context: Context) {
        try {
            context.applicationContext.filesDir.listFiles()?.forEach { file ->
                if (file.name.startsWith("briefing_") && file.name.endsWith(".wav")) {
                    file.delete()
                }
            }
        } catch (_: Exception) {
        }
    }

    fun saveBriefingContext(
        context: Context,
        userName: String,
        routinesJson: String,
        serverUrl: String,
        includeWeather: Boolean,
        includeCalendar: Boolean,
        includeMotivation: Boolean,
        voiceStyle: String
    ) {
        prefs(context).edit()
            .putString(KEY_USER_NAME, userName)
            .putString(KEY_ROUTINES, routinesJson)
            .putString(KEY_SERVER_URL, serverUrl)
            .putBoolean(KEY_INCLUDE_WEATHER, includeWeather)
            .putBoolean(KEY_INCLUDE_CALENDAR, includeCalendar)
            .putBoolean(KEY_INCLUDE_MOTIVATION, includeMotivation)
            .putString(KEY_DEFAULT_VOICE, voiceStyle)
            .apply()
    }

    fun getUserName(context: Context): String =
        prefs(context).getString(KEY_USER_NAME, "Friend") ?: "Friend"

    fun getRoutinesJson(context: Context): String =
        prefs(context).getString(KEY_ROUTINES, "[]") ?: "[]"

    fun getServerUrl(context: Context): String =
        prefs(context).getString(KEY_SERVER_URL, "") ?: ""

    fun getIncludeWeather(context: Context): Boolean =
        prefs(context).getBoolean(KEY_INCLUDE_WEATHER, true)

    fun getIncludeCalendar(context: Context): Boolean =
        prefs(context).getBoolean(KEY_INCLUDE_CALENDAR, true)

    fun getIncludeMotivation(context: Context): Boolean =
        prefs(context).getBoolean(KEY_INCLUDE_MOTIVATION, true)

    fun getDefaultVoiceStyle(context: Context): String =
        prefs(context).getString(KEY_DEFAULT_VOICE, "warm") ?: "warm"
}
