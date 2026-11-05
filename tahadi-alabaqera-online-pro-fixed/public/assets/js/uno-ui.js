/* A full-screen card table. Inputs always go through the room's action handler. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const make = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const COLORS = {red:'#e85158',gold:'#e8b34b',green:'#309e85',blue:'#4c8bd1',wild:'#354761'};
  const NAMES = {red:'أحمر',gold:'أصفر',green:'أخضر',blue:'أزرق',wild:'تغيير اللون'};
  const LABELS = {skip:'منع',reverse:'عكس',draw2:'اسحب ورقتين',wild:'غيّر اللون',draw4:'اسحب أربع'};
  const MARKS = {skip:'⊘',reverse:'⇄',draw2:'+2',wild:'◇',draw4:'+4'};
  const MODES = {classic:'كلاسيكي',stack:'سحب متراكم',quick:'جولة سريعة'};
  const POSITIONS = [[11,46],[50,12],[89,46],[25,20],[75,20],[11,74],[89,74]];
  let match = null, hooks = null, mounted = false, paused = false, armed = false;
  let selected = null, handKey = '', topKey = '', seen = -1, resultKey = '', winnerActor = null, dockObserver = null;
  let dom = null;
  const rivals = new Map();
  const me = () => match?.players.find(p => p.id === hooks.me);
  const text = (node,value) => { if (node.textContent !== value) node.textContent = value; };
  const sound = name => { if (!document.hidden) window.BS_AUDIO?.play?.(name); };

  function faceSVG(card) {
    const color = COLORS[card.color] || COLORS.wild;
    const mark = MARKS[card.face] || (/^[0-9]$/.test(card.face) ? card.face : '?');
    const id = 'uno-art-' + String(card.id).replace(/[^a-z0-9]/gi,'');
    const eyes = '<g class="uo-eyes" fill="#172c39"><ellipse cx="36" cy="43" rx="2.6" ry="3.7"/><ellipse cx="48" cy="43" rx="2.6" ry="3.7"/><circle cx="35.3" cy="41.8" r=".9" fill="white"/><circle cx="47.3" cy="41.8" r=".9" fill="white"/></g><path d="M37 51Q42 56 47 51" fill="none" stroke="#172c39" stroke-width="2" stroke-linecap="round"/>';
    const portrait = {
      red:'<path d="M23 51C18 36 28 35 27 24l10 9 8-16 7 16 9-7c7 18 4 34-16 36Z" fill="#ffe2a3" stroke="#fff4d4" stroke-width="1.2"/>',
      gold:'<path d="m42 18 6 10 12-3-3 12 11 7-11 6 3 12-12-3-6 10-6-10-12 3 3-12-11-6 11-7-3-12 12 3Z" fill="#fff1af" stroke="#fff9db" stroke-width="1.1"/>',
      green:'<path d="M23 50C17 29 38 25 61 22c5 24-4 43-24 41Z" fill="#c9f2bb" stroke="#efffe0" stroke-width="1.3"/><path d="M30 63q12-16 25-31" stroke="#7abe83" stroke-width="2" fill="none"/>',
      blue:'<path d="M20 51q-5-13 8-22 10-7 19-2 14-5 18 9 6 13-6 22-19 16-39-7Z" fill="#c9f2ff" stroke="#effdff" stroke-width="1.4"/><path d="M21 53q-8-6-10 1l9 7" fill="#a0e3fb"/>',
      wild:'<path d="M21 36q20-22 42 0l-3 21q-18 11-36 0Z" fill="#fff0c4"/><path d="M21 37 33 33l9 11 10-11 11 4-3 8-9 4-9-5-10 5-10-4Z" fill="#d686c4"/>',
    };
    let scene;
    if(card.face==='draw2'||card.face==='draw4'){
      const four=card.face==='draw4';
      const tints=four?['#f57c83','#ffd578','#7dd8ac','#8fc7fb']:['#fff0c8','#fff0c8'];
      scene='<g class="uo-burst"><path d="m42 22 6 9 12-2-3 11 9 7-10 5 2 12-11-3-7 10-5-10-12 2 3-12-10-7 11-5-1-10 10 3Z" fill="#ffffff" opacity=".19"/></g>';
      scene+=tints.map((t,i)=>'<g transform="translate(42 47) rotate('+((i-(tints.length-1)/2)*19)+')"><rect x="-10" y="-19" width="20" height="30" rx="4" fill="'+t+'" stroke="#fff9df" stroke-width="1.5"/><path d="M-5-10H5M-5-5H5" stroke="#243647" stroke-width="1.8"/></g>').join('');
      scene+='<text x="42" y="97" fill="#fff4d7" stroke="#182c45" stroke-width=".9" paint-order="stroke" text-anchor="middle" font-family="Arial,sans-serif" font-size="29" font-weight="900">'+mark+'</text>';
    }else if(card.face==='reverse'){
      scene='<g class="uo-burst" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 51a22 22 0 0 1 38-14l-1-10m1 10-11-1" stroke="#fff4d4" stroke-width="5"/><path d="M63 60a22 22 0 0 1-38 14l1 10m-1-10 11 1" stroke="#bcf0e4" stroke-width="5"/></g><circle cx="42" cy="57" r="12" fill="#fff0c4"/><path d="M35 56h2m10 0h2M37 62q5 4 10 0" stroke="#243344" stroke-width="2.1" stroke-linecap="round" fill="none"/>';
    }else if(card.face==='skip'){
      scene='<path d="M42 24 63 32v24q0 19-21 29-21-10-21-29V32Z" fill="#fff1d1"/><circle cx="42" cy="53" r="16" fill="none" stroke="'+color+'" stroke-width="5"/><path d="m30 65 24-24" stroke="'+color+'" stroke-width="5" stroke-linecap="round"/><path d="m17 28-5-5m55 5 5-5M14 75l-5 4m61-4 5 4" stroke="#ffe3a6" stroke-width="2" stroke-linecap="round"/>';
    }else{
      scene='<g class="uo-hero">'+(portrait[card.color]||portrait.wild)+eyes+'</g>';
      scene+='<text x="42" y="100" fill="#fff4d7" stroke="#17304b" stroke-width=".85" paint-order="stroke" text-anchor="middle" font-family="Arial,sans-serif" font-size="'+(card.color==='wild'?28:40)+'" font-weight="900">'+mark+'</text>';
    }
    return '<svg viewBox="0 0 84 120" aria-hidden="true" direction="ltr"><defs><linearGradient id="'+id+'" x2=".8" y2="1"><stop stop-color="'+color+'"/><stop offset="1" stop-color="#18324a"/></linearGradient></defs><rect x="1" y="1" width="82" height="118" rx="11" fill="#fff2da"/><rect x="5" y="5" width="74" height="110" rx="8" fill="url(#'+id+')"/><path d="M7 70 76 8M8 91 77 29M8 103 77 41" stroke="#ffffff" stroke-width="1" opacity=".12"/><circle cx="66" cy="78" r="18" fill="#ffffff" opacity=".035"/>'+scene+'<g fill="#fff6df" font-family="Arial,sans-serif" font-weight="900" font-size="13"><text x="11" y="21">'+mark+'</text><text x="11" y="21" transform="rotate(180 42 60)">'+mark+'</text></g><path d="M8 108h10m48-96h10" stroke="#fff1c7" stroke-width="1.4" opacity=".65"/></svg>';
  }

  function cardNode(card, cls = '') {
    const node = make('button','uno-card '+cls);
    node.type = 'button';
    node.dataset.card = card.id;
    node.dataset.color = card.color;
    node.setAttribute('aria-label', (LABELS[card.face] || card.face)+' · '+NAMES[card.color]);
    node.innerHTML = faceSVG(card);
    return node;
  }
  function action(label, cls, fn) {
    const button = make('button',cls,label);
    button.type = 'button'; button.addEventListener('click',fn);
    return button;
  }
  function mount() {
    const table = make('div','uno-table');
    const heading = make('div','uno-table-heading');
    heading.append(make('b','','أونو'),make('small','uno-mode'));
    const meter = make('div','uno-turn-clock');
    meter.append(make('small','','وقت الدور'),make('b','uno-seconds','30'));
    const clockbar = make('i','uno-clock-bar');
    meter.append(clockbar);
    const seats = make('div','uno-seats');
    const center = make('div','uno-center');
    const stock = action('','uno-stock',() => send('draw'));
    stock.setAttribute('aria-label','اسحب ورقة');
    const back = make('span','uno-card-back');
    back.append(make('b','','UNO'),make('small','','بوسراج'));
    const stockCount = make('small','uno-stock-count');
    stock.append(back,stockCount);
    const discard = make('div','uno-discard');
    const middle = make('div','uno-piles'); middle.append(stock,discard);
    const direction = make('div','uno-direction');
    const tint = make('span','uno-color');
    const turn = make('b','uno-turn-name');
    direction.append(tint,turn);
    const feed = make('p','uno-feed');
    feed.setAttribute('aria-live','polite');
    center.append(middle,direction,feed);
    const status = make('div','uno-status');
    status.setAttribute('role','status');
    table.append(heading,meter,seats,center,status);
    const picker = make('div','uno-picker');
    picker.hidden = true;
    picker.setAttribute('role','dialog'); picker.setAttribute('aria-modal','true');
    picker.setAttribute('aria-label','اختيار اللون');
    const choice = make('div','uno-picker-card');
    const buttons = make('div','uno-colors');
    for (const color of ['red','gold','green','blue']) {
      const button = action(NAMES[color],'uno-color-choice',() => play(selected,color));
      button.style.setProperty('--color',COLORS[color]); buttons.append(button);
    }
    choice.append(make('b','','اللون لك'),make('small','','اختر لون الجولة القادم'),buttons,action('إلغاء','uno-picker-close',closePicker));
    picker.append(choice);table.append(picker);
    const dock = make('div','uno-dock');
    const top = make('div','uno-dock-top');
    const own = make('b','uno-own-name');
    const draw = action('اسحب','uno-draw',() => send('draw'));
    const pass = action('مرّر','uno-pass',() => send('pass'));
    const uno = action('UNO!','uno-call',callUno);
    const catchButton = action('مسكته! نسي أونو','uno-catch',() => send('catch'));
    pass.hidden = true; catchButton.hidden = true;
    top.append(own,draw,pass,uno,catchButton);
    const hand = make('div','uno-hand');
    hand.setAttribute('aria-label','أوراقك');
    dock.append(top,hand);
    table.append(dock);
    $('chBoard').className = 'ch-board ch-uno';
    $('chBoard').replaceChildren(table);
    $('chControls').replaceChildren(); $('chTactics').replaceChildren();
    dom = {table,seats,stock,stockCount,discard,tint,turn,feed,status,picker,hand,own,draw,pass,uno,catchButton,
      seconds:meter.querySelector('.uno-seconds'),bar:clockbar,mode:heading.querySelector('small')};
    mounted = true;
    const fitDock = () => table.style.setProperty('--uno-dock-height',(dock.getBoundingClientRect?.().height||141)+'px');
    if(typeof ResizeObserver!=='undefined'){dockObserver=new ResizeObserver(fitDock);dockObserver.observe(dock);}
    fitDock();
  }
  function closePicker() {
    selected = null;
    if (dom) dom.picker.hidden = true;
  }
  function send(type) {
    if (!match || match.phase !== 'playing' || paused) return;
    hooks.act({type});
  }
  function play(card, color) {
    if (!card || !match.uno.legal.includes(card.id) || paused || match.phase !== 'playing') return;
    if (card.color === 'wild' && !color) {
      selected = card; dom.picker.hidden = false;
      dom.picker.querySelector('button')?.focus(); return;
    }
    const called = armed;
    closePicker();
    if (hooks.act({type:'play',card:card.id,color,uno:called}) !== false) armed = false;
  }
  function callUno() {
    const u = match.uno, player = me();
    if (u.missed === player.slot) { send('uno'); return; }
    if (u.hand.length !== 2 || u.turn !== player.slot) return;
    armed = !armed; tick(match,{...hooks,paused});
  }
  function render(m,next) {
    if (!m.uno) return;
    match=m; hooks=next;
    if (!mounted) mount();
    const u=m.uno, player=me();
    if (!player) return;
    if (selected && (!u.legal.includes(selected.id) || m.phase !== 'playing')) closePicker();
    if (u.hand.length !== 2) armed=false;
    text(dom.mode,MODES[u.mode]||'كلاسيكي');
    text(dom.own,player.name+' · '+u.hand.length+' أوراق');
    const order=m.players.filter(p=>p.id!==player.id).sort((a,b)=>(a.slot-player.slot+m.players.length)%m.players.length-(b.slot-player.slot+m.players.length)%m.players.length);
    for(const [i,p] of order.entries()) {
      let seat=rivals.get(p.id);
      if(!seat) {
        seat=make('div','uno-rival');seat.dataset.player=p.id;
        const backs=make('div','uno-mini-hand');
        for(let k=0;k<3;k++)backs.append(make('i'));
        seat.append(backs,make('b','uno-rival-name',p.name),make('small','uno-rival-count'));
        rivals.set(p.id,seat);dom.seats.append(seat);
      }
      const [x,y]=POSITIONS[i%POSITIONS.length];
      seat.style.setProperty('--x',x+'%');seat.style.setProperty('--y',y+'%');
      seat.classList.toggle('active',u.turn===p.slot);
      seat.classList.toggle('last-card',u.counts[p.slot]===1);
      text(seat.querySelector('.uno-rival-count'),u.counts[p.slot]===1?'UNO · ورقة واحدة':u.counts[p.slot]+' أوراق');
    }
    const key=u.hand.map(c=>c.id).join(',')+'|'+u.legal.join(',');
    if(handKey!==key) {
      handKey=key;
      dom.hand.style.setProperty('--cols',String(Math.min(7,Math.max(1,u.hand.length))));
      dom.hand.replaceChildren(...u.hand.map(card=>{
        const node=cardNode(card,'uno-hand-card');
        node.addEventListener('click',()=>play(card));
        node.classList.toggle('playable',u.legal.includes(card.id));
        return node;
      }));
    }
    if(topKey!==u.top.id) {
      topKey=u.top.id;
      const top=cardNode(u.top,'uno-top-card');top.disabled=true;
      dom.discard.replaceChildren(top);
    }
    text(dom.stockCount,u.stock+' ورقة');
    text(dom.tint,NAMES[u.color]);
    dom.tint.style.setProperty('--color',COLORS[u.color]);
    text(dom.turn,u.direction===1?'الدور مع عقارب الساعة':'الدور عكس الساعة');
    text(dom.feed,u.event?.text||'');
    if(u.event?.id!==seen) {
      if(seen>=0) sound(u.event.kind==='play'?'card':u.event.kind==='draw'?'deal':u.event.kind==='finish'?'win':'select');
      seen=u.event?.id;
    }
    tick(m,{...next,paused});
  }
  function tick(m,next) {
    if(!mounted||!m.uno)return;
    paused=!!next.paused;
    const u=m.uno, player=m.players.find(p=>p.id===next.me);
    if(!player)return;
    const active=m.phase==='playing'&&!paused, myTurn=u.turn===player.slot;
    const left=Math.max(0,Math.ceil((u.deadline-next.now())/1000));
    text(dom.seconds,String(left));
    dom.bar.style.setProperty('--left',Math.min(100,left/30*100)+'%');
    dom.table.classList.toggle('my-turn',active&&myTurn);
    text(dom.status,m.phase==='finished'?'انتهت الجولة':paused?'اللعب متوقف':myTurn?(u.pending?'عليك سحب '+u.pending+' أو تراكم بنفس الرمز':u.drawn?'العب الورقة المسحوبة أو مرّر':'دورك · اختر ورقة مضيئة'):'دور '+m.players[u.turn].name);
    dom.stock.disabled=dom.draw.disabled=!active||!myTurn||!!u.drawn;
    text(dom.draw,u.pending?'اسحب '+u.pending:'اسحب ورقة');
    dom.pass.hidden=!u.drawn;dom.pass.disabled=!active||!myTurn;
    dom.uno.disabled=!active||!(u.missed===player.slot||myTurn&&u.hand.length===2);
    dom.uno.classList.toggle('armed',armed);
    dom.uno.setAttribute('aria-pressed',String(armed));
    text(dom.uno,armed?'UNO جاهز!':'UNO!');
    dom.catchButton.hidden=u.missed===null||u.missed===player.slot;
    dom.catchButton.disabled=!active;
    for(const node of dom.hand.children)node.disabled=!active||!myTurn||!u.legal.includes(node.dataset.card);
  }
  function podium(m,id) {
    const area=$('unoRecap');
    const key=m.seed+':'+m.startedAt;
    if(!area||resultKey===key)return;
    resultKey=key;
    const winner=m.players.find(p=>m.winners.includes(p.id));
    const portrait=make('div','uno-winner');
    if(winner&&window.BS_CHARACTERS) {
      winnerActor=window.BS_CHARACTERS.actor(winner.hero,{piece:true,staticIdle:true});
      portrait.append(winnerActor);
      window.BS_CHARACTERS.setState(winnerActor,'win',{returnIdle:false});
    }
    const rows=make('div','uno-final-rows');
    for(const p of [...m.players].sort((a,b)=>b.score-a.score)) {
      const row=make('div','uno-final-row');
      row.classList.toggle('self',p.id===id);
      row.append(make('b','',p.name),make('span','',m.winners.includes(p.id)?'الفائز':m.uno.counts[p.slot]+' أوراق متبقية'));
      rows.append(row);
    }
    area.replaceChildren(portrait,rows);
  }
  function clear() {
    dockObserver?.disconnect();dockObserver=null;
    if(winnerActor)window.BS_CHARACTERS?.dispose?.(winnerActor);
    winnerActor=null;mounted=false;match=null;hooks=null;dom=null;paused=false;armed=false;
    selected=null;handKey='';topKey='';seen=-1;resultKey='';rivals.clear();
    $('unoRecap')?.replaceChildren();
  }
  window.BS_UNO={render,tick,podium,clear};
})();
