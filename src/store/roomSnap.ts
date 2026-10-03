import type { GameState } from '../engine/types';

/** Cheap paint key. Same key → skip setState on poll. */
export function roomPaintKey(g?: GameState | null): string {
  if (!g) return '';
  const votes = g.votes || {};
  const liga = g.leagueScores || {};
  return [
    g.phase,
    g.round,
    g.currentPrompt?.id ?? '',
    (g.submissions || []).length,
    (g.revealOrder || []).join(','),
    Object.keys(votes).length,
    (g.players || [])
      .map(
        (p) =>
          // Card ids, not just count: a rematch deal with the same hand size
          // was skipped by the poll and the old hand stayed on screen.
          `${p.id}:${p.nickname || ''}:${p.score}:${(p.hand || [])
            .map((c) => c?.id ?? '')
            .join(',')}`
      )
      .join('|'),
    (g.restartReadyIds || []).length,
    Object.keys(liga)
      .sort()
      .map((id) => `${id}:${liga[id]}`)
      .join(','),
    g.roundWinnerId ?? '',
    String(g.maxPlayers ?? ''),
    JSON.stringify(g.handFix ?? {}),
  ].join('~');
}
