/**
 * App release label shown in the UI (Partida header).
 * Bump this when shipping a visible change to Vercel / stores.
 */
export const APP_VERSION = '0.2';

/** Short note for humans / changelog (not shown in header). */
export const APP_VERSION_NOTES = [
  {
    version: '0.2',
    date: '2026-09-12',
    notes: [
      'Anti-repetición de preguntas reforzada',
      'Favoritos: pregunta blanca / respuesta naranja',
      'Gate +18 y aviso de guardado local',
      'Pantalla compartir + Solo por defecto',
    ],
  },
  {
    version: '0.1',
    date: '2026-09-12',
    notes: ['MVP Solo jugable (Expo web)'],
  },
] as const;
