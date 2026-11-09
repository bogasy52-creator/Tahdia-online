/* Tahdia 33.0.0 — one online flow for the four table games (السلم والثعبان،
   الزهرة، جاكارو، تحدي النرد). Every match is online: «العب الحين» seats you at
   a public table that starts ten seconds after it opened, a friends' room
   starts with whoever came, and bots of every strength take the empty seats.
   This module owns the room: the menu, the lobby, the connection, the steps to
   play one by one, and what happens after the match. The page only draws the
   game (`apply`) and sends its moves (`send`). */
import {BoardOnlineClient,createStepPlayer,bindRoomCountdown} from './board-online.js?v=33.8.0-gameplay3';

const QUICK_SEATS={snakes:4,zahra:4,jackaroo:4,dice:3};

export function createTable({game,modes=null,seats=null,seatsDefault,quickNote,roomNote,lobbyNote,apply,onLobby,onMenu,onStatus,onError}={}){
  const $=selector=>document.querySelector(selector);
  const menuHost=$('#gameMenu');
  let client=null,room=null,quickMode=null,quickSeats=null,leaving=false,retriedQuick=false;
  const player=createStepPlayer(async(next,{animate,signal})=>{
    if(signal?.aborted)return;
    room=next;window.BS_HERO_FX?.frame(next);
    if(next.status==='lobby'){
      onLobby?.(next);
      menu.lobby(lobbyModel(next));
      window.BS_GAME_MENU?.remember(game,next.code,{status:'lobby'});
      return;
    }
    window.BS_GAME_MENU?.remember(game,next.code,{status:next.status==='finished'?'finished':'playing'});
    await apply(next,{animate,signal});
    if(!signal?.aborted){clockOf(next);nearWin(next);}
  },{maxBacklog:game==='snakes'?5:14,onError:error=>console.error('table state failed',error)});

  const menu=window.BS_GAME_MENU.mount(menuHost,{
    game,modes,seats,seatsDefault,quickNote,roomNote,
    onQuick:async({mode,seats:count})=>{quickMode=mode;quickSeats=count||null;retriedQuick=false;connect();await client.quick(menu.name(),{variant:mode||'classic',seats:count||null});window.BS_AUDIO?.play?.('join');},
    onCreate:async({mode,seats:count})=>{quickMode=null;connect();await client.create(menu.name(),0,{variant:mode||'classic',seats:count||null});window.BS_AUDIO?.play?.('join');},
    onJoin:async({code})=>{quickMode=null;connect();await client.join(code,menu.name());window.BS_AUDIO?.play?.('join');},
    onResume:async({code})=>{quickMode=null;connect();await client.join(code,menu.name());}
  });
  const stopTimer=bindRoomCountdown($('#turnTimer'),()=>room?.status==='playing'&&room.turnDeadline?room:null);
  // 33.7.0: the room clock sits in the turn line («دورك …»), big and the same in every game
  const clock=window.BS_CLOCK?.attach($('#status'));
  function clockOf(next){
    if(!clock)return;
    const s=next.state;
    if(next.stepOf||next.status!=='playing'||!next.turnDeadline||!s||s.winner!=null||s.winnerTeam!=null){clock.clear();return;}
    const base=Number(next.serverNow)||Date.now(),got=Number(next.clientReceivedAt)||Date.now(),seat=s.turn,mine=seat===next.me?.index;
    const who=(next.players||[]).find(p=>p.index===seat);
    clock.set({end:Number(next.turnDeadline),total:Number(next.turnTotal)||0,clock:()=>base+(Date.now()-got),mine,key:next.code+':'+next.turnDeadline,label:mine?'دورك':who?'دور '+who.name:''});
  }
  // 33.7.0: one step from winning: a heartbeat for everybody else, a gold note for the player
  function nearWin(next){
    const s=next.state;if(!window.BS_CLOCK||next.stepOf||next.status!=='playing'||!s?.players)return;
    const me=next.me?.index,tag=game+':'+next.code+':'+(next.startedAt||0)+':',name=i=>(next.players||[]).find(p=>p.index===i)?.name||'لاعب';
    const say=(key,mine,text)=>window.BS_CLOCK.alert(tag+key,text,{tone:mine?'mine':'rival'});
    if(game==='snakes')s.players.forEach((p,i)=>{const at=Number(p.position)||0;if(at>=94&&at<100)say(i,i===me,i===me?'قربت! أنت على '+at+' وباقي لك رمية وتوصل 100':name(i)+' على '+at+' — قريب من 100!');});
    if(game==='zahra'){const finish=(s.players.length>4?6:4)*(s.arm||13)+(s.home==='fill'?3:4);s.players.forEach((p,i)=>{const done=(p.tokens||[]).filter(t=>t===finish).length;if(done===(p.tokens||[]).length-1&&done>0)say(i,i===me,i===me?'قربت تفوز! باقي لك حجر واحد':name(i)+' باقي له حجر واحد ويفوز!');});}
    if(game==='jackaroo'){const seats=s.players.length>4?6:4,track=seats*(s.arm||13),home=m=>s.home==='fill'?m>=track:m===track+4;
      for(const team of [0,1]){const ms=s.players.filter((_,i)=>i%2===team).flatMap(p=>p.marbles||[]),done=ms.filter(home).length;if(ms.length&&done===ms.length-1){const ours=me!=null&&me%2===team;say('team'+team,ours,ours?'قربتوا تفوزون! باقي لفريقك كرة وحدة':'الفريق الثاني باقي له كرة وحدة ويفوز!');}}}
    if(game==='dice'){const target=Number(s.target)||50;s.players.forEach((p,i)=>{const score=Number(p.score)||0;if(score<target&&score>=Math.ceil(target*.8))say(i,i===me,i===me?'قربت! عندك '+score+' من '+target:name(i)+' وصل '+score+' من '+target+'!');});}
  }

  function connect(){
    leaving=false;client?.close();player.reset();room=null;
    client=new BoardOnlineClient(game,{
      onState:next=>player.push(next),
      onStatus:status=>onStatus?.(status),
      onError:message=>{
        // a public table that started before we got in: find the next one
        if(quickMode!==null&&!retriedQuick&&!room&&/بدأت|ممتلئة|انتهت/.test(message)){retriedQuick=true;setTimeout(()=>menu.busy(false),0);client.quick(menu.name(),{variant:quickMode||'classic',seats:quickSeats}).catch(()=>{});return;}
        onError?.(message);
      }
    });
    return client;
  }
  function lobbyModel(next){
    const people=(next.players||[]).filter(p=>!p.bot);
    const host=next.me?.role==='host'&&!next.publicMatch;
    // a table the group room (الجمعة) opened: it starts by itself when its players are in
    const party=next.party?.first?next.party:null;
    if(party)return {
      code:next.code,isPublic:true,deadline:next.lobbyDeadline,ringSeconds:30,serverNow:next.serverNow,receivedAt:next.clientReceivedAt,
      seats:party.expected,variant:next.variant,openSeat:['بانتظار لاعب','من الجمعة'],
      title:'طاولتك في الجمعة',
      note:'نبدأ أول ما يوصل أصحاب طاولتك ('+people.length+' من '+party.expected+'). إذا تأخر أحد نبدأ بعد العد بمنافس إضافي.',
      players:people.map(p=>({name:p.name,host:false,me:p.id===next.me?.id,connected:p.connected})),
      canStart:false,onLeave:()=>leave()
    };
    return {
      code:next.code,isPublic:Boolean(next.publicMatch),deadline:next.lobbyDeadline,serverNow:next.serverNow,receivedAt:next.clientReceivedAt,
      seats:next.publicMatch?(next.tableSeats||QUICK_SEATS[game]):0,variant:next.variant,
      title:next.publicMatch?'نجمع اللاعبين':'غرفتك جاهزة',
      note:next.publicMatch?(lobbyNote?.(next,true)||'تبدأ بعد العد وتكتمل المقاعد بمنافسين متنوعي المستوى.'):(lobbyNote?.(next,false)||'أرسل الرمز لأصحابك. تبدأ بمن حضر، وتكتمل الطاولة تلقائيًا.'),
      players:people.map(p=>({name:p.name,host:p.role==='host'&&!next.publicMatch,me:p.id===next.me?.id,connected:p.connected})),
      canStart:host,startDisabled:people.some(p=>!p.connected),startLabel:people.length>1?'ابدأ المباراة':'ابدأ المباراة',
      waitingText:'بانتظار المضيف يبدأ المباراة',
      onStart:()=>client?.send('start'),
      onLeave:()=>leave()
    };
  }
  function leave(){
    leaving=true;
    if(room?.code)window.BS_GAME_MENU?.forget(game,room.code);
    client?.close();client=null;room=null;player.reset();
    menu.menu();onMenu?.();
  }
  /** After a match: a friends' room goes back to its lobby (the host decides);
      a public table is over, so «جولة جديدة» finds the next one. */
  async function again(){
    if(!room)return;
    if(room.publicMatch){
      const mode=room.variant||quickMode||'classic';
      leave();menu.setMode?.(mode);quickMode=mode;retriedQuick=false;connect();
      try{await client.quick(menu.name(),{variant:mode});}catch(error){window.BS_PLATFORM?.toast?.(error.message);menu.menu();}
      return;
    }
    if(room.me?.role==='host')client?.send('rematch');
    else window.BS_PLATFORM?.toast?.('المضيف يبدأ الجولة الجديدة');
  }
  // 33.7.0: a tap on a player (a row of the list, a face on the board) opens that player's card
  function openCard(event){
    if(!room?.players||!window.BS_PLAYER_CARD||event.target.closest?.('button,a,input'))return;
    const tag=event.target.closest?.('[data-player-tag]'),row=tag?null:event.target.closest?.('#players > *');
    if(!tag&&!row)return;
    const seat=tag?Number(tag.dataset.playerTag):[...row.parentElement.children].indexOf(row);
    const p=room.players.find(x=>x.index===seat);if(!p)return;
    if(event.type==='keydown'){if(event.key!=='Enter'&&event.key!==' ')return;event.preventDefault();}
    const color=row?.style.getPropertyValue('--seat')||row?.style.getPropertyValue('--pc')||'';
    window.BS_PLAYER_CARD.open({name:p.name,username:p.username,character:p.look?.character||p.character,bot:p.bot,level:p.level,me:seat===room.me?.index,color:color.trim()});
  }
  document.addEventListener('click',openCard);
  document.addEventListener('keydown',event=>{if(event.target.closest?.('[data-player-tag]'))openCard(event);});
  // a room code in the address (an invite, the party, «ارجع لمباراتك»)
  const invited=new URLSearchParams(location.search).get('room');
  if(/^\d{6}$/.test(invited||'')){
    connect();
    client.join(invited,menu.name()).then(()=>window.BS_AUDIO?.play?.('join')).catch(error=>{menu.menu();menu.say(error.message,true);window.BS_PLATFORM?.toast?.(error.message);});
  }
  window.addEventListener('pagehide',()=>{client?.close();});
  return {
    get room(){return room;},
    get client(){return client;},
    get me(){return room?.me?.index;},
    get isPublic(){return Boolean(room?.publicMatch);},
    get busy(){return player.busy;},
    send(type,payload){return Boolean(client?.send(type,payload));},
    again,leave,menu,
    destroy(){stopTimer?.();clock?.destroy();client?.close();}
  };
}

