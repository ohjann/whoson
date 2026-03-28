#!/usr/bin/env node
/**
 * sync-version.js
 *
 * Reads version from package.json and syncs it to:
 *   - capacitor.config.ts (appVersion)
 *   - altstore/source.json (version, versionDate, downloadURL, size)
 *   - ios/App/App.xcodeproj/project.pbxproj (MARKETING_VERSION)
 *   - android/app/build.gradle (versionName, versionCode)
 *
 * Android versionCode is derived from semver: 1.2.3 -> 10203
 *
 * Environment variables (optional, used by CI release job):
 *   GITHUB_REPOSITORY  - e.g. "owner/whoson" (updates altstore downloadURL)
 *   IPA_SIZE           - IPA file size in bytes (updates altstore size)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Read version from package.json
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const version = pkg.version;

// Derive Android versionCode from semver (1.2.3 -> 10203)
const parts = version.split('.').map((n) => parseInt(n, 10));
const [major = 0, minor = 0, patch = 0] = parts;
const versionCode = major * 10000 + minor * 100 + patch;

console.log(`Syncing version ${version} (versionCode: ${versionCode})`);

// --- capacitor.config.ts ---
const capConfigPath = resolve(root, 'capacitor.config.ts');
if (existsSync(capConfigPath)) {
  let capConfig = readFileSync(capConfigPath, 'utf8');
  if (capConfig.includes('appVersion:')) {
    capConfig = capConfig.replace(/appVersion:\s*['"][^'"]*['"]/, `appVersion: '${version}'`);
  } else {
    // Insert appVersion after webDir line
    capConfig = capConfig.replace(
      /(webDir:\s*['"][^'"]*['"])/,
      `$1,\n  appVersion: '${version}'`
    );
  }
  writeFileSync(capConfigPath, capConfig);
  console.log('Updated capacitor.config.ts');
}

// --- altstore/source.json ---
const altstorePath = resolve(root, 'altstore/source.json');
if (existsSync(altstorePath)) {
  const source = JSON.parse(readFileSync(altstorePath, 'utf8'));
  const today = new Date().toISOString().split('T')[0];

  if (source.apps && source.apps[0]) {
    source.apps[0].version = version;
    source.apps[0].versionDate = today;

    // Update downloadURL if GITHUB_REPOSITORY is set (CI release job)
    const repo = process.env.GITHUB_REPOSITORY;
    if (repo) {
      source.apps[0].downloadURL = `https://github.com/${repo}/releases/download/v${version}/WhosOn.ipa`;
    } else {
      // Keep existing URL structure but update the version in it
      source.apps[0].downloadURL = source.apps[0].downloadURL.replace(
        /\/v[^/]+\/WhosOn\.ipa$/,
        `/v${version}/WhosOn.ipa`
      );
    }

    // Update size if IPA_SIZE env var is set
    const ipaSize = process.env.IPA_SIZE;
    if (ipaSize) {
      source.apps[0].size = parseInt(ipaSize, 10);
    }
  }

  writeFileSync(altstorePath, JSON.stringify(source, null, 2) + '\n');
  console.log('Updated altstore/source.json');
}

// --- iOS project.pbxproj (MARKETING_VERSION) ---
const iosPbxprojPath = resolve(root, 'ios/App/App.xcodeproj/project.pbxproj');
if (existsSync(iosPbxprojPath)) {
  let pbxproj = readFileSync(iosPbxprojPath, 'utf8');
  pbxproj = pbxproj.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`);
  writeFileSync(iosPbxprojPath, pbxproj);
  console.log('Updated iOS MARKETING_VERSION');
} else {
  console.log('Skipping iOS (ios/ not present)');
}

// --- Android app/build.gradle (versionName, versionCode) ---
const androidBuildGradlePath = resolve(root, 'android/app/build.gradle');
if (existsSync(androidBuildGradlePath)) {
  let buildGradle = readFileSync(androidBuildGradlePath, 'utf8');
  buildGradle = buildGradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
  buildGradle = buildGradle.replace(/versionName\s+["'][^"']*["']/, `versionName "${version}"`);
  writeFileSync(androidBuildGradlePath, buildGradle);
  console.log('Updated Android versionName/versionCode');
} else {
  console.log('Skipping Android (android/ not present)');
}

console.log('Version sync complete!');
