export const APP_VERSION = '0.99.421.57';
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
export const APP_VERSION_NOTES = [
  {
    version: '0.99.421.57',
    date: '2026-09-26',
    notes: [
      'Fix: restaura results.tsx (commits probe lo habían vaciado)',
      'Rematch: solo el anfitrión baraja; invitados aplican remoto',
      'Listo colaborativo = mismo camino que Forzar',
      'Liga +1 solo al cerrar manga; sin doble conteo en rematch',
      'Voto dividido / Zar faltan / sin fantasma ya contestaste / HUD corto',
    ],
  },
  {
    version: '0.99.421.56',
    date: '2026-09-26',
    notes: [
      'Rematch: solo el anfitrión baraja; invitados aplican remoto',
      'Listo colaborativo: unión de listos + mismo arranque que Forzar',
      'Liga: +1 solo al cerrar manga (no en rematch)',
      'Voto dividido: avanza ronda sin puntos',
      'Zar no aparece en faltan respuestas',
      'Sin fantasma «ya contestaste» (no reinyectar envíos locales)',
      'HUD: Partida N · Ronda N; en voto «Tu respuesta» arriba',
    ],
  },
  {
    version: '0.99.421.55',
    date: '2026-09-26',
    notes: ['Reinicio: solo el anfitrión baraja la pregunta'],
  },
] as const;
