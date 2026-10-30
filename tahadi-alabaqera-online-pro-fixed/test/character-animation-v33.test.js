import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createDOM} from './dom-harness.mjs';
import {Career} from '../src/career/core.js';
import {loadAtelier} from './atelier-harness.mjs';
const json=async path=>JSON.parse(await readFile(new URL('../public/'+path,import.meta.url)));
const IDS=Career.HEROES.map(h=>h.id);
async function setup({reduced=false,fail=false,hold=false,page='reaction.html'}={}){
 const requests=[],draws=[],rafs=new Map(),gates=[];let next=0,clock=0;
 class Image{naturalWidth=1774;naturalHeight=887;set src(value){this.path=value;queueMicrotask(()=>this.onload?.());}}
 const h=await createDOM(page,{Image,fetch:async url=>{requests.push(url);if(hold)await new Promise(resolve=>gates.push(resolve));if(fail)return{ok:false};return{ok:true,json:()=>json(url.split('?')[0].slice(1))};},matchMedia:()=>({matches:reduced}),requestAnimationFrame:fn=>{rafs.set(++next,fn);return next;},cancelAnimationFrame:id=>rafs.delete(id)});
 const create=h.doc.createElement;h.doc.createElement=tag=>{const el=create(tag);if(tag==='canvas')el.getContext=()=>new Proxy({drawImage:(...args)=>draws.push(args),measureText:text=>({width:String(text).length*50})}, {get:(t,k)=>t[k]||(()=>{}),set:(t,k,v)=>(t[k]=v,true)});return el;};
 h.context.BS_CAREER_CORE=Career;h.context.BS_AUDIO={getSettings:()=>({effects:true,volume:.72})};
 await h.runFile('assets/js/character-player.js');
 const advance=ms=>{for(let i=0;i<ms;i+=20){clock+=20;const todo=[...rafs.values()];rafs.clear();for(const fn of todo)fn(clock);}};
 return{...h,requests,draws,rafs,gates,advance,player:h.context.BS_CHARACTERS};
}
test('all twelve full-body actors have safe, anchored, distinct poses in every action',async()=>{
 const index=await json('assets/characters-v33/index.json');assert.equal(index.characters.length,12);const masters=new Set();
 for(const id of IDS){
  const m=await json('assets/characters-v33/'+id+'.json'),png=await readFile(new URL('../public/assets/characters-v33/'+id+'.png',import.meta.url));
  assert.equal(m.frameCount,32);assert.equal(createHash('sha256').update(png).digest('hex'),m.source_sha256);masters.add(m.source_sha256);assert.equal(png.readUInt32BE(16),m.width);assert.equal(png.readUInt32BE(20),m.height);
  for(const state of ['idle','walk','entry','win']){const s=m.states[state];assert.equal(s.frames.length,8,id+state);assert.equal(new Set(s.frames).size,8);for(const n of s.frames){const f=m.frames[n];assert.ok(f.usable);assert.ok(f.x>=0&&f.y>=0&&f.x+f.w<=m.width&&f.y+f.h<=m.height);const left=192-f.anchorX*m.scale,top=m.viewport.baseline-f.anchorY*m.scale;assert.ok(left>=0&&top>=0&&left+f.w*m.scale<=384&&top+f.h*m.scale<=320,id+': '+state+n);}}
  assert.ok((await readFile(new URL('../public/assets/characters-v33/portraits/'+id+'.webp',import.meta.url))).length>5000);
 }
 assert.equal(masters.size,12);
});
test('store posters do not decode twelve animation atlases; active instances share one load',async()=>{
 const h=await setup();for(const id of IDS)h.doc.body.append(h.player.actor(id,{posterOnly:true}));assert.equal(h.requests.length,0);
 const a=h.player.actor('cat'),b=h.player.actor('character-cat');h.doc.body.append(a,b);await Promise.all([a.ready,b.ready]);assert.equal(h.requests.length,1);assert.equal(a.dataset.loaded,'true');assert.equal(b.dataset.loaded,'true');h.player.cancel();
});
test('walking changes source UVs and a finite entrance returns to idle without a delayed replay',async()=>{
 const h=await setup(),actor=h.player.actor('samurai',{staticIdle:true});h.doc.body.append(actor);await actor.ready;h.player.setState(actor,'walk',{loop:false});h.advance(220);assert.ok(Number(actor.dataset.frame)>8);assert.ok(h.draws.some(args=>args[0]?.path?.includes('samurai.png')&&args.length===9));h.advance(1000);assert.equal(actor.dataset.pose,'idle');assert.equal(h.rafs.size,0);
 h.player.setState(actor,'entry');h.advance(1600);assert.equal(actor.dataset.pose,'idle');assert.equal(h.rafs.size,0);
});
test('pause and page visibility freeze the playhead and do not skip through the animation',async()=>{
 const h=await setup(),actor=h.player.actor('robot',{pose:'walk'});h.doc.body.append(actor);await actor.ready;h.advance(200);const before=actor.dataset.frame;
 h.context.dispatchEvent({type:'bs-match-pause',detail:{paused:true}});h.advance(3000);assert.equal(actor.dataset.frame,before);assert.equal(h.rafs.size,0);
 h.context.dispatchEvent({type:'bs-match-pause',detail:{paused:false}});h.advance(40);assert.ok(Number(actor.dataset.frame)-Number(before)<=1);const resumed=actor.dataset.frame;h.doc.hidden=true;h.doc.dispatchEvent({type:'visibilitychange'});h.advance(3000);assert.equal(actor.dataset.frame,resumed);h.doc.hidden=false;h.doc.dispatchEvent({type:'visibilitychange'});h.advance(120);assert.notEqual(actor.dataset.frame,resumed);h.player.cancel();
});
test('reduced motion stays still until the player explicitly previews an action',async()=>{
 const h=await setup({reduced:true}),actor=h.player.actor('cyber');h.doc.body.append(actor);await actor.ready;assert.equal(h.rafs.size,0);const before=actor.dataset.frame;h.advance(1000);assert.equal(actor.dataset.frame,before);h.player.setState(actor,'win',{explicit:true});h.advance(350);assert.ok(Number(actor.dataset.frame)>=25);h.advance(1600);assert.equal(actor.dataset.pose,'idle');assert.equal(h.rafs.size,0);
});
test('missing art keeps the poster visible and exposes an honest load failure',async()=>{
 const h=await setup({fail:true}),actor=h.player.actor('viking');h.doc.body.append(actor);await actor.ready;assert.equal(actor.dataset.loaded,'error');assert.notEqual(actor.querySelector('img').hidden,true);assert.equal(actor.querySelector('canvas'),null);assert.equal(h.rafs.size,0);
});
test('cancelling before async loading completes prevents a late entrance or animation',async()=>{
 const h=await setup({hold:true}),actor=h.player.actor('diver',{pose:'entry'});h.doc.body.append(actor);h.player.cancel();h.gates.forEach(fn=>fn());await actor.ready;assert.equal(actor.dataset.pose,'idle');assert.equal(h.rafs.size,0);
});
test('a real preview switches whole-character poses and cleans up without changing ownership',async()=>{
 const h=await setup(),box=h.doc.createElement('div'),actor=h.player.actor('cat');box.append(actor);h.doc.body.append(box);await actor.ready;await h.runFile('assets/js/hero-effects.js');const stop=h.context.BS_HERO_FX.preview(box,'cat','move',{sound:false});assert.equal(actor.dataset.pose,'walk');h.advance(180);assert.ok(Number(actor.dataset.frame)>8);stop();assert.equal(actor.dataset.pose,'idle');h.player.dispose(actor);h.advance(500);assert.equal(h.rafs.size,0);
});
test('all thirty-six Foley cues are distinct, nonverbal, finite and reproducible from included licensed layers',async()=>{
 const m=await json('assets/sounds/character-foley-v33/manifest.json'),hashes=new Set();assert.equal(m.files.length,36);assert.equal(m.speech,false);assert.equal(m.voice_clone,false);assert.equal(m.license,'CC0-1.0');
 for(const row of m.files){const b=await readFile(new URL('../public/assets/sounds/character-foley-v33/'+row.path,import.meta.url));assert.equal(b.toString('ascii',0,4),'RIFF');assert.ok(row.duration<=2&&row.duration>=.5);assert.ok(row.rms>.01&&row.peak<=.7);assert.equal(createHash('sha256').update(b).digest('hex'),row.sha256);hashes.add(row.sha256);for(const [pack,name]of row.layers)await readFile(new URL('../public/assets/sounds/character-foley-v33/source/'+pack+'-'+name+'.ogg',import.meta.url));}
 assert.equal(hashes.size,36);
});
test('every game loads actors before event effects and snakes uses each seat own character',async()=>{
 for(const route of ['baloot','snakes','jackaroo','zahra','dice','serpent','party','journey','paths-online','sudoku','picture','quiz','online','local','memory','logic','reaction','puzzle']){const html=await readFile(new URL('../public/'+route+'.html',import.meta.url),'utf8');assert.ok(html.indexOf('character-player.js')>0&&html.indexOf('character-player.js')<html.indexOf('hero-effects.js'),route);}
 const snakes=await readFile(new URL('../public/snakes.html',import.meta.url),'utf8');assert.match(snakes,/BS_CHARACTERS\.actor\(look\.character/);assert.equal(Career.heroPoster('../../bad'),'');
});
test('the actual shop loads an animated full actor and its movement control changes source poses',async()=>{
 const h=await setup({page:'shop.html'});h.context.BS_CAREER={get:()=>Career.normalize({coins:3000}),now:()=>Date.now(),account:()=>null};await h.runFile('assets/js/hero-effects.js');await loadAtelier(h);
 h.doc.querySelector('[data-item="character-cyber"] [data-control="inspect"]').click();const actor=h.doc.getElementById('previewArt').querySelector('.character-actor');await actor.ready;await Promise.resolve();const buttons=h.doc.querySelectorAll('.hero-signature-controls button');assert.equal(buttons.length,3);assert.equal(buttons[1].textContent,'المشي');assert.equal(buttons[1].disabled,false);buttons[1].click();h.advance(200);assert.equal(actor.dataset.pose,'walk');assert.ok(Number(actor.dataset.frame)>8);h.doc.getElementById('previewDialog').close();h.advance(100);assert.equal(h.doc.querySelectorAll('.hero-signature-panel').length,0);h.player.cancel();
});
test('the character gallery switches identities, action gestures and sound controls',async()=>{
 const h=await setup({page:'characters.html'});await h.runFile('assets/js/hero-effects.js');await h.runFile('assets/js/character-gallery.js');let actor=h.doc.getElementById('characterStage').querySelector('.character-actor');await actor.ready;assert.equal(actor.dataset.hero,'samurai');assert.equal(h.doc.querySelectorAll('[data-character]').length,12);h.doc.querySelector('[data-character="diver"]').click();actor=h.doc.getElementById('characterStage').querySelector('.character-actor');await actor.ready;await Promise.resolve();h.doc.querySelector('[data-pose="win"]').click();h.advance(200);assert.equal(actor.dataset.hero,'diver');assert.equal(actor.dataset.pose,'win');assert.match(h.doc.getElementById('characterIdentity').textContent,/الأعماق/);h.player.cancel();
});
