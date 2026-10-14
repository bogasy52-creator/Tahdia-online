import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function loadAudio(settings) {
  const code = await readFile(new URL('../public/assets/js/audio-manager.js', import.meta.url), 'utf8');
  const started = [],played=[];
  class FakeAudio {
    constructor(src){this.src=src}
    pause() {}
    play() { played.push(this.src);return Promise.resolve(); }
    set currentTime(_) {}
    set volume(_) {}
    set preload(_) {}
  }
  class FakeAudioContext {
    constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
    createOscillator() {
      return {
        type: 'sine', frequency: { setValueAtTime() {} }, connect() { return this; },
        start(t) { started.push(t); }, stop() {}
      };
    }
    createGain() {
      return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() { return this; } };
    }
    resume() { return Promise.resolve(); }
    close() {}
  }
  const window = {
    AudioContext: FakeAudioContext,
    addEventListener() {},
    dispatchEvent() {},
  };
  const context = {
    window,
    Audio: FakeAudio,
    localStorage: { getItem: () => JSON.stringify(settings), setItem() {} },
    navigator: { vibrate() {} },
    CustomEvent: class {},
    console,
  };
  vm.runInNewContext(code, context);
  return { api: window.BS_AUDIO, started,played };
}

test('timer sounds remain independent when regular effects are disabled', async () => {
  const { api, played } = await loadAudio({ muted: false, effects: false, timer: true, volume: 1 });
  api.timerTick(5);
  assert.ok(played.length > 0, 'timer channel plays independently of regular effects');
});

test('regular effects stay disabled when effects setting is off', async () => {
  const { api, started } = await loadAudio({ muted: false, effects: false, timer: true, volume: 1 });
  api.play('move');
  assert.equal(started.length, 0);
});

test('consecutive dice rolls use different short samples without repeating the same clatter',async()=>{
 const {api,played}=await loadAudio({muted:false,effects:true,timer:true,volume:1});
 for(let i=0;i<8;i++)api.play('dice');
 assert.ok(new Set(played).size>=4);assert.ok(played.every((src,i)=>!i||src!==played[i-1]));
});

test('board reactions use rendered foley instead of oscillator beeps', async () => {
  const names=['boardStep','boardLand','diceImpact','ladderIgnite','ladderStep','ladderLand','snakeHiss','snakeBite','snakeSwallow','snakeGrow','snakeRelease'];
  for(const name of names){
    const {api,started,played}=await loadAudio({muted:false,effects:true,timer:true,volume:1});
    api.play(name);
    assert.ok(played.some(src=>src.includes('/arena-v9/')||src.includes('/dice-v133/')),`${name} uses a rendered foley sample`);assert.equal(started.length,0,'board effects must not fall back to electronic oscillator beeps');
  }
});
