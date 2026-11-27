// 33.21.3: أونو house rules (+4 any time, +4 answers +2, any card after drawing), a player who is not
// in the room is played for after a few seconds, and an expired sign-in no longer locks anyone out.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as Core from '../public/assets/js/engines/challenge-core.js';
import { unoDeck, unoLegal, UNO_AWAY_MS } from '../public/assets/js/engines/uno-core.js';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
const card = (id, color, face) => ({ id, color, face });
function setup(n = 4) {
  const m = Core.createChallenge('chaos', Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'لاعب ' + i })), 7, 1000, { unoMode: 'classic' }), u = m.uno;
  u.discard = [card('top', 'red', '5')]; u.color = 'red'; u.deck = unoDeck().slice(30, 60);
  u.hands = Array.from({ length: n }, (_, i) => [card('r' + i, 'red', '1'), card('b' + i, 'blue', '8'), card('g' + i, 'green', '3')]);
  return m;
}
const act = (m, seat, a, t = 1100) => Core.applyChallenge(m, 'p' + seat, a, t);

test('+4 is played whenever you like, even holding the colour on the table', () => {
  const m = setup(), u = m.uno; u.hands[0].push(card('four', 'wild', 'draw4'));
  assert.ok(unoLegal(u, 0).includes('four'));
  act(m, 0, { type: 'play', card: 'four', color: 'blue' });
  assert.equal(u.pending, 4); assert.equal(u.color, 'blue'); assert.equal(u.turn, 1);
});

test('+2 is answered with +2 or +4; once a +4 is down only a +4 answers', () => {
  const m = setup(), u = m.uno;
  u.hands[0].push(card('a', 'red', 'draw2')); u.hands[1].push(card('f', 'wild', 'draw4'), card('c', 'blue', 'draw2')); u.hands[2].push(card('d', 'green', 'draw2'), card('e', 'wild', 'draw4'));
  act(m, 0, { type: 'play', card: 'a' });
  assert.deepEqual(unoLegal(u, 1).sort(), ['c', 'f']);
  act(m, 1, { type: 'play', card: 'f', color: 'green' }); assert.equal(u.pending, 6);
  assert.deepEqual(unoLegal(u, 2), ['e'], 'a +2 does not answer a +4');
  const before = u.hands[2].length; act(m, 2, { type: 'draw' });
  assert.equal(u.hands[2].length, before + 6); assert.equal(u.pending, 0);
});

test('after drawing, any fitting card in the hand can be played; with none the turn passes on', () => {
  const m = setup(), u = m.uno;
  u.deck.push(card('n', 'blue', '7'));
  act(m, 0, { type: 'draw' });
  assert.equal(u.turn, 0, 'the red 1 in the hand still fits'); act(m, 0, { type: 'play', card: 'r0' }); assert.equal(u.turn, 1);
  const k = setup(), v = k.uno; v.hands[0] = [card('x', 'blue', '8')]; v.deck.push(card('y', 'green', '2'));
  act(k, 0, { type: 'draw' }); assert.equal(v.turn, 1, 'nothing fits: the turn moves on');
});

test('a player who is not in the room is played for after a few seconds, not thirty', () => {
  const m = setup(), u = m.uno, start = u.deadline - 30000;
  m.players[0].away = true;
  Core.advanceChallenge(m, start + 2000); assert.equal(u.turn, 0, 'a short grace first');
  assert.ok(Core.nextChallengeAlarm(m, start + 2000) <= start + UNO_AWAY_MS + 1, 'the room wakes up for it');
  Core.advanceChallenge(m, start + UNO_AWAY_MS + 10);
  assert.notEqual(u.turn, 0, 'played for them');
});

test('rooms: an expired sign-in joins as a guest, and a seat token is enough to come back', async () => {
  const index = await read('src/index.js'), party = await read('src/party/party-room.js'), room = await read('src/challenges/challenge-room.js');
  assert.doesNotMatch(index, /if\(st&&!auth\)return/);
  assert.match(party, /if\(p\.username&&account&&account!==p\.username\)/);
  assert.match(room, /markAway\(\)/);
  assert.match(room, /if\(p\?\.username&&username&&p\.username!==username\)/);
});

import { createParty, addPartyPlayer, startPartyRound, finishPartyRound, partySnapshot } from '../src/party/party-engine.js';
test('the group room: a friend who comes late joins the next round (or this one if it has not begun)', () => {
  const room = createParty({ code: '123456', hostKey: 'k'.repeat(40), capacity: 8, playlist: ['quiz', 'memory', 'quiz'], now: 1000 });
  const a = addPartyPlayer(room, { name: 'سعد', now: 1000 }), b = addPartyPlayer(room, { name: 'ريم', now: 1000 });
  room.roster = [...room.order]; startPartyRound(room, 2000, 5);
  assert.equal(room.status, 'playing');
  const late = addPartyPlayer(room, { name: 'فهد', now: 3000 });
  assert.ok(!room.roster.includes(late.id), 'not dropped into a round already under way');
  assert.equal(room.round.participants[late.id], undefined);
  assert.deepEqual(partySnapshot(room, late.id, 3000).roster, [a.id, b.id], 'the page knows they wait');
  finishPartyRound(room, 4000);
  startPartyRound(room, 5000, 6);
  assert.ok(room.roster.includes(late.id) && room.round.participants[late.id], 'plays from the next round');
  finishPartyRound(room, 6000);
  const between = addPartyPlayer(room, { name: 'نورة', now: 6500 });
  assert.ok(room.roster.includes(between.id), 'between rounds: straight into the next one');
});
