import test from 'node:test';
import assert from 'node:assert/strict';
import { createBalootMatch, applyBalootAction, balootActions, balootView, legalCards, playableCards, canClaim, provenCuts, teamOf, suitOf } from '../public/assets/js/engines/baloot-engine.js';
import { chooseBalootAction, botClaim } from '../public/assets/js/engines/baloot-bot.js';
import { BALOOT_PHRASES, BALOOT_EMOJI, BOT_TALK, validTalk, talkPhrase, talkEmoji } from '../public/assets/js/engines/baloot-talk.js';

function seeded(seed) { return () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; }; }

// Deal and bid (the first seat to speak buys Sun) until the first card is due.
function toPlay(seed, open = true) {
  const rng = seeded(seed);
  let state = createBalootMatch({ open, rng });
  for (let guard = 0; state.phase !== 'playing' && guard < 40; guard++) {
    const options = balootActions(state, state.turn);
    const pick = options.find((o) => o.bid === 'sun') || options.find((o) => o.call === 'pass' || o.bid === 'pass') || options[0];
    state = applyBalootAction(state, state.turn, pick, rng).state;
  }
  assert.equal(state.phase, 'playing');
  return { state, rng };
}
// Play legal cards until someone could cut: the seat to play holds the led suit and another card.
function untilCutChance(seed) {
  let { state, rng } = toPlay(seed);
  for (let guard = 0; guard < 40; guard++) {
    const seat = state.turn, legal = legalCards(state, seat), all = state.hands[seat];
    if (state.trick.cards.length && all.some((card) => !legal.includes(card))) return { state, rng, seat, cut: all.find((card) => !legal.includes(card)) };
    state = applyBalootAction(state, seat, { type: 'play', card: legal[0] }, rng).state;
  }
  return null;
}
function findCutChance() { for (let seed = 1; seed < 400; seed++) { const found = untilCutChance(seed); if (found) return found; } throw new Error('no deal offers a cut'); }

test('closed play refuses a card against the rules; open play takes it as a hidden cut', () => {
  const { state, seat, cut } = findCutChance();
  const closed = { ...structuredClone(state), open: false };
  assert.throws(() => applyBalootAction(closed, seat, { type: 'play', card: cut }), /illegal_card/);
  assert.deepEqual(playableCards(state, seat).sort(), [...state.hands[seat]].sort(), 'open play offers every card in hand');
  const after = applyBalootAction(state, seat, { type: 'play', card: cut }).state;
  assert.equal(after.violations.length, 1);
  assert.equal(after.violations[0].seat, seat);
  assert.equal(after.violations[0].card, cut);
  for (let viewer = 0; viewer < 4; viewer++) assert.equal(balootView(after, viewer).violations, null, 'nobody sees a cut until it is claimed');
});

test('a claim that catches the cut wins the hand for the claimers', () => {
  const { state, seat, cut } = findCutChance();
  const after = applyBalootAction(state, seat, { type: 'play', card: cut }).state;
  const claimer = (seat + 1) % 4; // the other team, and not on turn
  assert.equal(canClaim(after, claimer), true);
  const { state: done, events } = applyBalootAction(after, claimer, { type: 'claim' });
  const claim = events.find((e) => e.type === 'claim');
  assert.equal(claim.correct, true);
  assert.equal(claim.proof.card, cut);
  assert.equal(done.claim.team, teamOf(claimer));
  assert.equal(done.result.winnerTeam, teamOf(claimer));
  assert.equal(done.result.claim.correct, true);
  assert.equal(done.result.cuts.length, 1, 'the cut is shown with the result');
  assert.equal(done.result.projects[1 - teamOf(claimer)], 0, 'the caught team keeps no projects');
  assert.ok(done.result.score[teamOf(claimer)] >= done.result.projects[teamOf(claimer)] + 16, 'the whole hand and every project go to the claimers');
  assert.equal(canClaim(done, claimer), false, 'one claim per hand');
});

