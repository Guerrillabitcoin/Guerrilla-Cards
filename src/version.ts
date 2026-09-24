export const APP_VERSION = '0.99.421.18';
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
export const APP_VERSION_NOTES = [
  {
    version: '0.99.421.18',
    date: '2026-09-24',
    notes: [
      'Lobby: cada ventana/navegador es un asiento nuevo (el enlace ya no clona al anfitrión)',
      'Zar: las jugadas anónimas dejan de intercambiarse en cada sync',
      'Otra manga: 2–8 jugadores (ya no exige exactamente 4)',
    ],
  },
  {
    version: '0.99.421.17',
    date: '2026-09-24',
    notes: [
      'Otra manga: 2–8 jugadores (ya no exige 4 para reiniciar la misma sala)',
      'Liga: el +1 no se pega a la manga nueva; clasificación final + liga de sesión',
      'Lobby: error en pantalla y reintento si el join se queda bloqueado',
    ],
  },
  {
    version: '0.99.421.16',
    date: '2026-09-19',
    notes: [
      'Lobby: el 3.º+ jugador ya entra con el mismo enlace (join atómico + sync de asientos)',
      'Fin de partida: reinicio con listos (WaitingRoster); anfitrión/ganador puede forzar',
      'Liga de sesión: +1 al ganador de cada partida; se mantiene al reiniciar la misma sala',
    ],
  },
  {
    version: '0.99.421.15',
    date: '2026-09-19',
    notes: [
      'Voto online: fusión por votante (ya no se pierden votos simultáneos ni se cuelga en Votos N/N)',
      'Reveal/empate: cada carta muestra Puntacos y ronda junto al apodo',
    ],
  },
  {
    version: '0.99.421.14',
    date: '2026-09-19',
    notes: [
      'Lobby: el enlace /lobby?code= sienta un jugador NUEVO (no roba el asiento del anfitrión)',
      'Modo voto (>2): empate anula la ronda («Empate: voto dividido») y sigue a la siguiente',
    ],
  },
  {
    version: '0.99.421.13',
    date: '2026-09-19',
    notes: [
      'Enlaces de asiento abren /play y reclaman el turno (no el menú)',
      'Bloque recuperar asiento del anfitrión al final de la partida',
    ],
  },
  {
    version: '0.99.421.12',
    date: '2026-09-19',
    notes: [
      'Descarte online: avanza al completar N/N (sync ya no se queda colgado)',
      'Anfitrión: enlaces de recuperación visibles en partida (esperas)',
      'Tema/skin: sin parpadeo al cargar (localStorage antes del primer paint)',
    ],
  },
  {
    version: '0.99.421.11',
    date: '2026-09-19',
    notes: [
      'Crear sala: solo tú como anfitrión (sin 2.º jugador fantasma en lobby)',
    ],
  },
  {
    version: '0.99.421.10',
    date: '2026-09-19',
    notes: [
      'Arreglo unirse/lobby: API room.js (join/claim/upsert) y aforo maxPlayers',
      'Sin asientos fantasma; avisos web con window.alert',
    ],
  },
  {
    version: '0.99.421.09',
    date: '2026-09-18',
    notes: [
      'Enlace /lobby?code= baja la sala y sienta al jugador',
      'El anfitrión empieza cuando está el número elegido',
    ],
  },
] as const;
