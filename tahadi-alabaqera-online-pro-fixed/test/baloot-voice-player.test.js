import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoicePlayer } from '../public/assets/js/baloot-voice-player.js';
import { BalootVoice, voiceLines, humanPackReady } from '../public/assets/js/baloot-voice.js';
import { VOICE_LINES, VOICE_PACK } from '../public/assets/js/baloot-voice-pack.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; }
function setup(options = {}) {
  const started = [], sources = [], fetched = [], gains = [];
  let allowed = true, volume = .6, time = 0;
  const context = { state:'running', destination:{}, decodeAudioData:async data => ({ id:data }),
    createGain() { const gain={ gain:{value:0}, connect(){}, disconnect(){} }; gains.push(gain); return gain; },
    createBufferSource() {
      const source = { buffer:null, stopped:0, connect(){}, disconnect(){},
        start(...args) { if(options.startFails?.()) throw Error('start'); started.push({ id:this.buffer.id, args }); },
        stop() { this.stopped++; this.onended?.(); }, finish() { this.onended?.(); } };
      sources.push(source); return source;
    } };
  const recordings = Object.fromEntries(['a','b','c','d','e'].map(id => [id,{src:id}]));
  const player = createVoicePlayer({ recordings, getContext:() => context,
    fetchClip:async (clip, signal) => { fetched.push(clip.src); return options.fetch ? options.fetch(clip.src,signal) : clip.src; },
    isAllowed:() => allowed, getVolume:() => volume, now:() => time, ...options.player });
  return { player, context, started, sources, gains, fetched,
    allowed(value) { allowed=value; }, volume(value) { volume=value; }, time(value) { time=value; },
    finish() { sources.at(-1).finish(); } };
}
test('a recording plays in full and later calls never interrupt it', async () => {
  const f=setup(); f.player.enqueue('a'); await flush(); f.player.enqueue('b'); await flush();
  assert.deepEqual(f.started,[{id:'a',args:[]}]); assert.equal(f.sources[0].stopped,0);
  f.finish(); await flush(); assert.deepEqual(f.started.map(x=>x.id),['a','b']);
  f.finish(); await flush(); assert.equal(f.player.status().state,'ready'); f.player.dispose();
});
test('urgent calls keep their arrival order without cutting the active word',async()=>{
  const f=setup();f.player.enqueue('a');await flush();f.player.enqueue('b');f.player.enqueue('c',{urgent:true});f.player.enqueue('d',{urgent:true});
  for(let i=0;i<4;i++){f.finish();await flush();}
  assert.deepEqual(f.started.map(x=>x.id),['a','c','d','b']);assert.ok(f.sources.every(s=>s.stopped===0));f.player.dispose();
});
test('a late network response cannot resurrect a stopped table',async()=>{
  const late=deferred(),f=setup({fetch:id=>id==='a'?late.promise:Promise.resolve(id)});
  f.player.enqueue('a');await flush();f.player.stop({clearLast:true});f.player.enqueue('b');await flush();
  late.resolve('a');await flush();assert.deepEqual(f.started.map(x=>x.id),['b']);assert.equal(f.player.status().last,'b');f.player.dispose();
});
test('failed loading does not block the next call and is visible when there is no next call',async()=>{
  const f=setup({fetch:async id=>{if(id==='a')throw Error('offline');return id;}});
  f.player.enqueue('a');await flush();assert.equal(f.player.status().state,'error');
  f.player.enqueue('b');await flush();assert.equal(f.player.status().state,'playing');assert.equal(f.player.status().error,null);f.player.dispose();
});
test('a suspended context retains a loaded call until it resumes',async()=>{
  const gate=deferred(),f=setup({fetch:()=>gate.promise});f.player.enqueue('a');await flush();f.context.state='suspended';gate.resolve('a');await flush();
  assert.equal(f.started.length,0);assert.equal(f.player.status().pending,1);f.context.state='running';void f.player.drain();await flush();
  assert.deepEqual(f.started.map(x=>x.id),['a']);f.player.dispose();
});
test('stale calls are not replayed after a slow request',async()=>{
  const gate=deferred(),f=setup({fetch:()=>gate.promise});f.player.enqueue('a');await flush();f.time(11000);gate.resolve('a');await flush();assert.equal(f.started.length,0);f.player.dispose();
});
test('mute immediately cancels current and queued calls; changing volume preserves speech',async()=>{
  const f=setup();f.player.enqueue('a');await flush();f.volume(.2);f.player.refreshSettings();assert.equal(f.gains[0].gain.value,.2);assert.equal(f.sources[0].stopped,0);
  f.player.enqueue('b');f.allowed(false);f.player.refreshSettings();await flush();assert.equal(f.sources[0].stopped,1);assert.equal(f.player.status().pending,0);assert.equal(f.player.enqueue('c'),false);f.player.dispose();
});
test('queue pressure drops a waiting normal call instead of a pending urgent call',async()=>{
  const f=setup({player:{maxQueue:2}});f.player.enqueue('a');await flush();f.player.enqueue('b');f.player.enqueue('c',{urgent:true});f.player.enqueue('d');
  f.finish();await flush();f.finish();await flush();assert.deepEqual(f.started.map(x=>x.id),['a','c','d']);f.player.dispose();
});
test('replay uses the complete last call and leaving a table clears that history',async()=>{
  const f=setup();assert.equal(f.player.replay(),false);f.player.enqueue('a');await flush();f.finish();await flush();assert.equal(f.player.replay(),true);await flush();
  assert.deepEqual(f.started.map(x=>x.id),['a','a']);f.player.stop({clearLast:true});assert.equal(f.player.replay(),false);f.player.dispose();
});
test('a start failure releases the queue and can be retried',async()=>{
  let fail=true;const f=setup({startFails:()=>fail});f.player.enqueue('a');await flush();assert.equal(f.player.status().state,'error');fail=false;f.player.enqueue('b');await flush();assert.deepEqual(f.started.map(x=>x.id),['b']);f.player.dispose();
});
test('decoded recordings use a bounded cache',async()=>{
  const f=setup({player:{cacheSize:2}});
  for(const id of ['a','b','c','a']){f.player.enqueue(id);await flush();f.finish();await flush();}
  assert.deepEqual(f.fetched,['a','b','c','a']);f.player.dispose();
});
test('preloading uses no more than two simultaneous requests',async()=>{
  let active=0,max=0;const f=setup({fetch:async id=>{active++;max=Math.max(max,active);await flush();active--;return id;}});
  await f.player.prime(['a','b','c','d']);assert.equal(max,2);f.player.dispose();
});
test('a repeated event is spoken once, while distinct players and explicit replay remain audible',async()=>{
  const f=setup();
  assert.equal(f.player.enqueue('a',{key:'batch:1:seat:0'}),true);await flush();
  assert.equal(f.player.enqueue('a',{key:'batch:1:seat:0'}),false);
  assert.equal(f.player.enqueue('a',{key:'batch:1:seat:1'}),true);
  f.finish();await flush();f.finish();await flush();
  assert.equal(f.player.enqueue('a',{key:'batch:1:seat:0'}),false);
  assert.equal(f.player.replay(),true);await flush();
  assert.deepEqual(f.started.map(x=>x.id),['a','a','a']);f.player.dispose();
});
test('the next call downloads while the current recording plays',async()=>{
  const next=deferred(),f=setup({fetch:id=>id==='b'?next.promise:Promise.resolve(id)});
  f.player.enqueue('a');await flush();f.player.enqueue('b');await flush();
  assert.deepEqual(f.fetched,['a','b']);assert.deepEqual(f.started.map(x=>x.id),['a']);
  next.resolve('b');await flush();f.finish();await flush();
  assert.deepEqual(f.fetched,['a','b']);assert.deepEqual(f.started.map(x=>x.id),['a','b']);f.player.dispose();
});
test('a hung download times out so an already loaded call can play',async()=>{
  const late=deferred();let aborted=false;
  const f=setup({fetch:(id,signal)=>{if(id!=='a')return Promise.resolve(id);signal.addEventListener('abort',()=>{aborted=true;});return late.promise;},player:{loadTimeout:20}});
  f.player.enqueue('a');f.player.enqueue('b');await new Promise(resolve=>setTimeout(resolve,40));await flush();
  assert.equal(aborted,true);assert.deepEqual(f.started.map(x=>x.id),['b']);
  late.resolve('a');await flush();assert.deepEqual(f.started.map(x=>x.id),['b']);f.player.dispose();
});
test('the original event time expires both delayed animation calls and queued chatter',async()=>{
  const f=setup();f.time(5000);
  assert.equal(f.player.enqueue('a',{createdAt:1000}),false);
  assert.equal(f.player.enqueue('a',{createdAt:4900}),true);await flush();
  assert.equal(f.player.enqueue('b',{maxAge:1800}),true);await flush();
  f.time(6900);f.finish();await flush();
  assert.deepEqual(f.started.map(x=>x.id),['a']);f.player.dispose();
});
test('an unapproved or missing human voice never falls back to the rejected synthesized pack',()=>{
  assert.equal(Object.keys(VOICE_LINES).length,56);
  const fixture={kind:'human',approved:true,voice:'TEST METADATA',recordings:Object.fromEntries(Object.entries(VOICE_LINES).map(([id,text])=>[id,{text,src:'/assets/audio/baloot-human/test/'+id+'.mp3',seconds:.2,sha256:'0'.repeat(64)}]))};
  assert.equal(humanPackReady(fixture),true);
  assert.equal(humanPackReady({...fixture,approved:false}),false);
  assert.equal(humanPackReady({...fixture,kind:'synthetic'}),false);
  assert.equal(humanPackReady({...fixture,recordings:{}}),false);
  if(!humanPackReady(VOICE_PACK)){
    assert.equal(BalootVoice.say('بس'),false);assert.equal(BalootVoice.getStatus().state,'awaiting-recordings');assert.equal(BalootVoice.synthetic,null);
  }else assert.equal(BalootVoice.synthetic,false);
  for(const id of Object.keys(VOICE_LINES))assert.deepEqual(voiceLines(id),[id],id);
});
