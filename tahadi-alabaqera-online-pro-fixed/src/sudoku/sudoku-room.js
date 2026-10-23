import {createSudoku} from '../../public/assets/js/engines/sudoku-engine.js';
import {solveSudoku,SUDOKU_PEERS} from '../../public/assets/js/engines/sudoku-core.js';

const TTL=60*60000,GRACE=45000,LOBBY_MS=20000,MAX_MISTAKES=5;
const DURATIONS=[10,15,20,25,30].map(n=>n*60000);
const secret=()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
const json=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const cleanName=value=>String(value||'لاعب').normalize('NFKC').replace(/[<>\u0000-\u001f\u202a-\u202e\u2066-\u2069]/g,'').trim().slice(0,20)||'لاعب';
export function sudokuSettings(value){
  return Number.isInteger(value?.difficulty)&&value.difficulty>=1&&value.difficulty<=5&&Number.isInteger(value?.capacity)&&value.capacity>=1&&value.capacity<=20;
}

export class SudokuRoom{
  constructor(ctx,env){
    this.ctx=ctx;this.env=env;this.room=null;
    this.ready=ctx.blockConcurrencyWhile(async()=>{this.room=await ctx.storage.get('sudokuRoom')||null;this.sync();});
  }
  sync(){
    if(!this.room)return;
    const connections=new Set(this.ctx.getWebSockets().flatMap(ws=>{try{const a=ws.deserializeAttachment();return a?.sudoku?[a.connection]:[];}catch{return [];}}));
    for(const p of Object.values(this.room.players))p.connected=connections.has(p.connection);
  }
  async save(){if(this.room)await this.ctx.storage.put('sudokuRoom',this.room);}
  snapshot(id){
    const r=this.room,p=r.players[id],live=['playing','finished'].includes(r.status);
    const players=r.order.map(id=>r.players[id]).sort((a,b)=>(b.finishedAt>0)-(a.finishedAt>0)||(a.finishedAt&&b.finishedAt?a.finishedAt-b.finishedAt:0)||(a.eliminatedAt>0)-(b.eliminatedAt>0)||(b.correct||0)-(a.correct||0)||a.joinedAt-b.joinedAt);
    return {code:r.code,status:r.status,difficulty:r.difficulty,capacity:r.capacity,round:r.round,startsAt:r.startsAt||0,deadline:r.deadline||0,serverNow:Date.now(),lobbyMs:LOBBY_MS,winnerId:r.winnerId||null,finishedAt:r.finishedAt||0,
      initial:live?r.initial:[],total:live?r.initial.filter(v=>!v).length:0,
      maxMistakes:MAX_MISTAKES,
      players:players.map((x,i)=>({id:x.id,name:x.name,role:x.role,connected:x.connected,correct:x.correct||0,mistakes:x.mistakes||0,eliminatedAt:x.eliminatedAt||0,finishedAt:x.finishedAt||0,rank:i+1})),
      me:p?{id:p.id,board:live?p.board:[],seq:p.seq||0,mistakes:p.mistakes||0,eliminatedAt:p.eliminatedAt||0,canUndo:live&&!p.eliminatedAt&&Boolean(p.history?.length)}:null};
  }
  broadcast(){
    if(!this.room)return;this.sync();
    for(const ws of this.ctx.getWebSockets()){const a=ws.deserializeAttachment();if(a?.sudoku&&this.room.players[a.playerId]?.connection===a.connection)try{ws.send(JSON.stringify({type:'state',state:this.snapshot(a.playerId)}));}catch{}}
  }
  error(ws,message){try{const a=ws.deserializeAttachment();ws.send(JSON.stringify({type:'error',message,state:this.snapshot(a.playerId)}));}catch{}}
  async schedule(){
    const r=this.room;if(!r)return;
    const now=Date.now(),times=[r.expiresAt];
    if(r.status==='countdown')times.push(r.startsAt);
    if(r.status==='playing')times.push(r.deadline);
    if(['lobby','finished'].includes(r.status))for(const p of Object.values(r.players))if(!p.connected&&p.disconnectedAt)times.push(p.disconnectedAt+GRACE);
    await this.ctx.storage.setAlarm(Math.max(now+1,Math.min(...times.filter(t=>t>now))));
  }
  cleanup(){
    const r=this.room;if(!r||!['lobby','finished'].includes(r.status))return;
    for(const id of [...r.order]){const p=r.players[id];if(!p.connected&&p.disconnectedAt&&Date.now()-p.disconnectedAt>=GRACE){delete r.players[id];r.order=r.order.filter(x=>x!==id);}}
    if(r.order.length&&!r.order.some(id=>r.players[id].role==='host'))r.players[r.order.find(id=>r.players[id].connected)||r.order[0]].role='host';
  }
  async advance(){
    const r=this.room;if(!r)return;
    if(Date.now()>=r.expiresAt){for(const ws of this.ctx.getWebSockets())try{ws.close(4000,'expired');}catch{}await this.ctx.storage.deleteAll();this.room=null;return;}
    if(r.status==='countdown'&&Date.now()>=r.startsAt){
      this.sync();
      if(!r.order.some(id=>r.players[id].connected)){r.status='lobby';r.startsAt=0;}
      else{
        // The server chooses the stage and retains its answer; neither is sent in the lobby.
        const random=crypto.getRandomValues(new Uint32Array(1));
        const puzzle=createSudoku((r.difficulty-1)*24+1+random[0]%24);
        const result=solveSudoku(puzzle.initial);
        if(result.count!==1||result.limited)throw Error('invalid_sudoku_stage');
        r.initial=puzzle.initial;r.solution=result.solution;r.status='playing';
        r.deadline=r.startsAt+DURATIONS[r.difficulty-1];
        for(const p of Object.values(r.players)){p.board=[...r.initial];p.history=[];p.seq=0;p.correct=0;p.mistakes=0;p.eliminatedAt=0;p.finishedAt=0;}
      }
      await this.save();this.broadcast();
    }
    if(r.status==='playing'&&Date.now()>=r.deadline)await this.finish();
  }
  async fetch(request){
    await this.ready;const url=new URL(request.url);
    if(url.pathname==='/init'&&request.method==='POST')return this.ctx.blockConcurrencyWhile(async()=>{
      if(this.room)return json({ok:false},409);
      const b=await request.json().catch(()=>null);if(!sudokuSettings(b)||!/^\d{6}$/.test(b.code)||typeof b.hostKey!=='string'||b.hostKey.length<32)return json({ok:false,error:'إعدادات الغرفة غير صالحة'},400);
      this.room={code:b.code,hostKey:b.hostKey,difficulty:b.difficulty,capacity:b.capacity,status:'lobby',players:{},order:[],round:'',createdAt:Date.now(),expiresAt:Date.now()+TTL};
      await this.save();await this.schedule();return json({ok:true},201);
    });
    return this.ctx.blockConcurrencyWhile(async()=>{
      await this.advance();if(!this.room)return json({ok:false,error:'انتهت الغرفة؛ أنشئ غرفة جديدة'},404);
      this.sync();this.cleanup();
      if(url.pathname==='/status'){await this.save();await this.schedule();return json({ok:true,game:'sudoku',status:this.room.status,players:this.room.order.length,capacity:this.room.capacity,difficulty:this.room.difficulty});}
      if(url.pathname==='/ws')return this.connect(request,url);
      return json({ok:false,error:'not_found'},404);
    });
  }
  async connect(request,url){
    if(request.headers.get('upgrade')?.toLowerCase()!=='websocket')return json({ok:false,error:'يلزم اتصال مباشر'},426);
    const protocols=String(request.headers.get('sec-websocket-protocol')||'').split(',').map(x=>x.trim());
    if(!protocols.includes('tahdia-sudoku-v1'))return json({ok:false,error:'حدّث الصفحة'},426);
    const read=prefix=>protocols.find(x=>x.startsWith(prefix))?.slice(prefix.length)||'';
    const r=this.room,username=request.headers.get('x-bs-account')||null,resume=read('rt.');
    let p=r.order.map(id=>r.players[id]).find(x=>x.token===resume);
    if(resume&&!p)return json({ok:false,error:'انتهت جلستك في الغرفة؛ ادخل من جديد'},403);
    if(p?.username&&p.username!==username)return json({ok:false,error:'ارجع بالحساب نفسه'},403);
    if(!p&&username&&Object.values(r.players).some(x=>x.username===username))return json({ok:false,error:'حسابك موجود؛ استعد جلستك من الجهاز نفسه'},409);
    if(!p){
      if(!['lobby','countdown'].includes(r.status))return json({ok:false,error:'الجولة بدأت؛ انتظر الغرفة التالية'},409);
      if(r.order.length>=r.capacity)return json({ok:false,error:'الغرفة ممتلئة'},409);
      const first=!r.order.length;if(first&&read('hk.')!==r.hostKey)return json({ok:false,error:'بانتظار المضيف'},403);
      p={id:crypto.randomUUID(),token:secret(),name:cleanName(url.searchParams.get('name')),role:first?'host':'guest',username,joinedAt:Date.now()};r.players[p.id]=p;r.order.push(p.id);
    }
    // Mark the new connection before closing the old socket: its late close cannot disconnect this seat.
    const previous=p.connection;p.connection=crypto.randomUUID();p.connected=true;p.disconnectedAt=null;
    for(const old of this.ctx.getWebSockets())if(old.deserializeAttachment()?.connection===previous)try{old.close(4001,'reconnected');}catch{}
    const pair=new WebSocketPair(),server=pair[1];this.ctx.acceptWebSocket(server);
    server.serializeAttachment({sudoku:true,playerId:p.id,connection:p.connection});
    await this.save();server.send(JSON.stringify({type:'welcome',playerId:p.id,token:p.token,state:this.snapshot(p.id)}));this.broadcast();await this.schedule();
    return new Response(null,{status:101,webSocket:pair[0],headers:{'sec-websocket-protocol':'tahdia-sudoku-v1'}});
  }
  async webSocketMessage(ws,raw){
    await this.ready;return this.ctx.blockConcurrencyWhile(async()=>{
      const a=ws.deserializeAttachment();let r=this.room,p=r?.players[a?.playerId];
      if(!p||p.connection!==a.connection||!p.connected)return;
      await this.advance();r=this.room;if(!r)return;
      const text=typeof raw==='string'?raw:new TextDecoder().decode(raw);if(text.length>1024)return this.error(ws,'الرسالة كبيرة');
      let m;try{m=JSON.parse(text);}catch{return this.error(ws,'رسالة غير صالحة');}if(!m||typeof m!=='object')return this.error(ws,'رسالة غير صالحة');
      const second=Math.floor(Date.now()/1000);if(p.messageSecond!==second){p.messageSecond=second;p.messageCount=0;}if(++p.messageCount>30)return this.error(ws,'تمهّل قليلًا');
      if(m.type==='ping'){ws.send(JSON.stringify({type:'state',state:this.snapshot(p.id)}));return;}
      if(m.type==='leave'){
        if(['playing','countdown'].includes(r.status))return this.error(ws,'ارجع للمدخل لإغلاق اتصالك؛ مقعدك محفوظ حتى نهاية الجولة');
        delete r.players[p.id];r.order=r.order.filter(id=>id!==p.id);this.cleanup();try{ws.close(4002,'left');}catch{}
      }else if(m.type==='settings'&&p.role==='host'&&r.status==='lobby'){
        if(!sudokuSettings(m)||m.capacity<r.order.length)return this.error(ws,'اختر صعوبة من 1 إلى 5 وعددًا يستوعب الموجودين حتى 20');
        r.difficulty=m.difficulty;r.capacity=m.capacity;
      }else if(m.type==='start'&&p.role==='host'&&r.status==='lobby'){
        if(m.difficulty!==undefined||m.capacity!==undefined){if(!sudokuSettings(m)||m.capacity<r.order.length)return this.error(ws,'إعدادات البداية غير صالحة');r.difficulty=m.difficulty;r.capacity=m.capacity;}
        r.status='countdown';r.finishedAt=0;r.startsAt=Date.now()+LOBBY_MS;r.round=crypto.randomUUID();r.winnerId=null;
      }else if(m.type==='cancel'&&p.role==='host'&&r.status==='countdown'){
        r.status='lobby';r.startsAt=0;r.round='';
      }else if(m.type==='rematch'&&p.role==='host'&&r.status==='finished'){
        r.status='lobby';r.startsAt=0;r.deadline=0;r.initial=[];r.solution=[];r.winnerId=null;for(const x of Object.values(r.players)){x.correct=0;x.mistakes=0;x.eliminatedAt=0;x.finishedAt=0;}this.cleanup();
      }else if((m.type==='move'||m.type==='undo')&&r.status==='playing'){
        if(p.eliminatedAt)return this.error(ws,'انتهت فرصك الخمس؛ تابع نتيجة الجولة من الترتيب');
        if(m.round!==r.round)return this.error(ws,'هذه حركة من جولة قديمة');
        if(!Number.isInteger(m.seq)||m.seq<1)return this.error(ws,'تسلسل الحركة غير صالح');
        if(m.seq<=p.seq){this.broadcast();return;}
        if(m.seq!==p.seq+1||p.seq>=2000)return this.error(ws,'انتظر وصول الحركة السابقة');
        if(m.type==='undo'){
          const last=p.history.pop();if(!last)return this.error(ws,'لا يوجد إدخال للتراجع');p.board[last.cell]=last.value;
        }else{
          const {cell,value}=m;
          if(!Number.isInteger(cell)||cell<0||cell>=81||!Number.isInteger(value)||value<0||value>9||r.initial[cell]||p.board[cell]===value)return this.error(ws,'اختر خانة قابلة للتعديل ورقمًا من 1 إلى 9');
          if(value&&SUDOKU_PEERS[cell].some(i=>p.board[i]===value))return this.error(ws,'الرقم مكرر في الصف أو العمود أو المربع');
          p.history.push({cell,value:p.board[cell]});p.board[cell]=value;
          if(value&&value!==r.solution[cell]){p.mistakes=(p.mistakes||0)+1;if(p.mistakes>=MAX_MISTAKES)p.eliminatedAt=Date.now();}
        }
        p.seq=m.seq;p.correct=p.board.reduce((n,v,i)=>n+(!r.initial[i]&&v===r.solution[i]?1:0),0);
        if(p.correct===r.initial.filter(v=>!v).length){p.finishedAt=Date.now();r.winnerId=p.id;await this.finish();return;}
        if(r.order.every(id=>r.players[id].eliminatedAt)){await this.finish();return;}
      }else return this.error(ws,'الأمر غير متاح الآن');
      await this.save();this.broadcast();await this.schedule();
    });
  }
  async finish(){
    const r=this.room;if(r.status!=='playing')return;r.status='finished';r.finishedAt=Date.now();
    // A timeout may end in a tie. Never fabricate a winner from join order.
    if(!r.winnerId){const rows=r.order.map(id=>r.players[id]).filter(p=>!p.eliminatedAt).sort((a,b)=>b.correct-a.correct);r.winnerId=rows[0]?.correct>0&&(!rows[1]||rows[0].correct>rows[1].correct)?rows[0].id:null;}
    await this.save();this.broadcast();await this.schedule();
  }
  async webSocketClose(ws){
    await this.ready;return this.ctx.blockConcurrencyWhile(async()=>{
      const a=ws.deserializeAttachment(),p=this.room?.players[a?.playerId];
      if(p?.connection===a.connection){p.connected=false;p.disconnectedAt=Date.now();await this.save();this.broadcast();await this.schedule();}
    });
  }
  async webSocketError(ws){return this.webSocketClose(ws);}
  async alarm(){await this.ready;return this.ctx.blockConcurrencyWhile(async()=>{await this.advance();if(!this.room)return;this.sync();this.cleanup();await this.save();this.broadcast();await this.schedule();});}
}
