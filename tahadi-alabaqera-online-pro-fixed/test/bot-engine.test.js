import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url).pathname;
const pub = `${root}public/`;

async function loadBot() {
  const source = await readFile(`${pub}assets/js/bot-engine.js`, 'utf8').catch(() => '');
  const window = { addEventListener() {}, TAHADI_PROGRESS: null };
  vm.runInNewContext(source, { window, document: null, Math, Date, Set, Object });
  return window.TAHADI_BOT;
}

test('automatic bot difficulty becomes professional from level eight', async () => {
  const bot = await loadBot();
  assert.equal(bot.resolveDifficulty('auto', 1), 'medium');
  assert.equal(bot.resolveDifficulty('auto', 7), 'medium');
  assert.equal(bot.resolveDifficulty('auto', 8), 'pro');
  assert.equal(bot.resolveDifficulty('medium', 99), 'medium');
  assert.equal(bot.resolveDifficulty('pro', 1), 'pro');
});

test('quiz accuracy stays inside the approved medium and professional bands', async () => {
  const bot = await loadBot();
  assert.ok(bot.profile('medium').quizAccuracy >= 0.62 && bot.profile('medium').quizAccuracy <= 0.72);
  assert.ok(bot.profile('pro').quizAccuracy >= 0.82 && bot.profile('pro').quizAccuracy <= 0.92);
  assert.equal(bot.quizWillAnswerCorrect('medium', () => 0.65), true);
  assert.equal(bot.quizWillAnswerCorrect('medium', () => 0.75), false);
  assert.equal(bot.quizWillAnswerCorrect('pro', () => 0.84), true);
});

test('ludo bot prioritizes finishing and captures without changing dice odds', async () => {
  const bot = await loadBot();
  const finishState = {
    players: [
      { tokens: [52, 10, -1, -1] },
      { tokens: [8, -1, -1, -1] },
    ],
    turn: 0,
  };
  assert.equal(bot.chooseLudoMove(finishState, [0, 1], 4, 'pro', () => 0), 0);

  const captureState = {
    players: [
      { tokens: [4, 20, -1, -1] },
      { tokens: [48, -1, -1, -1] },
    ],
    turn: 0,
  };
  assert.equal(bot.chooseLudoMove(captureState, [0, 1], 5, 'pro', () => 0), 0);
  assert.equal(bot.roll(() => 0), 1);
  assert.equal(bot.roll(() => 0.9999), 6);
});

test('jackaroo bot never invents actions and prioritizes an available entry', async () => {
  const bot = await loadBot();
  const actions = [
    { type: 'discard' },
    { type: 'move', owner: 0, marble: 0, steps: 4 },
    { type: 'enter', owner: 0, marble: 1 },
  ];
  assert.equal(bot.chooseJackarooAction({}, actions, 'pro', () => 0), actions[2]);
  assert.ok(actions.includes(bot.chooseJackarooAction({}, actions, 'medium', () => 0.9)));
});

test('dice bot banks wins immediately and uses distinct risk thresholds', async () => {
  const bot = await loadBot();
  assert.equal(bot.shouldBankDice({ score: 43, turnTotal: 7, target: 50 }, 'medium'), true);
  assert.equal(bot.shouldBankDice({ score: 0, turnTotal: 13, target: 50 }, 'medium'), false);
  assert.equal(bot.shouldBankDice({ score: 0, turnTotal: 14, target: 50 }, 'medium'), true);
  assert.equal(bot.shouldBankDice({ score: 0, turnTotal: 19, target: 50 }, 'pro'), false);
  assert.equal(bot.shouldBankDice({ score: 0, turnTotal: 20, target: 50 }, 'pro'), true);
});

test('all playable game pages load the shared bot runtime', async () => {
  const pages = [
    'memory', 'reaction', 'logic', 'puzzle', 'draw', 'secret', 'order', 'auction', 'cipher',
    'local', 'online', 'spotdiff', 'snakes', 'zahra', 'jackaroo', 'dice', 'letters',
  ];
  for (const page of pages) {
    const html = await readFile(`${pub}${page}.html`, 'utf8');
    assert.match(html, /assets\/js\/bot-engine\.js/, `${page}.html must load bot-engine.js`);
  }
});

