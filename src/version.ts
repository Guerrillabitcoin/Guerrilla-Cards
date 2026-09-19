/**
 * App release label shown in the UI (home + Partida header).
 * Bump on every commit we deploy. v1.0 only when the owner says so.
 */
export const APP_VERSION = '0.99.421.07';

export const APP_VERSION_LABEL = `v${APP_VERSION}`;

export const APP_VERSION_NOTES = [
  {
    version: '0.99.421.07',
    date: '2026-09-18',
    notes: [
      'Espera: lista de quién ha respondido y a quién se espera',
      'Fin de ronda: clasificación con +puntos, total y si adelanta',
    ],
  },
  {
    version: '0.99.421.05',
    date: '2026-09-18',
    notes: ['1v1 Empate vs Puntaco'],
  },
] as const;
