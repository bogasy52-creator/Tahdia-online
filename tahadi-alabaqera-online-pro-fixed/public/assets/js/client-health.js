(function(){
 'use strict';
 const seen=new Set();let sent=0,windowStart=Date.now();
 function report(type,error,file='',line=0){
  if(!navigator.onLine)return;const now=Date.now();if(now-windowStart>60000){windowStart=now;sent=0;seen.clear();}
  const message=String(error?.message||error||'Unknown error').replace(/Bearer\s+\S+/gi,'Bearer [redacted]').replace(/[A-Za-z0-9_-]{24,}/g,'[redacted]').slice(0,180),key=type+file+line+message;
  if(sent>=3||seen.has(key))return;seen.add(key);sent++;
  fetch('/api/client-errors',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type,route:location.pathname,message,script:file,line}),keepalive:true}).catch(()=>{});
 }
 window.addEventListener('error',event=>{if(event.message)report('error',event.error||event.message,event.filename,event.lineno);});
 window.addEventListener('unhandledrejection',event=>report('rejection',event.reason));
})();

// 32.1.0: a small "I am here" signal for the owner's live dashboard: which page or room
// this tab is on, every two minutes while it is visible, and a goodbye when it closes.
(function(){
 'use strict';
 if(window.__BS_PRESENCE__)return;window.__BS_PRESENCE__=true;
 if((navigator.webdriver&&!window.__BS_PRESENCE_FORCE)||!/^https?:$/.test(location.protocol)||typeof fetch!=='function')return;
 const area=name=>{try{return window[name]||null;}catch{return null;}};
 const read=(store,key)=>{try{return store?.getItem(key)||'';}catch{return '';}},write=(store,key,value)=>{try{store?.setItem(key,value);}catch{}};
 const rand=()=>{try{return Array.from(crypto.getRandomValues(new Uint8Array(12)),b=>(b%36).toString(36)).join('');}catch{return (Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2)).slice(0,12);}};
 const id=(store,key)=>{let value=read(store,key);if(!/^[a-z0-9]{12}$/.test(value)){value=rand();write(store,key,value);}return value;};
 const cid=id(area('sessionStorage'),'bs_presence_tab'),did=id(area('localStorage'),'bs_presence_device');
 const hash=text=>{let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);};
 const device=(()=>{try{const short=Math.min(screen.width||0,screen.height||0);return matchMedia('(pointer:coarse)').matches?(short>=700?'t':'m'):'d';}catch{return '';}})();
 let timer=0,last=0,sent=false,next=120000,lastRoom='',lastPath='';
 function account(){const token=read(area('localStorage'),'bs_social_session'),user=token.split('.')[0]||'';return /^[a-z0-9_]{3,20}$/.test(user)?{token,user}:{token:'',user:''};}
 function room(){
  const query=new URLSearchParams(location.search).get('room')||'';if(/^\d{6}$/.test(query))return query;
  for(const key of ['soCode','pathRoomCode','roomCode','gameRoomCode','lobbyCode','arenaCode']){
   const el=document.getElementById(key);if(!el||el.tagName==='INPUT'||el.closest?.('[hidden],.hidden'))continue;
   const value=String(el.textContent||'').replace(/\s+/g,'');if(/^\d{6}$/.test(value)&&(!el.getClientRects||el.getClientRects().length))return value;
  }
  return '';
 }
 function schedule(ms){clearTimeout(timer);timer=setTimeout(()=>beat(),Math.max(1000,ms));}
 async function beat(kind){
  const vis=kind||(document.visibilityState==='hidden'?'hidden':'visible');
  if(vis==='visible'&&document.visibilityState==='hidden')return;
  if(vis==='visible'&&navigator.onLine===false){schedule(next);return;}
  const {token,user}=account(),tabStore=area('sessionStorage'),proof=read(tabStore,'bs_presence_auth'),stamp=token?hash(token):'',ask=Boolean(token)&&vis!=='leave'&&!proof.startsWith(stamp+':');
  const code=room(),body={cid,did,path:location.pathname,room:code,vis,dev:device,user,name:String(window.BS_CAREER?.get?.()?.name||'').slice(0,20)};
  const headers={'content-type':'application/json'};if(ask)headers.authorization='Bearer '+token;
  lastRoom=code;lastPath=location.pathname;last=Date.now();sent=vis!=='leave';
  // a closing or hidden page may not get to finish a fetch: a beacon is delivered anyway
  if(vis!=='visible'&&!ask&&typeof navigator.sendBeacon==='function'){try{if(navigator.sendBeacon('/api/presence',new Blob([JSON.stringify(body)],{type:'application/json'})))return;}catch{}}
  try{
   const response=await fetch('/api/presence',{method:'POST',headers,body:JSON.stringify(body),keepalive:true,cache:'no-store',credentials:'same-origin'});
   if(vis==='leave')return;const data=await response.json().catch(()=>({}));
   if(ask&&(data.auth==='ok'||data.auth==='failed'))write(tabStore,'bs_presence_auth',stamp+':'+data.auth);
   next=response.status===429||response.status>=500?300000:Math.min(900000,Math.max(60000,Number(data.next)||120000));
  }catch{next=Math.max(next,180000);}
  if(vis==='visible')schedule(next);
 }
 document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden'){clearTimeout(timer);if(sent)beat('hidden');}
  else{const age=Date.now()-last;schedule(!sent||age>30000?1500:next-age);}
 });
 window.addEventListener('pagehide',()=>{clearTimeout(timer);if(sent)beat('leave');});
 window.addEventListener('pageshow',event=>{if(event.persisted)schedule(1500);});
 // joining or leaving a room is worth an early beat; checking is a cheap read of the page
 setInterval(()=>{if(sent&&document.visibilityState!=='hidden'&&(room()!==lastRoom||location.pathname!==lastPath)&&Date.now()-last>15000)beat();},15000);
 if(document.visibilityState!=='hidden')schedule(4000);
})();