test('bot difficulty selector mounts on every page that loads the runtime', async () => {
  const source = await readFile(`${pub}assets/js/bot-engine.js`, 'utf8');
  assert.match(source, /const ready\s*=\s*\(\)\s*=>\s*mountDifficultyControl\(\)/);
  assert.doesNotMatch(source, /if \(document\.querySelector\('\[data-arcade-game\]/);
});

test('bot difficulty selector is restricted to setup and hides when play starts', async () => {
  const bot = await loadBot();
  const source = await readFile(`${pub}assets/js/bot-engine.js`, 'utf8');
  const doc = (classes = [], gameHidden = true) => ({
    body: { classList: { contains: (name) => classes.includes(name) } },
    querySelector: (selector) => selector.includes('#game')
      ? { classList: { contains: (name) => name === 'hidden' && gameHidden } }
      : null,
  });
  assert.equal(bot.isGameActive(doc([], true)), false);
  assert.equal(bot.isGameActive(doc(['game-running'], true)), true);
  assert.equal(bot.isGameActive(doc([], false)), true);
  const css = await readFile(`${pub}assets/css/platform.css`, 'utf8');
  assert.match(css, /tahadi-game-active[^{}]*\[data-bot-difficulty\][^{]*\{[^}]*display\s*:\s*none\s*!important/);
  assert.doesNotMatch(source, /#modeBot/, 'choosing BOT mode is still setup, not game start');
});

test('bot fallback validates and applies the requested difficulty before game startup', async () => {
  const source = await readFile(`${pub}assets/js/bot-engine.js`, 'utf8');
  assert.match(source, /URLSearchParams/);
  assert.match(source, /\['medium', 'pro'\]\.includes\(requestedDifficulty\)/);
  assert.match(source, /applyDifficulty\(requestedDifficulty\)/);
});

test('arcade opponents use the selected bot profile for scoring', async () => {
  for (const script of ['arcade-games.js', 'new-games.js']) {
    const source = await readFile(`${pub}assets/js/${script}`, 'utf8');
    assert.match(source, /TAHADI_BOT/);
    assert.match(source, /arcadeScore/);
    assert.match(source, /BOT/);
  }
});

test('quick matchmaking falls back to a local quiz bot after twelve seconds', async () => {
  const matchmaking = await readFile(`${pub}assets/js/matchmaking.js`, 'utf8');
  const quickGame = await readFile(`${pub}assets/js/quick-match-game.js`, 'utf8');
  assert.match(matchmaking, /MAX_WAIT\s*=\s*12_000/);
  assert.match(matchmaking, /fallbackToBot/);
  assert.match(matchmaking, /searchParams\.set\("bot",\s*"1"\)/);
  assert.match(quickGame, /const botMode\s*=\s*params\.get\("bot"\)\s*===\s*"1"/);
  assert.match(quickGame, /startBotMatch/);
  assert.match(quickGame, /TAHADI_BOT/);
});

test('every board game exposes a real bot mode driven by the shared engine', async () => {
  for (const page of ['snakes', 'zahra', 'jackaroo', 'dice']) {
    const html = await readFile(`${pub}${page}.html`, 'utf8');
    assert.match(html, /BOT/);
    assert.match(html, /TAHADI_BOT/);
    assert.match(html, /bot=1|botMode|startBot/);
  }
});

test('the local category quiz can run an autonomous bot team', async () => {
  const html = await readFile(`${pub}local.html`, 'utf8');
  assert.match(html, /id="startBot"/);
  assert.match(html, /scheduleBotPick/);
  assert.match(html, /scheduleBotAnswer/);
  assert.match(html, /quizWillAnswerCorrect/);
  assert.match(html, /TAHADI_PROGRESS\?\.award/);
});

test('spot-the-difference offers a timed bot opponent', async () => {
  const html = await readFile(`${pub}spotdiff.html`, 'utf8');
  assert.match(html, /id="sdModeBot"/);
  assert.match(html, /scheduleSpotBot/);
  assert.match(html, /BOT/);
  assert.match(html, /TAHADI_BOT/);
});

test('letters and pictures runs a visible medium or professional bot opponent', async () => {
  const html = await readFile(`${pub}letters.html`, 'utf8');
  assert.match(html, /id="lgBotScore"/);
  assert.match(html, /scheduleLettersBot/);
  assert.match(html, /TAHADI_BOT/);
  assert.match(html, /TAHADI_PROGRESS\?\.award/);
});

test('supported board games search for humans before the twelve-second bot fallback', async () => {
  const source = await readFile(`${pub}assets/js/board-matchmaking.js`, 'utf8').catch(() => '');
  assert.match(source, /WAIT_MS\s*=\s*12_000/);
  assert.match(source, /\/api\/matchmaking\/join/);
  assert.match(source, /\/api\/matchmaking\/status/);
  assert.match(source, /\/api\/matchmaking\/cancel/);
  assert.match(source, /searchParams\.set\('bot',\s*'1'\)/);
  assert.match(source, /cancelData\?\.status\s*===\s*'matched'/);
  for (const page of ['snakes', 'zahra', 'jackaroo', 'spotdiff']) {
    const html = await readFile(`${pub}${page}.html`, 'utf8');
    assert.match(html, /assets\/js\/board-matchmaking\.js/);
  }
});

test('jackaroo quick matchmaking waits for four human players', async () => {
  const source = await readFile(`${root}src/matchmaking.js`, 'utf8');
  assert.match(source, /requiredPlayersForGame/);
  assert.match(source, /game\s*===\s*['"]jackaroo['"]\s*\?\s*4\s*:\s*2/);
  assert.match(source, /slice\(0,\s*requiredPlayers\s*-\s*1\)/);
});
