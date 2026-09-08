import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('quiz board ships six visibly different deck themes on local and online pages', async () => {
  const [local, online, css, sw] = await Promise.all([
    read('public/local.html'),
    read('public/online.html'),
    read('public/assets/css/quiz-pro-overrides.css'),
    read('public/service-worker.js'),
  ]);
  assert.match(local, /quiz-pro-overrides\.css/);
  assert.match(online, /quiz-pro-overrides\.css/);
  for (let i = 1; i <= 6; i += 1) assert.match(css, new RegExp(`col:nth-child\\(6n(?:\\+${i})?\\)`));
  assert.match(css, /--col-accent:#22d3ee/);
  assert.match(css, /--col-accent:#34d399/);
  assert.match(css, /--col-accent:#fb7185/);
  assert.match(sw, /quiz-pro-overrides\.css/);
});

test('spot the difference uses one balanced four-zone round without answer-shaped overlays', async () => {
  const [page, scenes] = await Promise.all([
    read('public/spotdiff.html'),
    read('public/assets/js/engines/spotdiff-scenes.js'),
  ]);
  const diffPainter = page.match(/function applyDiffMarks[\s\S]*?\n}\n\nfunction loadImage/)?.[0] || '';
  assert.match(page, /4 فروقات واضحة/);
  assert.match(scenes, /if \(count === 4\)/);
  assert.match(scenes, /count: 4/);
  assert.doesNotMatch(diffPainter, /roundRect|shadowBlur|fillStyle\s*=\s*avgLum/);
});

test('snake local play starts the live procedural board instead of a background skin', async () => {
  const [page, css, sw] = await Promise.all([
    read('public/snakes.html'),
    read('public/assets/css/snake-arena-pro.css'),
    read('public/service-worker.js'),
  ]);
  assert.match(page, /state=createSnakesGame\(names\(\)\);enterGame\(\)/);
  assert.match(page, /classList\.remove\('reference-skin'\)/);
  assert.match(page, /classList\.add\('pro-snake-board'\)/);
  assert.match(css, /live game surface, not a decorative background image/);
  assert.match(css, /\.snake-board-wrap/);
  assert.match(sw, /snake-arena-pro\.css/);
  assert.match(page, /id="classicStartBtn"/);
  assert.match(page, /TAHDIA_CLASSIC_SNAKE\?\.start/);
});

test('online team rooms expose team identity and team totals to the UI', async () => {
  const [worker, page] = await Promise.all([read('src/index.js'), read('public/online.html')]);
  assert.match(worker, /teamScores/);
  assert.match(worker, /team: p\.team/);
  assert.match(page, /team-score-card/);
  assert.match(page, /الفريق الذهبي/);
});

test('team esports modes ship relay, escape, captain roles, voting, powers and spectators', async () => {
  const [worker, page, league, sw] = await Promise.all([
    read('src/index.js'),
    read('public/online.html'),
    read('public/league.html'),
    read('public/service-worker.js'),
  ]);
  assert.match(worker, /teamMode/);
  assert.match(worker, /relay/);
  assert.match(worker, /escape/);
  assert.match(worker, /captain/);
  assert.match(worker, /handleTeamVote/);
  assert.match(worker, /useTeamPower/);
  assert.match(worker, /spectate/);
  assert.match(page, /team_vote/);
  assert.match(page, /team_power/);
  assert.match(page, /voice_signal/);
  assert.match(page, /team_reaction/);
  assert.match(page, /٤ ضد ٤/);
  assert.match(league, /api\/league/);
  assert.match(sw, /['"]\/league['"]/);
});
