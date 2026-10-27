import {SERPENT_WORLDS,worldPreset,trainingProgress} from './engines/arena-worlds-v27.js';
const $=id=>document.getElementById(id);
export function installArenaExperience(){
 // 33.0.0: the arena is played online. A room's host picks its map in the lobby; a quick
 // match gets one from the server. The map names carry what makes each one different.
 const lobbyWorld=$('lobbyWorld');
 if(lobbyWorld){if(!lobbyWorld.options.length)for(const p of Object.values(SERPENT_WORLDS)){const o=document.createElement('option');o.value=p.id;lobbyWorld.append(o);}for(const option of lobbyWorld.options){const p=worldPreset(option.value);option.textContent=p.name;option.title=p.feature;}}
 const results=document.createElement('p');results.id='arenaTrainingResult';results.className='arena-training-result-v27';$('arenaFinalScores')?.before(results);
 const invite=document.createElement('button');invite.id='arenaInviteNow';invite.type='button';invite.setAttribute('aria-label','دعوة صديق لهذه اللعبة');invite.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m3-12v8m-4-4h8"/></svg>';invite.onclick=()=>window.BS_INVITES?.open?.();document.querySelector('.hud-actions')?.append(invite);
}
export function refreshWorldCards(){const id=$('lobbyWorld')?.value;for(const b of document.querySelectorAll('.arena-world-card-v27'))b.setAttribute('aria-pressed',String(b.dataset.world===id));}
let completed='';
export function resetTraining(){completed='';}
export function updateArenaExperience(game,id,solo){
 const w=game.world,p=worldPreset(w?.id);$('arenaPlay').dataset.world=w?.id||'classic';const label=$('arenaWorldStatus');label.classList.remove('hidden');label.dataset.phase=w?.phase||'calm';const warningLeft=Math.max(1,Math.ceil((w?.id==='volcano'?8:13)-(game.elapsed%(w?.id==='volcano'?16:24))));label.textContent=p.name+' · '+(w?.phase==='warning'?'تحذير · '+warningLeft+'ث':w?.phase==='active'?'الحدث نشط':w?.frenzy?'النافورة مفتوحة':p.feature);
 const training=w?.training||'free',mission=$('arenaMission');mission?.classList.toggle('hidden',!solo||training==='free'||game.status!=='playing'||$('arenaCoach')?.checked===false);if(!mission||!solo||training==='free')return;
 const tasks=trainingProgress(game,id,training),done=tasks.filter(t=>t.done).length,next=tasks.find(t=>!t.done);$('arenaMissionName').textContent=next?next.name:'اكتمل المسار · كمل جولتك';$('arenaMissionCount').textContent=next?next.value+' / '+next.target:'3 / 3';$('arenaMissionProgress').value=(done+(next?next.value/next.target:0))/3*100;
 if(done===3&&completed!==training){completed=training;try{const key='tahdia-arena-academy-v27',saved=JSON.parse(localStorage.getItem(key)||'{}');saved[training]=true;localStorage.setItem(key,JSON.stringify(saved));}catch{}window.BS_PLATFORM?.toast?.('أتقنت مسار التدريب · 3 مهام مكتملة');}
 if($('arenaTrainingResult'))$('arenaTrainingResult').textContent='مسار التدريب: '+done+' من 3 مهام مكتملة';
}
