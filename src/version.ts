export const APP_VERSION = '0.99.421.21';
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
export const APP_VERSION_NOTES = [
  {
    version: '0.99.421.21',
    date: '2026-09-25',
    notes: [
      'Otra manga: ya no exige 4 jugadores (arregla «Async necesita exactamente 4»)',
      'Classic: la lista de espera se lee en negro; recuadros de skin por tema',
      'Cabecera de partida: tú + ronda + estado, sin repetir el código',
    ],
  },
  {
    version: '0.99.421.20',
    date: '2026-09-24',
    notes: [
      'Servidor: tira respuestas de rondas viejas y congela el orden del Zar',
      'Sin overlay negro en el inicio; la skin se pinta en html/body',
      'Otra manga 2–8 y liga al llegar a la meta',
    ],
  },
  {
    version: '0.99.421.19',
    date: '2026-09-24',
    notes: [
      'Zar ronda 10: se tiran respuestas de rondas viejas y se congela el orden (sin swap)',
      'Al llegar a la meta: pantalla final +1 liga y Otra manga con los mismos',
      'Inicio: la skin se aplica antes de pintar (sin flash de color)',
    ],
  },
  {
    version: '0.99.421.18',
    date: '2026-09-24',
    notes: [
      'Lobby: cada ventana/navegador es un asiento nuevo',
      'Zar: las jugadas anónimas dejan de intercambiarse en cada sync',
      'Otra manga: 2–8 jugadores',
    ],
  },
] as const;
