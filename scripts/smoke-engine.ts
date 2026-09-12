import { createGame, addPlayer, startGame, submitCards, judgePick, nextRound, getFilledSubmission } from '../src/engine/game';
import { getManifestTotals, getBannedCount, loadCombinedDeck } from '../src/engine/deck';

const totals = getManifestTotals();
console.log('totals', totals, 'banned', getBannedCount());

const all = loadCombinedDeck(['core', 'politica', 'celebridades', 'plus18']);
console.log('combined', all.prompts.length, all.answers.length, all.packCounts);

let g = createGame({ hostNickname: 'Host', mode: 'live', packIds: ['core'], targetScore: 2 });
g = addPlayer(g, 'Ada');
g = addPlayer(g, 'Bea');
g = startGame(g);
console.log('phase', g.phase, 'round', g.round, 'prompt', g.currentPrompt?.text.slice(0, 60), 'pick', g.currentPrompt?.pick);
console.log('hands', g.players.map((p) => p.hand.length));

const zarId = g.players[g.zarIndex].id;
const pick = Math.max(1, g.currentPrompt?.pick ?? 1);
for (const p of g.players) {
  if (p.id === zarId) continue;
  const ids = p.hand.slice(0, pick).map((c) => c.id);
  g = submitCards(g, p.id, ids);
}
console.log('after submit', g.phase, 'subs', g.submissions.length);

const winner = g.submissions[0].playerId;
g = judgePick(g, winner);
console.log('after judge', g.phase, 'winner', g.roundWinnerId, 'scores', g.players.map((p) => `${p.nickname}:${p.score}`));
console.log('filled', getFilledSubmission(g, g.submissions[0]).slice(0, 100));

if (g.phase === 'reveal') {
  g = nextRound(g);
  console.log('next round', g.round, g.phase);
}
console.log('SMOKE OK');
