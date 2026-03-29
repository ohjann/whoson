import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.whoson.app',
  appName: 'WhosOn',
  webDir: 'build',
  appVersion: '0.0.3',
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
