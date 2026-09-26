function mergeLeague(a, b) {
  const out = { ...(a || {}) };
  Object.keys(b || {}).forEach((id) => {
    out[id] = Math.max(Number(out[id]) || 0, Number(b[id]) || 0);
  });
  return out;
}

/** +1 liga al cerrar manga. No toca Puntacos de ronda. */
function awardOnResults(state) {
  if (!state || state.phase !== 'results' || state.mode === 'solo') return state;
  if (state.leagueAwarded) {
    return {
      ...state,
      leagueScores: mergeLeague(state.leagueScores, {}),
      leagueMatchCount: Number(state.leagueMatchCount) || 0,
    };
  }
  const humans = (state.players || []).filter((p) => p && !p.isBot);
  const top = [...humans].sort(
    (a, b) => (Number(b.score) || 0) - (Number(a.score) || 0)
  )[0];
  if (!top || !top.id || !(Number(top.score) > 0)) return state;
  const leagueScores = mergeLeague(state.leagueScores, {});
  leagueScores[top.id] = (Number(leagueScores[top.id]) || 0) + 1;
  return {
    ...state,
    leagueScores,
    leagueAwarded: true,
    leagueMatchCount: (Number(state.leagueMatchCount) || 0) + 1,
  };
}

module.exports = { awardOnResults, mergeLeague };
