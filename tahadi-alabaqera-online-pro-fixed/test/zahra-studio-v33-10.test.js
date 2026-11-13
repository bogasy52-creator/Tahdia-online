import test from 'node:test';
import assert from 'node:assert/strict';
import {createDOM} from './dom-harness.mjs';
import {createLudoGame,applyLudoMove,getLegalLudoMoves} from '../public/assets/js/engines/ludo-engine.js';

function room(state, pendingRoll=null) {
 return {code:'401234',status:'playing',state,pendingRoll,me:{id:'p0',index:0,role:'host'},order:['p0','p1'],players:state.players.map((p,index)=>({id:'p'+index,index,name:p.name,look:{pawn:'pawn-classic',dice:'dice-ivory'}}))};
}
test('leaving Zahra while a die is rolling cancels the frame without restoring or reading the departed game',async()=>{
 const h=await createDOM('zahra.html');await h.runInline();
 let finishRoll;h.context.BS_DICE.roll=()=>new Promise(resolve=>{finishRoll=resolve;});
 const table=h.context.tables[0],s=createLudoGame(['أ','ب']);await table.apply(room(s));
 const controller=new AbortController(),pending=table.apply(room(s,6),{animate:true,signal:controller.signal});
 controller.abort();table.leave();finishRoll();
 await assert.doesNotReject(pending);
 assert.equal(h.context.BS_TABLE.active,false);assert.equal(h.doc.getElementById('game').classList.contains('hidden'),true);
 assert.equal(h.doc.querySelector('.board-preview-v34'),null);
});

async function practice(options){
 const module=await import('../public/assets/js/zahra-practice-v33-10.js').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
 assert.equal(typeof module.createZahraPractice,'function','Zahra provides local practice without a room connection');
 return module.createZahraPractice(options);
}
test('local pass-and-play rolls, selects only legal stones, and hands control to the next person',async()=>{
 const frames=[],rolls=[.99,0],local=await practice({onFrame:async next=>frames.push(structuredClone(next)),rng:()=>rolls.shift()??0,delay:async()=>{}});
 await local.start({mode:'pass',count:2,name:'أ',look:{pawn:'pawn-character',dice:'dice-ruby',character:'character-samurai'}});
 assert.deepEqual(local.snapshot.players[0].look,{pawn:'pawn-character',dice:'dice-ruby',character:'character-samurai'});
 assert.equal(local.send('ludo_move',{token:0}),false);
 assert.equal(local.send('roll'),true);await local.settled;
 assert.equal(local.snapshot.pendingRoll,6);assert.equal(local.send('roll'),false);
 assert.equal(local.send('ludo_move',{token:0}),true);await local.settled;
 assert.equal(local.snapshot.state.players[0].tokens[0],0);assert.equal(local.snapshot.state.turn,0);
 local.send('roll');await local.settled;local.send('ludo_move',{token:0});await local.settled;
 assert.equal(local.snapshot.state.players[0].tokens[0],1);assert.equal(local.snapshot.me.index,1);assert.equal(local.snapshot.localMode,'pass');
 assert.ok(frames.length>=5);local.leave();
});
test('local AI finishes its turn and preserves four stones for every one of six seats',async()=>{
 const local=await practice({onFrame:async()=>{},rng:()=>0,delay:async()=>{}});await local.start({mode:'ai',count:6});
 local.send('roll');await local.settled;
 assert.equal(local.snapshot.state.turn,0);assert.equal(local.snapshot.state.rollCount,6);assert.equal(local.snapshot.players.filter(p=>p.bot).length,5);
 assert.ok(local.snapshot.state.players.every(p=>p.tokens.length===4));local.leave();
});
test('leaving local practice cancels an in-flight frame and prevents AI frames after exit',async()=>{
 const frames=[];let unblock;const local=await practice({rng:()=>0,delay:async()=>{},onFrame:async(next,{animate,signal})=>{frames.push(next);if(animate)await new Promise(resolve=>{unblock=resolve;signal.addEventListener('abort',resolve,{once:true});});}});
 await local.start({count:2,mode:'ai'});local.send('roll');await Promise.resolve();
 assert.ok(unblock);local.leave();unblock();await local.settled;
 assert.equal(local.active,false);assert.equal(local.snapshot,null);assert.equal(frames.length,2);assert.equal(local.send('roll'),false);
});