test('a wrong claim gives the hand to the team that was accused', () => {
  let { state, rng } = toPlay(11);
  state = applyBalootAction(state, state.turn, { type: 'play', card: legalCards(state, state.turn)[0] }, rng).state;
  const claimer = state.turn;
  const { state: done, events } = applyBalootAction(state, claimer, { type: 'claim' });
  assert.equal(events.find((e) => e.type === 'claim').correct, false);
  assert.equal(done.result.winnerTeam, 1 - teamOf(claimer));
});

test('a claim needs open play and at least one card on the table', () => {
  const { state } = toPlay(5);
  assert.equal(canClaim(state, 0), false, 'nothing played yet');
  const closed = toPlay(5, false).state;
  const played = applyBalootAction(closed, closed.turn, { type: 'play', card: legalCards(closed, closed.turn)[0] }).state;
  assert.equal(canClaim(played, 1), false);
  assert.throws(() => applyBalootAction(played, (played.turn + 1) % 4, { type: 'claim' }), /illegal_claim/);
  assert.equal(canClaim(state, 7), false);
});

test('a cut is provable from the table once the player later shows the suit they denied', () => {
  for (let seed = 1; seed < 400; seed++) {
    const found = untilCutChance(seed); if (!found) continue;
    let { state, rng, seat, cut } = found;
    const led = suitOf(state.trick.cards[0].card);
    if (!state.hands[seat].some((card) => suitOf(card) === led && card !== cut)) continue;
    state = applyBalootAction(state, seat, { type: 'play', card: cut }, rng).state;
    // play on by the rules until the cutter shows the denied suit, or the hand ends
    for (let guard = 0; guard < 40 && state.phase === 'playing'; guard++) {
      const turn = state.turn, legal = legalCards(state, turn);
      const showing = turn === seat ? legal.find((card) => suitOf(card) === led) : null;
      state = applyBalootAction(state, turn, { type: 'play', card: showing || legal[0] }, rng).state;
      const watcher = (seat + 1) % 4, view = balootView(state, watcher);
      const proofs = provenCuts(view, teamOf(seat));
      if (proofs.length) {
        assert.equal(proofs[0].seat, seat);
        assert.equal(proofs[0].card, cut);
        assert.equal(provenCuts(view, 1 - teamOf(seat)).length, 0, 'the honest team is never accused');
        const call = botClaim(view, watcher, 'hard');
        if (call) assert.equal(call.proof.card, cut, 'a bot claims only what it can prove');
        assert.equal(botClaim(balootView(state, seat), seat, 'hard'), null, 'nothing to claim against an honest team');
        return;
      }
    }
  }
  assert.fail('no deal produced a provable cut');
});

test('a bot playing for an absent human never cuts; claims are not made from a closed table', () => {
  for (let seed = 1; seed < 40; seed++) {
    let { state, rng } = toPlay(seed);
    for (let guard = 0; guard < 32 && state.phase === 'playing'; guard++) {
      const seat = state.turn, view = balootView(state, seat);
      const action = chooseBalootAction(view, seat, { level: 'hard', rng, honest: true });
      if (action.type === 'claim') { state = applyBalootAction(state, seat, action, rng).state; break; }
      assert.ok(legalCards(state, seat).includes(action.card), 'an honest bot plays by the rules');
      state = applyBalootAction(state, seat, action, rng).state;
    }
  }
  assert.equal(botClaim({ open: false, phase: 'playing' }, 0), null);
});

test('table talk carries only the fixed phrases and emoji', () => {
  assert.equal(new Set(BALOOT_PHRASES.map((p) => p.id)).size, BALOOT_PHRASES.length);
  assert.equal(new Set(BALOOT_EMOJI.map((e) => e.id)).size, BALOOT_EMOJI.length);
  for (const p of BALOOT_PHRASES) { assert.ok(validTalk('phrase', p.id)); assert.ok(p.say && !/[<>]/.test(p.text)); }
  for (const e of BALOOT_EMOJI) assert.ok(validTalk('emoji', e.id));
  for (const ids of Object.values(BOT_TALK)) for (const id of ids) assert.ok(talkPhrase(id) || talkEmoji(id), id);
  assert.equal(validTalk('phrase', 'e1'), false);
  assert.equal(validTalk('text', 'p1'), false);
  assert.equal(validTalk('phrase', '<script>'), false);
  assert.equal(talkPhrase('p99'), null);
});
