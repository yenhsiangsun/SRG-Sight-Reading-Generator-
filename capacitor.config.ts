import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yenhsiang.sightreadinggenerator',
  appName: 'Sight Reading Generator',
  webDir: 'dist',
  ios: {
    backgroundColor: '#f7f2e8',
    preferredContentMode: 'mobile',
    scrollEnabled: true,
  },
};

export default config;
