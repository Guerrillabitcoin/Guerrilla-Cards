/**
 * App release label shown in the UI (home + Partida header).
 * Bump this when shipping a visible change to Vercel / stores.
 */
export const APP_VERSION = '0.5';

export const APP_VERSION_NOTES = [
  {
    version: '0.5',
    date: '2026-09-12',
    notes: [
      'Al crear partida: un solo mazo mezclado (no pack a pack)',
      'Baraja distinta en cada nueva / reinicio',
    ],
  },
  {
    version: '0.4',
    date: '2026-09-12',
    notes: [
      'Sorteo de preguntas con máxima entropía (Fisher–Yates uniforme)',
      'Sin sesgo por pack en el orden del mazo',
    ],
  },
  {
    version: '0.3',
    date: '2026-09-12',
    notes: ['Versión visible también en la pantalla de inicio'],
  },
  {
    version: '0.2',
    date: '2026-09-12',
    notes: [
      'Anti-repetición, favoritos blanco/naranja, +18, compartir, Solo',
    ],
  },
  {
    version: '0.1',
    date: '2026-09-12',
    notes: ['MVP Solo jugable (Expo web)'],
  },
] as const;
