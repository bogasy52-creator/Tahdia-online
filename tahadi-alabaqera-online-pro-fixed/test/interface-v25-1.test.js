import {loadAtelier} from './atelier-harness.mjs';
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
 for(const id of ['gameSearch','gameFilters','editProfile','homeResume'])assert.ok(h.doc.getElementById(id),id);
 // 33.4.0: rooms live inside each game; the home page asks for no room code
 for(const id of ['homeQuickPlay','homeRoomJoin','homeRoomCode'])assert.equal(h.doc.getElementById(id),null,id);
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
// 33.4.0: the home page has no room box. A code typed in any game's «غرفة مع أصحابك» finds
// its own game (its first two digits name it) and the server confirms the room is open.
async function gameJoin(answer,page='snakes'){
 const h=await createDOM(page+'.html'),joined=[];
 h.context.fetch=async(url)=>{const code=String(url).split('/').pop();const found=answer(code);return found===null?Response.json({ok:false,found:false,error:'none'},{status:404}):Response.json({ok:true,game:found})};
 h.context.AbortSignal=AbortSignal;
 await h.runFile('assets/js/game-menu-v33.js');
 const join=async value=>{try{return await h.context.BS_GAME_MENU.joinAnywhere(value,{game:page,onJoin:code=>joined.push(code)});}catch(error){return {error:error.message};}};
 return {h,joined,join,href:()=>h.context.location.href};
}
test('a room code typed inside a game opens its own game and reads Arabic and Persian digits',async()=>{
 const routes={quiz:'/online',picture:'/picture',sudoku:'/sudoku',paths:'/paths-online',serpent:'/serpent',jackaroo:'/jackaroo',zahra:'/zahra',dice:'/dice',baloot:'/baloot',party:'/party'};
 const prefixes={quiz:'10',party:'15',sudoku:'20',paths:'25',picture:'30',serpent:'35',snakes:'40',zahra:'45',jackaroo:'50',dice:'55',baloot:'60'};
 const {joined,join,href}=await gameJoin(code=>Object.keys(prefixes).find(game=>code.startsWith(prefixes[game])));
 for(const [game,route]of Object.entries(routes)){
  const code=prefixes[game]+'3456',typed=code.replace(/[0-9]/g,d=>'٠١٢٣٤٥٦٧٨٩'[d]);
  const result=await join(typed);assert.equal(result.here,false,game);assert.equal(href(),route+'?room='+code,game);
 }
 // this game's own code joins here, Persian digits too
 const here=await join('۴۰۱۲۳۴');assert.equal(here.here,true);assert.deepEqual(joined,['401234']);
});
test('a short or closed room code joins nothing',async()=>{
 const {joined,join,href}=await gameJoin(()=>null);
 assert.match((await join('12')).error,/6 أرقام/);
 assert.match((await join('401234')).error,/ما لقينا غرفة/);
 assert.equal(joined.length,0);assert.equal(href(),'https://game.test/snakes');
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
test('new store owns one header and its native preview restores focus on close',async()=>{
 const h=await createDOM('shop.html');await h.runFile('assets/js/tahdia-premium-v25.js');await h.runFile('assets/js/profile-core.js');await h.runFile('assets/js/career-client.js');await h.context.BS_CAREER.refresh();await loadAtelier(h);
 assert.equal(h.doc.getElementById('hubRail'),null);assert.equal(h.doc.querySelectorAll('.atelier-header').length,1);const inspect=h.doc.querySelector('[data-item="pawn-rook"] [data-control="inspect"]');inspect.focus();inspect.onclick();assert.equal(h.doc.getElementById('previewDialog').open,true);assert.equal(h.doc.activeElement.id,'previewClose');h.doc.getElementById('previewClose').onclick();assert.equal(h.doc.getElementById('previewDialog').open,false);assert.equal(h.doc.activeElement,inspect);
});
test('winner dialog traps Tab, handles Escape and restores the original focus',async()=>{
 const h=await createDOM('sudoku.html');await h.runFile('assets/js/play-feedback-v24-1.js');const opener=h.doc.getElementById('sudokuOnlineLaunch');opener.focus();h.context.BS_GAME_FX.celebrate('سالم',{key:'keyboard-round'});const modal=h.doc.getElementById('bsVictory'),button=modal.querySelector('button');assert.equal(h.doc.activeElement,button);modal.dispatchEvent({type:'keydown',key:'Tab',preventDefault(){}});assert.equal(h.doc.activeElement,button);modal.dispatchEvent({type:'keydown',key:'Escape',preventDefault(){}});assert.equal(h.doc.getElementById('bsVictory'),null);assert.equal(h.doc.activeElement,opener);
});
test('winning two separate board rounds with the same name celebrates each round but not repeated state messages',async()=>{
 let notify;const h=await createDOM('sudoku.html',{Element:MiniElement,MutationObserver:class{constructor(callback){notify=callback;}observe(){}}});await h.runFile('assets/js/play-feedback-v24-1.js');const result=h.doc.createElement('div'),name=h.doc.createElement('h2');result.id='winnerOverlay';result.className='winner-overlay show';name.id='winnerName';name.textContent='سالم';result.append(name);h.doc.body.append(result);const emit=()=>notify([{target:result,addedNodes:[]}]);emit();const first=h.doc.getElementById('bsVictory');assert.ok(first);emit();assert.equal(h.doc.getElementById('bsVictory'),first);first.querySelector('button').click();result.classList.remove('show');emit();result.classList.add('show');emit();const second=h.doc.getElementById('bsVictory');assert.ok(second);assert.notEqual(second,first);
});
