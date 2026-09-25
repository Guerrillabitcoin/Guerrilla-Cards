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
      .map((p) => `${p.id}:${p.score}:${(p.hand || []).length}`)
      .join('|'),
    (g.restartReadyIds || []).length,
    Object.keys(liga)
      .sort()
      .map((id) => `${id}:${liga[id]}`)
      .join(','),
    g.roundWinnerId ?? '',
  ].join('~');
}
