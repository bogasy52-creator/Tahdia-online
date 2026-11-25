import {COLOR_PALETTE,createColorTable,playColorTable,publicColorTable,chooseColorMove,colorTimeout,isColorState} from './engines/color-tables-v33-14.js?v=33.15.0';
import {createTable} from './board-table-v33.js?v=33.19.0';
const $=id=>document.getElementById(id),symbols=['▲','★','✚','◆','☾','⬡'];
const titles={bluff:'خدعة الألوان',vault:'خزنة الألوان'},rules={bluff:'شوف لون حجرك سرًا، أعلن لونًا، وخلّ خصمك يختار: أصدقك أو أتحداك. ثلاث جولات، والكل يكمل للنهاية.',vault:'احفظ أماكن الألوان. كل إصابة تزيد مكاسب دورك؛ ثبّتها أو أكمل. الغلطة تضيّع مكاسب الدور غير المثبتة. ثلاث جولات أو نفاد القطع.'};
const KEY='bs-color-practice-v33-14';let mode=new URLSearchParams(location.search).get('mode')==='vault'?'vault':'bluff';
let state=null,room=null,local=null,kind=null,waiting=false,online=false,animating=false,viewEpoch=0,botTimer=0,deadline=0,handoff=-1,ack=-1,lastEvent=-1,revealUntil=0,recorded=false,pausedRemaining=null,rosterKey='',boardKey='',matchKey='';
const palette=c=>COLOR_PALETTE[c],colorName=c=>palette(c)?.name||'مخفي',make=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n;};
const now=()=>kind==='online'?(Number(room?.serverNow)||Date.now())+Date.now()-(Number(room?.clientReceivedAt)||Date.now()):Date.now();
const mySeat=()=>kind==='online'?(room?.me?.index??-1):kind==='pass'?(local?.turn??0):0;
const openLook=()=>state?.mode==='vault'&&state.seq===0&&now()<state.lookUntil;
const mine=()=>state&&state.winner===null&&state.turn===mySeat()&&!waiting&&!animating&&!openLook()&&(kind!=='online'||online)&&(kind!=='pass'||ack===state.seq);
function readTraining(){
  try{const saved=JSON.parse(sessionStorage.getItem(KEY)||'null'),s=saved?.state;
    if(!Number.isFinite(saved?.savedAt)||!isColorState(s)||s.winner!==null||!Array.isArray(s.players)||s.players.length<2||s.players.length>6||!Number.isSafeInteger(s.seq)||Date.now()-saved.savedAt>1800000||saved.savedAt>Date.now()+30000)return null;
    return saved;
  }catch{return null;}
}
function resumeButton(){$('ctResume').hidden=!readTraining();}
function save(){try{if(local)sessionStorage.setItem(KEY,JSON.stringify({state:local,kind,level:$('ctLevel').value,savedAt:Date.now(),remainingMs:pausedRemaining??Math.max(0,deadline-Date.now())}));}catch{}resumeButton();}
function resetView(){lastEvent=-1;rosterKey='';boardKey='';revealUntil=0;$('ctEvent').textContent='';$('ctResolution').hidden=true;}
function setMode(value,force=false){
  if(!force&&kind==='online'&&room)return;
  mode=value==='vault'?'vault':'bluff';$('ctTitle').textContent=titles[mode];$('ctIntro').textContent=mode==='bluff'?'تعرف الحقيقة. هل تقدر تخدع اللي قدامك؟':'تذكّر المكان. اجمع الكنز. واعرف متى توقف.';$('ctRule').textContent=rules[mode];
  document.querySelectorAll('[data-color-mode]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.colorMode===mode));b.disabled=kind==='online'&&Boolean(room);});table?.menu.setMode?.(mode);
}
function menu(keepRoom=false){
  viewEpoch++;animating=false;clearTimeout(botTimer);state=null;waiting=false;local=null;pausedRemaining=null;kind=keepRoom?'online':null;if(!keepRoom){room=null;matchKey='';}
  $('game').classList.add('hidden');$('setup').hidden=false;$('ctCurtain').hidden=true;document.querySelector('main').inert=false;document.body.classList.remove('game-running');
  document.querySelectorAll('[data-color-mode]').forEach(b=>b.disabled=keepRoom);resumeButton();
}
function show(){event();clearTimeout(botTimer);$('setup').hidden=true;$('game').classList.remove('hidden');document.body.classList.add('game-running');$('ctGameName').textContent=titles[state.mode];$('ctBluff').hidden=state.mode!=='bluff';$('ctVault').hidden=state.mode!=='vault';render();schedule();}
function refreshLocal(remainingMs){state=publicColorTable(local,mySeat(),Date.now());deadline=Number.isFinite(remainingMs)?Date.now()+Math.max(0,Math.min(15000,remainingMs)):Math.max(Date.now(),local.lookUntil)+10_000;save();show();}
function startLocal(){window.BS_AUDIO?.unlock?.();table.leave();resetView();kind=$('ctLocal').value==='pass'?'pass':'ai';room=null;online=false;recorded=false;ack=-1;lastEvent=-1;handoff=-1;const n=Number($('ctCount').value),name=window.BS_CAREER?.get?.().name||'أنت';local=createColorTable(Array.from({length:n},(_,i)=>i===0?name:['نورة','فهد','ريم','ماجد','سارة'][i-1]),{mode,now:Date.now()});refreshLocal();}
function action(type,payload={}){
  if(!mine())return;
  window.BS_AUDIO?.unlock?.();
  if(kind==='online'){waiting=true;render();if(!table.send(type,{seq:state.seq,...payload})){waiting=false;render();}return;}
  try{const previous=local.turn;local=playColorTable(local,local.turn,{type,seq:local.seq,...payload},{now:Date.now()});ack=kind==='pass'&&local.turn===previous?local.seq:-1;refreshLocal();}catch(error){window.BS_PLATFORM?.toast?.(error.message);}
}
function schedule(){
  clearTimeout(botTimer);if(!local||kind==='online'||local.winner!==null||document.hidden)return;
  if(kind==='ai'&&local.turn!==0)botTimer=setTimeout(()=>{
    const move=chooseColorMove(local,$('ctLevel').value);local=playColorTable(local,local.turn,move,{now:Math.max(Date.now(),local.lookUntil)});refreshLocal();
  },Math.max(950,local.lookUntil-Date.now()+100,local.last?.ms||0));
}
function curtain(){
  const needed=kind==='pass'&&state.winner===null&&ack!==state.seq&&(!openLook()||document.hidden);
  $('ctCurtain').hidden=!needed;document.querySelector('main').inert=needed;
  if(needed){$('ctPrivate').hidden=true;$('ctSecret').textContent='';$('ctHandoffName').textContent='دور '+state.players[state.turn].name;if(handoff!==state.seq){handoff=state.seq;$('ctReveal').focus();}}
}
function render(){
  if(!state)return;
  const active=mine(),looking=openLook();$('ctRound').textContent='الجولة '+Math.min(3,Math.floor(state.turnNo/state.players.length)+1)+' من 3';
  const roster=$('ctRoster');roster.style.setProperty('--seats',state.players.length);const rk=JSON.stringify([state.turn,state.winner,state.players.map(p=>[p.name,p.score]),room?.players?.map(p=>p.look)]);if(rk!==rosterKey){rosterKey=rk;roster.replaceChildren(...state.players.map((p,i)=>{const card=make('div','ct-player'+(state.winner===null&&i===state.turn?' active':''));const face=make('span','bs-avatar',String(p.name).slice(0,1)),look=room?.players?.find(x=>x.index===i)?.look||{},url=window.BS_CAREER_CORE?.heroFace?.(look.character);if(url){const image=make('img');image.src=url;image.alt='';image.width=32;image.height=32;face.replaceChildren(image);}if(look.frame)window.BS_LEGEND_FRAMES?.decorateAvatar?.(face,look.frame);card.dataset.playerTag=i;card.append(face,make('b','',p.name),make('strong','',p.score));card.setAttribute('aria-label',p.name+'، '+p.score+' نقاط'+(i===state.turn?'، صاحب الدور':''));return card;}));}
  $('status').textContent=state.winner!==null?'اكتملت المباراة':looking?'احفظ الألوان قبل إخفائها':waiting?'جاري تأكيد الحركة…':kind==='online'&&!online?'جاري إعادة الاتصال…':(active?'دورك':'دور '+state.players[state.turn].name)+' • '+({claim:'اختر اللون الذي تعلنه',answer:'تصدّق أو تتحدّى؟',roll:'ارمِ نرد الألوان',pick:'اختر القطعة المطابقة',decide:'ثبّت مكاسبك أو أكمل'}[state.phase]||'');
  if(state.mode==='bluff'){
    const secret=Number.isInteger(state.secretColor)&&state.sender===mySeat()&&state.winner===null;
    $('ctPrivate').hidden=!secret;$('ctSecret').textContent=secret?symbols[state.secretColor]+' '+colorName(state.secretColor):'';$('ctSecret').style.setProperty('--color',secret?palette(state.secretColor).hex:'#fff');
    $('ctClaim').textContent=state.phase==='answer'?state.players[state.sender].name+' يقول: '+symbols[state.claim]+' '+colorName(state.claim):state.winner!==null?'من عرف يخدع ومن كشف الخدعة؟':'الحقيقة عند صاحب الحجر';
    $('ctColors').hidden=state.phase!=='claim'||state.turn!==mySeat();$('ctAnswer').hidden=state.phase!=='answer'||state.turn!==mySeat();for(const b of [...$('ctColors').children,...$('ctAnswer').children])b.disabled=!active;
    const revealed=state.last?.type==='reveal'&&(animating||state.winner!==null);$('ctCapsule').classList.toggle('is-revealed',revealed);$('ctCapsuleSymbol').textContent=revealed?symbols[state.last.color]:'?';$('ctCapsule').style.setProperty('--color',revealed?palette(state.last.color).hex:'#fff');
  }else{
    $('ctPending').textContent=state.pending;$('ctDie').textContent=Number.isInteger(state.die)?symbols[state.die]:'?';$('ctDie').style.setProperty('--color',palette(state.die)?.hex||'#60417c');$('ctDie').setAttribute('aria-label','لون النرد: '+colorName(state.die));
    $('ctLook').textContent=looking?'احفظ • '+Math.max(0,Math.ceil((state.lookUntil-now())/1000))+' ثوانٍ':'النقاط المثبتة تبقى لك؛ الخطأ يخسرك مكاسب هذا الدور فقط';
    const bk=JSON.stringify([active,looking,state.phase,state.pegs,state.last?.seq,Date.now()<revealUntil]);if(bk!==boardKey){boardKey=bk;$('ctBoard').replaceChildren(...state.pegs.map((p,i)=>{const last=state.last?.type==='pick'&&state.last.peg===i&&Date.now()<revealUntil;const c=looking?p.c:last?state.last.color:-1;const shown=c>=0;const b=make('button','ct-stone'+(shown?' is-open':'')+(p.taken!==null?' is-taken':''));b.type='button';b.disabled=!active||state.phase!=='pick'||p.taken!==null;b.style.setProperty('--color',shown?palette(c).hex:'#ead6b3');b.setAttribute('aria-label','قطعة '+(i+1)+(p.taken!==null?'، جُمعت':shown?'، '+colorName(c):'، مخفية'));b.append(make('span','',p.taken!==null?'✓':shown?symbols[c]:'?'),make('small','',i+1));b.addEventListener('click',()=>action('color_pick',{peg:i}));return b;}));}
    for(const [id,phase]of[['ctRoll','roll'],['ctBank','decide'],['ctContinue','decide']]){$(id).hidden=state.phase!==phase;$(id).disabled=!active;}
  }
  const result=state.last?.type==='reveal'?state.last:null;$('ctResolution').hidden=!result;if(result){$('ctResolvedColor').textContent=symbols[result.color];$('ctResolvedColor').style.setProperty('--color',palette(result.color).hex);$('ctResolvedTitle').textContent=(result.honest?'كان صادقًا':'انكشفت الخدعة')+' • '+colorName(result.color);$('ctResolvedDetail').textContent=state.players[result.winner].name+' +'+result.points+' • نتيجة الحجر السابق';}
  $('ctResult').hidden=state.winner===null;
  if(state.winner!==null){$('ctWinner').textContent=state.ties.length>1?'تعادل جميل!':'التاج لـ '+state.players[state.winner].name;$('ctRanks').replaceChildren(...state.players.map((p,i)=>({...p,i})).sort((a,b)=>b.score-a.score).map(p=>{const li=make('li');li.append(make('b','',p.name),make('span','',p.score+' نقاط'));return li;}));const h=state.highlights?.at(-1);$('ctHighlight').textContent=h?'أقوى خدعة • '+state.players[h.sender].name+' قال '+colorName(h.claim)+' والحجر '+colorName(h.color):'جولة جديدة، وقرارات جديدة.';
    if(local&&!recorded){recorded=true;window.BS_CAREER?.record?.({id:'color:'+local.startedAt,game:'pegs',win:state.ties.length===1&&state.winner===0,score:state.players[0].score}).catch?.(()=>{});}}
  curtain();
}
function event(){
  if(!state?.last||state.last.seq===lastEvent)return;lastEvent=state.last.seq;revealUntil=Date.now()+1600;
  const e=state.last,n=i=>state.players[i]?.name||'لاعب';
  $('ctEvent').textContent=e.type==='reveal'?(e.honest?'كان صادقًا! ':'انكشفت الخدعة! ')+n(e.winner)+' +'+e.points+' • اللون '+colorName(e.color):e.type==='bank'?n(e.seat)+' ثبّت '+e.points+' نقاط':e.type==='pick'?e.ok?'إصابة! '+(e.banked?'ثُبّتت آخر المكاسب':'كمّل أو ثبّت مكاسبك'):'اللون '+colorName(e.color)+' • ضاعت '+e.lost+' نقاط مؤقتة':e.type==='timeout'?'انتهى وقت الدور':e.type==='claim'?'وصل الحجر… القرار عندك':e.type==='continue'?'المجازفة مستمرة':'لون النرد: '+colorName(e.color);
  window.BS_AUDIO?.play?.(e.type==='reveal'||e.type==='pick'?(e.winner===mySeat()||e.ok?'correct':'reveal'):e.type==='bank'?'reward':e.type==='roll'?'dice':'card',{volume:.65});
  setTimeout(()=>{if(state&&state.last?.seq===lastEvent)render();},1650);
}
function accept(next){
  if(!isColorState(next.state)){const target=new URL(location.href);target.pathname='/pegs';target.searchParams.set('room',next.code);location.replace(target.pathname+target.search+target.hash);return;}
  const key=next.code+':'+(next.startedAt||0);if(key!==matchKey){resetView();matchKey=key;}kind='online';local=null;room=next;state=next.state;waiting=false;online=true;mode=state.mode;event();show();
}
const table=createTable({game:'pegs',page:'/colorbluff',title:'تحديات الألوان',modes:[{id:'bluff',label:'خدعة الألوان'},{id:'vault',label:'خزنة الألوان'}],seats:[2,3,4,5,6],seatsDefault:2,
  apply:async(next,{animate,signal}={})=>{const epoch=++viewEpoch;animating=Boolean(animate&&['reveal','pick','bank'].includes(next.state?.last?.type));accept(next);if(animating)await new Promise(resolve=>{let timer;const done=()=>{clearTimeout(timer);signal?.removeEventListener('abort',done);resolve();};if(signal?.aborted)return done();timer=setTimeout(done,Math.min(1600,next.state.last.ms||0));signal?.addEventListener('abort',done,{once:true});});if(epoch===viewEpoch){animating=false;render();}},onLobby:next=>{if(!['bluff','vault'].includes(next.variant)){const target=new URL(location.href);target.pathname='/pegs';target.searchParams.set('room',next.code);location.replace(target.pathname+target.search+target.hash);return;}room=next;menu(true);setMode(next.variant,true);},onMenu:menu,
  onResync:()=>{viewEpoch++;animating=false;waiting=false;},onStatus:s=>{online=Boolean(s.online);$('ctNetwork').hidden=online||kind!=='online';$('ctNetwork').textContent=s.text||'جاري إعادة الاتصال…';render();},onError:message=>{waiting=false;window.BS_PLATFORM?.toast?.(message);render();}});
for(let c=0;c<6;c++){const b=make('button');b.style.setProperty('--color',palette(c).hex);b.append(make('i','',symbols[c]),document.createTextNode(colorName(c)));b.onclick=()=>action('color_claim',{color:c});$('ctColors').append(b);}
document.querySelectorAll('[data-color-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.colorMode));
document.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>action('color_answer',{answer:b.dataset.answer}));
$('ctStart').onclick=startLocal;$('ctRoll').onclick=()=>action('color_roll');$('ctBank').onclick=()=>action('color_bank');$('ctContinue').onclick=()=>action('color_continue');
$('ctReveal').onclick=()=>{ack=state.seq;deadline=Date.now()+10_000;render();};
$('ctExit').onclick=()=>{if(kind==='online'){table.leave();}else{save();local=null;menu();}};
$('ctAgain').onclick=()=>{if(kind==='online')table.again();else startLocal();};
$('ctResume').onclick=()=>{
  const saved=readTraining();if(!saved){resumeButton();return;}
  table.leave();resetView();kind=saved.kind==='pass'?'pass':'ai';local=saved.state;setMode(local.mode);$('ctLevel').value=saved.level||'medium';ack=-1;recorded=false;refreshLocal(saved.remainingMs);
};
resumeButton();
setInterval(()=>{if(!state||document.hidden)return;if(kind!=='online')$('turnTimer').textContent=state.winner===null&&!openLook()&&(kind!=='pass'||ack===state.seq)?Math.max(0,Math.ceil((deadline-Date.now())/1000))+'ث':'';if(openLook()){render();return;}if(local&&state.seq===0&&state.mode==='vault')render();if(local&&local.winner===null&&(kind!=='pass'||ack===local.seq)&&local.turn===mySeat()&&Date.now()>=deadline){local=colorTimeout(local,{now:Date.now()});ack=-1;refreshLocal();}const t=$('ctLook');if(t&&state.mode==='vault'&&state.seq===0&&now()>=state.lookUntil)render();},300);
function pauseLocal(){if(local&&pausedRemaining===null)pausedRemaining=Math.max(0,deadline-Date.now());clearTimeout(botTimer);if(kind==='pass'&&state){ack=-1;$('ctPrivate').hidden=true;$('ctSecret').textContent='';curtain();}save();}
function continueLocal(){if(local&&pausedRemaining!==null){deadline=Date.now()+pausedRemaining;pausedRemaining=null;}render();schedule();}
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseLocal();else continueLocal();});
window.addEventListener('pagehide',pauseLocal);window.addEventListener('pageshow',continueLocal);
setMode(mode);
window.BS_COLOR_TABLE=Object.freeze({action,get state(){return state;},get mode(){return kind;}});
