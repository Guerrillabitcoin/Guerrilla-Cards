export const APP_VERSION = '0.99.421.24';
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
export const APP_VERSION_NOTES = [
  {
    version: '0.99.421.24',
    date: '2026-09-25',
    notes: [
      'Liga: acumula +1 por partida ganada (ya no se resetea a 1)',
    ],
  },
  {
    version: '0.99.421.23',
    date: '2026-09-25',
    notes: [
      'Liga: los puntos se guardan por código de sala y se arrastran al reiniciar',
    ],
  },
] as const;
