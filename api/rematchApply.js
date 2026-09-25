function applyRematch(existing) {
  if (!existing || typeof existing !== 'object') {
    return { reject: true, error: 'missing_room' };
  }
  const phase = existing.phase;
  const playersIn = existing.players || [];
  const already =
    (phase === 'submitting' || phase === 'discarding') &&
    (Number(existing.round) || 0) <= 1 &&
    playersIn.every((p) => !p || !p.score);
  if (already && (Number(existing.leagueMatchCount) || 0) > 0) {
    return { reject: false, state: existing };
  }
  if (phase !== 'results') {
    return { reject: true, error: 'not_results' };
  }
  const humans = playersIn.filter((p) => p && !p.isBot);
  const ranked = [...humans].sort(
    (a, b) => (Number(b.score) || 0) - (Number(a.score) || 0)
  );
  const winner = ranked[0];
  const leagueScores = { ...(existing.leagueScores || {}) };
  let leagueMatchCount = Number(existing.leagueMatchCount) || 0;
  if (!existing.leagueAwarded && winner && winner.id && (Number(winner.score) || 0) > 0) {
    leagueScores[winner.id] = (Number(leagueScores[winner.id]) || 0) + 1;
    leagueMatchCount += 1;
  }
  const players = playersIn.map((p) => ({
    ...p,
    score: 0,
  }));
  return {
    reject: false,
    state: {
      ...existing,
      players,
      phase: 'submitting',
      round: 1,
      submissions: [],
      votes: {},
      revealOrder: [],
      roundWinnerId: null,
      roundWinnerIds: [],
      restartReadyIds: [],
      leagueScores,
      leagueMatchCount,
      leagueAwarded: false,
      discardDonePlayerIds: [],
      lastDiscarded: [],
      rematchGen: (Number(existing.rematchGen) || 0) + 1,
      updatedAt: Date.now(),
    },
  };
}

module.exports = { applyRematch };
