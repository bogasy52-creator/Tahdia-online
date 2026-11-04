// 33.5.0: «صيد الكلمات» replaces «قنبلة الكلمات»; the focus duel asks and answers in one card
// with fourteen challenges; the cipher arena is arranged on one screen and its computer opponent
// thinks at a person's pace; the quick quiz keeps its answer buttons under the finger.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CHALLENGES, FOCUS_MODES, createChallenge, upgradeChallenge } from '../public/assets/js/engines/challenge-core.js';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('the 33.5.0 notes say what changed', async () => {
  const notes = await read('RELEASE_V33_5_AR.md');
  for (const words of ['صيد الكلمات', 'مواجهة التركيز', 'ساحة الشفرات', 'سباق الفوضى']) assert.ok(notes.includes(words), words);
});

test('«صيد الكلمات» takes the place of the word bomb under the same id, route and codes', async () => {
  assert.equal(CHALLENGES.wordbomb.title, 'صيد الكلمات');
  const m = createChallenge('wordbomb', [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], 4, 1000);
  assert.ok(m.hunt && m.hunt.phase === 'play' && m.hunt.grid.length === 64);
  assert.ok(!('prompt' in m) && !('usedWords' in m));
  const page = await read('public/wordbomb.html');
  assert.match(page, /data-challenge="wordbomb"/);
  assert.match(page, /wordbomb-ui\.js\?v=33\.\d+\.\d+-hunt1"><\/script><script type="module" src="assets\/js\/challenge-client\.js\?v=33\.\d+\.\d+-[a-z0-9]+"/);
  assert.match(await read('public/assets/js/wordbomb-ui.js'), /window\.BS_WORD_HUNT=\{render,tick,clear\}/);
  const client = await read('public/assets/js/challenge-client.js');
  assert.match(client, /window\.BS_WORD_HUNT\.render\(m,\{me:state\.me,act,now,message\}\)/);
  assert.doesNotMatch(client, /BS_WORD_BOMB/);
  const bundles = JSON.parse(await read('scripts/style-bundles.json'));
  assert.ok(bundles['wordbomb.html'].includes('assets/css/wordhunt-v33-5.css'));
  assert.match(await read('scripts/build-styles.mjs'), /'assets\/css\/wordhunt-v33-5\.css'/);
  assert.match(await read('public/assets/css/app-wordbomb.css'), /\.ch-hunt-grid\{position:relative;z-index:2;display:grid/);
  // rooms saved before the update
  assert.match(await read('src/challenges/challenge-room.js'), /if\(upgradeChallenge\(this\.room\?\.match\)\)await persistChallenge/);
  const old = createChallenge('focus', [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], 1, 1000);
  assert.equal(upgradeChallenge(old, 2000), false, 'a current match is left alone');
});

test('the focus duel: fourteen challenges, the question and its answers in one card', async () => {
  assert.ok(FOCUS_MODES.length >= 14, 'fourteen then, more since 33.7.0');
  for (const mode of ['odd', 'missing', 'flash', 'majority', 'dots']) assert.ok(FOCUS_MODES.includes(mode), mode);
  const css = await read('public/assets/css/challenges-v33-5.css');
  assert.match(css, /\.ch-board\.ch-focus\{min-height:0;justify-content:flex-start;/);
  assert.match(css, /\.ch-in-match\[data-challenge="focus"\] #chSubstatus,\.ch-in-match\[data-challenge="focus"\] #chFlow\{display:none\}/);
  for (const page of ['focus.html', 'reaction.html', 'cipher.html', 'wordbomb.html']) assert.ok(JSON.parse(await read('scripts/style-bundles.json'))[page].includes('assets/css/challenges-v33-5.css'), page);
});

test('the cipher arena: the target card, the uncovered digits, the notebook on the keypad', async () => {
  const client = await read('public/assets/js/challenge-client.js');
  assert.match(client, /card\.append\(el\('div','ch-target-heading'\),el\('div','ch-revealed'\)\)/);
  assert.match(client, /function revealedDigits\(m,t=now\(\)\)/);
  assert.match(client, /else if\(!historyView\)area\.scrollTop=area\.scrollHeight;/);
  assert.match(client, /nav\.hidden=start<=0&&start\+rows\.length>=total;/);
  assert.match(client, /if\(roundChanged\)\{resetView\(\);lastRound=state\.round;try\{window\.scrollTo\?\.\(0,0\);\}catch\{\}\}/);
  assert.match(await read('public/assets/js/challenge-studio.js'), /for\(const k of \$\('chControls'\)\.querySelectorAll\('\.ch-code-pad button'\)\)\{const d=Number\(k\.textContent\)-\(m\.digits===6\?1:0\);k\.dataset\.mark=String\(values\[d\]\|\|0\);\}/);
  const core = await read('public/assets/js/engines/challenge-core.js');
  assert.match(core, /if\(!p\.nextThink\)\{p\.nextThink=now\+8000\+Math\.floor\(pace\(\)\*4000\);return null;\}/);
  assert.match(core, /p\.nextThink=now\+15000\+Math\.floor\(pace\(\)\*7000\);/);
  const css = await read('public/assets/css/challenges-v33-5.css');
  assert.match(css, /\.ch-board\.ch-cipher-hunt\{display:flex;flex-direction:column;justify-content:flex-start;gap:8px;min-height:0;/);
  assert.match(css, /\[data-challenge="cipher"\] \.ch-player-score\{font-size:14px;white-space:nowrap\}/);
});

test('the quick quiz rebuilds its answers only when the question, its phase or your answer changes', async () => {
  const game = await read('public/assets/js/quick-match-game.js');
  assert.match(game, /const view=data\.phase==='finished'\?'finished':\[data\.index,data\.phase,!!data\.answered,submitting\]\.join\(':'\);if\(view===shown\)\{if\(data\.phase==='question'\)timer\(\);return\}shown=view;/);
});

test('no page calls the word game by its old name', async () => {
  for (const file of ['public/index.html', 'public/wordbomb.html', 'public/focus.html', 'public/cipher.html', 'public/reaction.html', 'public/party.html', 'public/assets/js/social-client.js', 'public/assets/js/game-menu-v33.js', 'public/assets/js/engines/party-catalog-v29.js', 'src/presence/presence-registry.js']) assert.doesNotMatch(await read(file), /قنبلة الكلمات/, file);
});
