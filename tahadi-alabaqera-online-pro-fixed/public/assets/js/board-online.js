import {normalizeRoomCode,timedFetch} from './online/connection-utils.js';
// Pages with a board-game room share the active room through window events,
// so add-ons such as live reactions need no changes inside each game page.
function announce(type,detail){try{if(typeof globalThis.dispatchEvent==='function'&&typeof CustomEvent==='function')globalThis.dispatchEvent(new CustomEvent(type,{detail}));}catch{}}
function announceRoom(client,state){globalThis.BS_BOARD_ROOM=client?{client,state}:null;announce('bs-board-room',globalThis.BS_BOARD_ROOM);}
export class BoardOnlineClient {
  constructor(game,{onState,onStatus,onError}={}){
    this.game=game;this.onState=onState||(()=>{});this.onStatus=onStatus||(()=>{});this.onError=onError||(()=>{});
    this.ws=null;this.code='';this.name='';this.hostKey='';this.token='';this.closedByUser=false;this.retry=0;this.reconnectTimer=null;this.version=null;this.heartbeat=null;this.lastMessageAt=0;this.cancelOpening=null;this.bound=false;this.terminal=false;this.requestEpoch=0;
    this.resume=()=>{if(!this.closedByUser&&!this.terminal&&this.code){if(this.ws?.readyState===1){if(Date.now()-this.lastMessageAt>45000)this.recoverSocket(this.ws);else this.send('ping');}else{clearTimeout(this.reconnectTimer);this.openSocket().catch(()=>{});}}};
    this.visibility=()=>{if(!globalThis.document?.hidden)this.resume();};
  }
  tokenKey(code){return `bs_board_${this.game}_${code}`}
  async create(name,playerLimit,{variant='classic',character=''}={}){
    const epoch=++this.requestEpoch;this.closedByUser=false;
    this.character=character;
    const res=await timedFetch('/api/board/rooms',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({game:this.game,name,playerLimit,variant})});
    const data=await res.json().catch(()=>({}));this.checkRequest(epoch);if(!res.ok||!data.ok){
      if(data.code==='DURABLE_REQUEST_LIMIT'||/exceeded allowed volume of requests in durable objects free tier/i.test(data.error||'')){
        const error=new Error('وصلت خدمة الأونلاين إلى حد الطلبات اليومي. تعود بعد الساعة 3:00 صباحًا بتوقيت السعودية.');error.code='DURABLE_REQUEST_LIMIT';error.resetAt=data.resetAt;throw error;
      }
      let failure=data;
      if(res.status>=500)try{const check=await fetch('/api/board/health',{cache:'no-store',signal:AbortSignal.timeout(9000)}),health=await check.json().catch(()=>({}));if(health.code)failure={...data,...health,requestId:data.requestId||health.requestId}}catch{}
      const messages={BOARD_BINDING_MISSING:'محرك الغرف غير مفعّل على السيرفر. يحتاج ربط BOARD_ROOMS مع BoardRoom.',BOARD_ENGINE_OUTDATED:'محرك الغرف على السيرفر قديم. حدّث الحزمة كاملة، الواجهة والسيرفر.',BOARD_ENGINE_UNAVAILABLE:'تعذر تشغيل محرك الغرف على السيرفر. يحتاج فحص النشر والترحيلات.',ROOM_INITIALIZATION_FAILED:'تعذر حفظ الغرفة على السيرفر. أعد المحاولة؛ إذا تكرر الخطأ افحص السيرفر.'};
      const error=new Error((messages[failure.code]||([404,405].includes(res.status)?'هذا السيرفر لا يحتوي خدمة الغرف. انشر المشروع كاملًا.':data.error||'تعذر إنشاء الغرفة'))+(failure.requestId?' · رقم الفحص '+failure.requestId:''));error.code=failure.code;error.requestId=failure.requestId;throw error;
    }
    if(this.game==='snakes'&&variant==='adventure'&&data.variant!=='adventure')throw new Error('المطوّر يحتاج تحديث اللعبة على هذا الخادم؛ حدّث اللعبة وحاول مجددًا');
    this.hostKey=data.hostKey;this.hostCode=data.code;return this.connect(data.code,name);
  }
  async join(code,name,{character=''}={}){
    const epoch=++this.requestEpoch;this.closedByUser=false;
    this.character=character;
    code=normalizeRoomCode(code);if(!/^\d{6}$/.test(code))throw new Error('رمز الغرفة يجب أن يكون 6 أرقام');
    const res=await timedFetch(`/api/board/rooms/${code}/status`);const data=await res.json().catch(()=>({}));this.checkRequest(epoch);if(!res.ok||!data.ok)throw new Error(data.error||'الغرفة غير موجودة');if(data.game!==this.game)throw new Error('رمز الغرفة يخص لعبة أخرى');
    return this.connect(code,name)
  }
  checkRequest(epoch){if(this.closedByUser||epoch!==this.requestEpoch)throw new Error('تم إلغاء طلب الغرفة السابق');}
  async connect(code,name){
    if(!/^\d{6}$/.test(code))throw new Error('رمز الغرفة يجب أن يكون 6 أرقام');
    this.closedByUser=false;this.terminal=false;this.code=code;if(this.hostCode!==code)this.hostKey='';
    if(!this.bound&&globalThis.window?.addEventListener){window.addEventListener('online',this.resume);window.addEventListener('pageshow',this.resume);document.addEventListener('visibilitychange',this.visibility);this.bound=true;}
    this.name=String(name||'لاعب').trim().slice(0,20)||'لاعب';
    try{this.token=localStorage.getItem(this.tokenKey(code))||''}catch{}
    await this.openSocket();return code;
  }
  stopTransport(){
    clearInterval(this.heartbeat);this.heartbeat=null;
    const cancel=this.cancelOpening;this.cancelOpening=null;cancel?.();
    const old=this.ws;this.ws=null;
    if(old){old.onopen=old.onmessage=old.onerror=old.onclose=null;try{old.close(1000,'replaced')}catch{}}
  }
  recoverSocket(ws){
    if(this.ws!==ws||this.closedByUser||this.terminal)return;
    this.stopTransport();this.onStatus({online:false,reconnecting:true,text:'انقطع الاتصال؛ نحاول العودة…'});this.scheduleReconnect();
  }
  openSocket(){
    this.stopTransport();
    return new Promise((resolve,reject)=>{
      clearTimeout(this.reconnectTimer);this.reconnectTimer=null;
      const proto=location.protocol==='https:'?'wss:':'ws:',q=new URLSearchParams({name:this.name,game:this.game});
      if(this.game==='snakes'&&this.character)q.set('character',this.character);
      const protocols=['busraj-v1'];if(this.token)protocols.push(`rt.${this.token}`);if(this.hostKey)protocols.push(`hk.${this.hostKey}`);try{const account=localStorage.getItem('bs_social_session');if(account)protocols.push('st.'+account)}catch{}
      let ws,settled=false;
      const fail=message=>{if(settled)return;settled=true;clearTimeout(timer);this.cancelOpening=null;reject(new Error(message));};
      const timer=setTimeout(()=>{if(this.ws!==ws)return;fail('انتهت مهلة الاتصال بالغرفة. أعد المحاولة.');this.recoverSocket(ws)},10000);
      this.cancelOpening=()=>fail('تم إلغاء الاتصال السابق');
      try{ws=new WebSocket(`${proto}//${location.host}/api/board/rooms/${this.code}/ws?${q}`,protocols);}catch(error){fail('تعذر بدء الاتصال بالغرفة');this.scheduleReconnect();return;}
      this.ws=ws;this.lastMessageAt=Date.now();
      ws.onopen=()=>{if(this.ws===ws)this.onStatus({online:false,reconnecting:true,text:'جاري دخول الغرفة…'});};
      ws.onmessage=(ev)=>{
        if(this.ws!==ws)return;let msg;try{msg=JSON.parse(ev.data)}catch{return}
        this.lastMessageAt=Date.now();
        const identity=state=>{const {serverNow,clientReceivedAt,...stable}=state;return JSON.stringify(stable)};
        const stamp=state=>{if(state){this.stateKey=identity(state);state.clientReceivedAt=Date.now();this.version=state.version;}return state};
        if(msg.type==='welcome'){
          if(!msg.state)return;
          this.retry=0;this.token=msg.token||this.token;try{localStorage.setItem(this.tokenKey(this.code),this.token)}catch{}
          const state=stamp(msg.state);this.onState(state);announceRoom(this,state);this.onStatus({online:true,reconnecting:false,text:'متصل'});
          if(!settled){settled=true;clearTimeout(timer);this.cancelOpening=null;resolve(state);}
          clearInterval(this.heartbeat);this.heartbeat=setInterval(()=>{
            if(this.ws!==ws||globalThis.document?.hidden)return;
            if(Date.now()-this.lastMessageAt>55000){this.recoverSocket(ws);return;}
            if(ws.readyState===WebSocket.OPEN)this.send('ping');
          },20000);this.heartbeat?.unref?.();
        }else if(msg.type==='state'){
          if(!msg.state||this.version!=null&&(msg.state.version<this.version||msg.state.version===this.version&&identity(msg.state)===this.stateKey))return;
          const state=stamp(msg.state);this.onState(state);announceRoom(this,state);
        }else if(msg.type==='emote'){
          announce('bs-board-emote',{from:msg.from,name:msg.name,emote:msg.emote,at:msg.at});
        }else if(msg.type==='emote-locked'){
          announce('bs-board-emote-locked',{emote:msg.emote});
        }else if(msg.type==='error'){
          const message=msg.message||'تعذر دخول الغرفة';this.onError(message);
          if(!settled){this.terminal=true;fail(message);this.stopTransport();this.onStatus({online:false,reconnecting:false,text:message});}
        }
      };
      ws.onerror=()=>{if(this.ws===ws)this.onStatus({online:false,reconnecting:true,text:'نتحقق من الاتصال…'});};
      ws.onclose=(ev)=>{
        clearTimeout(timer);clearInterval(this.heartbeat);this.heartbeat=null;
        if(this.ws!==ws)return;this.ws=null;
        const terminal=[4001,4002,4003,1008].includes(ev.code)||ev.reason==='room_expired';
        this.terminal=terminal;
        const text=ev.code===4001?'الغرفة مفتوحة في نافذة أخرى':terminal?'انتهت جلسة الغرفة. ادخل مجددًا.':this.closedByUser?'غير متصل':'انقطع الاتصال؛ نحاول العودة…';
        this.onStatus({online:false,reconnecting:!this.closedByUser&&!terminal,text});
        fail(ev.reason||'تعذر الاتصال بالغرفة');
        if(!this.closedByUser&&!terminal)this.scheduleReconnect();
      };
    });
  }
  scheduleReconnect(){
    if(this.closedByUser||this.terminal)return;
    clearTimeout(this.reconnectTimer);
    const delay=Math.min(12000,700*Math.pow(1.65,this.retry++))+Math.floor(Math.random()*250);
    this.reconnectTimer=setTimeout(()=>{this.reconnectTimer=null;if(!this.closedByUser)this.openSocket().catch(()=>{});},delay);
    this.reconnectTimer?.unref?.();
  }
  send(type,payload={}){
    if(!this.ws||this.ws.readyState!==WebSocket.OPEN){this.onError('الاتصال غير جاهز — جاري إعادة الاتصال');return false}
    if((this.ws.bufferedAmount||0)>65536){this.onError('الاتصال بطيء؛ انتظر وصول آخر حركة');return false}
    try{this.ws.send(JSON.stringify({type,expectedVersion:this.version,...payload}));return true}catch{this.onError('تعذر إرسال الحركة؛ نتصل مجددًا');this.recoverSocket(this.ws);return false}
  }
  // Quick reactions are best effort: never an error toast, never a resend.
  react(emote){
    if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return false;
    try{this.ws.send(JSON.stringify({type:'emote',emote:String(emote)}));return true}catch{return false}
  }
  close(){
    if(globalThis.BS_BOARD_ROOM?.client===this)announceRoom(null,null);
    this.closedByUser=true;this.requestEpoch++;clearTimeout(this.reconnectTimer);this.reconnectTimer=null;
    try{if(this.ws?.readyState===WebSocket.OPEN)this.ws.send(JSON.stringify({type:'leave'}));}catch{}
    this.stopTransport();
    if(this.bound){window.removeEventListener('online',this.resume);window.removeEventListener('pageshow',this.resume);document.removeEventListener('visibilitychange',this.visibility);this.bound=false;}
  }
}

