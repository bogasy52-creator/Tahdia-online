import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import * as Ludo from '../public/assets/js/engines/ludo-engine.js';import * as Six from '../public/assets/js/ludo/six-layout.js';import{createDOM,MiniElement}from'./dom-harness.mjs';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),signature=el=>[el.tagName,el.attributes,el._text||'',el.children.map(signature)];
async function renderer(){const h=await createDOM('ludo.html',{...Ludo,...Six});h.doc.createTextNode=t=>{const n=new MiniElement('#text');n.textContent=t;return n;};await h.runFile('assets/js/ludo/board.js');return h;}
async function render(h,state,options){h.context.args={host:h.doc.getElementById('board'),state,options};await vm.runInContext('renderLudoBoard(args.host,args.state,args.options)',h.context);return h.doc.querySelector('#board svg');}
test('the four-player royal board (33.13) is drawn the same from every player and turn',async()=>{
 const gold=JSON.parse(await readFile(new URL('./fixtures/ludo-four-v33-13.json',import.meta.url),'utf8'));
 for(let viewer=0;viewer<4;viewer++)for(let active=0;active<4;active++){const h=await renderer(),svg=await render(h,Ludo.createLudoGame(['A','B','C','D']),{viewer,active,legal:[0,1]});assert.equal(createHash('sha256').update(JSON.stringify(signature(svg))).digest('hex'),gold[viewer+':'+active]);}
});
test('six arms have straight parallel columns, larger separate tiles and a direct home gate',()=>{
 const c=Six.SIX_CELL;assert.equal(c,26);assert.equal(Six.SIX_TRACK.length,78);const all=[...Six.SIX_TRACK,...Six.SIX_LANES.flat(),...Six.SIX_YARDS.flatMap(y=>y.slots)];
 for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++)assert.ok(distance(all[i],all[j])>=c-1e-8,'tile and pawn centres have room');
 for(let seat=0;seat<6;seat++){const lane=Six.SIX_LANES[seat];for(let h=1;h<5;h++)assert.ok(Math.abs(distance(lane[h-1],lane[h])-c)<1e-8);assert.ok(Math.abs(distance(Six.SIX_TRACK[(seat*13+76)%78],lane[0])-c)<1e-8);const a=Six.sixAngle(seat),normal=p=>-(p.x-300)*Math.sin(a)+(p.y-300)*Math.cos(a);for(let k=0;k<6;k++)assert.ok(Math.abs(normal(Six.SIX_TRACK[(seat*13+k+70)%78])+c)<1e-8);}
});
test('a tap under a neighbouring SVG hit area chooses the closest legal pawn and keyboard still works',async()=>{
 for(let viewer=0;viewer<6;viewer++){const h=await renderer(),state=Ludo.createLudoGame(['A','B','C','D','E','F']),picked=[];state.players[viewer].tokens=[0,1,-1,-1];const svg=await render(h,state,{viewer,active:viewer,legal:[0,1],onPick:t=>picked.push(t)}),hits=svg.querySelectorAll('.ludo-hit'),point=Six.sixRotate(Six.sixSpot(state,viewer,0,0),viewer);
  svg.createSVGPoint=()=>({x:0,y:0,matrixTransform(){return{x:this.x,y:this.y};}});svg.getScreenCTM=()=>({inverse:()=>({})});
  const wrong=hits.find(n=>n.parentElement.dataset.token==='1'),event={type:'click',clientX:point.x,clientY:point.y,target:wrong,stopPropagation(){throw Error('the front hit area must not capture the pointer');}};wrong.dispatchEvent(event);svg.dispatchEvent(event);assert.deepEqual(picked,[0]);wrong.dispatchEvent({type:'keydown',key:'Enter',preventDefault(){}});assert.deepEqual(picked,[0,1]);
 }
});
test('the isolated home keeps account controls, room entry, invitations and search working',async()=>{
 const h=await createDOM('index.html');assert.ok(h.doc.body.classList.contains('home-palace'));assert.ok(!h.doc.body.classList.contains('release-v26'));assert.ok(!h.doc.body.classList.contains('suite-v17'));assert.equal(h.doc.getElementById('heroTitle').textContent.replace(/\s+/g,''),'لعبةالعباقرة');
 assert.equal(h.doc.querySelectorAll('[data-open-profile]').length,1);assert.equal(h.doc.querySelectorAll('.palace-dock a').length,5);assert.ok(h.doc.querySelector('[data-invite-list]'));
 await h.runFile('assets/js/home-v14.js');const search=h.doc.getElementById('gameSearch');search.value='جاكارو';search.dispatchEvent({type:'input'});const visible=h.doc.querySelectorAll('.home-game').filter(n=>!n.classList.contains('hidden'));assert.equal(visible.length,1);assert.equal(visible[0].getAttribute('href'),'/jackaroo');
 await h.runFile('assets/js/home-join-v33-6.js');h.doc.getElementById('homeJoinOpen').click();assert.equal(h.doc.getElementById('homeJoinSheet').hidden,false);
});
