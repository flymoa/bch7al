// On web (preview only), replace the phone database and dialogs with browser versions.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const config = getDefaultConfig(__dirname);
const swaps = {
  'expo-sqlite': path.resolve(__dirname, 'src/sqlite.web.tsx'),
};
const original = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    if (swaps[moduleName]) return { type: 'sourceFile', filePath: swaps[moduleName] };
    if (moduleName === '@/alert' || moduleName.endsWith('/alert')) {
      if (moduleName === '@/alert') return { type: 'sourceFile', filePath: path.resolve(__dirname, 'src/alert.web.ts') };
    }
    if (moduleName === '@/scan') {
      return { type: 'sourceFile', filePath: path.resolve(__dirname, 'src/scan.web.ts') };
    }
  }
  return original ? original(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
};
module.exports = config;
