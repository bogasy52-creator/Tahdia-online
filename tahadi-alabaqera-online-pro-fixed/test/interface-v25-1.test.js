import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
import {createDOM,MiniElement} from './dom-harness.mjs';
const source=path=>readFile(new URL('../public/'+path,import.meta.url),'utf8');

test('home shell mounts once, marks the current destination and preserves working page controls',async()=>{
 const h=await createDOM('index.html');
 await h.runFile('assets/js/tahdia-premium-v25.js');
 await h.runFile('assets/js/tahdia-premium-v25.js');
 assert.equal(h.doc.querySelectorAll('#hubRail').length,1);
 assert.equal(h.doc.querySelectorAll('.mobile-dock').length,1);
 assert.equal(h.doc.querySelectorAll('.bs-premium-nav').length,0);
 assert.equal(h.doc.getElementById('hubRail').querySelector('[aria-current="page"]').getAttribute('href'),'/');
 for(const id of ['gameSearch','gameFilters','editProfile','homeQuickPlay','homeRoomJoin'])assert.ok(h.doc.getElementById(id),id);
});
test('game pages retain only one game command bar and the compatibility API delegates to it',async()=>{
 const h=await createDOM('sudoku.html');
 await h.runFile('assets/js/play-feedback-v24-1.js');
 const original=h.context.BS_GAME_FX;
 await h.runFile('assets/js/tahdia-premium-v25.js');
 assert.equal(h.doc.querySelectorAll('#bsGameCommand').length,1);
 assert.equal(h.doc.querySelectorAll('#hubRail,.bs-premium-nav').length,0);
 assert.equal(h.context.BS_GAME_FX,original);
 const calls=[];h.context.BS_SOCIAL.openInvitePicker=async data=>calls.push(data);
 await h.context.TAHDIA_PREMIUM.openInvite();
 assert.equal(calls.length,1);assert.equal(calls[0].game,'sudoku');assert.equal(h.doc.querySelectorAll('#bsInvitePanel').length,0);
});
test('replacing the header preserves the Sudoku rules and picture leave actions',async()=>{
 for(const [page,id]of [['sudoku.html','sudokuHelp'],['picture.html','leave']]){
  const h=await createDOM(page);await h.runFile('assets/js/play-feedback-v24-1.js');
  assert.ok(h.doc.getElementById(id).closest('.v26-command-utilities'),id+' remains an available game control');
  assert.equal(h.doc.querySelector('.v26-replaced-header').contains(h.doc.getElementById(id)),false);
 }
});
test('friends page receives a mobile dock, an active destination and an explicit home/back control',async()=>{
 const h=await createDOM('social.html');await h.runFile('assets/js/tahdia-premium-v25.js');
 assert.equal(h.doc.querySelectorAll('.mobile-dock').length,1);
 assert.equal(h.doc.querySelector('.mobile-dock [aria-current="page"]').href,'/social');
 assert.equal(h.doc.querySelector('[data-hub-back]').href,'/');
});
test('room entry routes all eight supported room types and normalizes Arabic and Persian digits',async()=>{
 const h=await createDOM('index.html'),visits=[];h.context.location.assign=url=>visits.push(url);
 await h.runFile('assets/js/home-v19.js');const field=h.doc.getElementById('homeRoomCode'),select=h.doc.getElementById('homeRoomGame'),form=h.doc.getElementById('homeRoomJoin');
 field.setCustomValidity=()=>{};
 for(const [game,route]of Object.entries({quiz:'/online',picture:'/picture',sudoku:'/sudoku',paths:'/paths-online',serpent:'/serpent',snakes:'/snakes',jackaroo:'/jackaroo',zahra:'/zahra'})){
  select.value=game;field.value='١۲٣۴٥۶';form.dispatchEvent({type:'submit',preventDefault(){}});assert.equal(visits.at(-1),route+'?room=123456');
 }
 assert.equal(visits.length,8);
});
test('invalid room codes and forged game choices do not navigate',async()=>{
 const h=await createDOM('index.html');let visited=false,invalid=0;h.context.location.assign=()=>visited=true;
 await h.runFile('assets/js/home-v19.js');const field=h.doc.getElementById('homeRoomCode'),game=h.doc.getElementById('homeRoomGame');field.setCustomValidity=()=>{};field.reportValidity=()=>invalid++;
 for(const [value,choice]of [['12','quiz'],['123456','https://evil.invalid']]){field.value=value;game.value=choice;h.doc.getElementById('homeRoomJoin').dispatchEvent({type:'submit',preventDefault(){}});}
 assert.equal(visited,false);assert.equal(invalid,2);
 field.value='١٢٣-٤٥٦٧';field.dispatchEvent({type:'input'});assert.equal(field.value,'123456');
});
test('the game library precedes progression and all static HTML ids remain unique',async()=>{
 const home=await source('index.html');assert.ok(home.indexOf('id="games"')<home.indexOf('class="home-today-v17"'));
 for(const page of ['index','shop','social','sudoku','paths-online']){const html=await source(page+'.html'),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(ids.length,new Set(ids).size,page+' duplicate id');}
});
test('the premium CSS parses without warnings and keeps responsive rules scoped away from board geometry',async()=>{
 const css=await source('assets/css/tahdia-premium-v25.css');const parsed=await transform(css,{loader:'css',logLevel:'silent'});assert.deepEqual(parsed.warnings,[]);
 for(const marker of ['max-width:370px','max-width:720px','min-width:1200px','prefers-reduced-motion','safe-area-inset-bottom','minmax(0,1fr)'])assert.ok(css.includes(marker),marker);
 assert.doesNotMatch(css,/(?:#soBoard|#pathCanvas|#arenaCanvas)\s*\{[^}]*(?:width|height|transform):/);
 assert.match(css,/\.serpent-active \.bs-game-command[^}]*display:none!important/);
});
test('store preview keeps the new sidebar inert and restores it on close',async()=>{
 const h=await createDOM('shop.html');await h.runFile('assets/js/tahdia-premium-v25.js');await h.runFile('assets/js/profile-core.js');await h.runFile('assets/js/career-client.js');await h.context.BS_CAREER.refresh();await h.runFile('assets/js/shop.js');
 const rail=h.doc.getElementById('hubRail'),inspect=h.doc.querySelector('[data-item="pawn-jade"] .item-inspect');inspect.onclick();assert.equal(rail.inert,true);assert.equal(h.doc.activeElement.id,'itemClose');h.doc.getElementById('itemClose').onclick();assert.equal(rail.inert,false);
});
test('winner dialog traps Tab, handles Escape and restores the original focus',async()=>{
 const h=await createDOM('sudoku.html');await h.runFile('assets/js/play-feedback-v24-1.js');const opener=h.doc.getElementById('sudokuOnlineLaunch');opener.focus();h.context.BS_GAME_FX.celebrate('سالم',{key:'keyboard-round'});const modal=h.doc.getElementById('bsVictory'),button=modal.querySelector('button');assert.equal(h.doc.activeElement,button);modal.dispatchEvent({type:'keydown',key:'Tab',preventDefault(){}});assert.equal(h.doc.activeElement,button);modal.dispatchEvent({type:'keydown',key:'Escape',preventDefault(){}});assert.equal(h.doc.getElementById('bsVictory'),null);assert.equal(h.doc.activeElement,opener);
});
test('winning two separate board rounds with the same name celebrates each round but not repeated state messages',async()=>{
 let notify;const h=await createDOM('sudoku.html',{Element:MiniElement,MutationObserver:class{constructor(callback){notify=callback;}observe(){}}});await h.runFile('assets/js/play-feedback-v24-1.js');const result=h.doc.createElement('div'),name=h.doc.createElement('h2');result.id='winnerOverlay';result.className='winner-overlay show';name.id='winnerName';name.textContent='سالم';result.append(name);h.doc.body.append(result);const emit=()=>notify([{target:result,addedNodes:[]}]);emit();const first=h.doc.getElementById('bsVictory');assert.ok(first);emit();assert.equal(h.doc.getElementById('bsVictory'),first);first.querySelector('button').click();result.classList.remove('show');emit();result.classList.add('show');emit();const second=h.doc.getElementById('bsVictory');assert.ok(second);assert.notEqual(second,first);
});
