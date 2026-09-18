/**
 * App release label shown in the UI (home + Partida header).
 * Bump on every commit we deploy. v1.0 only when the owner says so.
 */
export const APP_VERSION = '0.99.421.05';

export const APP_VERSION_LABEL = `v${APP_VERSION}`;

export const APP_VERSION_NOTES = [
  {
    version: '0.99.421.05',
    date: '2026-09-18',
    notes: [
      '1v1: si cada uno vota una respuesta distinta sale Empate (+1 y +1)',
      '1v1: si los dos votan la misma, Puntaco (+2)',
    ],
  },
  {
    version: '0.99.421.04',
    date: '2026-09-18',
    notes: [
      '1v1: no pedir otro voto al ir 1-1',
      'Barra verde de 8s siguiente ronda',
    ],
  },
] as const;
