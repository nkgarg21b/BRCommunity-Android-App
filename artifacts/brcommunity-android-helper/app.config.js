const base = require('./app.json');

module.exports = ({ config }) => {
  const expo = { ...(base.expo || {}), ...(config || {}) };
  const plugins = Array.isArray(expo.plugins) ? [...expo.plugins] : [];
  const org = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;
  const androidPackage = process.env.ANDROID_PACKAGE || expo.android?.package || 'com.brcommunity.androidhelper';
  const versionCode = Number.parseInt(process.env.ANDROID_VERSION_CODE || String(expo.android?.versionCode || 1), 10);

  if (!Number.isInteger(versionCode) || versionCode < 1) {
    throw new Error('ANDROID_VERSION_CODE must be a positive integer.');
  }

  if (!/^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)+$/.test(androidPackage)) {
    throw new Error('ANDROID_PACKAGE must be a valid Android application ID.');
  }

  if (org && project && !plugins.some((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) === '@sentry/react-native/expo')) {
    plugins.push([
      '@sentry/react-native/expo',
      {
        organization: org,
        project,
        url: process.env.SENTRY_URL || 'https://sentry.io/',
      },
    ]);
  }

  return {
    ...expo,
    android: {
      ...(expo.android || {}),
      package: androidPackage,
      versionCode,
      allowBackup: false,
    },
    plugins,
  };
};
