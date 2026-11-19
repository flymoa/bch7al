// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', 'scripts/*'] },
  {
    rules: {
      // Animated.Value kept in useRef(...).current is the standard React Native pattern.
      'react-hooks/refs': 'off',
      // Apostrophes in French copy: this is a native app, not HTML.
      'react/no-unescaped-entities': 'off',
    },
  },
]);
