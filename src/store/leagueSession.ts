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

type Pack = { scores: Record<string, number>; matches: number };

function parsePack(raw: string | null): Pack {
  if (!raw) return { scores: {}, matches: 0 };
  try {
    const parsed = JSON.parse(raw) as Pack | Record<string, number>;
    if (parsed && typeof parsed === 'object' && 'scores' in parsed) {
      const p = parsed as Pack;
      return {
        scores: mergeLeague(p.scores),
        matches: Math.max(0, Number(p.matches) || 0),
      };
    }
    const scores = mergeLeague(parsed as Record<string, number>);
    const inferred = Object.values(scores).reduce((a, b) => a + b, 0);
    return { scores, matches: inferred };
  } catch {
    return { scores: {}, matches: 0 };
  }
}

export function readLeaguePack(code: string): Pack {
  if (typeof window === 'undefined' || !code) return { scores: {}, matches: 0 };
  try {
    return parsePack(window.localStorage.getItem(keyFor(code)));
  } catch {
    return { scores: {}, matches: 0 };
  }
}

export function readLeague(code: string): Record<string, number> {
  return readLeaguePack(code).scores;
}

export function writeLeaguePack(
  code: string,
  scores: Record<string, number>,
  matches: number
): void {
  if (typeof window === 'undefined' || !code) return;
  try {
    window.localStorage.setItem(
      keyFor(code),
      JSON.stringify({
        scores: mergeLeague(scores),
        matches: Math.max(0, Number(matches) || 0),
      })
    );
  } catch {
    /* quota */
  }
}

export function writeLeague(code: string, scores: Record<string, number>): void {
  const prev = readLeaguePack(code);
  writeLeaguePack(code, scores, prev.matches);
}

export function leagueFromState(state: GameState): Record<string, number> {
  return mergeLeague(state.leagueScores, readLeague(state.code));
}

export function leagueMatchCountOf(state: GameState): number {
  const stored = readLeaguePack(state.code).matches;
  return Math.max(Number(state.leagueMatchCount) || 0, stored);
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

export function awardLeaguePersistent(
  state: GameState,
  winnerId: string | null
): GameState {
  if (!winnerId || state.mode === 'solo') return state;
  const pack = readLeaguePack(state.code);
  const base = mergeLeague(state.leagueScores, pack.scores);
  const matchesNow = Math.max(Number(state.leagueMatchCount) || 0, pack.matches);
  if (state.leagueAwarded) {
    writeLeaguePack(state.code, base, matchesNow);
    return {
      ...state,
      leagueScores: base,
      leagueAwarded: true,
      leagueMatchCount: matchesNow,
    };
  }
  const leagueScores = {
    ...base,
    [winnerId]: (base[winnerId] || 0) + 1,
  };
  const matches = matchesNow + 1;
  writeLeaguePack(state.code, leagueScores, matches);
  return {
    ...state,
    leagueScores,
    leagueAwarded: true,
    leagueMatchCount: matches,
  };
}
