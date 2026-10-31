/* Tahdia 33.0.0 — one game menu for every online game.
   A game shows the same three things: how to play (only when it has modes),
   «العب الحين» (a public table that starts after ten seconds, bots fill the
   empty seats) and «غرفة مع أصحابك» (make a room, or type any room code — the
   code says which game it belongs to, so a code from another game opens that
   game). The name comes from the account, or the guest's own name.
   The same module draws the room lobby, the online friends to invite, and
   remembers the match you are in so the home page can bring you back. */
(function(root){
  'use strict';
  if(root.BS_GAME_MENU)return;
  const doc=root.document;
  const TITLES=Object.freeze({quiz:'تحدي الأسئلة',party:'الألعاب الجماعية',sudoku:'سودوكو',paths:'توصيل الأرقام',picture:'سباق الصور',serpent:'حلبة الثعابين',snakes:'الثعبان والسلالم',zahra:'الزهرة',jackaroo:'جاكارو',dice:'تحدي النرد',baloot:'بلوت',memory:'الذاكرة',logic:'الألغاز',puzzle:'تركيب الصور',reaction:'مواجهة التركيز',labyrinth:'سباق المتاهة',focus:'مواجهة التركيز',cipher:'شفرة الخصم',patterns:'صائد الأنماط',survival:'ساحة البقاء',jewels:'ماستر الجواهر',colors:'توصيل الأرقام'});
  // the first two digits of a room code name its game (src/rooms/room-codes.js)
  const FAMILIES=Object.freeze([['quiz',10,14,'/online'],['party',15,19,'/party'],['sudoku',20,24,'/sudoku'],['paths',25,29,'/paths-online'],['picture',30,34,'/picture'],['serpent',35,39,'/serpent'],['snakes',40,44,'/snakes'],['zahra',45,49,'/zahra'],['jackaroo',50,54,'/jackaroo'],['dice',55,59,'/dice'],['baloot',60,64,'/baloot'],['memory',65,69,'/memory'],['logic',70,74,'/logic'],['puzzle',75,79,'/puzzle'],['reaction',80,84,'/reaction'],['jewels',85,89,'/journey?game=jewels'],['colors',90,94,'/paths-online?mode=solo'],['labyrinth',95,95,'/labyrinth'],['focus',96,96,'/focus'],['cipher',97,97,'/cipher'],['patterns',98,98,'/patterns'],['survival',99,99,'/survival']]);
  const LAST_KEY='bs-last-match-v33',NAME_KEY='bs-player-name-v33',MODE_KEY=game=>'bs-mode-v33-'+game;
  const store={get(key){try{return localStorage.getItem(key)}catch{return null}},set(key,value){try{localStorage.setItem(key,value)}catch{}},remove(key){try{localStorage.removeItem(key)}catch{}}};

  /* ---------- codes ---------- */
  function normalizeCode(value){
    const digits=String(value??'').normalize('NFKC').replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/\D/g,'');
    return /^\d{6}$/.test(digits)?digits:'';
  }
  function gameOfCode(code){const prefix=Number(String(code||'').slice(0,2));const row=FAMILIES.find(([,from,to])=>prefix>=from&&prefix<=to);return row?row[0]:null;}
  function pageOf(game){return FAMILIES.find(row=>row[0]===game)?.[3]||null;}
  function roomUrl(game,code){const page=pageOf(game);if(!page)return null;return page+(page.includes('?')?'&':'?')+'room='+code;}
  /** Asks the server which game a code belongs to: {game,page}, null when no room has it,
      or undefined when the server could not be asked (old server, network). */
  async function resolve(code){
    code=normalizeCode(code);if(!code)return null;
    let response;
    try{response=await fetch('/api/rooms/resolve/'+code,{cache:'no-store',signal:AbortSignal.timeout?.(9000)});}catch{return undefined;}
    // a server from before 33.0.0 has no resolver and answers «not_found» for the route itself
    if(response.status===404){const data=await response.json().catch(()=>({}));return data?.found===false?null:undefined;}
    if(!response.ok)return undefined;
    const data=await response.json().catch(()=>null);
    return data?.ok&&data.game?{game:data.game,page:pageOf(data.game)||data.page}:undefined;
  }
  /** Joins a code typed anywhere: here when it is this game's, otherwise opens its game. */
  async function joinAnywhere(raw,{game,onJoin}){
    const code=normalizeCode(raw);
    if(!code)throw new Error('رمز الغرفة 6 أرقام');
    const found=await resolve(code);
    if(found===null)throw new Error('ما لقينا غرفة مفتوحة بهذا الرمز. تأكد من الرقم.');
    const target=found?.game||(found===undefined?gameOfCode(code)||game:game);
    if(target===game||!pageOf(target)){await onJoin(code);return {game,code,here:true};}
    root.location.href=roomUrl(target,code);
    return {game:target,code,here:false};
  }

  /* ---------- the player's name ---------- */
  function accountName(){try{return root.BS_SOCIAL?.isLoggedIn?.()?String(root.BS_SOCIAL.accountName?.()||root.BS_SOCIAL.profile?.()?.displayName||''):''}catch{return ''}}
  function playerName(){
    const career=root.BS_CAREER?.get?.()?.name;
    const name=accountName()||root.BS_PARTY_LINK?.name||store.get(NAME_KEY)||(career&&career!=='لاعب العباقرة'?career:'')||'لاعب';
    return String(name).replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,20)||'لاعب';
  }
  function setGuestName(name){const clean=String(name||'').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,20);if(clean)store.set(NAME_KEY,clean);else store.remove(NAME_KEY);return playerName();}

  /* ---------- the match you are in ---------- */
  function remember(game,code,{status='lobby',page}={}){
    if(!normalizeCode(code))return;
    store.set(LAST_KEY,JSON.stringify({game,code:String(code),status,page:page||roomUrl(game,code),at:Date.now()}));
  }
  function forget(game,code){
    const last=lastMatch(true);
    if(last&&(!code||last.code===String(code))&&(!game||last.game===game))store.remove(LAST_KEY);
  }
  function lastMatch(any=false){
    let last=null;try{last=JSON.parse(store.get(LAST_KEY)||'null')}catch{}
    if(!last||!normalizeCode(last.code)||!TITLES[last.game])return null;
    if(!any&&(Date.now()-Number(last.at||0)>3*3600_000||last.status==='finished'))return null;
    return last;
  }

  /* ---------- small DOM helpers ---------- */
  function make(tag,cls,text){const el=doc.createElement(tag);if(cls)el.className=cls;if(text!==undefined&&text!==null)el.textContent=String(text);return el;}
  function button(cls,text,onclick){const el=make('button',cls,text);el.type='button';if(onclick)el.addEventListener('click',onclick);return el;}
  const toast=text=>{try{root.BS_PLATFORM?.toast?.(text)}catch{}};
  const sound=name=>{try{root.BS_AUDIO?.play?.(name)}catch{}};
  const looks=()=>{const equipped=root.BS_CAREER?.get?.()?.equipped||{};return {dice:equipped.dice||'dice-ivory',pawn:equipped.pawn||'pawn-classic',character:equipped.character||'character-fox'};};
  const itemName=id=>root.BS_CAREER_CORE?.CATALOG?.find?.(item=>item.id===id)?.name||'';

  /* ---------- the menu ---------- */
  function mount(target,options={}){
    if(!target)throw new Error('menu_target_missing');
    const game=options.game,modes=Array.isArray(options.modes)?options.modes.filter(m=>m&&m.id):[];
    let mode=modes.length?(modes.some(m=>m.id===store.get(MODE_KEY(game)))?store.get(MODE_KEY(game)):options.mode&&modes.some(m=>m.id===options.mode)?options.mode:modes[0].id):null;
    let pending=false,view='menu',lobbyTimer=null,friendsFor='';
    const box=make('div','gm33');box.dataset.game=game||'';box.setAttribute('dir','rtl');
    target.replaceChildren(box);

    const menu=make('div','gm33-menu'),lobbyView=make('div','gm33-lobby');lobbyView.hidden=true;
    const status=make('p','gm33-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    box.append(menu,lobbyView,status);

    // how to play — only for a game that has more than one way
    let modeNote=null;
    if(modes.length>1){
      const group=make('div','gm33-modes');group.setAttribute('role','radiogroup');group.setAttribute('aria-label',options.modesLabel||'طريقة اللعب');
      for(const m of modes){
        const b=button('gm33-mode',null,()=>{if(pending)return;setMode(m.id);sound('select');});
        b.dataset.mode=m.id;b.setAttribute('role','radio');
        b.append(make('b',null,m.label));if(m.hint)b.append(make('small',null,m.hint));
        group.append(b);
      }
      modeNote=make('p','gm33-mode-note');
      menu.append(group,modeNote);
    }
    // العب الحين
    const quick=button('gm33-quick',null,()=>run(()=>options.onQuick?.({mode,name:playerName()})));
    quick.append(make('span','gm33-quick-icon','⚡'),make('b',null,options.quickLabel||'العب الحين'),make('small',null,options.quickNote||'تكتمل الطاولة خلال 10 ثوانٍ بمنافسين متنوعي المستوى'));
    if(options.onQuick)menu.append(quick);
    // غرفة مع أصحابك
    const friends=make('details','gm33-friends');
    if(options.friendsOpen)friends.open=true;
    const summary=make('summary',null);summary.append(make('span','gm33-friends-icon','👥'),make('b',null,'غرفة مع أصحابك'),make('small',null,'أنشئ غرفة أو ادخل برمز من أي لعبة'));
    const create=button('gm33-create',options.createLabel||'＋ أنشئ غرفة',()=>run(()=>options.onCreate?.({mode,name:playerName()})));
    const form=make('form','gm33-join');form.noValidate=true;
    const code=make('input');code.type='text';code.inputMode='numeric';code.maxLength=7;code.placeholder='رمز من 6 أرقام';code.autocomplete='off';code.dir='ltr';code.setAttribute('aria-label','رمز الغرفة');code.name='code';
    const join=make('button','gm33-join-btn','ادخل');join.type='submit';
    form.append(code,join);
    form.addEventListener('submit',event=>{event.preventDefault();run(()=>joinAnywhere(code.value,{game,onJoin:value=>options.onJoin?.({code:value,mode,name:playerName()})}));});
    code.addEventListener('input',()=>{const clean=String(code.value).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/\D/g,'').slice(0,6);if(clean!==code.value)code.value=clean;});
    const friendsBody=make('div','gm33-friends-body');
    if(options.onCreate)friendsBody.append(create);
    friendsBody.append(form,make('small','gm33-friends-note',options.roomNote||'الغرفة تبدأ بمن حضر، وتكتمل بقية المقاعد تلقائيًا.'));
    friends.append(summary,friendsBody);
    if(options.onCreate||options.onJoin)menu.append(friends);
    const opponents=make('details','gm33-friends gm33-opponents');
    const opponentsTitle=make('summary');
    opponentsTitle.append(make('span','gm33-friends-icon','🎮'),make('b',null,'كيف تكتمل المباراة؟'));
    const opponentsBody=make('div','gm33-friends-body');
    opponentsBody.append(make('p','gm33-friends-note','عند نقص اللاعبين، قد يكمل الكمبيوتر المقاعد الشاغرة بمنافسين متنوعي المستوى.'));
    opponents.append(opponentsTitle,opponentsBody);menu.append(opponents);
    // who you are and what you play with
    const foot=make('div','gm33-foot');
    const who=make('div','gm33-who');
    const paintWho=()=>{
      who.replaceChildren();
      const account=Boolean(accountName());
      who.append(make('span',null,'تلعب باسم '),make('b','gm33-name',playerName()));
      if(!account&&!root.BS_PARTY_LINK?.name){
        const edit=button('gm33-edit','تغيير',()=>{
          const field=make('input','gm33-name-input');field.value=playerName()==='لاعب'?'':playerName();field.maxLength=20;field.placeholder='اكتب اسمك';field.setAttribute('aria-label','اسمك في اللعب');
          const save=button('gm33-edit','حفظ',()=>{setGuestName(field.value);paintWho();});
          field.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();save.click();}if(event.key==='Escape')paintWho();});
          who.replaceChildren(field,save);field.focus();
        });
        who.append(edit);
      }else if(account)who.append(make('small','gm33-account','من حسابك'));
    };
    paintWho();
    foot.append(who);
    if(options.loadout!==false){
      const chip=make('a','gm33-loadout');chip.href=options.loadoutHref||'/shop';
      const paintChip=()=>{
        chip.replaceChildren();
        const l=looks(),parts=[];
        if(options.loadout==='cards')parts.push(itemName(root.BS_CAREER?.get?.()?.equipped?.deck)||'الورق');
        else{if(options.showDice!==false)parts.push(itemName(l.dice)||'النرد');if(options.showPawn!==false)parts.push(l.pawn==='pawn-character'?'شخصيتك '+(itemName(l.character)||''):itemName(l.pawn)||'الحجر');}
        chip.append(make('small',null,options.loadoutLabel||'من المتجر'),make('b',null,parts.filter(Boolean).join(' · ')));
      };
      paintChip();root.addEventListener?.('bs-career-change',paintChip);
      foot.append(chip);
    }
    menu.append(foot);
    // your last match, if it is still open
    const resume=make('div','gm33-resume');resume.hidden=true;menu.prepend(resume);

    function setMode(id){
      if(!modes.some(m=>m.id===id))return;
      mode=id;store.set(MODE_KEY(game),id);
      for(const b of menu.querySelectorAll('.gm33-mode')){const on=b.dataset.mode===id;b.classList.toggle('is-on',on);b.setAttribute('aria-checked',String(on));}
      if(modeNote)modeNote.textContent=modes.find(m=>m.id===id)?.note||'';
      options.onModeChange?.(id);
    }
    if(mode)setMode(mode);
    async function run(task){
      if(pending)return;
      setPending(true);say('');
      try{await task();}
      catch(error){const text=error?.message||'تعذر الاتصال. حاول مرة ثانية.';say(text,true);toast(text);sound('error');}
      finally{setPending(false);}
    }
    function setPending(value){
      pending=value;box.classList.toggle('is-pending',value);
      for(const el of box.querySelectorAll('button,input'))if(!el.closest('.gm33-lobby'))el.disabled=value;
    }
    function say(text,error=false){status.textContent=text||'';status.classList.toggle('is-error',Boolean(error&&text));}

    /* ---------- the lobby ---------- */
    function showMenu(){
      view='menu';clearInterval(lobbyTimer);lobbyTimer=null;
      lobbyView.hidden=true;lobbyView.replaceChildren();menu.hidden=false;friendsFor='';
      paintWho();checkResume();
    }
    function showLobby(model){
      view='lobby';menu.hidden=true;lobbyView.hidden=false;say('');
      clearInterval(lobbyTimer);lobbyTimer=null;
      const keepFriends=friendsFor===String(model.code)&&lobbyView.querySelector('.gm33-online-friends');
      const friendsBlock=keepFriends?lobbyView.querySelector('.gm33-online-friends'):null;
      lobbyView.replaceChildren();
      const head=make('div','gm33-lobby-head');
      if(model.isPublic){
        const total=Number(model.ringSeconds)||10;
        const ring=make('div','gm33-ring');const seconds=make('b',null,model.deadline?String(total):'…');ring.append(seconds);
        const copy=make('div');copy.append(make('h2',null,model.title||'نجمع اللاعبين'),make('p',null,model.note||'تبدأ المباراة بعد العد بمنافسين متنوعي المستوى.'));
        head.append(ring,copy);
        const paint=()=>{
          if(!model.deadline){ring.style.setProperty('--left','1');return;}
          const received=Number(model.receivedAt)||Date.now(),serverNow=(Number(model.serverNow)||received)+(Date.now()-received);
          const left=Math.max(0,Math.ceil((Number(model.deadline)-serverNow)/1000));
          seconds.textContent=String(left);ring.style.setProperty('--left',String(Math.min(1,left/total)));
          ring.classList.toggle('is-done',left===0);
        };
        paint();if(model.deadline)lobbyTimer=setInterval(paint,250);
      }else{
        const copy=make('div','gm33-code-box');
        copy.append(make('small',null,'رمز الغرفة'));
        const codeButton=button('gm33-code',String(model.code||'——————'),async()=>{try{await navigator.clipboard.writeText(String(model.code));toast('نسخنا الرمز');}catch{toast(String(model.code));}});
        codeButton.setAttribute('aria-label','نسخ رمز الغرفة '+model.code);codeButton.dir='ltr';
        copy.append(codeButton);
        const share=button('gm33-share','مشاركة',async()=>{
          const url=root.location.origin+(roomUrl(game,model.code)||root.location.pathname+'?room='+model.code);
          const text='تعال العب '+(TITLES[game]||'معي')+' في بوسراج — رمز الغرفة '+model.code;
          try{if(navigator.share){await navigator.share({title:'بوسراج',text,url});return;}}catch{return;}
          try{await navigator.clipboard.writeText(text+'\n'+url);toast('نسخنا رابط الدعوة');}catch{toast(url);}
        });
        const title=make('div','gm33-lobby-title');title.append(make('h2',null,model.title||'غرفتك جاهزة'),make('p',null,model.note||'أرسل الرمز لأصحابك. أي رمز ينكتب في أي لعبة يوصلهم هنا.'));
        head.append(title,copy,share);
      }
      lobbyView.append(head);
      // the players in the room
      const list=make('ul','gm33-players');list.setAttribute('aria-label','اللاعبون في الغرفة');
      for(const p of model.players||[]){
        const row=make('li','gm33-player'+(p.me?' is-me':'')+(p.connected===false?' is-away':''));
        row.append(make('span','gm33-avatar',(String(p.name||'؟').trim()[0]||'؟')));
        const text=make('span','gm33-player-name');text.append(make('b',null,p.name||'لاعب'));
        const tags=[p.me?'أنت':'',p.host?'المضيف':'',p.connected===false?'يعيد الاتصال':''].filter(Boolean);
        if(tags.length)text.append(make('small',null,tags.join(' · ')));
        row.append(text);list.append(row);
      }
      const empty=Math.max(0,Number(model.seats||0)-(model.players||[]).length);
      if(model.isPublic&&empty>0)for(let i=0;i<Math.min(empty,6);i++){const row=make('li','gm33-player is-open');row.append(make('span','gm33-avatar','؟'),make('span','gm33-player-name',''));row.lastChild.append(make('b',null,model.openSeat?.[0]||'مقعد فاضي'),make('small',null,model.openSeat?.[1]||'بانتظار المنافس'));list.append(row);}
      lobbyView.append(list);
      // your online friends, one tap to invite
      if(!model.isPublic&&model.code){
        if(friendsBlock)lobbyView.append(friendsBlock);
        else{friendsFor=String(model.code);lobbyView.append(onlineFriends(game,model.code,model.variant));}
      }
      const actions=make('div','gm33-lobby-actions');
      if(model.canStart){const start=button('gm33-start',model.startLabel||'ابدأ المباراة',()=>model.onStart?.());start.disabled=Boolean(model.startDisabled);actions.append(start);}
      else if(!model.isPublic)actions.append(make('p','gm33-wait',model.waitingText||'بانتظار المضيف يبدأ المباراة'));
      if(model.extra)actions.append(model.extra);
      actions.append(button('gm33-leave','خروج',()=>model.onLeave?.()));
      lobbyView.append(actions);
    }
    async function checkResume(){
      resume.hidden=true;resume.replaceChildren();
      const last=lastMatch();
      if(!last||last.game!==game||!options.onResume)return;
      const card=make('div','gm33-resume-card');
      card.append(make('span',null,'↩'),make('b',null,'عندك مباراة مفتوحة'),make('small',null,'الغرفة '+last.code));
      const back=button('gm33-resume-btn','ارجع لها',()=>run(()=>options.onResume({code:last.code,name:playerName()})));
      const drop=button('gm33-resume-drop','تجاهل',()=>{forget(game,last.code);resume.hidden=true;});
      card.append(back,drop);resume.append(card);resume.hidden=false;
    }
    checkResume();
    return {
      get mode(){return mode;},
      get view(){return view;},
      setMode,menu:showMenu,lobby:showLobby,say,
      busy:setPending,
      name:playerName,
      prefillCode(value){const clean=normalizeCode(value);if(clean){code.value=clean;friends.open=true;}},
      destroy(){clearInterval(lobbyTimer);box.remove();}
    };
  }

  /* ---------- online friends in a room lobby ---------- */
  function onlineFriends(game,code,variant){
    const block=make('div','gm33-online-friends');
    const social=root.BS_SOCIAL;
    if(!social?.isLoggedIn?.()){
      const link=make('a','gm33-friends-login','سجّل دخولك وادعُ أصحابك المتصلين بضغطة');link.href='/social?next='+encodeURIComponent(root.location.pathname+'?room='+code);
      block.append(link);return block;
    }
    block.append(make('b',null,'أصحابك المتصلون'));
    const list=make('div','gm33-friend-list');list.append(make('small','gm33-muted','نشوف مين متصل…'));block.append(list);
    const all=button('gm33-all-friends','كل الأصدقاء',()=>social.openInvitePicker?.({game,roomCode:code,variant,title:TITLES[game]}));
    block.append(all);
    const paint=async(force=false)=>{
      let data=null;try{data=await social.me?.(force);}catch{}
      const friends=(data?.friends||[]).filter(f=>f.online).slice(0,6);
      list.replaceChildren();
      if(!friends.length){list.append(make('small','gm33-muted','ما فيه أحد من أصحابك متصل الحين.'));return;}
      for(const friend of friends){
        const row=make('div','gm33-friend');row.append(make('span','gm33-dot'),make('b',null,friend.displayName||friend.username));
        const invite=button('gm33-invite','ادعُ',async()=>{invite.disabled=true;try{await social.invite?.(friend.username,game,code,variant);invite.textContent='أُرسلت ✓';sound('select');}catch(error){invite.disabled=false;toast(error?.message||'تعذر إرسال الدعوة');}});
        row.append(invite);list.append(row);
      }
    };
    paint(true);
    try{social.events?.addEventListener?.('presence',()=>{if(block.isConnected)paint(false);});}catch{}
    return block;
  }

  root.BS_GAME_MENU=Object.freeze({mount,resolve,joinAnywhere,normalizeCode,gameOfCode,pageOf,roomUrl,playerName,setGuestName,remember,forget,lastMatch,onlineFriends,TITLES});
})(typeof window!=='undefined'?window:globalThis);
