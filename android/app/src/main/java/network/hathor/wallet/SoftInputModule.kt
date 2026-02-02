package network.hathor.wallet

import android.graphics.Rect
import android.view.ViewTreeObserver
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.modules.core.DeviceEventManagerModule

class SoftInputModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private var globalLayoutListener: ViewTreeObserver.OnGlobalLayoutListener? = null
    private var lastKeyboardHeight = 0

    override fun getName(): String = "SoftInputModule"

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for NativeEventEmitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for NativeEventEmitter
    }

    @ReactMethod
    fun startKeyboardListener() {
        UiThreadUtil.runOnUiThread {
            val activity = currentActivity ?: return@runOnUiThread
            val rootView = activity.window.decorView.rootView

            globalLayoutListener = ViewTreeObserver.OnGlobalLayoutListener {
                val rect = Rect()
                rootView.getWindowVisibleDisplayFrame(rect)

                val density = reactApplicationContext.resources.displayMetrics.density
                val screenHeightPx = rootView.height
                val keyboardHeightPx = screenHeightPx - rect.bottom

                // Get navigation bar height
                val resourceId = reactApplicationContext.resources.getIdentifier(
                    "navigation_bar_height", "dimen", "android"
                )
                val navBarHeightPx = if (resourceId > 0) {
                    reactApplicationContext.resources.getDimensionPixelSize(resourceId)
                } else {
                    0
                }

                // Subtract navigation bar from keyboard height since it's always present
                val adjustedKeyboardPx = if (keyboardHeightPx > navBarHeightPx) {
                    keyboardHeightPx - navBarHeightPx
                } else {
                    0
                }

                // Convert to density-independent pixels (dp) for React Native
                val keyboardHeightDp = (adjustedKeyboardPx / density).toInt()
                val navBarDp = (navBarHeightPx / density).toInt()

                // Only send event if keyboard height changed significantly (> 50dp threshold for keyboard)
                val isVisible = keyboardHeightDp > 50

                if (keyboardHeightDp != lastKeyboardHeight) {
                    lastKeyboardHeight = keyboardHeightDp

                    val params = Arguments.createMap().apply {
                        putInt("height", keyboardHeightDp)
                        putInt("navBarDp", navBarDp)
                        putInt("rawKbDp", (keyboardHeightPx / density).toInt())
                        putBoolean("isVisible", isVisible)
                    }

                    reactApplicationContext
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        .emit("keyboardHeightChanged", params)
                }
            }

            rootView.viewTreeObserver.addOnGlobalLayoutListener(globalLayoutListener)
        }
    }

    @ReactMethod
    fun stopKeyboardListener() {
        UiThreadUtil.runOnUiThread {
            val activity = currentActivity ?: return@runOnUiThread
            val rootView = activity.window.decorView.rootView
            globalLayoutListener?.let {
                rootView.viewTreeObserver.removeOnGlobalLayoutListener(it)
            }
            globalLayoutListener = null
            lastKeyboardHeight = 0
        }
    }
}
