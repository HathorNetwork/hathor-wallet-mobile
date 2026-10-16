package network.hathor.wallet

import android.os.Build
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.uimanager.ViewManager

/**
 * Exposes the system's font weight adjustment (+300 when the "Bold text" accessibility setting is
 * on, API 31+) to the react-native Text patch, which adds it to the default font weight so Text is
 * measured and drawn with the same typeface.
 */
class FontWeightAdjustmentModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  override fun getConstants(): Map<String, Any> {
    val adjustment =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          reactApplicationContext.resources.configuration.fontWeightAdjustment
        } else {
          0
        }
    // Configuration.FONT_WEIGHT_ADJUSTMENT_UNDEFINED is Int.MAX_VALUE.
    return mapOf("fontWeightAdjustment" to if (adjustment == Int.MAX_VALUE) 0 else adjustment)
  }

  companion object {
    const val NAME = "FontWeightAdjustment"
  }
}

class FontWeightAdjustmentPackage : ReactPackage {
  override fun createNativeModules(
      reactContext: ReactApplicationContext
  ): List<NativeModule> = listOf(FontWeightAdjustmentModule(reactContext))

  override fun createViewManagers(
      reactContext: ReactApplicationContext
  ): List<ViewManager<*, *>> = emptyList()
}
