import {W,L} from './core.js?v=33.9.9-studio1';
const session=()=>{try{return localStorage.getItem('bs_social_session')||'';}catch{return '';}};
const abort=()=>Object.assign(new Error('تم إلغاء الاتصال السابق'),{name:'AbortError'});
export function hockeyPerspective(source,seat){const g=structuredClone(source);if(seat!==1)return g;for(const p of[g.puck,...g.strikers]){p.x=W-p.x;p.y=L-p.y;p.vx=-p.vx;p.vy=-p.vy;if(Number.isFinite(p.tx))p.tx=W-p.tx;if(Number.isFinite(p.ty))p.ty=L-p.ty;}g.strikers.reverse();g.score.reverse();if(g.winner>=0)g.winner=1-g.winner;g.server=1-g.server;g.events=g.events.map(e=>({...e,...(Number.isFinite(e.x)?{x:W-e.x}:{}),...(Number.isFinite(e.y)?{y:L-e.y}:{}),...(e.scorer!==undefined?{scorer:1-e.scorer}:{}),...(e.who!==undefined?{who:1-e.who}:{}),...(e.winner>=0?{winner:1-e.winner}:{})}));return g;}
export class HockeyOnline{
 constructor({onState,onStatus}={}){this.onState=onState||(()=>{});this.onStatus=onStatus||(()=>{});this.epoch=0;this.seq=0;this.retry=0;this.closed=true;this.lastInput=0;this.state=null;this.status='';this.sentAt=new Map();this.rtt=0;}
 statusOf(text){if(this.status!==text){this.status=text;this.onStatus(text);}}
 storage(){try{return session()?localStorage:sessionStorage;}catch{return null;}}
 loadToken(code){try{const saved=JSON.parse(this.storage()?.getItem('hockey:'+code)||'null');return saved?.account===session()?saved.token||'':'';}catch{return '';}}
 remember(token){this.token=token||this.token;try{this.storage()?.setItem('hockey:'+this.code,JSON.stringify({token:this.token,account:session()}));}catch{}}
 async enter(kind,{name,target,code}={}){
  this.close();this.closed=false;const epoch=++this.epoch;this.name=String(name||'لاعب').trim().slice(0,20)||'لاعب';this.retry=0;this.state=null;this.seq=0;this.lastInput=0;
  if(kind!=='join'){
   const response=await fetch('/api/hockey/'+(kind==='quick'?'quick':'rooms'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({target}),signal:AbortSignal.timeout(10000),cache:'no-store'});
   const data=await response.json().catch(()=>null);if(this.closed||epoch!==this.epoch)throw abort();
   if(!response.ok||!data?.ok||!/^95\d{4}$/.test(data.code||'')){const msg=response.status===401?'انتهت جلسة حسابك. سجّل الدخول مجددًا.':[404,405].includes(response.status)?'خدمة الهوكي غير متاحة في هذه النسخة. حدّث الصفحة ثم جرّب.':data?.error||'تعذر فتح المواجهة الآن. أعد المحاولة.';throw Error(msg);}
   code=data.code;this.hostKey=data.hostKey||'';
  }else this.hostKey='';
  if(!/^95\d{4}$/.test(code||''))throw Error('اكتب رمز غرفة الهوكي المكوّن من 6 أرقام');
  this.code=code;this.token=this.loadToken(code);return this.connect(epoch);
 }
 drop(){clearInterval(this.heartbeat);clearTimeout(this.openTimer);this.heartbeat=null;this.openTimer=null;const cancel=this.cancelOpening;this.cancelOpening=null;cancel?.();const ws=this.ws;this.ws=null;if(ws){ws.onmessage=ws.onclose=ws.onerror=ws.onopen=null;try{ws.close(1000,'replaced');}catch{}}}
 connect(epoch=this.epoch){
  if(this.closed||epoch!==this.epoch)return Promise.reject(abort());this.drop();clearTimeout(this.retryTimer);this.statusOf(this.retry?'نعيد الاتصال بمواجهتك…':'جارٍ دخول المواجهة…');
  return new Promise((resolve,reject)=>{
   let settled=false,welcomed=false;const account=session(),protocols=['bs-hockey-v1',...(this.hostKey?['hk.'+this.hostKey]:[]),...(this.token?['rt.'+this.token]:[]),...(account?['st.'+account]:[])];
   const finish=(error)=>{if(settled)return;settled=true;clearTimeout(this.openTimer);this.cancelOpening=null;error?reject(error):resolve(this.code);};
   this.cancelOpening=()=>finish(abort());let ws;
   try{ws=new WebSocket((location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/api/hockey/rooms/'+this.code+'/ws?name='+encodeURIComponent(this.name),protocols);}catch{finish(Error('تعذر بدء الاتصال. تحقق من الإنترنت.'));return;}
   this.ws=ws;this.lastMessage=Date.now();
   this.openTimer=setTimeout(()=>{if(this.ws!==ws)return;finish(Error('تأخر دخول المواجهة. أعد المحاولة.'));this.drop();this.statusOf('لم يكتمل الاتصال');},10000);
   ws.onmessage=event=>{
    if(this.closed||epoch!==this.epoch||this.ws!==ws)return;let message;try{message=JSON.parse(event.data);}catch{return;}this.lastMessage=Date.now();
    if(message.type==='emote'){window.dispatchEvent(new CustomEvent('bs-board-emote',{detail:message}));return;}
    if(message.type==='emote-locked'){window.dispatchEvent(new CustomEvent('bs-board-emote-locked',{detail:message}));return;}
    const next=message.state;
    if(message.type==='welcome'){
     if(!next||!Array.isArray(next.players)||!Number.isInteger(next.me)||next.me<0||next.me>=next.players.length){finish(Error('وصلت حالة غرفة غير صالحة. أعد الدخول.'));this.statusOf('تعذر تجهيز المواجهة');this.drop();return;}
     welcomed=true;this.retry=0;this.remember(message.token);finish();this.send({type:'ready'});clearInterval(this.heartbeat);
     this.heartbeat=setInterval(()=>{if(this.closed||this.ws!==ws||document.hidden)return;if(Date.now()-this.lastMessage>35000){try{ws.close(1012,'heartbeat');}catch{}return;}this.send({type:'ping'});},12000);
    }
    if(!next||!Array.isArray(next.players)||!Number.isInteger(next.me)||next.me<0||next.me>=next.players.length)return;
    if(message.type!=='welcome'&&this.state&&(next.round<this.state.round||next.round===this.state.round&&next.frame<this.state.frame))return;
    if(this.state?.round!==next.round||message.type==='welcome'){this.seq=next.seq||0;this.hitId=next.hits?.[next.me]||0;}
    // 33.9.0: how long a move takes to come back (the room's word carries the last input it took)
    const sent=this.sentAt.get(next.seq);if(sent){const sample=performance.now()-sent;this.rtt=this.rtt?this.rtt*.8+sample*.2:sample;this.sentAt.delete(next.seq);}
    this.state=next;this.seat=next.me;this.statusOf(next.paused?'بانتظار عودة خصمك · 20 ثانية':next.status==='lobby'?'بانتظار لاعب آخر':'متصل');this.onState(next);
    window.dispatchEvent(new CustomEvent('bs-board-room',{detail:{client:{react:(id,to)=>this.send({type:'emote',emote:id,...(to?{to:String(to)}:{})})},state:{me:{id:next.players[this.seat]?.id},players:next.players,status:next.status}}}));
   };
   ws.onerror=()=>{if(this.ws===ws)this.statusOf('نتحقق من الاتصال…');};
   ws.onclose=event=>{
    clearInterval(this.heartbeat);clearTimeout(this.openTimer);if(this.closed||epoch!==this.epoch||this.ws!==ws)return;this.ws=null;
    if([4001,4002,4003,1008].includes(event.code)){
     this.closed=true;const text=event.code===4001?'فُتحت مواجهتك في نافذة أخرى. أغلقها ثم عُد.':'انتهت جلسة المواجهة. افتح مواجهة جديدة.';finish(Error(text));this.statusOf(text);return;
    }
    if(!welcomed&&!this.token){finish(Error('تعذر دخول الغرفة. تحقق من الرمز وحضور المضيف.'));this.statusOf('لم يتم دخول الغرفة');return;}
    finish(Error('انقطع الاتصال؛ نحاول العودة'));this.statusOf('انقطع الاتصال؛ نحاول العودة…');if(this.retry++<7)this.retryTimer=setTimeout(()=>this.connect(epoch).catch(error=>{if(error.name!=='AbortError')this.statusOf(error.message);}),Math.min(6000,600*1.6**this.retry));else this.statusOf('تعذر استعادة الاتصال. أعد دخول المواجهة.');
   };
  });
 }
 send(data){if(this.closed||this.ws?.readyState!==1||(this.ws.bufferedAmount||0)>65536)return false;try{this.ws.send(JSON.stringify(data));return true;}catch{return false;}}
 input(x,y){const now=performance.now();if(!this.state||this.state.paused||!Number.isFinite(x)||!Number.isFinite(y)||now-this.lastInput<16)return;
  // 33.9.0: a hand that has not moved says nothing (a word every half second keeps the round trip known)
  if(Math.abs(x-(this.lastX??-1e9))<.5&&Math.abs(y-(this.lastY??-1e9))<.5&&now-this.lastInput<500)return;
  this.lastInput=now;this.lastX=x;this.lastY=y;const seq=++this.seq;if(this.send({type:'input',seq,x:this.seat===1?W-x:x,y:this.seat===1?L-y:y})){this.sentAt.set(seq,now);if(this.sentAt.size>40)this.sentAt.delete(this.sentAt.keys().next().value);}}
 /** 33.9.8: your striker sent the puck — the room plays it on from what this page saw. */
 hit(p,strike=false){if(!this.state||this.state.paused||this.state.status!=='playing'||!p)return 0;const f=this.seat===1,id=(this.hitId=(this.hitId||0)+1);
  return this.send({type:'hit',id,strike:!!strike,x:f?W-p.x:p.x,y:f?L-p.y:p.y,vx:f?-p.vx:p.vx,vy:f?-p.vy:p.vy,spin:p.spin||0,lag:Math.round(Math.min(300,(this.rtt||110)/2+8))})?id:0;}
 resume({force=false}={}){if(!this.code||!this.token||!force&&this.ws?.readyState===1)return;this.closed=false;const epoch=++this.epoch;this.retry=0;return this.connect(epoch);}
 close({leave=true}={}){if(leave)this.send({type:'leave'});this.closed=true;this.epoch++;clearTimeout(this.retryTimer);this.drop();window.dispatchEvent(new CustomEvent('bs-board-room',{detail:null}));}
}
