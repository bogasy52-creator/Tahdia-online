import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

// 33.0.0: the same-device quiz (local.html) moved online: everyone plays from their own
// device, and someone alone plays bots. These tests used to drive its board; now the
// page only sends an old link or shortcut on to the online quiz, keeping what it carried.
const read = (file) => readFile(new URL('../public/' + file, import.meta.url), 'utf8');
async function visit(search) {
  const html = await read('local.html');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const went = [], link = { href: '' };
  vm.runInNewContext(script, { location: { search, replace: (url) => went.push(url) }, document: { getElementById: () => link }, URLSearchParams, encodeURIComponent });
  return { went, link };
}

test('an old same-device link goes on to the online quiz', async () => {
  const { went, link } = await visit('');
  assert.deepEqual(went, ['/online']);
  assert.equal(link.href, '/online', 'the button says the same, for a browser that stops the redirect');
  const html = await read('local.html');
  assert.match(html, /<meta http-equiv="refresh" content="1;url=\/online">/, 'works without JavaScript too');
  assert.match(html, /<meta name="robots" content="noindex">/);
});

test('the categories an old link carried come along to the room', async () => {
  const { went } = await visit('?categories=science,sports,history,geo,cars,memory');
  assert.deepEqual(went, ['/online?categories=science%2Csports%2Chistory%2Cgeo%2Ccars%2Cmemory']);
});

test('the old team relay link opens a room for two teams', async () => {
  const { went } = await visit('?relay=1');
  assert.deepEqual(went, ['/online?teams=4']);
});

test('the quiz hub opens an online room with the six categories you picked', async () => {
  const hub = await read('assets/js/quiz-hub.js'), page = await read('quiz.html'), online = await read('online.html');
  assert.match(hub, /location\.assign\('\/online\?categories='\+encodeURIComponent\(selected\.join\(','\)\)\)/);
  assert.doesNotMatch(page, /href="\/local/);
  assert.match(page, /href="\/online"/);
  // the room takes them once, as soon as its host is in the lobby
  assert.match(online, /sessionStorage\.setItem\('bs-quiz-categories-v33'/);
  assert.match(online, /send\('set_categories',\{categories:picked\}\)/);
});
