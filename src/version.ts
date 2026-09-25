export const APP_VERSION = '0.99.421.23';
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
export const APP_VERSION_NOTES = [
  {
    version: '0.99.421.23',
    date: '2026-09-25',
    notes: [
      'Liga: los puntos se guardan por código de sala y se arrastran al reiniciar',
      'Otra manga: solo el anfitrión reparte (sin flash de pregunta vieja)',
      'Classic: el 1 del ranking se lee en blanco',
    ],
  },
  {
    version: '0.99.421.22',
    date: '2026-09-25',
    notes: [
      'Voto dividido: +0 en el ranking',
      'Liga: el +1 del ganador se guarda al reiniciar la misma sala',
    ],
  },
] as const;
