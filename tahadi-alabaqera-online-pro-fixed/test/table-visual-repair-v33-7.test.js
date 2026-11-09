import test from 'node:test';
import assert from 'node:assert/strict';
import {createDOM} from './dom-harness.mjs';

for(const page of ['snakes.html','jackaroo.html'])test(page+': moving room tools preserves their nodes, listeners and one roster',async()=>{
 const h=await createDOM(page),players=h.doc.getElementById('players'),help=h.doc.getElementById(page==='snakes.html'?'boardHelp':'jackLookNext'),exit=h.doc.getElementById('leaveGame');let helped=0,left=0;
 help.onclick=()=>helped++;exit.onclick=()=>left++;
 await h.runFile('assets/js/table-viewport-v33-7.js');await h.runFile('assets/js/pro-experience.js');
 assert.equal(h.doc.querySelectorAll('#players').length,1);assert.equal(h.doc.getElementById('players'),players);
 assert.equal(h.doc.querySelector('.table-heading').contains(players),false,'players must not enlarge the header');
 assert.equal(h.doc.querySelectorAll('.round-roster').length,0);
 assert.ok(h.doc.querySelector('.table-more-body').contains(help));help.click();exit.click();assert.equal(helped,1);assert.equal(left,1);
 assert.ok(h.doc.querySelector('.table-topbar').contains(h.doc.getElementById('tableReactions')));
 await h.runFile('assets/js/table-viewport-v33-7.js');assert.equal(h.doc.querySelectorAll('.table-topbar').length,1);
 if(page==='jackaroo.html')assert.equal(players.parentElement,h.doc.getElementById('game'));
 else assert.ok(h.doc.querySelector('.game-side').contains(players));
});

test('an already connected room uses the visible header trigger and sends one free reaction without a floating duplicate',async()=>{
 const h=await createDOM('snakes.html'),sent=[];await h.runFile('assets/js/profile-core.js');await h.runFile('assets/js/table-viewport-v33-7.js');
 h.doc.body.classList.add('game-running');h.context.BS_BOARD_ROOM={client:{react:id=>{sent.push(id);return true}},state:{me:{id:'me'}}};
 await h.runFile('assets/js/reaction-performers.js');await h.runFile('assets/js/reactions-v31.js');
 const trigger=h.doc.getElementById('tableReactions');assert.equal(trigger.hidden,false);assert.equal(h.doc.querySelector('.rx-fab'),null);
 trigger.click();assert.equal(h.doc.getElementById('rxSheet').hidden,false);
 h.doc.querySelector('[data-reaction="emote-laugh"]').click();assert.deepEqual(sent,['laugh']);assert.equal(h.doc.getElementById('rxSheet').hidden,false,'33.9.0: the sheet stays open for the next one');
 h.context.dispatchEvent({type:'bs-board-emote',detail:{emote:'laugh',from:'me',name:'A'}});
 assert.ok(h.doc.querySelector('.rx-emote .premium-reaction-sprite'));assert.match(h.doc.querySelector('.rx-emote').textContent,/أنت/);
 // A supported fullscreen surface must contain both the picker and incoming art.
 h.doc.fullscreenElement=h.doc.getElementById('game');h.context.BS_REACTIONS.open();
 assert.equal(h.doc.getElementById('rxSheet').parentElement,h.doc.fullscreenElement);
 h.context.dispatchEvent({type:'bs-board-emote',detail:{emote:'laugh',from:'other',name:'B'}});
 assert.equal(h.doc.querySelector('.rx-layer').parentElement,h.doc.fullscreenElement);
});

test('Jackaroo renders all 52 real card faces including low pips, tens and court figures in the equipped deck',async()=>{
 const h=await createDOM('jackaroo.html');await h.runFile('assets/js/card-courts.js');await h.runFile('assets/js/baloot-cards.js');await h.runFile('assets/js/jackaroo-cards.js');
 for(const skin of ['deck-classic','deck-night','deck-royal']){
  h.context.BS_CAREER.get=()=>({equipped:{deck:skin}});
  for(const suit of ['S','H','D','C'])for(const rank of ['2','3','4','5','6','7','8','9','10','J','Q','K','A']){
   const svg=decodeURIComponent(h.context.BS_JACK_CARDS.url(rank+suit).split(',').slice(1).join(','));
   assert.match(svg,/viewBox="0 0 250 350"/);assert.doesNotMatch(svg,/undefined|NaN/);
   if(['J','Q','K'].includes(rank))assert.match(svg,/clip-path/);
   else if(rank!=='A'){const pip='d="'+h.context.BS_CARDS.suitPath(suit)+'"';assert.equal(svg.split(pip).length-1,Number(rank)+2,skin+' '+rank+suit+' shows the correct pip count');}
  }
 }
 const normal=h.context.BS_JACK_CARDS.url('2H');h.context.BS_CAREER.get=()=>({equipped:{deck:'deck-night'}});assert.notEqual(h.context.BS_JACK_CARDS.url('2H'),normal);
});
