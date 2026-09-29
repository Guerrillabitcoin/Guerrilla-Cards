export const APP_VERSION = '0.99.422.06';
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
