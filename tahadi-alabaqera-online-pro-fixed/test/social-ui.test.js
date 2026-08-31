import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const social = await readFile(new URL('../public/social.html', import.meta.url), 'utf8');
const client = await readFile(new URL('../public/assets/js/social-client.js', import.meta.url), 'utf8');
const wrangler = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));

test('home exposes friends entry and loads the social client', () => {
  assert.match(index, /data-social-open/);
  assert.match(index, /assets\/js\/social-client\.js/);
  assert.match(index, /👥 الأصدقاء/);
});

test('social page provides account, friends, requests, notifications and privacy surfaces', () => {
  for (const marker of ['loginForm', 'signupForm', 'friendUsername', 'data-tab="friends"', 'data-tab="requests"', 'data-tab="notifications"', 'data-tab="settings"', 'إظهار حالة الاتصال', "BS_SOCIAL.block"]) {
    assert.ok(social.includes(marker), `missing social UI marker ${marker}`);
  }
});

test('social client uses bearer auth and websocket subprotocol rather than query-string session tokens', () => {
  assert.match(client, /authorization/);
  assert.match(client, /busraj-social-v1/);
  assert.match(client, /`st\.\$\{token\(\)\}`/);
  assert.doesNotMatch(client, /searchParams\.set\(['"]token/);
});

test('social system reuses the deployed BoardRoom namespace without requiring a new Cloudflare migration', async () => {
  const bindings = wrangler.durable_objects.bindings;
  assert.ok(bindings.some((x) => x.name === 'BOARD_ROOMS' && x.class_name === 'BoardRoom'));
  assert.ok(!bindings.some((x) => x.name === 'SOCIAL_USERS'), 'mobile ZIP must not require a new binding');
  assert.ok(!wrangler.migrations.some((m) => (m.new_sqlite_classes || []).includes('SocialUser')), 'mobile ZIP must preserve deployed migration history');
  const worker = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
  const api = await readFile(new URL('../src/social/social-api.js', import.meta.url), 'utf8');
  assert.match(worker, /url\.hostname === "social\.internal"/);
  assert.match(api, /env\?\.SOCIAL_USERS \|\| env\?\.BOARD_ROOMS/);
});
