function applyBallot(existing, voterId, targetId) {
  if (!existing || existing.phase !== 'judging') {
    return { reject: true, error: 'not_judging' };
  }
  if ((existing.judgeMode || 'zar') !== 'vote') {
    return { reject: true, error: 'not_vote' };
  }
  const voter = String(voterId || '');
  const target = String(targetId || '');
  if (!voter || !target) return { reject: true, error: 'bad_ballot' };
  const seat = (existing.players || []).find((p) => p && p.id === voter);
  if (seat && seat.isBot) return { reject: true, error: 'bot_no_vote' };
  const votes = { ...(existing.votes || {}) };
  if (!votes[voter]) votes[voter] = target;
  return {
    reject: false,
    state: {
      ...existing,
      votes,
      updatedAt: Date.now(),
    },
  };
}

module.exports = { applyBallot };
