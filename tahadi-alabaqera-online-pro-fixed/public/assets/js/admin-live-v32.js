/* Tahdia 32.1.0 — who is on the site right now, for the owner.
   Reads /api/social/admin/live (owner only) every 20 seconds while this tab is visible. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),REFRESH_MS=20000;
 const token=()=>{try{return localStorage.getItem('bs_social_session')||''}catch{return ''}};
 const DEVICES={m:'جوال',t:'تابلت',d:'كمبيوتر'};
 let timer=0,busy=false,data=null,allowed=false;
 function node(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
 function flag(cc){return /^[A-Z]{2}$/.test(cc||'')?String.fromCodePoint(...[...cc].map(c=>0x1F1E6+c.charCodeAt(0)-65)):'';}
 function ago(ms){const s=Math.max(0,Math.round(ms/1000));if(s<60)return s+' ث';const m=Math.floor(s/60);if(m<60)return m+' د';const h=Math.floor(m/60);return h+' س'+(m%60?' '+m%60+' د':'');}
 function clock(at){try{return new Date(at).toLocaleTimeString('ar-SA-u-nu-latn',{hour:'2-digit',minute:'2-digit',second:'2-digit'});}catch{return '';}}
 function people(n){return n===1?'شخص واحد':n===2?'شخصان':n>=3&&n<=10?n+' أشخاص':n+' شخصًا';}
 function render(){
  if(!data)return;window.dispatchEvent(new CustomEvent('bs-admin-live-change',{detail:data}));
  $('adminLiveTotal').textContent=data.people;$('adminLiveSigned').textContent=data.signed;$('adminLiveGuests').textContent=data.guests;$('adminLiveRooms').textContent=data.inRooms;$('adminLiveAway').textContent=data.background;
  $('adminLiveStatus').textContent='آخر تحديث '+clock(data.now)+' · يتحدّث تلقائيًا كل 20 ثانية';
  const max=Math.max(1,...data.games.map(g=>g.people)),games=$('adminLiveGames');games.replaceChildren();
  for(const g of data.games){
   const li=node('li'),top=node('div','admin-live-game-top'),bar=node('div','admin-live-bar'),fill=node('i'),meta=node('small');
   top.append(node('b',null,g.label),node('strong',null,String(g.people)));fill.style.width=Math.max(4,Math.round(g.people/max*100))+'%';bar.append(fill);
   meta.textContent=[g.signed?g.signed+' مسجّل':'',g.guests?g.guests+' ضيف':'',g.rooms?(g.rooms===1?'غرفة واحدة':g.rooms+' غرف'):''].filter(Boolean).join(' · ');
   li.append(top,bar,meta);games.append(li);
  }
  if(!data.games.length)games.append(node('li','admin-live-empty','ما فيه أحد في الموقع الحين.'));
  const rooms=$('adminLiveRoomList');rooms.replaceChildren();
  for(const r of data.rooms){
   const card=node('article','admin-live-room'),head=node('div'),code=node('b','admin-live-code',r.room);code.dir='ltr';
   head.append(node('span',null,r.label),code);card.append(head,node('strong',null,people(r.people)),node('p',null,r.names.join('، ')));rooms.append(card);
  }
  if(!data.rooms.length)rooms.append(node('p','admin-live-empty','ما فيه غرف أونلاين مفتوحة الحين.'));
  const body=$('adminLivePeople');body.replaceChildren();$('adminLivePeopleCount').textContent='('+data.list.length+')';
  for(const p of data.list){
   const tr=node('tr',p.state==='background'?'is-away':''),who=node('td');
   who.append(node('b',null,p.signed?p.name:(p.name||'ضيف')));
   const tag=node('small',p.signed?'is-signed':'is-guest',p.signed?'@'+p.user:'ضيف');if(p.signed)tag.dir='ltr';who.append(tag);
   const room=node('td',null,p.room||'—');if(p.room)room.dir='ltr';
   tr.append(who,node('td',null,p.label),room,node('td',null,DEVICES[p.device]||'—'),node('td',null,p.country?flag(p.country)+' '+p.country:'—'),node('td',null,ago(data.now-p.since)),node('td',null,p.state==='background'?'في الخلفية':'نشط'));
   body.append(tr);
  }
  if(!data.list.length){const tr=node('tr'),td=node('td','admin-live-empty','لا أحد.');td.colSpan=7;tr.append(td);body.append(tr);}
 }
 async function load(){
  if(busy||!token())return;busy=true;$('adminLiveRefresh').disabled=true;
  try{
   const session=token();const response=await fetch('/api/social/admin/live',{headers:{authorization:'Bearer '+session},cache:'no-store',signal:AbortSignal.timeout?.(9000)});
   const result=await response.json().catch(()=>({}));if(session!==token())return;
   if(response.status===401||response.status===403){allowed=false;$('adminLive').hidden=true;stop();return;}
   allowed=true;$('adminLive').hidden=false;
   if(!response.ok||!result.ok){$('adminLiveStatus').textContent=response.status===404?'السيرفر يحتاج تحديث الحزمة كاملة لعرض الموجودين.':'تعذر جلب الموجودين الآن. نعيد المحاولة تلقائيًا.';return;}
   data=result;render();
  }catch{if(allowed)$('adminLiveStatus').textContent='تعذر الاتصال. نعيد المحاولة تلقائيًا.';}
  finally{busy=false;$('adminLiveRefresh').disabled=false;if(allowed)schedule();}
 }
 function schedule(){clearTimeout(timer);if(document.visibilityState!=='hidden')timer=setTimeout(load,REFRESH_MS);}
 function stop(){clearTimeout(timer);timer=0;}
 $('adminLiveRefresh').onclick=()=>{stop();load();};
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')stop();else if(allowed){stop();load();}});
 window.addEventListener('bs-social-session',()=>{stop();data=null;load();});
 if(token())load();
 window.BS_ADMIN_LIVE=Object.freeze({load,get data(){return data;}});
})();
