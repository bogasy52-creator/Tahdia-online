// Presentation only. The room validates words, turn ownership and deadlines.
(()=>{'use strict';
const $=id=>document.getElementById(id),el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;};
let mounted=false,lastTurn=0,lastAccepted=0,lastExplosions=0,historyKey='',current=null,callbacks=null;
function clear(){mounted=false;lastTurn=0;lastAccepted=0;lastExplosions=0;historyKey='';current=null;callbacks=null;}
function sound(name){if(!document.hidden)window.BS_AUDIO?.play?.(name);}
function mount(){
 $('chBoard').className='ch-board ch-wordbomb';
 const orb=el('div','ch-bomb-orb');orb.append(el('span','ch-bomb-cap'),el('span','ch-bomb-spark'),el('small','ch-bomb-caption','كلمة تحتوي'),el('strong','ch-bomb-fragment'),el('b','ch-bomb-clock'));
 const recent=el('section','ch-bomb-history');recent.setAttribute('aria-label','آخر الكلمات المقبولة');
 $('chBoard').replaceChildren(el('p','ch-bomb-turn'),orb,el('p','ch-bomb-hearts'),recent);
 const form=el('form','ch-bomb-form'),label=el('label','ch-bomb-label','كلمتك'),input=el('input','ch-bomb-input');input.id='chBombWord';label.htmlFor=input.id;input.maxLength=32;input.autocomplete='off';input.spellcheck=false;input.placeholder='اكتب كلمة عربية';input.setAttribute('dir','rtl');
 const submit=el('button','ch-button primary','مرّر القنبلة');submit.type='submit';form.append(label,input,submit);
 let composing=false;input.addEventListener('compositionstart',()=>composing=true);input.addEventListener('compositionend',()=>composing=false);
 form.addEventListener('submit',e=>{e.preventDefault();if(composing||!current||submit.disabled)return;callbacks.act({turnId:current.bomb.turnId,word:input.value});});
 $('chControls').replaceChildren(form,el('p','ch-help','تُقبل كلمات قاموس اللعبة فقط. التشكيل و«ال» لا يصنعان كلمة جديدة.'));
 mounted=true;
}
function render(m,hooks){
 current=m;callbacks=hooks;if(!mounted)mount();
 const bomb=m.bomb,me=m.players.find(p=>p.id===hooks.me),actor=m.players[m.turn];
 $('chBoard').querySelector('.ch-bomb-fragment').textContent=bomb.prompt;
 $('chBoard').querySelector('.ch-bomb-turn').textContent=m.phase==='finished'?'انتهت الجولة':actor.id===me.id?'القنبلة عندك · اكتب بسرعة':'القنبلة عند '+actor.name;
 $('chBoard').querySelector('.ch-bomb-hearts').textContent='قلوبك '+('♥'.repeat(me.hearts)||'—')+' · كلماتك '+(me.words||0);
 $('chSubstatus').textContent=!me.alive?'أُقصيت · تابع آخر صامد':'قاموس اللعبة: '+bomb.dictionarySize+' كلمة · باقي '+m.players.filter(p=>p.alive).length+' لاعبين';
 if(lastTurn&&bomb.turnId!==lastTurn&&actor.id===me.id)sound('turn');
 if(lastAccepted&&bomb.accepted>lastAccepted){const latest=bomb.recent.at(-1);if(latest?.id===me.id){$('chBombWord').value='';sound('correct');}}
 // accepted may go from zero to one; distinguish initial/restored snapshot using lastTurn.
 if(lastTurn&&bomb.accepted>lastAccepted&&lastAccepted===0&&bomb.recent.at(-1)?.id===me.id){$('chBombWord').value='';sound('correct');}
 if(lastTurn&&bomb.explosions>lastExplosions){sound('wrong');const orb=$('chBoard').querySelector('.ch-bomb-orb');orb.classList.remove('burst');void orb.offsetWidth;orb.classList.add('burst');}
 lastTurn=bomb.turnId;lastAccepted=bomb.accepted;lastExplosions=bomb.explosions;
 const key=bomb.accepted+':'+bomb.recent.length;if(historyKey!==key){historyKey=key;const area=$('chBoard').querySelector('.ch-bomb-history');area.replaceChildren(...[...bomb.recent].reverse().map(row=>{const n=el('div','ch-bomb-word');n.append(el('b','',row.word),el('small','',row.name),el('span','','+'+row.gain));return n;}));if(!bomb.recent.length)area.append(el('p','ch-help','الحرفان يتغيران بعد كل كلمة. لا تكرر كلمات الجولة.'));}
 tick(m,hooks);
}
function tick(m,hooks){
 if(!mounted)return;const remaining=Math.max(0,m.turnDeadline-hooks.now()),playing=m.phase==='playing',mine=playing&&m.players[m.turn].id===hooks.me,paused=!!hooks.paused;
 $('chBoard').querySelector('.ch-bomb-clock').textContent=playing?(remaining/1000).toFixed(1)+' ث':'انتهى';
 const orb=$('chBoard').querySelector('.ch-bomb-orb');orb.style.setProperty('--fuse',String(Math.min(1,remaining/m.bomb.turnDuration)));orb.classList.toggle('urgent',playing&&remaining<2000);orb.classList.toggle('mine',mine);
 const input=$('chBombWord'),button=$('chControls').querySelector('button');input.disabled=!mine||paused||document.hidden||remaining<=0;button.disabled=input.disabled;
}
window.BS_WORD_BOMB={render,tick,clear};
})();
