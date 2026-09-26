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
  // Liga +1 solo en results (awardOnResults). Rematch preserva y abre el pestillo.
  const leagueScores = { ...(existing.leagueScores || {}) };
  const leagueMatchCount = Number(existing.leagueMatchCount) || 0;
  const zarIndex = Math.max(
    0,
    playersIn.findIndex((p) => p && winner && p.id === winner.id)
  );
  const players = playersIn.map((p) => ({
    ...p,
    score: 0,
  }));
  return {
    reject: false,
    state: {
      ...existing,
      players,
      zarIndex,
      phase: 'submitting',
      round: 1,
      currentPrompt: null,
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
