package com.hathormobile;

import android.app.Application;

import com.facebook.react.ReactApplication;
import io.sentry.RNSentryPackage;
import com.masteratul.exceptionhandler.ReactNativeExceptionHandlerPackage;
import com.reactcommunity.rnlocalize.RNLocalizePackage;
import com.apsl.versionnumber.RNVersionNumberPackage;
import com.swmansion.reanimated.ReanimatedPackage;
import com.oblador.keychain.KeychainPackage;
import com.reactnativecommunity.asyncstorage.AsyncStoragePackage;
import com.horcrux.svg.SvgPackage;
import org.reactnative.camera.RNCameraPackage;
import com.swmansion.gesturehandler.react.RNGestureHandlerPackage;
import com.tradle.react.UdpSocketsModule;
import com.peel.react.TcpSocketsModule;
import com.peel.react.rnos.RNOSModule;
import com.bitgo.randombytes.RandomBytesPackage;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.shell.MainReactPackage;
import com.facebook.soloader.SoLoader;
import android.database.CursorWindow;

import java.lang.reflect.Field;
import java.util.Arrays;
import java.util.List;

public class MainApplication extends Application implements ReactApplication {

  private final ReactNativeHost mReactNativeHost = new ReactNativeHost(this) {
    @Override
    public boolean getUseDeveloperSupport() {
      return BuildConfig.DEBUG;
    }

    @Override
    protected List<ReactPackage> getPackages() {
      return Arrays.<ReactPackage>asList(
          new MainReactPackage(),
            new RNSentryPackage(),
            new ReactNativeExceptionHandlerPackage(),
            new RNLocalizePackage(),
            new RNVersionNumberPackage(),
            new ReanimatedPackage(),
            new KeychainPackage(),
            new AsyncStoragePackage(),
            new SvgPackage(),
            new RNCameraPackage(),
            new RNGestureHandlerPackage(),
            new UdpSocketsModule(),
            new TcpSocketsModule(),
            new RNOSModule(),
            new RandomBytesPackage()
      );
    }

    @Override
    protected String getJSMainModuleName() {
      return "index";
    }
  };

  @Override
  public ReactNativeHost getReactNativeHost() {
    return mReactNativeHost;
  }

  @Override
  public void onCreate() {
    super.onCreate();
    SoLoader.init(this, /* native exopackage */ false);

    // Starting on Android 9, the sqlite has a size limit of cursor get
    // We must increase this size because we were saving lots of data on storage
    // We should remove this in the future because we are not saving anymore
    // https://github.com/craftzdog/react-native-sqlite-2/issues/57#issuecomment-491156124

    try {
        Field field = CursorWindow.class.getDeclaredField("sCursorWindowSize");
        field.setAccessible(true);
        field.set(null, 50 * 1024 * 1024); // 50M is the new size
    } catch (Exception e) {
        if (BuildConfig.DEBUG) {
            e.printStackTrace();
        }
    }
  }
}
