import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function loadAudio(settings) {
  const code = await readFile(new URL('../public/assets/js/audio-manager.js', import.meta.url), 'utf8');
  const started = [],played=[],created=[];
  class FakeAudio {
    constructor(src){this.src=src;created.push(src)}
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
  return { api: window.BS_AUDIO, started,played,created };
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

test('opening a game creates no audio players and aliases share one lazy sample',async()=>{const {api,created}=await loadAudio({muted:false,effects:true,volume:1});assert.equal(created.length,0);api.play('move');api.play('boardStep');api.play('step');assert.equal(created.length,1);api.play('win');assert.equal(created.length,2);});

test('question content follows mute and volume while suppressing background cues',async()=>{
 const {api,played}=await loadAudio({muted:false,effects:true,timer:true,volume:.6});
 const clip={paused:false,ended:false},release=api.registerContent(clip);
 assert.equal(clip.volume,.6);assert.equal(clip.muted,false);
 api.play('correct');api.timerTick(3);api.timerEnd();assert.equal(played.length,0);
 api.setMuted(true);assert.equal(clip.muted,true);api.update({volume:.3});assert.equal(clip.volume,.3);
 api.setMuted(false);release();api.play('correct');assert.equal(played.length,1);
});
test('quiz events have seven distinct short rendered cues',async()=>{
 const {api,played}=await loadAudio({muted:false,effects:true,timer:true,volume:1});
 for(const name of ['round','correct','wrong','reveal','buzzer','relay'])api.play(name);api.timerEnd();
 assert.equal(new Set(played).size,7);assert.ok(played.every(src=>src.includes('/quiz-v28/')&&src.endsWith('.wav')));
});
test('invalid saved volume and invalid updates cannot produce a NaN audio volume',async()=>{
 const {api}=await loadAudio({volume:'broken'});assert.equal(api.getSettings().volume,.72);
 api.update({volume:NaN});assert.equal(api.getSettings().volume,.72);
 api.update({volume:7});assert.equal(api.getSettings().volume,1);
});
