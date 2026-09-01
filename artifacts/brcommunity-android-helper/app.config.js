const base = require('./app.json');

module.exports = ({ config }) => {
  const expo = { ...(base.expo || {}), ...(config || {}) };
  const plugins = Array.isArray(expo.plugins) ? [...expo.plugins] : [];
  const org = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;
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
  return { ...expo, plugins };
};