/* Each seat's look from the shop (dice, stone, character), with the free ones
   for anyone the room does not know. */
export function seatLook(room,seat){
  const id=room?.order?.[seat];
  const p=(room?.players||[]).find(x=>x.index===seat)||(room?.players||[])[seat];
  const look=p?.look||{};
  return {dice:look.dice||'dice-ivory',pawn:look.pawn||'pawn-classic',character:look.character||'fox',bot:Boolean(p?.bot),level:p?.level||null,name:p?.name||'',id};
}
export const BOT_LEVEL_NAMES=Object.freeze({easy:'سهل',medium:'متوسط',hard:'صعب'});
/** Keep the shared renderer API; player rows use names without extra badges. */
export function botTag(){ return null; }
/* Gives a die the skin of a shop item (the 3D die reads it, and the CSS cube its colours). */
export function skinDie(el,id){
  if(!el)return;
  const skin=id||'dice-ivory';
  if(el.dataset.diceSkin===skin)return;
  el.dataset.diceSkin=skin;
  const styles=window.BS_CAREER_CORE?.COSMETIC_STYLES?.[skin]||{};
  for(const name of ['--die-color','--die-highlight','--die-shade','--die-pip','--die-pip-light','--die-edge','--die-radius','--die-pip-radius'])el.style.removeProperty(name);
  for(const [name,value] of Object.entries(styles))el.style.setProperty(name,value);
  try{el.__die3d?.set?.(Number(el.dataset.value)||1);}catch{}
}
