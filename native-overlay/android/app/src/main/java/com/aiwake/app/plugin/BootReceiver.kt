package com.aiwake.app.plugin

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Listens for device boot, time changes, timezone changes, and app update events
 * to re-create notification channels and reschedule all active alarms stored in AlarmStore.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        Log.i("AIWakeBootReceiver", "Received broadcast: $action. Rescheduling stored alarms.")
        AlarmScheduler.rescheduleAll(context.applicationContext)
    }
}
