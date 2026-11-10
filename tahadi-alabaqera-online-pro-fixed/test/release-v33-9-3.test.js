// 33.9.3: music for the whole site with one piece per game (on/off and its own volume in the
// settings), and the sounds of play through decoded buffers: on time, overlapping, louder.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, stat } from 'node:fs/promises';

const read = (file) => readFile(new URL('../' + file, import.meta.url), 'utf8');
const size = async (file) => (await stat(new URL('../' + file, import.meta.url))).size;
const TRACKS = ['lobby', 'baloot', 'jackaroo', 'chaos', 'snakes', 'zahra', 'dice', 'hockey', 'billiards', 'carrom', 'focus', 'quiz', 'words', 'arcade', 'party'];
const FX = ['tap', 'open', 'yourTurn', 'count', 'go', 'victory', 'defeat', 'coin', 'combo', 'whoosh', 'hit', 'send', 'levelUp'];

test('every music piece and effect is shipped and small enough to load on demand', async () => {
  for (const t of TRACKS) { const n = await size(`public/assets/music/v33-9-3/${t}.mp3`); assert.ok(n > 200000 && n < 800000, t); }
  for (const f of FX) assert.ok(await size(`public/assets/sounds/fx-v33-9-3/${f}.wav`) > 5000, f);
  const sw = await read('scripts/build-offline.mjs');
  assert.doesNotMatch(sw, /assets\/music/, 'music stays out of the offline core');
});

test('each game page plays its own piece, and loops are declared for every piece', async () => {
  const code = await read('public/assets/js/sound-v33-9-3.js');
  const loops = code.match(/const LOOPS = (\{[^;]+\});/)[1];
  for (const t of TRACKS) assert.match(loops, new RegExp(t + ':\\{lead:1(?:\\.0)?,loop:\\d+\\.\\d+\\}'), t);
  const tracks = code.match(/const TRACKS = (\{[\s\S]*?\n {2}\});/)[1];
  for (const [page, t] of [['index', 'lobby'], ['baloot', 'baloot'], ['jackaroo', 'jackaroo'], ['race', 'carrom'], ['memory', 'focus'], ['party', 'party'], ['hockey', 'hockey']]) assert.match(tracks, new RegExp(t + ": \\[[^\\]]*'" + page + "'"), page);
  assert.match(code, /window\.top !== window/, 'a game inside the friends room adds no second music');
  assert.match(code, /node\.loop = true/);
  assert.match(code, /bs_music_v1/, 'the music carries on from where it was between pages');
  assert.match(code, /visibilitychange/);
});

test('the settings offer music on/off and its own volume', async () => {
  const platform = await read('public/assets/js/platform.js');
  assert.match(platform, /data-key="music"/);
  assert.match(platform, /data-music-volume/);
  assert.match(platform, /update\(\{musicVolume:Number/);
  const audio = await read('public/assets/js/audio-manager.js');
  assert.match(audio, /music:true,musicVolume:\.55/);
});

test('effects play from decoded buffers once loaded, through one compressor', async () => {
  const code = await read('public/assets/js/audio-manager.js');
  const played = [], sources = [];
  class Buf { constructor() { this.duration = .2; } }
  class Ctx {
    constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
    createGain() { return { gain: { value: 1 }, connect(x) { return x; } }; }
    createDynamicsCompressor() { const p = () => ({ value: 0 }); return { threshold: p(), knee: p(), ratio: p(), attack: p(), release: p(), connect(x) { return x; } }; }
    createBufferSource() { const s = { connect(x) { return x; }, start() { played.push(s.buffer); } }; sources.push(s); return s; }
    decodeAudioData(b, ok) { ok(new Buf()); }
    resume() { return Promise.resolve(); }
  }
  const fetched = [];
  const window = { AudioContext: Ctx, addEventListener() {}, dispatchEvent() {} };
  const context = { window, Audio: class { constructor(src) { this.src = src; } play() { return Promise.resolve(); } pause() {} }, localStorage: { getItem: () => '{}', setItem() {} },
    navigator: {}, CustomEvent: class {}, fetch: async (src) => { fetched.push(src); return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; }, console };
  vm.runInNewContext(code, context);
  window.BS_AUDIO.play('yourTurn');
  assert.deepEqual(fetched, ['assets/sounds/fx-v33-9-3/yourTurn.wav']);
  await new Promise((r) => setTimeout(r, 10));
  window.BS_AUDIO.play('yourTurn');
  assert.equal(played.length, 1, 'the second call plays the decoded buffer');
  assert.ok(window.BS_AUDIO.has('victory') && window.BS_AUDIO.recent(1000));
});

test('turns, starts and endings have their own sounds', async () => {
  assert.match(await read('public/assets/js/room-clock-v33-7.js'), /a\.play\('yourTurn'/);
  assert.match(await read('public/assets/js/party-v29.js'), /'go'/);
  assert.match(await read('public/assets/js/chaos-ui.js'), /sound\('go'\)/);
  const code = await read('public/assets/js/sound-v33-9-3.js');
  assert.match(code, /'victory' : 'defeat'/);
  assert.match(code, /play\?\.\('coin'/);
  assert.match(code, /play\?\.\('tap'/);
});

test('the release is 33.9.3 or later with its notes', async () => {
  assert.match(JSON.parse(await read('package.json')).version, /^33\.(?:9\.(?:[3-9]|\d{2,})|\d{2,}\.\d+)$/);
  const notes = await read('RELEASE_V33_9_3_AR.md');
  for (const word of ['الموسيقى', 'لكل لعبة', 'الإعدادات', 'دورك', 'الفوز']) assert.match(notes, new RegExp(word));
  assert.doesNotMatch(notes, /بوت(?!ن)/);
  assert.doesNotMatch(notes, /السلم والثعبان/);
  assert.match(await read('README-AR.md'), /RELEASE_V33_9_3_AR\.md/);
});
