/**
 * App release label shown in the UI (home + Partida header).
 * Bump this when shipping a visible change to Vercel / stores.
 */
export const APP_VERSION = '0.4';

/** Short note for humans / changelog. */
export const APP_VERSION_NOTES = [
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
      'Anti-repetición de preguntas reforzada',
      'Favoritos: pregunta blanca / respuesta naranja',
      'Gate +18 y aviso de guardado local',
      'Pantalla compartir + Solo por defecto',
      'Versión en header de Partida',
    ],
  },
  {
    version: '0.1',
    date: '2026-09-12',
    notes: ['MVP Solo jugable (Expo web)'],
  },
] as const;
