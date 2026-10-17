import type { CapacitorConfig } from '@capacitor/cli';

// Android app (APK). The web build for the APK is `npm run build:android`
// (Vite `--mode android`: base "/" instead of /family-memories/).
const config: CapacitorConfig = {
  appId: 'com.ggalba.familymemories',
  appName: 'Raíces',
  webDir: 'dist',
  android: {
    // Light app background while the WebView starts.
    backgroundColor: '#fbfaf8',
  },
  plugins: {
    LocalNotifications: {
      iconColor: '#e46c16',
    },
  },
};

export default config;
