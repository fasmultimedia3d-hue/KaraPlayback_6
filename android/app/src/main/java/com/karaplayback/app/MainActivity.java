package com.karaplayback.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.karaplayback.app.LibraryPlugin;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    registerPlugin(LibraryPlugin.class);
  }
}
