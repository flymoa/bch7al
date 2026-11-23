// Same rule as PayDay: the app's own JS intro is the ONLY branded opening.
// Android 12+ draws an icon on its system launch screen; with a bitmap (even a transparent
// one) some phones fall back to the launcher icon, so the logo flashed before the intro.
// Here the launch icon is a 1 dp transparent shape and its background is transparent too:
// the launch screen is plain night ink, then the intro pops the bubble once.
const { withAndroidStyles, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const EMPTY = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <size android:width="1dp" android:height="1dp" />
    <solid android:color="#00000000" />
</shape>
`;

function setItem(style, name, value) {
  style.item = (style.item ?? []).filter((i) => i.$.name !== name);
  style.item.push({ $: { name }, _: value });
}

module.exports = function withBlankLaunchIcon(config) {
  config = withDangerousMod(config, ['android', async (c) => {
    const dir = path.join(c.modRequest.platformProjectRoot, 'app/src/main/res/drawable');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'launch_empty.xml'), EMPTY);
    return c;
  }]);
  return withAndroidStyles(config, (c) => {
    for (const style of c.modResults.resources.style ?? []) {
      if (style.$.name !== 'Theme.App.SplashScreen') continue;
      setItem(style, 'windowSplashScreenAnimatedIcon', '@drawable/launch_empty');
      setItem(style, 'windowSplashScreenIconBackgroundColor', '@android:color/transparent');
      style.item = style.item.filter((i) => i.$.name !== 'android:windowSplashScreenBehavior');
    }
    return c;
  });
};
