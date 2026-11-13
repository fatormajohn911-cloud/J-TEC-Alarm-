package com.aiwake.app.plugin

import android.content.Context
import android.util.Base64
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Background WorkManager task scheduled ~60 minutes before an alarm with AI Briefing enabled.
 * Prepares the spoken briefing text (TEXT API) and audio file (VOICE API) and stores the WAV clip
 * in app private filesDir for instant zero-network playback at ring time.
 */
class BriefingWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : Worker(appContext, workerParams) {

    override fun doWork(): Result {
        val alarmId = inputData.getString(KEY_ALARM_ID) ?: return Result.success()
        val alarm = AlarmStore.getAlarm(applicationContext, alarmId) ?: return Result.success()
        if (!alarm.enabled || !alarm.aiBriefing) {
            return Result.success()
        }

        val serverBaseUrl = AlarmStore.getServerUrl(applicationContext).trimEnd('/')
        if (serverBaseUrl.isEmpty()) {
            return Result.success()
        }

        return try {
            val briefingText = fetchBriefingText(serverBaseUrl, alarm)
            if (briefingText.isNullOrBlank()) {
                return Result.success()
            }

            val voiceStyle = alarm.aiVoiceStyle.ifBlank {
                AlarmStore.getDefaultVoiceStyle(applicationContext)
            }
            val wavBytes = fetchBriefingAudio(serverBaseUrl, briefingText, voiceStyle)
                ?: return Result.success()

            AlarmStore.clearAllBriefingAudio(applicationContext)

            val targetFile: File = AlarmStore.getBriefingAudioFile(applicationContext, alarmId)
            FileOutputStream(targetFile).use { fos ->
                fos.write(wavBytes)
                fos.flush()
            }

            AlarmStore.setBriefingReady(applicationContext, alarmId, true)
            Result.success()
        } catch (_: Exception) {
            Result.success()
        }
    }

    private fun fetchBriefingText(serverBaseUrl: String, alarm: StoredAlarm): String? {
        val todayDow = java.util.Calendar.getInstance().get(java.util.Calendar.DAY_OF_WEEK) - 1
        val allRoutines = try {
            JSONArray(AlarmStore.getRoutinesJson(applicationContext))
        } catch (_: Exception) {
            JSONArray()
        }
        val todayRoutines = JSONArray()
        for (i in 0 until allRoutines.length()) {
            val item = allRoutines.optJSONObject(i) ?: continue
            if (item.optInt("dayOfWeek", -1) == todayDow) {
                todayRoutines.put(JSONObject().apply {
                    put("time", item.optString("time"))
                    put("title", item.optString("title"))
                    put("durationMinutes", item.optInt("durationMinutes", 15))
                })
            }
        }

        val dateFormatted = SimpleDateFormat("EEEE, MMM d, h:mm a", Locale.getDefault()).format(Date())
        val payload = JSONObject().apply {
            put("userName", AlarmStore.getUserName(applicationContext))
            put("alarmLabel", alarm.label)
            put("currentDateTime", dateFormatted)
            put("routines", todayRoutines)
            put("includeWeather", AlarmStore.getIncludeWeather(applicationContext))
            put("includeCalendar", AlarmStore.getIncludeCalendar(applicationContext))
            put("includeMotivation", AlarmStore.getIncludeMotivation(applicationContext))
            put(
                "voiceStyle",
                alarm.aiVoiceStyle.ifBlank { AlarmStore.getDefaultVoiceStyle(applicationContext) }
            )
        }

        val response = postJson("$serverBaseUrl/api/briefing/generate", payload.toString())
            ?: return null
        val json = JSONObject(response)
        return json.optString("briefingText", json.optString("text", "")).takeIf { it.isNotBlank() }
    }

    private fun fetchBriefingAudio(
        serverBaseUrl: String,
        text: String,
        persona: String
    ): ByteArray? {
        val payload = JSONObject().apply {
            put("text", text.take(600))
            put("persona", persona)
        }

        val response = postJson("$serverBaseUrl/api/voice/tts", payload.toString()) ?: return null
        val json = JSONObject(response)
        val audioBase64 = json.optString("audioBase64", "")
        if (audioBase64.isEmpty()) return null

        val mimeType = json.optString("mimeType", "audio/wav").lowercase(Locale.ROOT)
        val rawBytes = Base64.decode(audioBase64, Base64.DEFAULT)

        val needsWavHeader =
            mimeType.contains("l16") ||
                mimeType.contains("pcm") ||
                (mimeType.contains("wav") && !hasRiffWavHeader(rawBytes))

        return if (needsWavHeader) wrapPcmInWavHeader(rawBytes) else rawBytes
    }

    private fun postJson(urlStr: String, body: String): String? {
        var conn: HttpURLConnection? = null
        return try {
            val url = URL(urlStr)
            conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 15000
                readTimeout = 25000
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
            conn.outputStream.use { os ->
                os.write(body.toByteArray(Charsets.UTF_8))
                os.flush()
            }
            val code = conn.responseCode
            if (code !in 200..299) {
                return null
            }
            val buffer = ByteArrayOutputStream()
            conn.inputStream.use { input ->
                val chunk = ByteArray(4096)
                var read: Int
                while (input.read(chunk).also { read = it } != -1) {
                    buffer.write(chunk, 0, read)
                }
            }
            buffer.toString("UTF-8")
        } catch (_: Exception) {
            null
        } finally {
            conn?.disconnect()
        }
    }

    private fun hasRiffWavHeader(bytes: ByteArray): Boolean {
        return bytes.size >= 12 &&
            bytes[0] == 'R'.code.toByte() &&
            bytes[1] == 'I'.code.toByte() &&
            bytes[2] == 'F'.code.toByte() &&
            bytes[3] == 'F'.code.toByte() &&
            bytes[8] == 'W'.code.toByte() &&
            bytes[9] == 'A'.code.toByte() &&
            bytes[10] == 'V'.code.toByte() &&
            bytes[11] == 'E'.code.toByte()
    }

    private fun wrapPcmInWavHeader(
        pcmBytes: ByteArray,
        sampleRate: Int = 24000,
        numChannels: Int = 1,
        bitsPerSample: Int = 16
    ): ByteArray {
        val header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN)
        val byteRate = sampleRate * numChannels * bitsPerSample / 8
        val blockAlign = (numChannels * bitsPerSample / 8).toShort()

        header.put("RIFF".toByteArray(Charsets.US_ASCII))
        header.putInt(36 + pcmBytes.size)
        header.put("WAVE".toByteArray(Charsets.US_ASCII))
        header.put("fmt ".toByteArray(Charsets.US_ASCII))
        header.putInt(16)
        header.putShort(1)
        header.putShort(numChannels.toShort())
        header.putInt(sampleRate)
        header.putInt(byteRate)
        header.putShort(blockAlign)
        header.putShort(bitsPerSample.toShort())
        header.put("data".toByteArray(Charsets.US_ASCII))
        header.putInt(pcmBytes.size)

        return header.array() + pcmBytes
    }

    companion object {
        const val KEY_ALARM_ID = "alarm_id"
    }
}
