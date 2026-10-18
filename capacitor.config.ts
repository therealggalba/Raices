import type { CapacitorConfig } from '@capacitor/cli';

// Android app (APK). The web build for the APK is `npm run build:android`
// (Vite `--mode android`: base "/" instead of /raices/).
const config: CapacitorConfig = {
  appId: 'com.ggalba.raices',
  appName: 'Raíces',
  webDir: 'dist',
  android: {
    // Light app background while the WebView starts.
    backgroundColor: '#fbfaf8',
  },
  plugins: {
    // Edge to edge: the app is drawn under the status and navigation bars and
    // gets their real sizes as CSS variables (--safe-area-inset-*), which the
    // styles use to keep everything clear of them.
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
    LocalNotifications: {
      iconColor: '#e46c16',
    },
  },
};

export default config;
