export const APP_VERSION = '0.99.421.66';
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
