export const APP_VERSION = '0.99.421.11';
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
export const APP_VERSION_NOTES = [
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
