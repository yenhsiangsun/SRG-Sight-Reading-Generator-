import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yenhsiang.sightreadinggenerator',
  appName: 'Sight Reading Generator',
  webDir: 'dist',
  android: {
    backgroundColor: '#f7f2e8',
  },
  plugins: {
    SystemBars: {
      style: 'LIGHT',
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
  },
  ios: {
    // CSS owns the safe area for the page, sticky controls and dialogs.
    contentInset: 'never',
    backgroundColor: '#f7f2e8',
    preferredContentMode: 'mobile',
    scrollEnabled: true,
  },
};

export default config;
