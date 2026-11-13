package com.aiwake.app.plugin

import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

/**
 * Foreground Service that handles immediate alarm ringtone playback, vibration,
 * lockscreen notification lifecycle, and offline playback of pre-generated AI briefing audio.
 * Zero network calls are ever performed at ring time.
 */
class AlarmService : Service() {

    private var ringtonePlayer: MediaPlayer? = null
    private var briefingPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private val handler = Handler(Looper.getMainLooper())
    private var pendingBriefingRunnable: Runnable? = null
    private var ringtoneVolume: Float = 1.0f

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action

        if (action == "ACTION_DISMISS" || action == "ACTION_SNOOZE") {
            stopAlarm()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }

        val alarmId = intent?.getStringExtra("ALARM_ID") ?: "default_alarm"
        val label = intent?.getStringExtra("ALARM_LABEL") ?: "Wake Up Alarm"
        val volumePercent = intent?.getIntExtra("ALARM_VOLUME", 85) ?: 85
        val shouldVibrate = intent?.getBooleanExtra("ALARM_VIBRATE", true) ?: true
        val snoozeMinutes = intent?.getIntExtra("ALARM_SNOOZE_MINUTES", 9) ?: 9
        val aiBriefing = intent?.getBooleanExtra("ALARM_AI_BRIEFING", true) ?: true

        ringtoneVolume = (volumePercent.coerceIn(10, 100) / 100.0f)

        val notification = AlarmNotificationHelper.buildAlarmNotification(
            this,
            alarmId,
            label,
            snoozeMinutes
        )
        startForeground(AlarmNotificationHelper.NOTIFICATION_ID_ALARM, notification)

        startRingtoneAndVibration(shouldVibrate)

        if (aiBriefing) {
            scheduleOfflineBriefingPlayback(alarmId)
        }

        return START_STICKY
    }

    private fun startRingtoneAndVibration(shouldVibrate: Boolean) {
        try {
            stopPlayersOnly()

            val alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)

            ringtonePlayer = MediaPlayer().apply {
                setDataSource(applicationContext, alertUri)
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                isLooping = true
                prepare()
                setVolume(ringtoneVolume, ringtoneVolume)
                start()
            }

            if (shouldVibrate) {
                vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    val vibratorManager =
                        getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                    vibratorManager.defaultVibrator
                } else {
                    @Suppress("DEPRECATION")
                    getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                }

                val pattern = longArrayOf(0, 500, 300, 500, 300, 500)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator?.vibrate(pattern, 0)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun scheduleOfflineBriefingPlayback(alarmId: String) {
        pendingBriefingRunnable?.let { handler.removeCallbacks(it) }
        val runnable = Runnable {
            playSavedBriefingIfAvailable(alarmId)
        }
        pendingBriefingRunnable = runnable
        handler.postDelayed(runnable, 5000L)
    }

    private fun playSavedBriefingIfAvailable(alarmId: String) {
        if (!AlarmStore.hasBriefingAudio(this, alarmId)) {
            return
        }

        val audioFile = AlarmStore.getBriefingAudioFile(this, alarmId)
        try {
            val ducked = (ringtoneVolume * 0.18f).coerceAtLeast(0.08f)
            ringtonePlayer?.setVolume(ducked, ducked)

            briefingPlayer = MediaPlayer().apply {
                setDataSource(audioFile.absolutePath)
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                )
                setOnCompletionListener {
                    restoreRingtoneVolume()
                    releaseBriefingPlayer()
                }
                setOnErrorListener { _, _, _ ->
                    restoreRingtoneVolume()
                    releaseBriefingPlayer()
                    true
                }
                prepare()
                start()
            }
        } catch (_: Exception) {
            restoreRingtoneVolume()
            releaseBriefingPlayer()
        }
    }

    private fun restoreRingtoneVolume() {
        try {
            ringtonePlayer?.setVolume(ringtoneVolume, ringtoneVolume)
        } catch (_: Exception) {
        }
    }

    private fun releaseBriefingPlayer() {
        try {
            briefingPlayer?.stop()
        } catch (_: Exception) {
        }
        try {
            briefingPlayer?.release()
        } catch (_: Exception) {
        }
        briefingPlayer = null
    }

    private fun stopPlayersOnly() {
        pendingBriefingRunnable?.let { handler.removeCallbacks(it) }
        pendingBriefingRunnable = null

        releaseBriefingPlayer()
        try {
            ringtonePlayer?.stop()
        } catch (_: Exception) {
        }
        try {
            ringtonePlayer?.release()
        } catch (_: Exception) {
        }
        ringtonePlayer = null
    }

    private fun stopAlarm() {
        stopPlayersOnly()
        try {
            vibrator?.cancel()
        } catch (_: Exception) {
        }
    }

    override fun onDestroy() {
        stopAlarm()
        super.onDestroy()
    }
}
