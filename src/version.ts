/**
 * App release label shown in the UI (home + Partida header).
 * Bump on every commit we deploy. v1.0 only when the owner says so.
 */
export const APP_VERSION = '0.99.421.03';

export const APP_VERSION_LABEL = `v${APP_VERSION}`;

export const APP_VERSION_NOTES = [
  {
    version: '0.99.421.03',
    date: '2026-09-18',
    notes: [
      '1v1: cada voto suma 1 a esa respuesta (2-0 → +2, 1-1 → +1 cada uno). Sin empate.',
    ],
  },
  {
    version: '0.99.421.01',
    date: '2026-09-18',
    notes: [
      '1v1: se ven las dos respuestas y puedes votar la tuya',
    ],
  },
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
