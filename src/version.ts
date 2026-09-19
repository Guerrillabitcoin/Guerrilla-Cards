/**
 * App release label shown in the UI (home + Partida header).
 * Bump on every commit we deploy. v1.0 only when the owner says so.
 */
export const APP_VERSION = '0.99.421.08';

export const APP_VERSION_LABEL = `v${APP_VERSION}`;

export const APP_VERSION_NOTES = [
  {
    version: '0.99.421.08',
    date: '2026-09-18',
    notes: [
      'Claim de jugador si no hay cookies',
      'Enlaces por jugador para recuperar mano y fase',
      'Unirse al lobby con /?code=XXXX',
    ],
  },
] as const;
