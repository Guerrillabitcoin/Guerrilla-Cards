/** 0.99.422.24: tokens de asiento + validación + puntos en servidor. */
export const APP_VERSION = '0.99.422.24';
/** True on preview/grok-docs. Production branch must keep this false. */
export const PREVIEW_BANNER = true;
export const APP_VERSION_LABEL = `v${APP_VERSION}`;

/** Runtime: PREVIEW_BANNER or preview hostname (git-previ / preview). */
export function isPreviewDeploy(): boolean {
  if (PREVIEW_BANNER) return true;
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const h = String(window.location.hostname).toLowerCase();
    return h.includes('git-previ') || h.includes('preview');
  }
  return false;
}

/** Visible label: "BETA v0.99.421.xx" on preview, plain version on live. */
export function displayVersionLabel(): string {
  return isPreviewDeploy() ? `BETA ${APP_VERSION_LABEL}` : APP_VERSION_LABEL;
}

export const APP_VERSION_NOTES = [
  {
    version: '0.99.422.24',
    date: '2026-09-30',
    notes:
      'Seguridad: token secreto por asiento (crear/unirse; enlaces de asiento llevan &t=; anfitrión obtiene los de todos). Token obligatorio para upsert, votar, renombrar, revancha (solo anfitrión) y reclamar; salas antiguas sin token siguen igual. Votos solo de humanos que enviaron, a una opción existente (autovoto solo 1v1). Nombres saneados ≤42. Puntos y Liga los calcula el servidor. GET sin token no muestra manos. Lock en 2 viajes (pipeline).',
  },
  {
    version: '0.99.422.23',
    date: '2026-09-30',
    notes:
      'Servidor: escrituras atómicas por sala (lock Upstash SET NX PX + liberación Lua). Envíos/votos/descartes en paralelo ya no se pierden; descartes/listo se unen aunque lleguen tarde. Cliente reintenta envío/voto/descarte hasta que el servidor lo confirma.',
  },
  {
    version: '0.99.422.22',
    date: '2026-09-30',
    notes:
      'Mazo core: «¿Dos recuerdos de mi infancia? 1. ______ y 2. ______.» ahora con 2 huecos (pick 2).',
  },
  {
    version: '0.99.422.21',
    date: '2026-09-30',
    notes:
      'Mazos: barrido mayúsculas (Frijolito, Cthulhu, Ibai…) + lote nuevo (~956 respuestas, ~106 preguntas glue). Sin Hola soy de 2 huecos. Glue 422.20 ya en el motor.',
  },
  {
    version: '0.99.422.20',
    date: '2026-09-30',
    notes:
      'Glue: email a@b / a@__ / __@__; url _____._____.com y www; archivos pdf/jpg/exe/zip/mp3/xls/txt/mp4/gif; título solo «»/""; nombres San/Calle; censura y tachado; siglas; y/e o/u; no repetir la palabra del hueco.',
  },
  {
    version: '0.99.422.19',
    date: '2026-09-29',
    notes:
      'Fix preview /api/room FUNCTION_INVOCATION_FAILED: remove stray ternary fragment in room.js restartReadyIds merge.',
  },
    {
    version: '0.99.422.18',
    date: '2026-09-29',
    notes:
      'UI: Lobby→Sala (textos visibles); código de sala; enlace sala. Identifiers/routes sin cambio.',
  },
    {
    version: '0.99.422.15',
    date: '2026-09-29',
    notes:
      'Header play: «GUERRILLA CARDS» + BETA (como inicio); toque → inicio.',
  },
    {
    version: '0.99.422.14',
    date: '2026-09-29',
    notes:
      'Wait roster: siempre nicks (no …). Opciones juicio: orden aleatorio distinto por asiento/ronda. Reveal: sticky rellena ganadora; perdedor ve la suya discreta; menos texto repetido. Enlaces asiento en menú ▾ con copy legible (oscuro). Listo rematch: union local+server + re-stamp. Tú/Partida colores.',
  },
    {
    version: '0.99.422.13',
    date: '2026-09-29',
    notes:
      'ClaimSeat picker también pasa recover=1 (aviso naranja al elegir asiento en lista).',
  },
    {
    version: '0.99.422.12',
    date: '2026-09-29',
    notes:
      'Recovery: banner naranja + force solo con /play?seat=&recover=1 (enlaces Copiar asiento). Rematch/?seat= sin aviso. En partida: host ve enlaces de todos (sin lobby); cada humano ve solo el suyo.',
  },
    {
    version: '0.99.422.11',
    date: '2026-09-29',
    notes:
      'Reveal countdown 5s (was 8); cap remaining ≤5s on paint; stamp revealEndsAt on vote resolve; reveal poll 1s; continueRound pull timeout 450ms (menos lag al pasar de ronda).',
  },
    {
    version: '0.99.422.10',
    date: '2026-09-29',
    notes:
      'Voto: bots en roster como ✓ «no vota» (ya listos). UI: Zar → Comandante en menús, lobby, play, botones y mensajes.',
  },
    {
    version: '0.99.422.09',
    date: '2026-09-29',
    notes:
      'Seat recovery: /play?seat= fuerza estado servidor (sin fantasmas ya-contestaste), limpia picks/privacy, banner «te falta…», claim rellena bots y promueve judging si listo.',
  },
    {
    version: '0.99.422.08',
    date: '2026-09-29',
    notes:
      'Bots en roster de espera con ✓ escalonado (~0.4s); auto-submit en cadena en host; servidor rellena bots pendientes; slim no borra manos de bots sin enviar; expected cuenta humanos+bots.',
  },
    {
    version: '0.99.422.07',
    date: '2026-09-29',
    notes:
      'Fix hang at fin de partida/liga: always accept rematch from results (ignore updatedAt race with liga award); /play no longer infinite Loading on results/lobby — fallback + keep seat in redirects.',
  },
    {
    version: '0.99.422.06',
    date: '2026-09-29',
    notes:
      'Reveal: shared revealEndsAt (max 8s) synced host/guest; host always sees advance button; guests wait without false «Empezando». Discard: accept peer discardDone even if local updatedAt newer; sticky discardAck + pull-before-discard + send lock; poll discarding/reveal 2s.',
  },
{
    version: '0.99.422.05',
    date: '2026-09-29',
    notes:
      'KV: pause poll when tab hidden; poll judging 1s / submitting 2s / lobby 3s / reveal·results 4s; home room list 20s + visible-only; telemetry log-only (no INCR); room SET EX 7d.',
  },
{
    version: '0.99.422.04',
    notes:
      'Lobby host: bots/cap no longer re-merge removed bots; host Quitar and bot chips stick on poll.',
  },
        {
    version: '0.99.422.03',
    notes:
      'Round standings include bots (same board as humans); they keep Puntacos and can win Liga.',
  },
{
    version: '0.99.422.02',
    notes:
      'Fix Multi vote: do not fog bot submission texts (were stuck as … on judging).',
  },
{
    version: '0.99.422.01',
    notes:
      'Fix Multi hang R1: slimForRoom keeps publishing all hands until a human submits (bots auto-submit was skipping guest hand publish).',
  },
{
    version: '0.99.422.00',
    date: '2026-09-29',
    notes: [
      'Multi: host chips Bots 0–4 (humanos + bots ≤ 8; bots no ocupan plaza)',
      'Bots: nick aleatorio + " (Bot)"; submit vía autoSubmitBots; nunca votan / Zar / Listo',
      'Voto: tally/resolve esperan solo humanos que enviaron; frases bot votables',
      'Rematch: mismos bots/ids/nicks; Puntacos 0; Liga intacta (bot puede ganar Liga)',
      'canStart / join / Faltan N: solo humanos vs maxPlayers; startFlexible auto-submit bots',
    ],
  },
  {
    version: '0.99.421.66',
    date: '2026-09-28',
    notes: [
      'Solo Reiniciar: restartSameSetup + /play (no rematchRoom / host check)',
    ],
  },
  {
    version: '0.99.421.65',
    date: '2026-09-28',
    notes: [
      'Freeze judging option order (playerId revealOrder, no re-sort)',
      'Stable judge card minHeight — less layout jump',
    ],
  },
  {
    version: '0.99.421.64',
    date: '2026-09-28',
    notes: ['Resultados: ganador de la final muestra +1 liga'],
  },
  {
    version: '0.99.421.63',
    date: '2026-09-28',
    notes: [
      'Rematch Listo: restartReadyIds from server only (no ghost ready)',
      'Results mount pull+apply before painting Listo; union never LWW-wipes',
    ],
  },
  {
    version: '0.99.421.62',
    date: '2026-09-28',
    notes: [
      'Reject incomplete pick submissions on room merge / promoteJudging',
      'Client autoSend + roomSync guard cards.length === pick',
    ],
  },
  {
    version: '0.99.421.60',
    date: '2026-09-28',
    notes: [
      'Voto online: action vote en servidor (applyBallot) + castVoteRoom',
      'BETA banner en preview junto a la versión',
      'Zar no cuenta en faltan respuestas (WaitingRoster)',
    ],
  },
] as const;
