/* Tahdia 30.1.0 — live reactions for snakes, zahra and jackaroo rooms.
   The game pages are untouched: board-online.js publishes the active room
   (bs-board-room) and relays incoming reactions (bs-board-emote). */
(()=>{
  'use strict';
  if(window.__BS_BOARD_REACTIONS__)return;window.__BS_BOARD_REACTIONS__=true;
  const REACTIONS=[['clap','👏','برافو'],['fire','🔥','نار'],['laugh','😂','ضحكتني'],['wow','😮','واو'],['angry','😤','قهر'],['gg','🤝','لعب نظيف'],['luck','🍀','حظ أوفر'],['fast','⚡','بسرعة']];
  const LABEL=new Map(REACTIONS.map(([id,icon,text])=>[id,{icon,text}]));
  const COOLDOWN=1500,SHOWN_MS=2600,MAX_SHOWN=3;
  let room=null,trigger=null,panel=null,feed=null,lastSent=0;

  function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
  function mount(){
    if(trigger)return true;
    const host=document.getElementById('livebar');if(!host)return false;
    trigger=el('button','bs-react-trigger');trigger.type='button';trigger.setAttribute('aria-haspopup','true');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-label','أرسل تفاعلًا للاعبين');
    trigger.append(el('span',null,'😊'),el('b',null,'تفاعل'));
    panel=el('div','bs-react-panel');panel.id='bsReactPanel';panel.hidden=true;panel.setAttribute('role','group');panel.setAttribute('aria-label','اختر تفاعلًا');
    for(const [id,icon,text] of REACTIONS){const b=el('button','bs-react-option');b.type='button';b.dataset.emote=id;b.append(el('span',null,icon),el('small',null,text));b.addEventListener('click',()=>send(id));panel.append(b);}
    trigger.setAttribute('aria-controls',panel.id);
    trigger.addEventListener('click',()=>toggle(panel.hidden));
    host.append(trigger,panel);host.classList.add('has-reactions');
    feed=el('div','bs-react-feed');feed.setAttribute('aria-live','polite');document.body.append(feed);
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){toggle(false);trigger.focus();}});
    document.addEventListener('pointerdown',event=>{if(!panel.hidden&&!panel.contains(event.target)&&!trigger.contains(event.target))toggle(false);});
    return true;
  }
  function toggle(open){if(!panel)return;panel.hidden=!open;trigger.setAttribute('aria-expanded',String(open));if(open)panel.querySelector('button')?.focus();}
  function send(id){
    const now=Date.now();if(!room?.client||now-lastSent<COOLDOWN)return;
    if(room.client.react(id)){lastSent=now;toggle(false);trigger.focus();trigger.disabled=true;setTimeout(()=>{if(trigger)trigger.disabled=false;},COOLDOWN);}
  }
  function show(detail){
    const meta=LABEL.get(detail?.emote);if(!meta||!feed)return;
    const mine=room?.state?.me?.id&&detail.from===room.state.me.id;
    const item=el('p','bs-react-bubble'+(mine?' is-mine':''));
    item.append(el('span','bs-react-icon',meta.icon),el('b',null,mine?'أنت':String(detail.name||'لاعب').slice(0,20)),el('span',null,meta.text));
    feed.append(item);while(feed.children.length>MAX_SHOWN)feed.children[0].remove();
    setTimeout(()=>item.remove(),SHOWN_MS);
  }
  addEventListener('bs-board-room',event=>{
    room=event.detail||null;
    if(!room){if(panel)toggle(false);return;}
    if(mount())trigger.hidden=!room.state?.me;
  });
  addEventListener('bs-board-emote',event=>show(event.detail));
})();
