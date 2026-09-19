export const APP_VERSION = '0.99.421.12';
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
export const APP_VERSION_NOTES = [
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
