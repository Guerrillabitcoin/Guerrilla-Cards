/**
 * App release label shown in the UI (home + Partida header).
 * Bump this when shipping a visible change to Vercel / stores.
 * UI always prefixes with "v" via APP_VERSION_LABEL.
 */
export const APP_VERSION = '0.70';

/** Display form, e.g. `v0.69` — use this in UI next to Partida / home. */
export const APP_VERSION_LABEL = `v${APP_VERSION}`;

export const APP_VERSION_NOTES = [
  {
    version: '0.70',
    date: '2026-09-13',
    notes: [
      '+111 preguntas nuevas (core + packs temáticos)',
    ],
  },
  {
    version: '0.69',
    date: '2026-09-13',
    notes: [
      'Vercel Analytics + Speed Insights',
      'Telemetría de cartas jugadas/descartadas',
      'Versión con prefijo v junto a Partida',
    ],
  },
  {
    version: '0.6',
    date: '2026-09-12',
    notes: [
      'PC: letras más grandes en cartas y packs (usan mejor el alto)',
    ],
  },
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
    notes: ['Sorteo de preguntas con máxima entropía'],
  },
  {
    version: '0.3',
    date: '2026-09-12',
    notes: ['Versión visible en inicio'],
  },
  {
    version: '0.2',
    date: '2026-09-12',
    notes: ['Anti-repetición, favoritos, +18, compartir, Solo'],
  },
  {
    version: '0.1',
    date: '2026-09-12',
    notes: ['MVP Solo'],
  },
] as const;
