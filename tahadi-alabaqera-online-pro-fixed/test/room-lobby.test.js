import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoomCode, roomIdentityKey } from '../public/assets/js/online/room-lobby.js';

test('room code normalization keeps exactly six digits', () => {
  assert.equal(normalizeRoomCode(' 12-34 56 '), '123456');
  assert.equal(normalizeRoomCode('1234567'), '123456');
  assert.equal(normalizeRoomCode('abc'), '');
});

test('room reconnect identity is scoped by game and room code', () => {
  assert.equal(roomIdentityKey('snakes', '123456'), 'bs_board_room:snakes:123456');
  assert.equal(roomIdentityKey('jackaroo', '654321'), 'bs_board_room:jackaroo:654321');
});
