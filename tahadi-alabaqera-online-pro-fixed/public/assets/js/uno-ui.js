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
    const value = MARKS[card.face] || (/^[0-9]$/.test(card.face) ? card.face : '?');
    const wild = card.color === 'wild';
    const center = wild
      ? '<g transform="translate(42 58) rotate(-25)"><path d="M0 0V-25A25 25 0 0 1 25 0Z" fill="#ef6970"/><path d="M0 0H25A25 25 0 0 1 0 25Z" fill="#efbe5a"/><path d="M0 0V25A25 25 0 0 1-25 0Z" fill="#40b395"/><path d="M0 0H-25A25 25 0 0 1 0-25Z" fill="#689be2"/></g>'
      : '<ellipse cx="42" cy="58" rx="27" ry="42" transform="rotate(28 42 58)" fill="#fff8e9" opacity=".94"/><text x="42" y="72" fill="'+color+'" font-size="'+(value.length>1?29:45)+'" font-weight="900" text-anchor="middle" font-family="Arial,sans-serif">'+value+'</text>';
    return '<svg viewBox="0 0 84 120" aria-hidden="true" direction="ltr"><rect x="1" y="1" width="82" height="118" rx="11" fill="#fff4dd"/><rect x="5" y="5" width="74" height="110" rx="8" fill="'+color+'"/><path d="M8 89 76 31M8 95 76 37" stroke="#ffffff" opacity=".10" stroke-width="2"/>'+center+'<g fill="#fff7e6" font-family="Arial,sans-serif" font-weight="900" font-size="15"><text x="12" y="24">'+value+'</text><text x="12" y="24" transform="rotate(180 42 60)">'+value+'</text></g><path d="M8 108h10M66 12h10" stroke="#fff7e6" stroke-width="1.5" opacity=".8"/></svg>';
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