import {renderZahraBoard,zahraLayout,ZAHRA_COLORS} from '../public/assets/js/zahra-studio-v33-10.js';
import {petalStonePoint,paintBoardPreview} from '../public/assets/js/board-petals-v29.js';
import {boardGeometry,boardStonePosition} from '../public/assets/js/engines/board-geometry-v29.js';
function installGlobals(t,values){const previous=Object.keys(values).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]);Object.assign(globalThis,values);t.after(()=>previous.forEach(([key,value])=>value?Object.defineProperty(globalThis,key,value):delete globalThis[key]));}
function installDocument(t,h){installGlobals(t,{Event:h.context.Event,document:h.doc,BS_PIECES:h.context.BS_PIECES,matchMedia:()=>({matches:true})});}
for(const count of [2,3,4,5,6])test('Zahra Studio keeps every legal destination, base and finish aligned with the move preview at '+count+' players',async t=>{
 const h=await createDOM('zahra.html');installDocument(t,h);const state=createLudoGame(Array.from({length:count},(_,i)=>'لاعب '+i)),geo=boardGeometry(state),L=zahraLayout(state),target=h.doc.getElementById('board');
 for(let seat=0;seat<count;seat++)state.players[seat].tokens=[-1,seat*3,geo.track+1,geo.finish];renderZahraBoard(target,state,{active:0,legal:[0,1],looks:state.players.map(()=> 'pawn-classic')});
 assert.equal(target.querySelectorAll('[data-track]').length,geo.track);assert.equal(target.querySelectorAll('[data-home]').length,geo.seats*4);assert.equal(target.querySelectorAll('[data-stone]').length,count*4);
 for(let seat=0;seat<count;seat++)for(let index=0;index<4;index++){const piece=target.querySelector('[data-stone="'+seat+':'+index+'"]'),coords=piece.getAttribute('transform').match(/translate\(([^ ]+) ([^)]+)\)/).slice(1).map(Number),expected=petalStonePoint(state,seat,index,'zahra');assert.ok(Math.abs(coords[0]-expected.x)<.001&&Math.abs(coords[1]-expected.y)<.001);}
 for(let seat=0;seat<count;seat++){const probe=createLudoGame(Array.from({length:count},(_,i)=>'P'+i));for(let progress=0;progress<=geo.finish;progress++){probe.players[seat].tokens[0]=progress;const expected=petalStonePoint(probe,seat,0,'zahra'),actual=progress<geo.track?L.track[boardStonePosition(seat,progress,probe)]:progress<geo.finish?L.lanes[seat][progress-geo.track]:L.finish[seat];assert.ok(Math.hypot(actual.x-expected.x,actual.y-expected.y)<1e-8,'slot aligns with step '+seat+':'+progress);}}
 assert.ok(L.track.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>0&&p.x<200&&p.y>0&&p.y<200));assert.equal(target.querySelectorAll('[data-sculpted-pawn]').length,count*4);assert.equal(new Set(target.querySelectorAll('[id]').map(x=>x.id)).size,target.querySelectorAll('[id]').length,'paint IDs are unique');
 const before=structuredClone(state);before.players[0].tokens[0]=-1;const after=applyLudoMove(before,0,6);paintBoardPreview(target,before,after,{game:'zahra',action:{token:0}});assert.ok(target.querySelector('[data-preview-route]'));assert.ok(target.querySelector('[data-preview-destination]'));
});
test('the rebuilt renderer preserves equipped stones, labels, keyboard choice and reduced-motion completion',async t=>{
 const h=await createDOM('zahra.html');installDocument(t,h);const state=createLudoGame(['أ','ب']),picks=[],board=h.doc.getElementById('board');renderZahraBoard(board,state,{legal:[0],looks:['pawn-rook','pawn-classic'],onPick:i=>picks.push(i)});
 assert.ok(board.querySelector('[data-pawn-item="pawn-rook"] [data-piece-item="pawn-rook"]'));assert.equal(board.querySelectorAll('[data-sculpted-pawn]').length,4);const piece=board.querySelector('[data-stone="0:0"]');piece.onkeydown({key:'Enter',preventDefault(){}});assert.deepEqual(picks,[0]);assert.equal(piece.getAttribute('aria-disabled'),'false');assert.equal(board.querySelector('[data-stone="1:0"]').getAttribute('aria-disabled'),'true');
 renderZahraBoard(board,applyLudoMove(state,0,6));await board.atelierMotion;assert.equal(board.querySelectorAll('[data-piece-number]').length,8);assert.equal(ZAHRA_COLORS.length,6);
});
test('local practice starts from the page, confirms a previewed move and leaves without sending any online commands',async t=>{
 const h=await createDOM('zahra.html');installDocument(t,h);const {createZahraPractice}=await import('../public/assets/js/zahra-practice-v33-10.js');let local;h.context.getLegalLudoMoves=getLegalLudoMoves;h.context.createZahraPractice=options=>(local=createZahraPractice({...options,rng:()=>.99,delay:async()=>{}}));h.context.renderPetalBoard=renderZahraBoard;
 await h.runInline();h.doc.getElementById('practiceMode').value='pass';h.doc.getElementById('practiceCount').value='4';await h.doc.getElementById('practiceStart').onclick();await local.settled;assert.equal(h.context.BS_TABLE.mode,'local');assert.equal(h.doc.getElementById('game').classList.contains('hidden'),false);
 h.doc.getElementById('roll').click();await local.settled;h.doc.getElementById('board').querySelector('[data-stone="0:0"]').click();assert.ok(h.doc.querySelector('.board-preview-v34'));h.doc.querySelector('.board-preview-v34 .primary').click();await local.settled;assert.equal(local.snapshot.state.players[0].tokens[0],0);assert.equal(h.context.tables[0].sent.length,0);
 h.doc.getElementById('leaveGame').click();h.doc.getElementById('leaveGame').click();await local.settled;assert.equal(local.active,false);assert.equal(h.context.BS_TABLE.active,false);assert.equal(h.doc.querySelector('.board-preview-v34'),null);
});
test('leaving an online table clears its countdown before a local practice session',async()=>{
 const h=await createDOM('zahra.html');await h.runInline();let cleared=0;h.doc.getElementById('status').__bsClock={clear(){cleared++;}};await h.context.tables[0].apply(room(createLudoGame(['أ','ب'])));h.context.tables[0].leave();assert.equal(cleared,1);
});
test('equipping the character stone paints the selected hero artwork on a seat-colored plinth',async t=>{
 const h=await createDOM('zahra.html');await h.runFile('assets/js/profile-core.js');installDocument(t,h);installGlobals(t,{BS_CAREER_CORE:h.context.BS_CAREER_CORE});const state=createLudoGame(['أ','ب']),board=h.doc.getElementById('board');renderZahraBoard(board,state,{looks:['pawn-character','pawn-classic'],characters:['character-samurai','fox']});
 const stone=board.querySelector('[data-stone="0:0"]'),hero=stone.querySelector('[data-character-art]');assert.ok(hero,'the actual selected character is painted');assert.equal(hero.getAttribute('href'),h.context.BS_CAREER_CORE.heroArt('samurai'));assert.equal(hero.getAttribute('preserveAspectRatio'),'xMidYMax meet');assert.ok(stone.querySelector('[data-character-plinth]'));assert.equal(board.querySelectorAll('[data-sculpted-pawn]').length,4);
});
for(const count of [2,6])test('local AI practice plays a complete legal match at '+count+' seats',async()=>{
 let seed=199+count;const rng=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};const {chooseZahraBotMove}=await import('../public/assets/js/zahra-practice-v33-10.js'),local=await practice({onFrame:async()=>{},delay:async()=>{},rng});await local.start({count,mode:'ai'});let turns=0;
 while(local.snapshot.state.winner===null&&turns++<4000){const next=local.snapshot;assert.equal(local.send(next.pendingRoll===null?'roll':'ludo_move',next.pendingRoll===null?{}:{token:chooseZahraBotMove(next.state,next.pendingRoll)}),true);await local.settled;}
 assert.notEqual(local.snapshot.state.winner,null);const state=local.snapshot.state;assert.ok(state.players[state.winner].tokens.every(t=>t===boardGeometry(state).finish));local.leave();
});
function tablePaint(svg){const colors=el=>{const fill=el.getAttribute('fill'),id=fill?.match(/^url\(#(.+)\)$/)?.[1];return id?svg.querySelector('#'+id).querySelectorAll('stop').map(stop=>stop.getAttribute('stop-color')):[fill];};const rects=svg.querySelectorAll('rect'),surface=rects.find(el=>Number(el.getAttribute('width'))===192.4),frame=rects.find(el=>Number(el.getAttribute('width'))===195.8),track=svg.querySelector('[data-track="1"]');return {surface:colors(surface),frame:colors(frame),slot:colors(track.parentElement.children[2])};}
test('equipped Zahra tables paint eight visibly distinct material identities from the actual catalog',async t=>{
 const h=await createDOM('zahra.html');await h.runFile('assets/js/profile-core.js');installDocument(t,h);const state=createLudoGame(['أ','ب','ج','د']),board=h.doc.getElementById('board'),ids=['table-gallery','table-walnut','table-club','table-royal','table-majlis','table-botanic','table-nocturne','table-cyber'],paints=[];
 for(const material of ids){assert.ok(h.context.BS_CAREER_CORE.CATALOG.some(item=>item.id===material&&item.type==='table'));paints.push(tablePaint(renderZahraBoard(board,state,{material})));}assert.equal(new Set(paints.map(p=>JSON.stringify(p))).size,ids.length,'paid material changes must change actual surface/frame/slot colors');assert.notDeepEqual(paints[3].surface,paints[0].surface);assert.notDeepEqual(paints[4].frame,paints[0].frame);assert.notDeepEqual(paints[5].slot,paints[0].slot);
});
test('unselected ivory and retired table aliases retain their intended material colors',async t=>{
 const h=await createDOM('zahra.html');installDocument(t,h);const board=h.doc.getElementById('board'),state=createLudoGame(['أ','ب']),paint=material=>tablePaint(renderZahraBoard(board,state,{material}));assert.deepEqual(paint(''),paint('table-gallery'));assert.deepEqual(paint('table-emerald'),paint('table-botanic'));assert.deepEqual(paint('table-slate'),paint('table-nocturne'));assert.deepEqual(paint('table-midnight'),paint('table-nocturne'));
});
test('paid Zahra motion trails use the equipped style and paint, then cancel cleanly on exit or reduced motion',async t=>{
 const h=await createDOM('zahra.html');await h.runFile('assets/js/profile-core.js');installDocument(t,h);let trail='trail-meteor';installGlobals(t,{BS_CAREER:{get:()=>({equipped:{trail}})},BS_CAREER_CORE:h.context.BS_CAREER_CORE,setTimeout:h.context.setTimeout,clearTimeout:h.context.clearTimeout});globalThis.matchMedia=()=>({matches:false});
 const board=h.doc.getElementById('board'),state=createLudoGame(['أ','ب']);state.players[0].tokens[0]=3;renderZahraBoard(board,state);renderZahraBoard(board,applyLudoMove(state,0,3));let effect=board.querySelector('[data-board-trail="trail-meteor"]');assert.ok(effect,'the equipped trail is visible during the actual move');assert.equal(effect.querySelector('path').getAttribute('stroke'),h.context.BS_CAREER_CORE.COSMETIC_STYLES['trail-meteor']['--trail-color']);assert.ok(effect.querySelectorAll('circle').length>0,'meteor paints sparks');
 board.zahraCleanup();assert.equal(board.querySelector('[data-board-trail]'),null);assert.equal(h.timers.size,0);await board.atelierMotion;trail='trail-echo';renderZahraBoard(board,state);renderZahraBoard(board,applyLudoMove(state,0,3));effect=board.querySelector('[data-board-trail="trail-echo"]');assert.ok(effect);assert.equal(effect.querySelector('path').getAttribute('stroke-dasharray'),'1 2');assert.ok(effect.querySelectorAll('rect').length>0);assert.notEqual(effect.querySelector('path').getAttribute('stroke'),h.context.BS_CAREER_CORE.COSMETIC_STYLES['trail-meteor']['--trail-color']);
 globalThis.matchMedia=()=>({matches:true});renderZahraBoard(board,state);assert.equal(board.querySelector('[data-board-trail]'),null);assert.equal(h.timers.size,0);board.zahraCleanup();
});
