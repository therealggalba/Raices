import type { CapacitorConfig } from '@capacitor/cli';

// Android app (APK). The web build for the APK is `npm run build:android`
// (Vite `--mode android`: base "/" instead of /family-memories/).
const config: CapacitorConfig = {
  appId: 'com.ggalba.familymemories',
  appName: 'FamilyMemories',
  webDir: 'dist',
  android: {
    // Dark app: no white flash while the WebView starts.
    backgroundColor: '#0e0d12',
  },
  plugins: {
    LocalNotifications: {
      iconColor: '#f2b45a',
    },
  },
};

export default config;
