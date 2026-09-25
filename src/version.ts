export const APP_VERSION = '0.99.421.22';
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
export const APP_VERSION_NOTES = [
  {
    version: '0.99.421.22',
    date: '2026-09-25',
    notes: [
      'Voto dividido: +0 en el ranking (2–3 solo el texto; 4+ opciones y votos)',
      'Liga: el +1 del ganador se guarda al reiniciar la misma sala',
      'El 3.er jugador entra a resultados cuando la sala llega a la meta',
    ],
  },
  {
    version: '0.99.421.21',
    date: '2026-09-25',
    notes: [
      'Otra manga: ya no exige 4 jugadores',
      'Classic: la lista de espera se lee en negro; recuadros de skin por tema',
    ],
  },
] as const;
