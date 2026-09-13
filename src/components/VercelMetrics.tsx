import { Platform } from 'react-native';

/**
 * Web-only Vercel Analytics + Speed Insights.
 * Renders nothing on native / Expo Go.
 */
export function VercelMetrics() {
  if (Platform.OS !== 'web') return null;
  // Require at runtime so Metro/native bundles do not pull these packages.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Analytics } = require('@vercel/analytics/react') as typeof import('@vercel/analytics/react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SpeedInsights } = require('@vercel/speed-insights/react') as typeof import('@vercel/speed-insights/react');
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
