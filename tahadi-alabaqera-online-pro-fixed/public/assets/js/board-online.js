export class BoardOnlineClient {
  constructor(game,{onState,onStatus,onError}={}){
    this.game=game;this.onState=onState||(()=>{});this.onStatus=onStatus||(()=>{});this.onError=onError||(()=>{});
    this.ws=null;this.code='';this.name='';this.hostKey='';this.token='';this.closedByUser=false;this.retry=0;this.reconnectTimer=null;this.version=null;
  }
  tokenKey(code){return `bs_board_${this.game}_${code}`}
  async create(name,playerLimit,{variant='classic'}={}){
    const res=await fetch('/api/board/rooms',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({game:this.game,name,playerLimit,variant})});
    const data=await res.json().catch(()=>({}));if(!res.ok||!data.ok){
      if(data.code==='DURABLE_REQUEST_LIMIT'||/exceeded allowed volume of requests in durable objects free tier/i.test(data.error||'')){
        const error=new Error('وصلت خدمة الأونلاين إلى حد الطلبات اليومي. تعود بعد الساعة ٣:٠٠ صباحًا بتوقيت السعودية.');error.code='DURABLE_REQUEST_LIMIT';error.resetAt=data.resetAt;throw error;
      }
      let failure=data;
      if(res.status>=500)try{const check=await fetch('/api/board/health',{cache:'no-store',signal:AbortSignal.timeout(9000)}),health=await check.json().catch(()=>({}));if(health.code)failure={...data,...health,requestId:data.requestId||health.requestId}}catch{}
      const messages={BOARD_BINDING_MISSING:'محرك الغرف غير مفعّل على السيرفر. يحتاج ربط BOARD_ROOMS مع BoardRoom.',BOARD_ENGINE_OUTDATED:'محرك الغرف على السيرفر قديم. حدّث الحزمة كاملة، الواجهة والسيرفر.',BOARD_ENGINE_UNAVAILABLE:'تعذر تشغيل محرك الغرف على السيرفر. يحتاج فحص النشر والترحيلات.',ROOM_INITIALIZATION_FAILED:'تعذر حفظ الغرفة على السيرفر. أعد المحاولة؛ إذا تكرر الخطأ افحص السيرفر.'};
      const error=new Error((messages[failure.code]||([404,405].includes(res.status)?'هذا السيرفر لا يحتوي خدمة الغرف. انشر المشروع كاملًا.':data.error||'تعذر إنشاء الغرفة'))+(failure.requestId?' · رقم الفحص '+failure.requestId:''));error.code=failure.code;error.requestId=failure.requestId;throw error;
    }
    if(this.game==='snakes'&&variant==='adventure'&&data.variant!=='adventure')throw new Error('المطوّر يحتاج تحديث اللعبة على هذا الخادم؛ حدّث اللعبة وحاول مجددًا');
    this.hostKey=data.hostKey;return this.connect(data.code,name);
  }
  async join(code,name){
    code=String(code||'').replace(/\D/g,'').slice(0,6);if(!/^\d{6}$/.test(code))throw new Error('رمز الغرفة يجب أن يكون 6 أرقام');
    const res=await fetch(`/api/board/rooms/${code}/status`);const data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.error||'الغرفة غير موجودة');if(data.game!==this.game)throw new Error('رمز الغرفة يخص لعبة أخرى');
    return this.connect(code,name)
  }
  async connect(code,name){
    if(!/^\d{6}$/.test(code))throw new Error('رمز الغرفة يجب أن يكون 6 أرقام');
    this.closedByUser=false;this.code=code;this.name=String(name||'لاعب').trim().slice(0,20)||'لاعب';
    try{this.token=localStorage.getItem(this.tokenKey(code))||''}catch{}
    await this.openSocket();return code;
  }
  openSocket(){
    return new Promise((resolve,reject)=>{
      clearTimeout(this.reconnectTimer);const proto=location.protocol==='https:'?'wss:':'ws:';
      const q=new URLSearchParams({name:this.name,game:this.game});
      const protocols=['busraj-v1'];if(this.token)protocols.push(`rt.${this.token}`);if(this.hostKey)protocols.push(`hk.${this.hostKey}`);try{const account=localStorage.getItem('bs_social_session');if(account)protocols.push('st.'+account)}catch{}
      const ws=new WebSocket(`${proto}//${location.host}/api/board/rooms/${this.code}/ws?${q}`,protocols);this.ws=ws;let settled=false;
      const timer=setTimeout(()=>{if(!settled){settled=true;try{ws.close()}catch{};reject(new Error('انتهت مهلة الاتصال بالغرفة'))}},9000);
      ws.onopen=()=>{if(this.ws!==ws)return;this.onStatus({online:true,reconnecting:false,text:'متصل'});};
      ws.onmessage=(ev)=>{
        if(this.ws!==ws)return;let msg;try{msg=JSON.parse(ev.data)}catch{return}
        const identity=state=>{const {serverNow,clientReceivedAt,...stable}=state;return JSON.stringify(stable)};
        const stamp=state=>{if(state){this.stateKey=identity(state);state.clientReceivedAt=Date.now();this.version=state.version;}return state};
        if(msg.type==='welcome'){this.retry=0;this.token=msg.token||this.token;try{localStorage.setItem(this.tokenKey(this.code),this.token)}catch{};const state=stamp(msg.state);this.onState(state);if(!settled){settled=true;clearTimeout(timer);resolve(state)}}
        else if(msg.type==='state'){
          if(!msg.state||this.version!=null&&(msg.state.version<this.version||msg.state.version===this.version&&identity(msg.state)===this.stateKey))return;
          this.onState(stamp(msg.state));
        }else if(msg.type==='error')this.onError(msg.message||'حدث خطأ');
      };
      ws.onerror=()=>{if(this.ws!==ws)return;this.onStatus({online:false,reconnecting:true,text:'مشكلة اتصال'});};
      ws.onclose=(ev)=>{clearTimeout(timer);if(this.ws!==ws)return;this.onStatus({online:false,reconnecting:!this.closedByUser,text:this.closedByUser?'غير متصل':'إعادة اتصال…'});if(!settled){settled=true;reject(new Error(ev.reason||'تعذر الاتصال بالغرفة'))}if(!this.closedByUser&&ev.code!==4001)this.scheduleReconnect();};
    })
  }
  scheduleReconnect(){clearTimeout(this.reconnectTimer);const delay=Math.min(7000,700*Math.pow(1.65,this.retry++));this.reconnectTimer=setTimeout(()=>this.openSocket().catch(()=>{}),delay)}
  send(type,payload={}){if(!this.ws||this.ws.readyState!==WebSocket.OPEN){this.onError('الاتصال غير جاهز — جاري إعادة الاتصال');return false}this.ws.send(JSON.stringify({type,expectedVersion:this.version,...payload}));return true}
  close(){this.closedByUser=true;clearTimeout(this.reconnectTimer);try{if(this.ws?.readyState===WebSocket.OPEN)this.ws.send(JSON.stringify({type:'leave'}));this.ws?.close(1000,'leave')}catch{};this.ws=null}
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
