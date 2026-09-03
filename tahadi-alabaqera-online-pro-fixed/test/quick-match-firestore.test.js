import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const online = fs.readFileSync(new URL('../public/online.html', import.meta.url), 'utf8');
const match = fs.readFileSync(new URL('../public/assets/js/matchmaking.js', import.meta.url), 'utf8');
const fb = fs.readFileSync(new URL('../public/assets/js/firebase-online.js', import.meta.url), 'utf8');
const game = fs.readFileSync(new URL('../public/assets/js/quick-match-game.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../public/service-worker.js', import.meta.url), 'utf8');

test('quick play requires no typed name and loads the Firestore match runtime', () => {
  assert.doesNotMatch(online, /id="quickName"/);
  assert.match(online, /id="quickPlayBtn"/);
  assert.match(online, /id="quickArena"/);
  assert.match(online, /assets\/js\/firebase-online\.js/);
  assert.match(online, /assets\/js\/matchmaking\.js/);
  assert.match(online, /assets\/js\/quick-match-game\.js/);
  assert.doesNotMatch(online, /apiFetch\('\/api\/matchmaking'/);
});

test('matchmaking atomically claims a waiting player and redirects both players by match id', () => {
  assert.match(match, /runTransaction/);
  assert.match(match, /match_queue/);
  assert.match(match, /status:\s*"matched"/);
  assert.match(match, /quickMatch/);
  assert.match(match, /onSnapshot\(ownRef/);
});

test('firebase identity supports account or stable automatic guest name', () => {
  assert.match(fb, /auth\.currentUser/);
  assert.match(fb, /signInAnonymously/);
  assert.match(fb, /stableFallbackId/);
  assert.match(fb, /عبقري/);
});

test('quick match uses shared random text questions and synchronized score phases', () => {
  assert.match(game, /questions-data\.js/);
  assert.match(game, /randomQuestionIds/);
  assert.match(game, /phase:\s*"question"/);
  assert.match(game, /phase:\s*"reveal"/);
  assert.match(game, /status:\s*"finished"/);
  assert.match(game, /correctCounts/);
});

test('service worker cache is bumped and includes the new online runtime', () => {
  assert.match(sw, /busraj-games-v23-v5-online-fix/);
  assert.match(sw, /quick-match-game\.js/);
  assert.match(sw, /firebase-online\.js/);
  assert.match(sw, /matchmaking\.js/);
});