export function renderRoomPlayers(container,roomState,colors=['#8b5cf6','#22d3ee','#f0b94a','#22c55e']){
  if(!container||!roomState)return;container.innerHTML='';
  roomState.players.forEach((p,i)=>{const row=document.createElement('div');row.className='room-player'+(p.id===roomState.me?.id?' me':'');row.innerHTML=`<span class="room-avatar" style="--pc:${colors[i%colors.length]}">${escapeHtml((p.name||'؟').slice(0,1))}</span><span class="room-player-copy"><b>${escapeHtml(p.name)}</b><small>${p.role==='host'?'المضيف':'لاعب'} • ${p.connected?'متصل':'يعيد الاتصال'}</small></span><span class="ready-dot ${p.ready?'yes':''}">${p.ready?'جاهز':'انتظار'}</span>`;container.appendChild(row)})
}
function escapeHtml(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

export function bindRoomCountdown(element,getRoom){
  if(!element)return()=>{};
  const paint=()=>{
    const room=typeof getRoom==='function'?getRoom():null;
    if(!room||room.status!=='playing'||!room.turnDeadline){element.classList.add('hidden');element.classList.remove('urgent');return}
    const receivedAt=Number(room.clientReceivedAt)||Date.now();
    const serverBase=Number(room.serverNow)||receivedAt;
    const estimatedServerNow=serverBase+(Date.now()-receivedAt);
    const seconds=Math.max(0,Math.ceil((Number(room.turnDeadline)-estimatedServerNow)/1000));
    element.textContent=`⏱ ${seconds}ث`;
    element.classList.remove('hidden');
    element.classList.toggle('urgent',seconds<=10);
  };
  paint();
  const timer=setInterval(paint,250);
  return()=>clearInterval(timer);
}
