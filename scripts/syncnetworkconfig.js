#!/usr/bin/env node
import { networkInterfaces } from 'os';
import { writeFileSync, readFileSync } from 'fs';

function getLocalIP() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const ip = getLocalIP();
const port = process.env.PORT || 5173;
const configPath = new URL('../capacitor.config.ts', import.meta.url).pathname;

let config = readFileSync(configPath, 'utf-8');

if (config.includes('server:')) {
  // Update existing server URL
  config = config.replace(
    /url: 'http:\/\/[^']+'/,
    `url: 'http://${ip}:${port}'`
  );
  writeFileSync(configPath, config);
  console.log(`Capacitor dev server updated: http://${ip}:${port}`);
} else {
  // Inject server config
  config = config.replace(
    "webDir: 'build'",
    `webDir: 'build',\n  server: {\n    url: 'http://${ip}:${port}',\n    cleartext: true\n  }`
  );
  writeFileSync(configPath, config);
  console.log(`Capacitor dev server configured: http://${ip}:${port}`);
}
