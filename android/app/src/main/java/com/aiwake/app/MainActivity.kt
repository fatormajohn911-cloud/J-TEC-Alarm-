package com.aiwake.app

import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import com.aiwake.app.plugin.AlarmPlugin
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Register the custom Kotlin Alarm Capacitor Plugin
        registerPlugin(AlarmPlugin::class.java)
        super.onCreate(savedInstanceState)

        // Ensure alarm screen can wake and show on top of keyguard when triggered
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            )
        }
    }
}
