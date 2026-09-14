/**
 * App release label shown in the UI (home + Partida header).
 * Bump this when shipping a visible change to Vercel / stores.
 * UI always prefixes with "v" via APP_VERSION_LABEL.
 */
export const APP_VERSION = '0.92';

/** Display form, e.g. `v0.69` — use this in UI next to Partida / home. */
export const APP_VERSION_LABEL = `v${APP_VERSION}`;

export const APP_VERSION_NOTES = [
  {
    version: '0.92',
    date: '2026-09-14',
    notes: [
      'Pick×2: los 2 huecos en la misma pantalla (sin re-confirmar identidad)',
    ],
  },
  {
    version: '0.91',
    date: '2026-09-14',
    notes: [
      'Anonimato al juzgar/votar: opciones sin apodo, orden aleatorio',
      'Tras el ganador: revelar nick + clasificación; meta por defecto 10',
      'Online async: salas KV (código entre dispositivos) si hay env en Vercel',
    ],
  },
  {
    version: '0.90',
    date: '2026-09-14',
    notes: [
      'Async beta: chip gris pero activo; 4 jugadores pass-and-play',
      'Juez Voto o Zar (ganador → próximo Zar); meta configurable',
      'Mismo dispositivo/navegador (código local; sin servidor aún)',
    ],
  },
  {
    version: '0.89',
    date: '2026-09-14',
    notes: [
      'Preguntas: más entropía en todo el mazo (no hundir casi todas las recientes)',
    ],
  },
  {
    version: '0.88',
    date: '2026-09-14',
    notes: [
      'Compartir: texto grande como en partida (large)',
    ],
  },
  {
    version: '0.87',
    date: '2026-09-14',
    notes: [
      'Compartir: imagen siempre cuadrada 420×420',
    ],
  },
  {
    version: '0.86',
    date: '2026-09-14',
    notes: [
      'Compartir: tag bajo el título con URL de Vercel',
    ],
  },
  {
    version: '0.85',
    date: '2026-09-14',
    notes: [
      'Quitar pregunta del César / sonido de comer',
      'Compartir: sin pie guerrillacards ni tag de humor',
    ],
  },
  {
    version: '0.84',
    date: '2026-09-14',
    notes: [
      'Cartas nuevas: mismo hueco + letras verdes 1s al empezar ronda',
    ],
  },
  {
    version: '0.83',
    date: '2026-09-14',
    notes: [
      'Flash verde en cartas nuevas al reponer la mano',
      'PC ancho: mano fija 6 columnas (sin bajar a 5)',
    ],
  },
  {
    version: '0.82',
    date: '2026-09-14',
    notes: [
      '+85 preguntas nuevas clasificadas por packs',
    ],
  },
  {
    version: '0.81',
    date: '2026-09-14',
    notes: [
      'Modo Admin deshabilitado',
      'Classic: packs/opciones en naranja oscuro con letra clara',
    ],
  },
  {
    version: '0.80',
    date: '2026-09-14',
    notes: [
      'Solo: sin descartar en ronda 5; vuelve en la 6',
    ],
  },
  {
    version: '0.79',
    date: '2026-09-13',
    notes: [
      'Classic: home B/N; respuestas negras con glow naranja en letras',
      'Solo: 3 respuestas bot (RESPUESTA BOT 1–3)',
      'Solo: sin descartar/pasar en ronda 5; vuelve en la 6',
    ],
  },
  {
    version: '0.78',
    date: '2026-09-13',
    notes: [
      'Modo Admin (PIN / ?admin=1): editar y añadir cartas con parches locales',
      'Exportar parches JSON para commit al mazo live',
    ],
  },
  {
    version: '0.77',
    date: '2026-09-13',
    notes: [
      'Temas Classic / Guerrilla / Oscuro (botón ◐ arriba)',
      'Classic: B/N estilo CAH + Verdana; respuestas negras',
    ],
  },
  {
    version: '0.76',
    date: '2026-09-13',
    notes: [
      'Sin botón Report flotante',
    ],
  },
  {
    version: '0.75',
    date: '2026-09-13',
    notes: [
      'Quitar mayúsculas inventadas dentro de palabras (AVE/OTAN/CIS…)',
    ],
  },
  {
    version: '0.74',
    date: '2026-09-13',
    notes: [
      'Botón Report más visible abajo-izquierda',
    ],
  },
  {
    version: '0.73',
    date: '2026-09-13',
    notes: [
      'Reportar fallos (⚑ abajo-izquierda → logs Vercel)',
      'PC: grid 6×2 o 4×3 si la letra no cabe (1080p)',
    ],
  },
  {
    version: '0.72',
    date: '2026-09-13',
    notes: [
      'Mano fija de 12 cartas (2×6 móvil / 6×2 PC)',
      'Misma talla de letra en toda la mano',
    ],
  },
  {
    version: '0.71',
    date: '2026-09-13',
    notes: [
      '+382 respuestas nuevas del PDF, clasificadas por packs',
      'Peinado de acentos, tipografías y mayúsculas de lugares',
    ],
  },
  {
    version: '0.70',
    date: '2026-09-13',
    notes: [
      '+111 preguntas nuevas (core + packs temáticos)',
    ],
  },
  {
    version: '0.69',
    date: '2026-09-13',
    notes: [
      'Vercel Analytics + Speed Insights',
      'Telemetría de cartas jugadas/descartadas',
      'Versión con prefijo v junto a Partida',
    ],
  },
  {
    version: '0.6',
    date: '2026-09-12',
    notes: [
      'PC: letras más grandes en cartas y packs (usan mejor el alto)',
    ],
  },
  {
    version: '0.5',
    date: '2026-09-12',
    notes: [
      'Al crear partida: un solo mazo mezclado (no pack a pack)',
      'Baraja distinta en cada nueva / reinicio',
    ],
  },
  {
    version: '0.4',
    date: '2026-09-12',
    notes: ['Sorteo de preguntas con máxima entropía'],
  },
  {
    version: '0.3',
    date: '2026-09-12',
    notes: ['Versión visible en inicio'],
  },
  {
    version: '0.2',
    date: '2026-09-12',
    notes: ['Anti-repetición, favoritos, +18, compartir, Solo'],
  },
  {
    version: '0.1',
    date: '2026-09-12',
    notes: ['MVP Solo'],
  },
] as const;
