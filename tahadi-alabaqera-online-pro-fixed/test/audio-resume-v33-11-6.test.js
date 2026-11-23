import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
async function fixture(){const sources=[],stops=[],html=[],requests=[],handlers={};let resumed=0,release;
 const gain=()=>({gain:{value:1},connect(){return this;},disconnect(){}});
 class Context{constructor(){this.state='suspended';this.destination={};}resume(){resumed++;this.state='running';return Promise.resolve();}createDynamicsCompressor(){return {...gain(),threshold:{},knee:{},ratio:{},attack:{},release:{}};}createGain(){return gain();}decodeAudioData(b,ok){ok({decoded:true});}createBufferSource(){const n={playbackRate:{},connect(){return this;},disconnect(){},start(){sources.push(n);},stop(){stops.push(n);}};return n;}}
 class Audio{constructor(src){this.src=src;}play(){html.push(this.src);return Promise.resolve();}pause(){}load(){}}
 const window={AudioContext:Context,addEventListener:(k,fn)=>handlers[k]=fn,dispatchEvent(){}};
 const env={window,Audio,navigator:{},localStorage:{getItem:()=>null,setItem(){}},CustomEvent:class{},setTimeout,clearTimeout,Date,console,fetch:url=>{requests.push(url);return new Promise(ok=>release=()=>ok({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)}));}};
 vm.runInNewContext(await readFile(new URL('../public/assets/js/audio-manager.js',import.meta.url),'utf8'),env);
 return {api:window.BS_AUDIO,sources,stops,html,requests,handlers,release:()=>release(),resumed:()=>resumed};}
const tick=()=>new Promise(r=>setTimeout(r,5));
test('the first cue waits for decode and plays once through WebAudio after unlocking',async()=>{const f=await fixture();f.api.play('move');assert.equal(f.sources.length,0);assert.equal(f.html.length,0);f.release();await tick();assert.equal(f.sources.length,1);assert.equal(f.requests.length,1);});
test('muting while a cue is loading prevents a late sound after decode',async()=>{const f=await fixture();f.api.play('move');f.api.setMuted(true);f.release();await tick();assert.equal(f.sources.length,0);assert.equal(f.html.length,0);});
test('returning from an interrupted context resumes cached cues and mute stops active voices',async()=>{const f=await fixture();f.api.play('move');f.release();await tick();f.api.context().state='interrupted';f.handlers.pointerdown();f.api.play('move');await tick();assert.ok(f.resumed()>=2);assert.equal(f.sources.length,2);assert.equal(f.requests.length,1);f.api.setMuted(true);assert.equal(f.stops.length,2);});
