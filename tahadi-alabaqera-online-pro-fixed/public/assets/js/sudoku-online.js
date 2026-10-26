import {markSudokuError,clearSudokuError} from './sudoku-feedback-v29-1.js?v=29.1.0';
import {createSudokuGrid,paintSudokuGrid,sudokuEntryConflict,sudokuKey} from './sudoku-grid.js';
import {SUDOKU_PEERS} from './engines/sudoku-core.js';
const $=id=>document.getElementById(id),show=(id,value)=>$(id).hidden=!value;
const read=key=>{try{return localStorage.getItem(key)||'';}catch{return '';}},write=(key,value)=>{try{localStorage.setItem(key,value);}catch{}},remove=key=>{try{localStorage.removeItem(key);}catch{}};
const session=()=>read('bs_social_session'),owner=()=>window.BS_CAREER?.account?.()||session().split('.')[0]||'guest';
const sessionKey=()=> 'tahdia-sudoku-room-v22:'+owner(),notesKey=()=>sessionKey()+':notes';
const difficulty=['سهل','متوسط','صعب','خبير','ماستر'];
let socket=null,state=null,seat=null,version=0,clock=null,retry=null,retries=0,offset=0,pending=null,cells=[],pads=[],notes=Array(81).fill(0),selected=0,pencil=false,gridRound='',lastPing=0,initialOwner=owner(),celebratedRound='';
// 32.1.0: the same feedback as the solo game: a wrong number stays red until it is changed,
// with the red pulse, the buzzer and the shake; a right one glows and completed lines light up.
let wrongCells=new Map(),wrongRound='';
function cellFx(node,cls){if(!node)return;node.classList.remove(cls);void node.offsetWidth;node.classList.add(cls);setTimeout(()=>node.classList.remove(cls),800);}
function markedWrong(){if(!state?.me?.board)return[];if(wrongRound!==state.round){wrongRound=state.round;wrongCells=new Map();}return[...wrongCells].filter(([cell,value])=>state.me.board[cell]===value).map(([cell])=>cell);}
function unitsDone(cell,board,wrong){const r=Math.floor(cell/9),c=cell%9,b=Math.floor(r/3)*3+Math.floor(c/3),bad=new Set(wrong),ok=list=>list.every(i=>board[i]&&!bad.has(i)),out=[];const row=Array.from({length:9},(_,k)=>r*9+k),col=Array.from({length:9},(_,k)=>k*9+c),box=Array.from({length:9},(_,k)=>(Math.floor(b/3)*3+Math.floor(k/3))*9+(b%3)*3+k%3);for(const unit of [row,col,box])if(ok(unit))out.push(...unit);return out;}
function toast(message){$('pictureToast').textContent=message;show('pictureToast',true);clearTimeout(toast.id);toast.id=setTimeout(()=>show('pictureToast',false),3500);}
function storedSeat(){try{const v=JSON.parse(read(sessionKey()));return /^\d{6}$/.test(v?.code)&&typeof v.name==='string'?v:null;}catch{return null;}}
function remember(){if(seat)write(sessionKey(),JSON.stringify(seat));}
function saveNotes(){if(state?.round)write(notesKey(),JSON.stringify({round:state.round,notes}));}
function now(){return Date.now()+offset;}
function resetTransport(){version++;clearTimeout(retry);clearTimeout(pending?.timer);clearInterval(clock);retry=null;clock=null;pending=null;const old=socket;socket=null;if(old){old.onclose=null;old.close();}}
function send(type,data={}){if(socket?.readyState!==1){toast('انتظر رجوع الاتصال');return false;}socket.send(JSON.stringify({type,...data}));return true;}
function openEntry(){window.BS_INVITES?.set({game:'sudoku',code:'',joinable:false});window.dispatchEvent(new CustomEvent('sudoku-online-open'));resetTransport();state=null;seat=null;show('sudokuHub',false);show('sudokuPlay',false);show('sudokuOnline',true);show('soEntry',true);show('soRoom',false);document.body.classList.remove('sudoku-playing');show('soResume',Boolean(storedSeat()));history.replaceState(null,'','/sudoku?online=1');}
async function api(path,body){const result=await fetch(path,{method:body?'POST':'GET',cache:'no-store',headers:{'content-type':'application/json',...(session()?{authorization:'Bearer '+session()}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await result.json();if(!result.ok)throw Error(data.error||'تعذر الاتصال بالسيرفر');return data;}
function playerName(){return $('soName').value.trim().slice(0,20)||'لاعب';}
async function create(){const v=version;$('soCreate').disabled=true;$('soEntryStatus').textContent='نجهّز غرفتك…';try{const data=await api('/api/sudoku/rooms',{difficulty:Number($('soDifficulty').value),capacity:Number($('soCapacity').value)});if(v!==version)return;await join(data.code,{code:data.code,hostKey:data.hostKey,name:playerName()});}catch(e){if(v===version)$('soEntryStatus').textContent=e.message;}finally{$('soCreate').disabled=false;}}
async function join(code,existing=null){
  code=sudokuKey(code).trim();if(!/^\d{6}$/.test(code)){toast('اكتب رمز الغرفة من 6 أرقام');return;}
  const v=version;$('soJoin').disabled=true;$('soEntryStatus').textContent='نتحقق من الغرفة…';
  try{const data=await api('/api/sudoku/rooms/'+code+'/status');if(v!==version)return;const saved=existing||(storedSeat()?.code===code?storedSeat():null);if(!saved?.token&&(!['lobby','countdown'].includes(data.status)||data.players>=data.capacity))throw Error(data.status==='playing'?'الجولة بدأت؛ لا يمكن الدخول الآن':'الغرفة ممتلئة أو انتهت');
    resetTransport();seat=saved||{code,name:playerName()};remember();state=null;gridRound='';retries=0;initialOwner=owner();show('soEntry',false);show('soRoom',true);show('soLobby',false);show('soMatch',false);$('soCode').textContent=code;history.replaceState(null,'','/sudoku?room='+code);connect(version);
  }catch(e){if(v===version)$('soEntryStatus').textContent=e.message;}finally{$('soJoin').disabled=false;}
}
function connect(v){
  if(v!==version||!seat)return;const url=new URL('/api/sudoku/rooms/'+seat.code+'/ws',location.origin);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.searchParams.set('name',seat.name);
  const protocols=['tahdia-sudoku-v1'];if(seat.token)protocols.push('rt.'+seat.token);if(seat.hostKey)protocols.push('hk.'+seat.hostKey);if(session())protocols.push('st.'+session());
  $('soConnection').textContent='جاري الاتصال…';show('soRetry',false);
  try{socket=new WebSocket(url,protocols);}catch{schedule(v);return;}const ws=socket;
  ws.onopen=()=>{if(v!==version||socket!==ws)return;$('soConnection').textContent='● متصل';};
  ws.onmessage=e=>{if(v!==version||socket!==ws)return;let message;try{message=JSON.parse(e.data);}catch{return;}
    if(message.type==='welcome'){seat.token=message.token;seat.id=message.playerId;remember();retries=0;}
    if(message.type==='error'){if(pending?.cell!=null){window.BS_GAME_FX?.wrong?.(cells[pending.cell]?.el);markSudokuError(cells[pending.cell]?.el,window);}if(pending?.beforeNotes)notes=pending.beforeNotes;clearTimeout(pending?.timer);pending=null;toast(message.message);$('soMessage').textContent=message.message;}
    if(message.state){const incoming=message.state,previous=state,action=pending&&incoming.round===pending.round&&incoming.me?.seq>=pending.seq?pending:null;if(pending&&(incoming.me?.seq>=pending.seq||incoming.status!=='playing'||incoming.round!==pending.round||pending.resync)){if(incoming.me?.seq<pending.seq&&pending.beforeNotes)notes=pending.beforeNotes;else $('soMessage').textContent='إدخالك محفوظ في الغرفة.';clearTimeout(pending.timer);pending=null;}state=incoming;offset=state.serverNow-Date.now();render();if(action?.value&&Number.isInteger(action.cell)){const before=previous?.players.find(p=>p.id===seat.id)?.correct||0,after=state.players.find(p=>p.id===seat.id)?.correct||0,missed=(state.me?.mistakes||0)>(previous?.me?.mistakes||0),kind=missed?'wrong':after>before?'right':'wrong',node=cells[action.cell]?.el;if(kind==='wrong'){wrongCells.set(action.cell,action.value);paint();cellFx(node,'fx-wrong');cellFx($('soBoard'),'fx-shake');markSudokuError(node,window);const left=Math.max(0,(state.maxMistakes||5)-(state.me.mistakes||0));$('soMessage').textContent=state.me.eliminatedAt?'انتهت فرصك الخمس. تقدر تتابع ترتيب الجولة.':'رقم خاطئ. '+(left===1?'بقيت لك فرصة واحدة.':left===2?'بقيت لك فرصتان.':'بقي لك '+left+' فرص.');}else{wrongCells.delete(action.cell);clearSudokuError(node,window);cellFx(node,'fx-right');window.BS_AUDIO?.play?.('correct');window.BS_AUDIO?.vibrate?.(14);$('soMessage').textContent='إجابة صحيحة!';for(const i of new Set(unitsDone(action.cell,state.me.board,markedWrong())))if(i!==action.cell)cellFx(cells[i]?.el,'fx-done');}window.BS_GAME_FX?.sudoku?.(cells,state.me.board,action.cell,kind);if(kind==='right')window.BS_GAME_FX?.progress?.($('soBoard'),after,state.total,'الخانات الصحيحة');}}
  };
  ws.onclose=e=>{if(v!==version||socket!==ws)return;if(pending?.beforeNotes)notes=pending.beforeNotes;clearTimeout(pending?.timer);pending=null;paint();$('soConnection').textContent=e.code===4001?'الغرفة مفتوحة في نافذة أخرى':e.code===4000?'انتهت صلاحية الغرفة':'انقطع الاتصال؛ نحاول العودة';if(e.code!==4001&&e.code!==4000&&e.code!==4002)schedule(v);else show('soRetry',false);};
  ws.onerror=()=>{if(v===version)$('soConnection').textContent='تعذر الاتصال؛ تحقق من الشبكة';};
}
function schedule(v){clearTimeout(retry);if(v!==version)return;if(++retries>6){$('soConnection').textContent='تعذر الرجوع. أعد المحاولة أو ارجع للمدخل.';show('soRetry',true);return;}retry=setTimeout(()=>connect(v),Math.min(8000,700*2**(retries-1)));}
function renderRoster(target,ranking=false){
  target.replaceChildren();for(const p of state.players){const item=document.createElement('li'),badge=document.createElement('span'),main=document.createElement('div'),name=document.createElement('b'),detail=document.createElement('small'),score=document.createElement('strong');
    item.className='sudoku-player'+(p.id===seat.id?' is-me':'')+(p.eliminatedAt?' is-eliminated':'');badge.className='sudoku-player-mark';badge.textContent=ranking?p.rank:String(p.name).slice(0,1);name.textContent=p.name+(p.id===seat.id?' (أنت)':'');detail.textContent=(p.role==='host'?'المضيف · ':'')+(p.connected?'متصل':'انقطع الاتصال')+(p.eliminatedAt?' · خرج من الجولة':'');main.append(name,detail);if(ranking){const mistakes=document.createElement('small');mistakes.className='sudoku-mistakes';mistakes.textContent='أخطاء '+(p.mistakes||0)+' / '+(state.maxMistakes||5);main.append(mistakes);}score.textContent=ranking?Math.round(p.correct/Math.max(1,state.total)*100)+'%':p.connected?'●':'○';item.append(badge,main,score);target.append(item);
  }
}
function buildBoard(){
  cells=createSudokuGrid($('soBoard'),{select:i=>{if(state.status!=='playing')return;selected=i;paint();cells[i].el.focus();},key:keyboard});
  $('soPad').replaceChildren();pads=Array.from({length:9},(_,i)=>{const b=document.createElement('button'),n=document.createElement('b'),count=document.createElement('small');b.type='button';n.textContent=i+1;b.setAttribute('aria-label','أدخل الرقم '+(i+1));b.append(n,count);b.onclick=()=>enter(i+1);$('soPad').append(b);return {b,count};});
}
function paint(){
  if(!state?.me?.board?.length||!cells.length)return;
  const disabled=state.status!=='playing'||Boolean(state.me.eliminatedAt)||socket?.readyState!==1||Boolean(pending);
  paintSudokuGrid(cells,{board:state.me.board,initial:state.initial,notes,selected,checked:markedWrong(),disabled:state.status!=='playing'});
  if(pending?.cell!=null)cells[pending.cell].el.classList.add('waiting');
  pads.forEach(({b,count},i)=>{count.textContent=Math.max(0,9-state.me.board.filter(n=>n===i+1).length)+' متبقي';b.disabled=disabled;});
  $('soErase').disabled=disabled;$('soNotes').disabled=state.status!=='playing'||Boolean(state.me.eliminatedAt);$('soUndo').disabled=disabled||!state.me.canUndo;
  $('soFilled').textContent=state.me.board.filter(Boolean).length+' / 81';const me=state.players.find(p=>p.id===seat.id);$('soPlace').textContent='ترتيبك '+(me?.rank||'—');
}
function render(){
  window.BS_INVITES?.set({game:'sudoku',code:seat.code,joinable:['lobby','countdown'].includes(state.status)});
  const lobby=['lobby','countdown'].includes(state.status),host=state.players.find(p=>p.id===seat.id)?.role==='host';
  show('soLobby',lobby);show('soMatch',!lobby);document.body.classList.toggle('sudoku-playing',!lobby);
  renderRoster($('soRoster'));$('soPlayerCount').textContent=state.players.length+' / '+state.capacity;
  $('soRoomDifficulty').value=state.difficulty;$('soRoomCapacity').value=state.capacity;
  $('soRoomDifficulty').disabled=!host||state.status!=='lobby';$('soRoomCapacity').disabled=!host||state.status!=='lobby';
  show('soSettings',host&&state.status==='lobby');show('soStart',host&&state.status==='lobby');show('soCancel',host&&state.status==='countdown');
  $('soLobbyStatus').textContent=host?'أنت المضيف. اختر الإعدادات ثم ابدأ العد.':'المضيف يحدد الإعدادات ويبدأ العد التنازلي.';
  if(lobby){$('soLobbyTitle').textContent=state.status==='countdown'?'قرّبنا… استعد للتحدّي.':'الكل جاهز للتحدّي؟';$('soLobbyCopy').textContent=state.status==='countdown'?'الدخول ما زال مفتوحًا حتى نهاية العد. نفس اللغز يظهر للجميع عند الصفر.':'شارك الرمز، اختر الصعوبة، ثم ابدأ العد التنازلي.';}
  else{
    if(gridRound!==state.round){gridRound=state.round;notes=Array(81).fill(0);try{const stored=JSON.parse(read(notesKey()));if(stored.round===gridRound&&stored.notes.length===81&&stored.notes.every(n=>Number.isInteger(n)&&n>=0&&n<=511))notes=stored.notes;}catch{}selected=state.initial.findIndex(n=>!n);pencil=false;$('soNotes').setAttribute('aria-pressed','false');buildBoard();$('soMessage').textContent='اختر خانة ثم رقمًا. أول حل صحيح يكسب التحدّي.';}
    notes=notes.map((n,i)=>state.me.board[i]?0:n);paint();renderRoster($('soRanking'),true);$('soMatchTier').textContent=difficulty[state.difficulty-1]+' · '+state.players.length+' لاعبين';const max=state.maxMistakes||5,mistakes=state.me.mistakes||0,left=Math.max(0,max-mistakes),lives=$('soLives');lives.querySelector('b').textContent=('♥ '.repeat(left)+'♡ '.repeat(mistakes)).trim();lives.querySelector('small').textContent=state.me.eliminatedAt?'خرجت من الجولة بعد الخطأ الخامس':`باقي ${left} من ${max} · بعد الخطأ الخامس تخرج من الجولة`;lives.classList.toggle('is-danger',left===1);lives.classList.toggle('is-out',Boolean(state.me.eliminatedAt));show('soEliminated',Boolean(state.me.eliminatedAt)&&state.status==='playing');if(state.me.eliminatedAt)$('soMessage').textContent='انتهت فرصك الخمس. تقدر تتابع ترتيب الجولة.';
    show('soResult',state.status==='finished');show('soRematch',host&&state.status==='finished');
    if(state.status==='finished'){const winner=state.players.find(p=>p.id===state.winnerId);$('soResultTitle').textContent=winner?(winner.id===seat.id?'أنت صاحب الحل. أحسنت!':'فاز '+winner.name):state.me.eliminatedAt?'انتهت الجولة بعد نفاد المحاولات':'انتهى الوقت بالتعادل';$('soResultCopy').textContent=winner?.finishedAt?'اكتمل الحل الصحيح في '+format(winner.finishedAt-state.startsAt)+'.':winner?'تصدّر بعدد الخانات الصحيحة.':'لا يوجد فائز منفرد في هذه الجولة.';if(celebratedRound!==state.round){celebratedRound=state.round;window.BS_GAME_FX?.celebrate?.(winner?.name||'تعادل',{key:'sudoku:'+state.round,self:winner?.id===seat.id,tie:!winner,subtitle:winner?.finishedAt?'أكمل شبكة السودوكو كاملة.':'حسم الجولة بأفضل تقدم صحيح.'});}}
    saveNotes();
  }
  clearInterval(clock);clock=setInterval(tick,250);tick();
}
function format(ms){const n=Math.max(0,Math.ceil(ms/1000));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
function tick(){if(!state)return;if(state.status==='countdown'){const left=Math.max(0,Math.ceil((state.startsAt-now())/1000));$('soCountdown').textContent=left;$('soCountdownCopy').textContent=left?'ثانية ونبدأ':'نجهّز اللوحة…';if(!left&&Date.now()-lastPing>3000){lastPing=Date.now();send('ping');}}else if(state.status==='lobby'){$('soCountdown').textContent='10';$('soCountdownCopy').textContent='ثوانٍ للاستعداد';}else{$('soTime').textContent=format(state.status==='finished'?state.deadline-state.finishedAt:state.deadline-now());if(state.status==='playing'&&now()>=state.deadline&&Date.now()-lastPing>3000){lastPing=Date.now();send('ping');}}}
function move(type,data={}){
  if(!state||state.status!=='playing'||state.me?.eliminatedAt||pending||socket?.readyState!==1)return false;
  const round=state.round,seq=state.me.seq+1;pending={seq,round,beforeNotes:notes.slice(),...data};
  pending.timer=setTimeout(()=>{if(pending?.seq!==seq)return;pending.resync=true;send('ping');$('soMessage').textContent='نتحقق من وصول آخر إدخال…';},4500);
  send(type,{...data,round,seq});paint();return true;
}
function enter(value){
  if(!state||state.status!=='playing'||state.me?.eliminatedAt||pending||socket?.readyState!==1)return;
  if(state.initial[selected])return toast('الرقم ثابت؛ اختر خانة قابلة للتعديل');
  if(pencil&&value){if(state.me.board[selected])return toast('امسح الرقم قبل تدوين الاحتمالات');notes[selected]^=1<<(value-1);saveNotes();paint();return;}
  if(!value&&!state.me.board[selected]&&notes[selected]){notes[selected]=0;saveNotes();paint();return;}
  if(state.me.board[selected]===value)return;
  if(sudokuEntryConflict(state.me.board,state.initial,selected,value)){markSudokuError(cells[selected]?.el,window);return toast('الرقم موجود في الصف أو العمود أو المربع؛ لم نغيّر الخانة');}
  if(move('move',{cell:selected,value})){$('soMessage').textContent='إدخالك يُحفظ في الغرفة…';if(value)for(const i of SUDOKU_PEERS[selected])notes[i]&=~(1<<(value-1));saveNotes();}
}
function toggleNotes(){pencil=!pencil;$('soNotes').setAttribute('aria-pressed',String(pencil));$('soMessage').textContent=pencil?'وضع القلم: دوّن احتمالاتك.':'وضع إدخال الأرقام.';}
function keyboard(e,cell){const key=sudokuKey(e.key);let next=cell;const r=Math.floor(cell/9),c=cell%9;if(key==='ArrowLeft')next=r*9+Math.max(0,c-1);else if(key==='ArrowRight')next=r*9+Math.min(8,c+1);else if(key==='ArrowUp')next=Math.max(0,r-1)*9+c;else if(key==='ArrowDown')next=Math.min(8,r+1)*9+c;else if(/^[1-9]$/.test(key)){e.preventDefault();enter(+key);return;}else if(['0','Delete','Backspace'].includes(key)){e.preventDefault();enter(0);return;}else if(key.toLowerCase()==='n'){e.preventDefault();toggleNotes();return;}else if((e.ctrlKey||e.metaKey)&&key.toLowerCase()==='z'){e.preventDefault();move('undo');return;}else return;e.preventDefault();selected=next;paint();cells[selected]?.el.focus();}
function leave(){saveNotes();if(['lobby','finished'].includes(state?.status)){send('leave');remove(sessionKey());}resetTransport();openEntry();}
$('sudokuOnlineLaunch').onclick=openEntry;$('soCreate').onclick=create;$('soJoin').onclick=()=>join($('soCodeInput').value);$('soCodeInput').onkeydown=e=>{if(e.key==='Enter')join($('soCodeInput').value);};$('soResume').onclick=()=>{const old=storedSeat();if(old)join(old.code,old);};$('soRetry').onclick=()=>{resetTransport();retries=0;connect(version);};$('soLeave').onclick=leave;
$('soHome').onclick=()=>{if(state)leave();else resetTransport();show('sudokuOnline',false);show('sudokuHub',true);document.body.classList.remove('sudoku-playing');history.replaceState(null,'','/sudoku');};
$('soSettings').onclick=()=>send('settings',{difficulty:Number($('soRoomDifficulty').value),capacity:Number($('soRoomCapacity').value)});$('soStart').onclick=()=>send('start',{difficulty:Number($('soRoomDifficulty').value),capacity:Number($('soRoomCapacity').value)});$('soCancel').onclick=()=>send('cancel');$('soRematch').onclick=()=>send('rematch');$('soNotes').onclick=toggleNotes;$('soErase').onclick=()=>enter(0);$('soUndo').onclick=()=>move('undo');
$('soCopy').onclick=async()=>{if(window.BS_INVITES){window.BS_INVITES.open();return;}try{await navigator.clipboard.writeText(new URL('/sudoku?room='+seat.code,location.origin).href);toast('تم نسخ رابط الدعوة');}catch{toast('رمز الغرفة: '+seat.code);}};
window.addEventListener('bs-social-session',()=>{if(owner()!==initialOwner){resetTransport();state=null;seat=null;initialOwner=owner();if(!$('sudokuOnline').hidden)openEntry();}});
window.addEventListener('pagehide',()=>{saveNotes();resetTransport();});window.addEventListener('pageshow',e=>{if(e.persisted&&seat){retries=0;connect(version);}});window.addEventListener('online',()=>{if(seat&&socket?.readyState!==1){clearTimeout(retry);retries=0;connect(version);}});document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state){tick();if(socket?.readyState===1)send('ping');else{clearTimeout(retry);connect(version);}}});
const params=new URLSearchParams(location.search);$('soName').value=window.BS_SOCIAL?.accountName?.()||window.BS_PARTY_LINK?.name||window.BS_CAREER?.get?.()?.name||'';if(params.has('room')||params.get('online')==='1'){openEntry();if(params.has('room')){const invitedRoom=sudokuKey(params.get('room')).trim();$('soCodeInput').value=invitedRoom;if(/^\d{6}$/.test(invitedRoom))join(invitedRoom);else $('soEntryStatus').textContent='رابط الغرفة غير صالح؛ اكتب الرمز الصحيح.';}}
