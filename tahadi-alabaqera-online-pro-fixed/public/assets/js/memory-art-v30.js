export const MEMORY_FACES=Object.freeze(['خوذة سباق','كاميرا','صاروخ','زمردة','سماعات','مفتاح ذهبي','صدفة بحرية','حصان شطرنج','سيارة كلاسيكية','ساعة منبّه','طائر ورقي','ورقة نبات','فنجان قهوة','تلسكوب','زجاجة عطر','كرة قدم']);
export const memoryVariant=value=>[...String(value||'')].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0)%16;
export function memoryFaceIndex(value,variant=0){return Number.isInteger(value)&&value>=0?(value+variant)%MEMORY_FACES.length:null;}
export function updateMemoryTile(tile,value,{open=false,matched=false,disabled=false,variant=0,index=0}={}){
 const face=memoryFaceIndex(value,variant),wasMatched=tile.classList.contains('matched');
 tile.classList.toggle('open',open);tile.classList.toggle('matched',matched);tile.disabled=disabled||matched||open;
 tile.setAttribute('aria-pressed',String(open||matched));tile.setAttribute('aria-label',open||matched?(matched?'زوج مطابق: ':'بطاقة: ')+(MEMORY_FACES[face]||'صورة'):'بطاقة '+(index+1)+' مخفية');
 if(face!==null&&(open||matched)){const front=tile.querySelector('.memory-front-v30');front.style.backgroundPosition=(face%4)/3*100+'% '+Math.floor(face/4)/3*100+'%';front.dataset.face=String(face);}
 if(matched&&!wasMatched){tile.classList.add('new-match');setTimeout(()=>tile.classList.remove('new-match'),650);}
 return tile;
}
export function createMemoryTile(value,options={}){
 const tile=document.createElement('button');tile.type='button';tile.className='memory-tile memory-tile-v30';
 const flip=document.createElement('span');flip.className='memory-flipper-v30';const back=document.createElement('span');back.className='memory-back-v30';back.setAttribute('aria-hidden','true');
 const mark=document.createElementNS('http://www.w3.org/2000/svg','svg');mark.setAttribute('viewBox','0 0 48 48');mark.setAttribute('focusable','false');
 for(const d of ['M24 6 33 15 24 24 15 15Z','M24 24 33 33 24 42 15 33Z','M6 24 15 15 24 24 15 33Z','M24 24 33 15 42 24 33 33Z']){const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',d);mark.append(p);}back.append(mark);
 const front=document.createElement('span');front.className='memory-front-v30';front.setAttribute('aria-hidden','true');const match=document.createElement('span');match.className='memory-check-v30';match.textContent='✓';match.setAttribute('aria-hidden','true');front.append(match);flip.append(back,front);tile.append(flip);return updateMemoryTile(tile,value,options);
}
