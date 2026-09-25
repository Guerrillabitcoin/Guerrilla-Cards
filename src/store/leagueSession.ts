import type { GameState } from '../engine/types';

function keyFor(code: string): string {
  return `gc_liga_${String(code || '').trim().toUpperCase()}`;
}
function genKey(code: string): string {
  return `gc_liga_gen_${String(code || '').trim().toUpperCase()}`;
}

export function mergeLeague(
  ...maps: Array<Record<string, number> | null | undefined>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of maps) {
    if (!m) continue;
    for (const [id, n] of Object.entries(m)) {
      if (!id) continue;
      const v = Number(n) || 0;
      out[id] = Math.max(out[id] || 0, v);
    }
  }
  return out;
}

export function readLeague(code: string): Record<string, number> {
  if (typeof window === 'undefined' || !code) return {};
  try {
    const raw = window.localStorage.getItem(keyFor(code));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === 'object' ? mergeLeague(parsed) : {};
  } catch {
    return {};
  }
}

export function writeLeague(code: string, scores: Record<string, number>): void {
  if (typeof window === 'undefined' || !code) return;
  try {
    window.localStorage.setItem(keyFor(code), JSON.stringify(mergeLeague(scores)));
  } catch {
    /* quota */
  }
}

export function leagueFromState(state: GameState): Record<string, number> {
  return mergeLeague(state.leagueScores, readLeague(state.code));
}

export function currentLeagueDeal(code: string): number {
  if (typeof window === 'undefined' || !code) return 0;
  try {
    return Number(window.localStorage.getItem(genKey(code))) || 0;
  } catch {
    return 0;
  }
}

export function bumpLeagueDeal(code: string): number {
  if (typeof window === 'undefined' || !code) return 0;
  const n = currentLeagueDeal(code) + 1;
  try {
    window.localStorage.setItem(genKey(code), String(n));
  } catch {
    /* quota */
  }
  return n;
}

/** +1 once per match. If the room already awarded, only copy the totals. */
export function awardLeaguePersistent(
  state: GameState,
  winnerId: string | null
): GameState {
  if (!winnerId || state.mode === 'solo') return state;
  const base = mergeLeague(state.leagueScores, readLeague(state.code));
  if (state.leagueAwarded) {
    writeLeague(state.code, base);
    return { ...state, leagueScores: base, leagueAwarded: true };
  }
  const leagueScores = {
    ...base,
    [winnerId]: (base[winnerId] || 0) + 1,
  };
  writeLeague(state.code, leagueScores);
  return { ...state, leagueScores, leagueAwarded: true };
}
