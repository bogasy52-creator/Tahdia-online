import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {createDOM} from './dom-harness.mjs';

async function player(page='billiards.html'){
 const fetched=[],sources=[],ramps=[];let muted=false,now=2000;
 const ctx={currentTime:0,state:'running',decodeAudioData:(_bytes,ok)=>ok({duration:200}),
  createBufferSource(){const n={connect(x){return x},start(...args){n.started=args},stop(){n.stopped=true},disconnect(){}};sources.push(n);return n},
  createGain(){return{gain:{value:0,cancelScheduledValues(){},setValueAtTime(){},linearRampToValueAtTime(v,t){ramps.push({v,t})}},connect(x){return x}}},
 };
 const h=await createDOM(page,{Date:class extends Date{static now(){return now}},fetch:async url=>{fetched.push(url);return{ok:true,arrayBuffer:async()=>new ArrayBuffer(16)}},
  BS_AUDIO:{context:()=>ctx,musicBus:()=>({}),getSettings:()=>({muted,music:true,volume:.8,musicVolume:.5}),prime(){},unlock(){},contentActive:()=>false,recent:()=>true},
 });
 h.context.top=h.context;
 h.doc.head=h.doc.createElement('head');
 await h.runFile('assets/js/sound-v33-9-3.js');
 await h.context.BS_SOUND.play();
 return{...h,fetched,sources,ramps,setMuted:v=>{muted=v;h.context.BS_SOUND.sync()},advance:ms=>{now+=ms}};
}

test('the billiards and Carrom pages decode distinct new recordings with musical loop boundaries',async()=>{
 const scores=JSON.parse(await readFile(new URL('../public/assets/music/v33-9-12/scores.json',import.meta.url),'utf8'));
 for(const [page,track] of [['billiards.html','billiards'],['race.html','carrom'],['index.html','lobby']]){
  const h=await player(page),node=h.sources[0];
  assert.equal(h.fetched[0],'/assets/music/v33-9-12/'+track+'.mp3');
  assert.equal(node.loop,true);assert.equal(node.loopStart,1);
  assert.ok(Math.abs(node.loopEnd-1-scores[track].loop)<.001);
  assert.equal(node.started[1],1);
 }
 assert.notEqual(scores.carrom.mood,scores.billiards.mood);
 assert.notDeepEqual(scores.carrom.programs,scores.billiards.programs);
});

test('all sixteen game scores are shipped with bounded sizes, sample rate and headroom metadata',async()=>{
 const scores=JSON.parse(await readFile(new URL('../public/assets/music/v33-9-12/scores.json',import.meta.url),'utf8'));
 assert.equal(Object.keys(scores).length,16);
 for(const [key,score] of Object.entries(scores)){
  const size=(await stat(new URL('../public/assets/music/v33-9-12/'+score.file,import.meta.url))).size;
  assert.equal(size,score.bytes);assert.ok(size>500000&&size<2000000,key);
  assert.equal(score.sample_rate,44100);assert.equal(score.integrated_target_lufs,-19);assert.equal(score.true_peak_ceiling_dbtp,-2);
  assert.ok(score.loop>45&&score.loop<105,key);
 }
});

test('a table strike briefly ducks music, restores it, and never defeats mute',async()=>{
 const h=await player(),full=h.ramps.at(-1).v;
 h.context.dispatchEvent(new h.context.Event('bs-table-strike'));
 assert.ok(h.ramps.at(-1).v<full*.6);
 h.advance(1000);
 const restore=[...h.timers.values()].find(t=>t.ms===920);assert.ok(restore);restore.fn();
 assert.equal(h.ramps.at(-1).v,full);
 h.setMuted(true);assert.equal(h.ramps.at(-1).v,0);
 h.context.dispatchEvent(new h.context.Event('bs-table-strike'));assert.equal(h.ramps.at(-1).v,0);
});
