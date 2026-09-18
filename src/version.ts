/**
 * App release label shown in the UI (home + Partida header).
 * Bump N in 0.99.N on every commit we deploy.
 * UI always prefixes with "v" via APP_VERSION_LABEL.
 */
export const APP_VERSION = '0.99.421.01';

/** Display form, e.g. `v0.69` — use this in UI next to Partida / home. */
export const APP_VERSION_LABEL = `v${APP_VERSION}`;

export const APP_VERSION_NOTES = [
  {
    version: '0.99.421',
    date: '2026-09-18',
    notes: [
      'Multi: el menú pide 2–8 jugadores al crear y la sala usa ese tope',
      'Textos ya no dicen que el multi es solo para 4',
    ],
  },
  {
    version: '0.99.420',
    date: '2026-09-18',
    notes: [
      'Docs Grok: AGENTS + arquitectura + cicatrices + preview vs main',
      'Producto visible: Solo, Multijugador, Reto semanal (este último aún no)',
      'Cicatrices: una sola baraja por partida; no regenerar el mazo en cada robo',
    ],
  },
] as const;
