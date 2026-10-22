import {SERPENT_WORLDS,worldPreset,trainingProgress} from './engines/arena-worlds-v27.js';
import {drawWorldPreview} from './arena-worlds-art-v27.js';
const $=id=>document.getElementById(id);
export function installArenaExperience(){
 const field=$('arenaWorldField'),picker=document.createElement('section');picker.className='arena-world-picker-v27';picker.id='arenaWorldPicker';picker.setAttribute('aria-label','اختر حلبة بخصائص مختلفة');
 for(const p of Object.values(SERPENT_WORLDS)){const button=document.createElement('button');button.type='button';button.className='arena-world-card-v27';button.dataset.world=p.id;button.style.setProperty('--world-color',p.color);button.setAttribute('aria-pressed','false');const image=document.createElement('canvas');image.setAttribute('aria-hidden','true');drawWorldPreview(image,p.id);const title=document.createElement('b'),feature=document.createElement('small');title.textContent=p.name;feature.textContent=p.feature;button.append(image,title,feature);button.onclick=()=>{$('arenaWorld').value=p.id;$('arenaWorld').dispatchEvent(new Event('change'));};picker.append(button);}
 field.closest('details').before(picker);
 for(const option of $('arenaWorld').options){const p=worldPreset(option.value);option.textContent=p.name+' · '+p.feature;}
 const course=document.createElement('label');course.id='arenaTrainingField';course.className='arena-training-select-v27';course.innerHTML='<span>أكاديمية الحلبة</span><select id="arenaTraining"><option value="control">مسار التحكم · جمع وتسريع وبقاء</option><option value="powers">مسار القدرات · دروب وميزات الماب</option><option value="combat">مسار المواجهة · اجمع ثم واجه</option><option value="free">تدريب حر بدون مهام</option></select><small>ثلاث مهام فعلية في كل مسار؛ تقدمك التدريبي محفوظ على جهازك.</small>';picker.before(course);
 try{const completed=JSON.parse(localStorage.getItem('tahdia-arena-academy-v27')||'{}');for(const o of $('arenaTraining').options)if(completed[o.value])o.textContent='✓ '+o.textContent;}catch{}
 $('arenaTraining').onchange=()=>{if($('arenaTraining').value==='control'){$('arenaBots').value='2';$('arenaDifficulty').value='easy';$('arenaMatchMode').value='timed';}if($('arenaTraining').value==='powers'){$('arenaWorld').value='neon';$('arenaWorld').dispatchEvent(new Event('change'));}};
 const lobby=document.createElement('label');lobby.innerHTML='<span>خريطة المواجهة</span><select id="lobbyWorld"></select>';for(const p of Object.values(SERPENT_WORLDS)){const o=document.createElement('option');o.value=p.id;o.textContent=p.name;lobby.querySelector('select').append(o);}document.querySelector('.arena-lobby-bots').prepend(lobby);
 const mission=document.createElement('aside');mission.id='arenaMission';mission.className='arena-mission-v27 hidden';mission.setAttribute('aria-label','تقدم التدريب');mission.innerHTML='<span id="arenaMissionName"></span><b id="arenaMissionCount"></b><progress id="arenaMissionProgress" max="100" value="0"></progress>';$('arenaPlay').append(mission);
 const results=document.createElement('p');results.id='arenaTrainingResult';results.className='arena-training-result-v27';$('arenaFinalScores').before(results);
 const invite=document.createElement('button');invite.id='arenaInviteNow';invite.type='button';invite.setAttribute('aria-label','دعوة صديق لهذه اللعبة');invite.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m3-12v8m-4-4h8"/></svg>';invite.onclick=()=>window.BS_INVITES?.open?.();document.querySelector('.hud-actions').append(invite);
 $('arenaWorld').addEventListener('change',refreshWorldCards);refreshWorldCards();
}
export function refreshWorldCards(){for(const b of document.querySelectorAll('.arena-world-card-v27'))b.setAttribute('aria-pressed',String(b.dataset.world===$('arenaWorld').value));}
let completed='';
export function resetTraining(){completed='';}
export function updateArenaExperience(game,id,solo){
 const w=game.world,p=worldPreset(w?.id);$('arenaPlay').dataset.world=w?.id||'classic';const label=$('arenaWorldStatus');label.classList.remove('hidden');label.dataset.phase=w?.phase||'calm';const warningLeft=Math.max(1,Math.ceil((w?.id==='volcano'?8:13)-(game.elapsed%(w?.id==='volcano'?16:24))));label.textContent=p.name+' · '+(w?.phase==='warning'?'تحذير · '+warningLeft+'ث':w?.phase==='active'?'الحدث نشط':w?.frenzy?'النافورة مفتوحة':p.feature);
 const training=w?.training||'free',mission=$('arenaMission');mission.classList.toggle('hidden',!solo||training==='free'||game.status!=='playing'||$('arenaCoach')?.checked===false);if(!solo||training==='free')return;
 const tasks=trainingProgress(game,id,training),done=tasks.filter(t=>t.done).length,next=tasks.find(t=>!t.done);$('arenaMissionName').textContent=next?next.name:'اكتمل المسار · كمل جولتك';$('arenaMissionCount').textContent=next?next.value+' / '+next.target:'3 / 3';$('arenaMissionProgress').value=(done+(next?next.value/next.target:0))/3*100;
 if(done===3&&completed!==training){completed=training;try{const key='tahdia-arena-academy-v27',saved=JSON.parse(localStorage.getItem(key)||'{}');saved[training]=true;localStorage.setItem(key,JSON.stringify(saved));}catch{}window.BS_PLATFORM?.toast?.('أتقنت مسار التدريب · 3 مهام مكتملة');}
 $('arenaTrainingResult').textContent='مسار التدريب: '+done+' من 3 مهام مكتملة';
}
