const $=id=>document.getElementById(id),selectionKey='bs-quiz-lineup-v21';
let catalog=[],selected=[],selectedOnly=false;
const symbols={ai:'✧',palm:'❋',map:'⌖',scroll:'▤',globe:'◎',atom:'⚛',rocket:'↗',chip:'▦',car:'◈',tag:'◇',ball:'◉',trophy:'♜',letter:'أ',puzzle:'✚',chef:'♨',film:'▣',bulb:'✦',paw:'♧',quran:'▥',tafsir:'⌕',meanings:'ض',soundcat:'♫',zoom:'⊕',memory:'∞'};
const normalize=value=>String(value||'').normalize('NFKC').replace(/[\u064b-\u065f\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').trim();
function persist(){try{localStorage.setItem(selectionKey,JSON.stringify(selected));}catch{}}
function remove(id){selected=selected.filter(value=>value!==id);persist();render();}
function lineup(){
 const box=$('quizLineup');box.replaceChildren();
 for(let team=0;team<2;team++){
  const panel=document.createElement('div');panel.className='quiz-lineup-team';const heading=document.createElement('h3');heading.textContent=team?'الفئات 4 إلى 6':'الفئات 1 إلى 3';const slots=document.createElement('div');slots.className='quiz-lineup-slots';
  for(let offset=0;offset<3;offset++){const id=selected[team*3+offset],category=catalog.find(row=>row.id===id),slot=document.createElement('button');slot.type='button';slot.className='quiz-lineup-slot';slot.disabled=!category;const title=document.createElement('span');title.textContent=category?category.name:'اختر الفئة '+(offset+1);const action=document.createElement('i');action.textContent=category?'×':'＋';slot.append(title,action);slot.setAttribute('aria-label',category?'إزالة فئة '+category.name:'مكان لفئة جديدة');slot.onclick=()=>remove(id);slots.append(slot);}
  panel.append(heading,slots);box.append(panel);
 }
}
function render(){
 const query=normalize($('quizSearch').value),box=$('quizCatalog');box.replaceChildren();
 const visible=catalog.filter(category=>(!selectedOnly||selected.includes(category.id))&&(!query||normalize(category.name+' '+category.desc).includes(query)));
 for(const category of visible){
  const index=selected.indexOf(category.id),button=document.createElement('button');button.type='button';button.className='quiz-category'+(index>=0?' active':'');button.setAttribute('aria-pressed',String(index>=0));
  const icon=document.createElement('span');icon.className='quiz-category-icon';icon.textContent=symbols[category.icon]||'✦';const name=document.createElement('b');name.textContent=category.name;const description=document.createElement('small');description.textContent=category.desc;const badge=document.createElement('em');badge.textContent=index>=0?`الفئة ${index+1}`:`${category.count} سؤالًا`;button.append(icon,name,description,badge);
  button.onclick=()=>{if(index>=0)return remove(category.id);if(selected.length===6){$('categoryStatus').textContent='اكتملت الفئات الست. أزل فئة لإضافة أخرى.';return;}selected.push(category.id);persist();render();};box.append(button);
 }
 $('quizEmpty').hidden=visible.length!==0;$('quizEmpty').textContent=selectedOnly&&!selected.length?'ما اخترت فئات بعد. ألغِ عرض المختارة وابدأ التشكيلة.':'ما لقينا فئة بهذا الاسم. جرّب كلمة ثانية أو امسح البحث.';
 $('categoryCount').textContent=selected.length+' / 6';$('quizLaunch').disabled=selected.length!==6;$('quizClear').disabled=selected.length===0;$('selectionSummary').textContent=selected.length?selected.map(id=>catalog.find(category=>category.id===id).name).join(' · '):'اختر ست فئات لتكوين المباراة';$('categoryStatus').textContent=selected.length===6?'تشكيلتكم جاهزة ومحفوظة. يلا على اللوحة!':`باقي ${6-selected.length} فئات لتكتمل المباراة.`;lineup();
}
$('quizSearch').oninput=render;$('quizSearch').onkeydown=event=>{if(event.key==='Escape'){$('quizSearch').value='';render();}};
$('quizSelected').onclick=()=>{selectedOnly=!selectedOnly;$('quizSelected').setAttribute('aria-pressed',String(selectedOnly));render();};
$('quizClear').onclick=()=>{selected=[];persist();render();};
$('quizRandom').onclick=()=>{const all=[...catalog];for(let i=all.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[all[i],all[j]]=[all[j],all[i]];}selected=all.slice(0,6).map(category=>category.id);persist();render();};
$('quizLaunch').onclick=()=>{if(selected.length===6)location.assign('/online?categories='+encodeURIComponent(selected.join(',')));};
// AI pictures are offered when the server has enough of them; the local
// board reads the same pack from this device afterwards.
const AI_PACK='bs-quiz-ai-pack-v31';
function aiEntry(items){const n=Array.isArray(items)?items.length:0,balanced=[100,200,300].every(v=>items.filter(q=>q?.v===v).length>=2);return n&&balanced?{id:'aiPictures',name:'صور الذكاء',icon:'ai',desc:'صور يولّدها الذكاء الاصطناعي: خمّن وش اللي في الصورة',count:n}:null;}
function restoreSelection(){try{const saved=JSON.parse(localStorage.getItem(selectionKey)||'[]');if(Array.isArray(saved))selected=[...new Set(saved)].filter(id=>catalog.some(category=>category.id===id)).slice(0,6);}catch{}}
fetch('/assets/quiz-catalog.json').then(response=>{if(!response.ok)throw Error();return response.json();}).then(data=>{if(!Array.isArray(data)||data.length<6)throw Error();catalog=data;restoreSelection();render();
 const useAi=items=>{const entry=aiEntry(items||[]);catalog=entry?[entry,...catalog.filter(c=>c.id!==entry.id)]:catalog.filter(c=>c.id!=='aiPictures');restoreSelection();render();};
 let cached=null;try{cached=JSON.parse(localStorage.getItem(AI_PACK)||'null');}catch{}
 if(Array.isArray(cached?.items))useAi(cached.items);
 // One check every ten minutes per device keeps the Worker request count low.
 if(!(Date.now()-Number(cached?.at||0)<600000))fetch('/api/quiz/ai/pack',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(pack=>{if(!pack||!Array.isArray(pack.items))return;try{localStorage.setItem(AI_PACK,JSON.stringify({at:Date.now(),items:pack.items}));}catch{}useAi(pack.items);}).catch(()=>{});
}).catch(()=>{$('categoryStatus').textContent='تعذر تحميل الفئات. تقدر تبدأ من اللعب المحلي مباشرة.';$('quizRandom').disabled=true;});
