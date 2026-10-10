import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanDisplayName,
  createSessionToken,
  gameJoinPath,
  hashPassword,
  normalizeGame,
  normalizeRoomCode,
  normalizeUsername,
  parseSessionToken,
  validUsername,
  validatePassword,
  verifyPassword,
} from '../src/social/social-core.js';

test('social usernames are normalized and constrained', () => {
  assert.equal(normalizeUsername('  Fahad_7  '), 'fahad_7');
  assert.equal(validUsername('fahad_7'), true);
  assert.equal(validUsername('فهد'), false);
  assert.equal(validUsername('ab'), false);
});

test('display names are cleaned without losing Arabic names', () => {
  assert.equal(cleanDisplayName('  فهد   محمد  '), 'فهد محمد');
  assert.equal(cleanDisplayName('<فهد>'), 'فهد');
});

test('social session token round-trips username and secret', () => {
  const token = createSessionToken('fahad_7', 'A'.repeat(43));
  assert.deepEqual(parseSessionToken(token), { username: 'fahad_7', secret: 'A'.repeat(43), token });
  assert.equal(parseSessionToken('bad'), null);
});

test('password hashing verifies correct password and rejects wrong password', async () => {
  assert.equal(validatePassword('1234567').length > 0, true);
  assert.equal(validatePassword('12345678'), '');
  const record = await hashPassword('correct horse battery staple', 'AQIDBAUGBwgJCgsMDQ4PEA', 1000);
  assert.equal(await verifyPassword('correct horse battery staple', record), true);
  assert.equal(await verifyPassword('wrong password', record), false);
});

test('game invites only accept currently online room games', () => {
  assert.equal(normalizeGame('JACKAROO'), 'jackaroo');
  assert.equal(normalizeGame('dice'), '');
  assert.equal(normalizeRoomCode('12-34 56'), '123456');
  assert.equal(gameJoinPath('quiz', '123456'), '/online?room=123456');
  assert.equal(gameJoinPath('snakes', '654321'), '/snakes?room=654321');
});
