/**
 * App release label shown in the UI (home + Partida header).
 * Bump on every commit we deploy. v1.0 only when the owner says so.
 */
export const APP_VERSION = '0.99.421.04';

export const APP_VERSION_LABEL = `v${APP_VERSION}`;

export const APP_VERSION_NOTES = [
  {
    version: '0.99.421.04',
    date: '2026-09-18',
    notes: [
      '1v1: no pedir otro voto al ir 1-1; cada respuesta suma sus votos',
      'Barra verde de 8s para la siguiente ronda (hay que montarla en play)',
    ],
  },
  {
    version: '0.99.421.03',
    date: '2026-09-18',
    notes: [
      '1v1: cada voto suma 1 a esa respuesta. Sin empate extra.',
    ],
  },
  {
    version: '0.99.421',
    date: '2026-09-18',
    notes: [
      'Multi: el menú pide 2–8 jugadores al crear',
    ],
  },
] as const;
