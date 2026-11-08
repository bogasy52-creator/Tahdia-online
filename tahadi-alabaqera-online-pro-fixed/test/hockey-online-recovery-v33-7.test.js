import test from 'node:test';
import assert from 'node:assert/strict';
import * as Core from '../public/assets/js/hockey/core.js';
import * as Render from '../public/assets/js/hockey/render.js';
import {hockeyPerspective} from '../public/assets/js/hockey/online.js';
import {createDOM} from './dom-harness.mjs';
test('a renderer failure can recover the running online round without asking the server for a rematch',async()=>{
 let frame,fail=true,client,draws=0;
 class Online{constructor(options){this.options=options;this.seat=0;this.sent=[];this.token='test';client=this}close(){}input(){}send(m){this.sent.push(m);return true}async enter(){const g=Object.fromEntries(Object.entries(Core.createGame({mode:'two'})).filter(([key])=>!['rng','ais','hitAt'].includes(key)));this.state={status:'playing',round:1,frame:1,players:[{id:'a',name:'A'},{id:'b',name:'B'}],g};this.options.onState(this.state)}}
 const h=await createDOM('hockey.html',{...Core,...Render,HockeyOnline:Online,hockeyPerspective,screen:{orientation:{}},innerWidth:390,innerHeight:844,requestAnimationFrame:fn=>(frame=fn,1),location:{search:'?debug',pathname:'/hockey',protocol:'https:',host:'game.test'}});
 h.doc.getElementById('conf').getContext=()=>({setTransform(){},clearRect(){}});
 await h.runFile('assets/js/hockey/main.js',{createRenderer:()=>({resize(){},layout(){},draw(){if(fail)throw Error('lost canvas');draws++},toTable:(x,y)=>({x,y})}),drawTablePreview(){},drawPuckPreview(){},drawStrikerPreview(){}});
 h.context.__hockey.prefs.mode='online';h.doc.getElementById('hkQuick').click();await Promise.resolve();frame(16);
 assert.equal(h.doc.getElementById('result').hidden,false);fail=false;h.doc.getElementById('againBtn').click();frame(32);
 assert.equal(h.doc.getElementById('result').hidden,true);assert.equal(draws,1);assert.deepEqual(client.sent,[]);assert.equal(h.context.__hockey.g.target,client.state.g.target);
});
