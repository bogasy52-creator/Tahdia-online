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
