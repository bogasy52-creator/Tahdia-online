/* Tahdia 31.0.0 — reactions for snakes & ladders, zahra and jackaroo.
   Animated emoji, ready-made phrases and board-wide moves. Free ones work for
   everyone; the rest are bought in the shop. Online rooms relay through
   board-online.js (bs-board-room / bs-board-emote); the server checks
   ownership. Local tables show your reaction and bots may answer.
   Effects respect the effects setting, mute and reduced motion. */
(()=>{
  'use strict';
  if(window.__BS_REACTIONS_V31__)return;window.__BS_REACTIONS_V31__=true;
  const core=()=>window.BS_CAREER_CORE,career=()=>window.BS_CAREER;
  const TABS=[['emote','إيموجي'],['phrase','عبارات'],['move','حركات']];
  const GAP={emote:1500,phrase:1500,move:6000};
  const TIER={common:'عادي',rare:'نادر',epic:'ملحمي',legendary:'أسطوري',exclusive:'حصري'};
  let room=null,tab='emote',fab=null,sheet=null,live=null,layer=null,canvas=null,ctx=null,raf=0,last=0,lastSent=0,lastMove=0,coolTimer=0,observer=null,lockNote=null,hostOverride=null,areaOverride=null,previewTimer=0;
  const particles=[];

  /* ---------- helpers ---------- */
  function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
  const reduced=()=>{try{return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true}catch{return false}};
  const effectsOn=()=>window.BS_AUDIO?.getSettings?.().effects!==false;
  const soundOn=()=>{const s=window.BS_AUDIO?.getSettings?.();return Boolean(window.BS_AUDIO?.tone)&&s?.muted!==true&&s?.effects!==false;};
  const VW=()=>window.innerWidth||390,VH=()=>window.innerHeight||800;
  const rand=(a,b)=>a+Math.random()*(b-a),pick=list=>list[Math.floor(Math.random()*list.length)];
  function all(){return (core()?.REACTIONS||[]);}
  function item(value){return core()?.reactionOf?.(String(value||''))||null;}
  function tier(it){return it.source?'exclusive':it.price>=450?'legendary':it.price>=300?'epic':it.price>=150?'rare':'common';}
  function profile(){try{return career()?.get?.()||null}catch{return null}}
  function signedIn(){try{return Boolean(career()?.account?.())}catch{return false}}
  function onlineMode(){return Boolean(room?.client&&room?.state?.me);}
  function table(){const t=window.BS_TABLE;try{return t&&t.active?t:null}catch{return null}}
  function localMode(){return !onlineMode()&&Boolean(table())&&document.body?.classList?.contains('game-running')&&table().mode!=='online';}
  function active(){return onlineMode()||localMode();}
  /* What this player may send right now. Online, paid reactions need the
     signed-in account that bought them; the server checks again. */
  function access(it){
    if(!it)return {ok:false,why:'missing'};
    if(it.price===0&&!it.source)return {ok:true};
    const owned=new Set(profile()?.owned||[]);
    if(!owned.has(it.id))return {ok:false,why:it.source?'exclusive':'buy'};
    if(onlineMode()&&!signedIn())return {ok:false,why:'signin'};
    return {ok:true};
  }
  function visibleItems(type){const owned=new Set(profile()?.owned||[]);return all().filter(it=>it.type===type&&(!it.source||owned.has(it.id)));}

  /* ---------- sounds (synthesised, no downloads) ---------- */
  const SOUNDS={
    pop:[[660,.07,.05,'sine',0,990]],
    clap:[[1800,.03,.05,'square',0,900],[1700,.03,.05,'square',.12,800],[1900,.03,.05,'square',.24,950]],
    whoosh:[[260,.28,.035,'triangle',0,980]],
    sparkle:[[1319,.09,.03,'sine',0],[1568,.09,.03,'sine',.07],[2093,.12,.03,'sine',.14]],
    chime:[[1175,.25,.025,'sine',0],[1568,.3,.02,'sine',.1]],
    low:[[150,.35,.06,'sawtooth',0,60]],
    boom:[[110,.5,.08,'square',0,38],[70,.6,.06,'sine',.05,30]],
    thunder:[[200,.18,.06,'sawtooth',0,70],[90,.7,.07,'sawtooth',.12,30]],
    coins:[[2093,.06,.03,'triangle',0],[2637,.06,.03,'triangle',.08],[2093,.06,.03,'triangle',.18],[3136,.08,.025,'triangle',.28]],
    fanfare:[[523,.14,.045,'triangle',0],[659,.14,.045,'triangle',.13],[784,.14,.045,'triangle',.26],[1047,.42,.05,'triangle',.39]],
    hearts:[[440,.12,.035,'sine',0,660],[523,.12,.035,'sine',.16,784]],
    tears:[[880,.2,.03,'sine',0,440]],
    gong:[[98,1.4,.07,'sine',0,92],[196,1.1,.03,'sine',.02,190],[1568,.5,.015,'sine',.3],[2093,.6,.012,'sine',.45]],
    rocket:[[200,.9,.04,'sawtooth',0,1200]],
    fireworks:[[900,.05,.04,'square',.2,300],[700,.05,.04,'square',.55,200],[1100,.05,.04,'square',.9,350]],
    hiss:[[3200,.35,.012,'sawtooth',0,2400]]
  };
  const SOUND_FOR={clap:'clap',flame:'whoosh',shake:'pop',pop:'pop',steam:'whoosh',plead:'chime',shine:'sparkle',tears:'tears',hush:'whoosh',frost:'chime',spin:'pop',blast:'boom',devil:'low',slither:'hiss',sparkle:'sparkle',launch:'rocket',royal:'fanfare',prism:'sparkle',phrase:'pop',
    confetti:'pop',snow:'chime',hearts:'hearts',roses:'chime',lightning:'thunder',quake:'boom',fireworks:'fireworks',rocket:'rocket',gold:'coins',crown:'fanfare',sovereign:'gong'};
  function sfx(name){if(!soundOn())return;for(const args of SOUNDS[name]||[])try{window.BS_AUDIO.tone(...args)}catch{}}

  /* ---------- particle canvas ---------- */
  function ensureCanvas(){
    if(canvas?.isConnected)return ctx;
    canvas=el('canvas','rx-canvas');canvas.setAttribute('aria-hidden','true');
    ctx=canvas.getContext?.('2d')||null;
    (layerEl()).append(canvas);size();
    return ctx;
  }
  function size(){if(!canvas)return;const dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(VW()*dpr);canvas.height=Math.round(VH()*dpr);canvas.style.width=VW()+'px';canvas.style.height=VH()+'px';ctx?.setTransform?.(dpr,0,0,dpr,0,0);}
  function add(p){particles.push({life:0,ttl:1400,vx:0,vy:0,ax:0,ay:0,drag:0,rot:0,vr:0,size:8,grow:0,alpha:1,delay:0,...p});if(!raf)raf=window.requestAnimationFrame(tick);}
  function tick(now){
    if(!ctx){particles.length=0;raf=0;return;}
    const dt=Math.min(48,now-(last||now));last=now;
    ctx.clearRect(0,0,VW(),VH());
    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i];if(p.delay>0){p.delay-=dt;continue;}
      p.life+=dt;if(p.life>=p.ttl){particles.splice(i,1);continue;}
      const s=dt/16.7;p.vx+=p.ax*s;p.vy+=p.ay*s;if(p.drag){p.vx*=1-p.drag*s;p.vy*=1-p.drag*s;}
      p.x+=p.vx*s;p.y+=p.vy*s;p.rot+=p.vr*s;p.size+=p.grow*s;if(p.sway)p.x+=Math.sin((p.life+p.seed)/p.sway)*p.swayAmp*s;
      draw(p);
    }
    if(particles.length)raf=window.requestAnimationFrame(tick);else{raf=0;last=0;ctx.clearRect(0,0,VW(),VH());}
  }
  function fade(p){const t=p.life/p.ttl,inT=p.fadeIn?Math.min(1,p.life/p.fadeIn):1;return Math.max(0,Math.min(1,(t>.7?(1-t)/.3:1)*inT))*p.alpha;}
  function draw(p){
    const c=ctx;c.save();c.globalAlpha=fade(p);c.translate(p.x,p.y);if(p.rot)c.rotate(p.rot);
    switch(p.kind){
      case 'dot':c.fillStyle=p.color;c.beginPath();c.arc(0,0,Math.max(.2,p.size),0,7);c.fill();break;
      case 'glow':{const g=c.createRadialGradient(0,0,0,0,0,p.size);g.addColorStop(0,p.color);g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.beginPath();c.arc(0,0,p.size,0,7);c.fill();break;}
      case 'spark':{c.rotate(Math.atan2(p.vy,p.vx)-p.rot);c.strokeStyle=p.color;c.lineWidth=p.width||2;c.lineCap='round';c.beginPath();c.moveTo(0,0);c.lineTo(-Math.hypot(p.vx,p.vy)*(p.tail||3),0);c.stroke();break;}
      case 'rect':c.scale(1,Math.cos(p.life/120+p.seed));c.fillStyle=p.color;c.fillRect(-p.size/2,-p.size/4,p.size,p.size/2);break;
      case 'text':c.font=`${Math.round(p.size)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(p.text,0,0);break;
      case 'coin':{const w=Math.abs(Math.cos(p.life/150+p.seed))*p.size;const g=c.createLinearGradient(-w,-p.size,w,p.size);g.addColorStop(0,'#fff3b8');g.addColorStop(.45,'#f2c14e');g.addColorStop(1,'#a8711a');c.fillStyle=g;c.beginPath();c.ellipse(0,0,Math.max(.6,w),p.size,0,0,7);c.fill();c.strokeStyle='#8a5a12';c.lineWidth=1;c.stroke();if(w>p.size*.5){c.fillStyle='#fff8d6';c.globalAlpha*=.7;c.fillRect(-w*.15,-p.size*.55,w*.3,p.size*1.1);}break;}
      case 'heart':{const s=p.size/16;c.scale(s,s);c.fillStyle=p.color;c.beginPath();c.moveTo(0,6);c.bezierCurveTo(-14,-4,-8,-16,0,-8);c.bezierCurveTo(8,-16,14,-4,0,6);c.fill();c.fillStyle='rgba(255,255,255,.45)';c.beginPath();c.ellipse(-5,-7,2.6,1.6,-.6,0,7);c.fill();break;}
      case 'petal':{const g=c.createLinearGradient(0,-p.size,0,p.size);g.addColorStop(0,p.color);g.addColorStop(1,'#7a0f26');c.fillStyle=g;c.scale(1,Math.max(.25,Math.abs(Math.cos(p.life/220+p.seed))));c.beginPath();c.ellipse(0,0,p.size*.62,p.size,0,0,7);c.fill();break;}
      case 'flake':{c.strokeStyle=p.color;c.lineWidth=1.3;c.lineCap='round';for(let k=0;k<6;k++){c.rotate(Math.PI/3);c.beginPath();c.moveTo(0,0);c.lineTo(0,-p.size);c.moveTo(0,-p.size*.55);c.lineTo(p.size*.25,-p.size*.78);c.moveTo(0,-p.size*.55);c.lineTo(-p.size*.25,-p.size*.78);c.stroke();}break;}
      case 'star':{c.fillStyle=p.color;c.beginPath();for(let k=0;k<8;k++){const r=k%2?p.size*.38:p.size;c.lineTo(Math.cos(k*Math.PI/4)*r,Math.sin(k*Math.PI/4)*r);}c.closePath();c.fill();break;}
      case 'ring':c.strokeStyle=p.color;c.lineWidth=p.width||3;c.beginPath();c.arc(0,0,Math.max(.5,p.size),0,7);c.stroke();break;
      case 'smoke':{const g=c.createRadialGradient(0,0,0,0,0,p.size);g.addColorStop(0,p.color);g.addColorStop(1,'rgba(200,200,210,0)');c.fillStyle=g;c.beginPath();c.arc(0,0,p.size,0,7);c.fill();break;}
      case 'path':{c.strokeStyle=p.color;c.lineWidth=p.width||2;c.lineJoin='round';c.lineCap='round';if(p.glow){c.shadowColor=p.glow;c.shadowBlur=18;}c.beginPath();p.points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();if(p.core){c.shadowBlur=0;c.strokeStyle=p.core;c.lineWidth=(p.width||2)*.4;c.stroke();}break;}
      case 'flash':c.fillStyle=p.color;c.fillRect(-p.x,-p.y,VW(),VH());break;
      case 'custom':p.paint(c,p);break;
    }
    c.restore();
  }

  /* ---------- geometry ---------- */
  function area(){
    const board=areaOverride||document.getElementById('board'),r=board?.getBoundingClientRect?.();
    const vw=VW()||390,vh=VH()||700;
    if(r&&r.width>40&&r.bottom>60&&r.top<vh-60){const top=Math.max(0,r.top),bottom=Math.min(vh,r.bottom);return {x:r.left,y:top,w:r.width,h:bottom-top,cx:r.left+r.width/2,cy:(top+bottom)/2};}
    return {x:0,y:vh*.12,w:vw,h:vh*.7,cx:vw/2,cy:vh*.47};
  }
  function chipFor(name){
    const box=document.getElementById('players');if(!box||!name)return null;
    for(const chip of box.children||[]){const label=chip.querySelector?.('b');if(label&&label.textContent.trim()===String(name).trim()){const r=chip.getBoundingClientRect?.();if(r&&r.width&&r.bottom>0&&r.top<VH())return r;}}
    return null;
  }

  /* ---------- layer, live region, banners ---------- */
  function layerEl(){const parent=hostOverride?.isConnected?hostOverride:document.body;if(layer&&layer.parentElement===parent)return layer;if(!layer){layer=el('div','rx-layer');layer.setAttribute('aria-hidden','true');}parent.append(layer);return layer;}
  /* The shop plays a reaction inside its preview dialog (a modal dialog sits
     above every other layer, so the effects move into it for a moment). */
  function preview(id,host){
    const it=item(id);if(!it)return false;
    hostOverride=host||null;areaOverride=host?.querySelector?.('.sx-preview-stage')||host||null;
    show({emote:it.id,name:'أنت',mine:true,origin:areaOverride?.getBoundingClientRect?.()});
    clearTimeout(previewTimer);previewTimer=setTimeout(()=>{hostOverride=null;areaOverride=null;},it.type==='move'?3600:3000);
    return true;
  }
  function announce(text){if(!live){live=el('div','rx-live');live.setAttribute('aria-live','polite');live.setAttribute('role','status');document.body.append(live);}live.textContent='';live.textContent=text;}
  function banner(it,name,mine){
    const b=el('div','rx-banner tier-'+tier(it));
    const icon=el('span','rx-banner-icon',it.glyph);const copy=el('span');copy.append(el('b',null,mine?'أنت':name),el('small',null,'أطلق '+it.name));
    b.append(icon,copy);layerEl().append(b);const a=area();b.style.left=Math.round(a.cx)+'px';b.style.top=Math.round(Math.max(10,a.y+10))+'px';
    setTimeout(()=>b.classList.add('out'),2300);setTimeout(()=>b.remove(),2800);
  }

  /* ---------- emotes ---------- */
  const EMOTE_FX={
    clap(x,y,c){for(let i=0;i<14;i++){const a=i/14*Math.PI*2;add({kind:'star',x,y,vx:Math.cos(a)*rand(2.4,4),vy:Math.sin(a)*rand(2.4,4),drag:.06,size:rand(3,6),color:pick([c,'#fff3b0','#ffffff']),ttl:800,delay:pick([0,120,240])});}},
    flame(x,y){for(let i=0;i<22;i++)add({kind:'dot',x:x+rand(-26,26),y:y+rand(0,22),vx:rand(-.4,.4),vy:rand(-2.6,-1.2),size:rand(2,4.5),grow:-.03,color:pick(['#ffb347','#ff7a3d','#ffd166']),ttl:rand(700,1200),delay:rand(0,500)});},
    shake(x,y){for(let i=0;i<6;i++)add({kind:'text',text:'😂',x:x+rand(-50,50),y:y+rand(-10,20),vy:rand(-1.6,-.8),vx:rand(-.8,.8),size:rand(14,20),ttl:1100,delay:rand(100,500)});},
    pop(x,y,c){add({kind:'ring',x,y,size:12,grow:2.2,width:3,color:c,ttl:600});add({kind:'ring',x,y,size:8,grow:1.6,width:2,color:'#ffffff',ttl:600,delay:120});},
    steam(x,y){for(let i=0;i<10;i++){const side=i%2?1:-1;add({kind:'smoke',x:x+side*30,y:y-18,vx:side*rand(.5,1.2),vy:rand(-1.4,-.7),size:6,grow:.35,color:'rgba(235,235,240,.85)',ttl:900,delay:i*80});}},
    plead(x,y){for(let i=0;i<8;i++)add({kind:'star',x:x+rand(-40,40),y:y+rand(-40,10),vy:-.3,size:rand(2,4),color:'#ffe9a8',ttl:900,delay:rand(0,600),fadeIn:200});},
    shine(x,y){add({kind:'custom',x,y,ttl:700,delay:250,paint:(c,p)=>{const t=p.life/p.ttl;c.rotate(-.6);const g=c.createLinearGradient(-40+t*80,0,-20+t*80,0);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,'rgba(255,255,255,.95)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(-46,-8,92,16);}});add({kind:'star',x:x+22,y:y-14,size:7,vr:.1,color:'#ffffff',ttl:700,delay:500});},
    tears(x,y){for(let i=0;i<14;i++){const side=i%2?1:-1;add({kind:'dot',x:x+side*14,y:y-4,vx:side*rand(.6,1.8),vy:rand(-1.8,-.6),ay:.22,size:rand(2.2,3.6),color:'#7cc4ff',ttl:900,delay:i*70});}},
    hush(x,y,c){for(let i=0;i<3;i++)add({kind:'ring',x,y,size:20,grow:1.2,width:1.6,color:c,ttl:900,delay:i*220});},
    frost(x,y){for(let i=0;i<12;i++){const a=i/12*Math.PI*2;add({kind:'flake',x,y,vx:Math.cos(a)*rand(1.4,2.6),vy:Math.sin(a)*rand(1.4,2.6),drag:.04,vr:.05,size:rand(4,7),color:'#c8f3ff',ttl:1000});}},
    spin(x,y){for(let i=0;i<6;i++){const a=i/6*Math.PI*2;add({kind:'dot',x:x+Math.cos(a)*30,y:y+Math.sin(a)*30,vx:Math.cos(a)*1.6,vy:Math.sin(a)*1.6,size:3.4,color:'#ffffff',ttl:700,delay:300});}},
    blast(x,y){add({kind:'ring',x,y,size:14,grow:3.2,width:5,color:'#ff9a3c',ttl:600});for(let i=0;i<18;i++){const a=Math.random()*Math.PI*2,v=rand(2.5,5);add({kind:'dot',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,ay:.12,size:rand(1.6,3.4),color:pick(['#ff9a3c','#ffd166','#ff5d5d']),ttl:900});}},
    devil(x,y){for(let i=0;i<20;i++)add({kind:'dot',x:x+rand(-30,30),y:y+rand(0,20),vx:rand(-.3,.3),vy:rand(-2.2,-1),size:rand(2,4),grow:-.03,color:pick(['#b16bff','#7a3cff','#e09bff']),ttl:rand(700,1100),delay:rand(0,500)});},
    slither(x,y){for(let i=0;i<10;i++)add({kind:'dot',x:x-40+i*9,y:y+Math.sin(i)*10+26,size:2.4,color:'#6cd88f',ttl:700,delay:i*60});},
    sparkle(x,y,c){for(let i=0;i<16;i++){const a=i/16*Math.PI*2;add({kind:'star',x:x+Math.cos(a)*36,y:y+Math.sin(a)*36,vx:Math.cos(a+1.6)*1.4,vy:Math.sin(a+1.6)*1.4,size:rand(2.4,4.6),color:pick([c,'#ffffff','#fff0a8']),ttl:1000,delay:i*30});}},
    launch(x,y){for(let i=0;i<16;i++)add({kind:'smoke',x:x+rand(-6,6),y:y+20+i*4,vy:rand(.4,1.2),size:5,grow:.3,color:'rgba(240,240,245,.9)',ttl:900,delay:200+i*40});},
    royal(x,y){for(let i=0;i<10;i++){const a=i/10*Math.PI*2;add({kind:'custom',x,y,rot:a,ttl:1100,paint:(c,p)=>{const t=p.life/p.ttl;c.fillStyle='rgba(255,214,107,.35)';c.beginPath();c.moveTo(0,0);c.lineTo(-6,-60-t*20);c.lineTo(6,-60-t*20);c.fill();},vr:.01});}for(let i=0;i<14;i++)add({kind:'star',x:x+rand(-50,50),y:y+rand(-40,40),size:rand(2,4),color:'#ffe08a',ttl:900,delay:rand(100,700),fadeIn:150});},
    prism(x,y){const colors=['#ff5d8f','#ffb347','#fff36b','#5dff9b','#5dd6ff','#9a7dff'];for(let i=0;i<24;i++){const a=i/24*Math.PI*2,v=rand(2,3.6);add({kind:'star',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,drag:.05,size:rand(2.4,4.4),color:colors[i%6],ttl:1000});}}
  };
  function showEmote(it,name,mine,from){
    const a=area(),node=el('div','rx-emote fx-'+it.fx+' tier-'+tier(it)),glyph=el('span','rx-emote-glyph',it.glyph),label=el('b','rx-emote-name',mine?'أنت':name);
    node.append(glyph,label);layerEl().append(node);
    const tx=a.cx+rand(-a.w*.18,a.w*.18),ty=a.y+Math.min(a.h*.42,a.h-70);
    const start=chipFor(mine?null:name)||from||null;
    node.style.left=Math.round(tx)+'px';node.style.top=Math.round(ty)+'px';
    const motion=!reduced()&&effectsOn();
    if(motion&&start&&node.animate){const dx=start.left+start.width/2-tx,dy=start.top+start.height/2-ty;node.animate([{transform:`translate(-50%,-50%) translate(${dx}px,${dy}px) scale(.35)`,opacity:.4},{transform:'translate(-50%,-50%) scale(1.12)',opacity:1,offset:.7},{transform:'translate(-50%,-50%) scale(1)',opacity:1}],{duration:520,easing:'cubic-bezier(.2,.8,.2,1)'});}
    if(motion&&ensureCanvas())setTimeout(()=>EMOTE_FX[it.fx]?.(tx,ty,it.color),motion&&start?420:120);
    setTimeout(()=>node.classList.add('out'),2200);setTimeout(()=>node.remove(),2700);
  }

  /* ---------- phrases ---------- */
  function showPhrase(it,name,mine){
    const a=area(),stack=layerEl().querySelectorAll('.rx-phrase:not(.out)');
    if(stack.length>=2)stack[0].classList.add('out');
    const node=el('div','rx-phrase tier-'+tier(it)+(mine?' is-mine':''));node.append(el('b',null,mine?'أنت':name),el('span',null,it.text||it.name));
    layerEl().append(node);node.style.left=Math.round(a.cx)+'px';node.style.top=Math.round(a.y+Math.min(a.h*.2,90)+layerEl().querySelectorAll('.rx-phrase:not(.out)').length*6)+'px';
    setTimeout(()=>node.classList.add('out'),3000);setTimeout(()=>node.remove(),3500);
  }

  /* ---------- moves ---------- */
  function shakeBoard(strength=8,duration=650){const board=document.getElementById('board');if(!board?.animate||reduced())return;const k=[];for(let i=0;i<10;i++){const s=strength*(1-i/10);k.push({transform:`translate(${rand(-s,s)}px,${rand(-s,s)}px) rotate(${rand(-.6,.6)}deg)`});}k.push({transform:'none'});board.animate(k,{duration,easing:'linear'});}
  function bolt(x1,y1,x2,y2){const pts=[[x1,y1]];const n=9;for(let i=1;i<n;i++){const t=i/n;pts.push([x1+(x2-x1)*t+rand(-18,18),y1+(y2-y1)*t+rand(-6,6)]);}pts.push([x2,y2]);return pts;}
  const MOVE_FX={
    confetti(a){const colors=['#ff5d8f','#ffd166','#5dd6ff','#7ee081','#b28dff','#ff9a52'];for(let i=0;i<110;i++)add({kind:'rect',x:a.x+rand(0,a.w),y:a.y-rand(10,120),vx:rand(-.8,.8),vy:rand(1.6,3.4),size:rand(6,10),vr:rand(-.12,.12),color:pick(colors),ttl:rand(1800,2600),seed:rand(0,99),sway:rand(160,260),swayAmp:.8,delay:rand(0,500)});},
    snow(a){for(let i=0;i<80;i++)add({kind:i%3?'dot':'flake',x:a.x+rand(0,a.w),y:a.y-rand(0,a.h*.5),vy:rand(.7,1.6),size:i%3?rand(1.6,3.2):rand(4,7),vr:.02,color:'#ffffff',alpha:.9,ttl:rand(2400,3200),seed:rand(0,99),sway:rand(220,360),swayAmp:.6,delay:rand(0,900),fadeIn:300});},
    hearts(a){for(let i=0;i<42;i++)add({kind:i%6?'heart':'text',text:'💖',x:a.x+rand(0,a.w),y:a.y+a.h+rand(0,60),vy:rand(-2.6,-1.4),size:i%6?rand(12,22):rand(18,26),color:pick(['#ff4d8d','#ff7eb6','#ff2e63','#ffb3cf']),ttl:rand(1900,2600),seed:rand(0,99),sway:rand(180,260),swayAmp:.7,delay:rand(0,700)});},
    roses(a){for(let i=0;i<60;i++)add({kind:'petal',x:a.x+rand(0,a.w),y:a.y-rand(10,140),vy:rand(1.2,2.4),vr:rand(-.05,.05),size:rand(5,9),color:pick(['#ff5f7a','#e8304f','#ff8fa3']),ttl:rand(2200,3000),seed:rand(0,99),sway:rand(200,300),swayAmp:.9,delay:rand(0,800)});for(let i=0;i<6;i++)add({kind:'text',text:'🌹',x:a.x+rand(.1,.9)*a.w,y:a.y-20,vy:rand(1.6,2.2),vr:rand(-.03,.03),size:26,ttl:2400,delay:rand(200,900)});},
    lightning(a){
      for(const [d,o] of [[0,.55],[260,.35]])add({kind:'flash',x:0,y:0,color:`rgba(255,255,240,${o})`,ttl:180,delay:d});
      for(let k=0;k<3;k++){const x2=a.x+rand(.2,.8)*a.w,y2=a.y+rand(.35,.85)*a.h;add({kind:'path',x:0,y:0,points:bolt(x2+rand(-60,60),a.y-30,x2,y2),width:5,color:'#fff7a8',glow:'#ffe55c',core:'#ffffff',ttl:420,delay:k*230});for(let i=0;i<14;i++){const ang=Math.random()*Math.PI*2,v=rand(1.5,4);add({kind:'spark',x:x2,y:y2,vx:Math.cos(ang)*v,vy:Math.sin(ang)*v,ay:.12,color:'#fff07a',width:2,tail:2.5,ttl:600,delay:k*230+60});}}
      setTimeout(()=>shakeBoard(4,300),240);
    },
    quake(a){
      shakeBoard(10,900);const cx=a.cx+rand(-a.w*.15,a.w*.15),cy=a.cy+rand(-a.h*.1,a.h*.1);
      for(let k=0;k<7;k++){const ang=k/7*Math.PI*2+rand(-.3,.3),len=rand(.25,.45)*Math.min(a.w,a.h),pts=[[cx,cy]];let x=cx,y=cy;for(let i=1;i<7;i++){x+=Math.cos(ang+rand(-.5,.5))*len/6;y+=Math.sin(ang+rand(-.5,.5))*len/6;pts.push([x,y]);}add({kind:'path',x:0,y:0,points:pts,width:2.4,color:'rgba(40,25,10,.85)',ttl:1600,delay:120});}
      for(let i=0;i<26;i++){const ang=Math.random()*Math.PI*2,v=rand(1,3.4);add({kind:'smoke',x:cx,y:cy,vx:Math.cos(ang)*v,vy:Math.sin(ang)*v,drag:.04,size:6,grow:.4,color:'rgba(190,160,120,.7)',ttl:1100,delay:100});}
    },
    fireworks(a){
      const colors=['#ff5d8f','#ffd166','#5dd6ff','#7ee081','#b28dff','#ffffff'];
      for(let k=0;k<5;k++){const x=a.x+rand(.15,.85)*a.w,top=a.y+rand(.12,.45)*a.h,start=a.y+a.h,delay=k*330,flight=520,c=pick(colors);
        add({kind:'spark',x,y:start,vx:0,vy:-(start-top)/(flight/16.7),color:'#fff3c4',width:2.4,tail:1.5,ttl:flight,delay});
        for(let i=0;i<48;i++){const ang=i/48*Math.PI*2,v=rand(2.2,4);add({kind:'spark',x,y:top,vx:Math.cos(ang)*v,vy:Math.sin(ang)*v,ay:.06,drag:.025,color:i%5?c:'#ffffff',width:2.8,tail:2.6,ttl:1150,delay:delay+flight});}
        for(let i=0;i<16;i++){const ang=Math.random()*Math.PI*2,v=rand(.6,2.2);add({kind:'dot',x,y:top,vx:Math.cos(ang)*v,vy:Math.sin(ang)*v,ay:.04,size:rand(1.2,2.2),color:'#fff6d0',ttl:1500,delay:delay+flight+200});}
        add({kind:'glow',x,y:top,size:60,color:c,ttl:420,delay:delay+flight});}
    },
    rocket(a){
      const sx=a.x+a.w+30,sy=a.y+a.h*.9,ex=a.x+a.w*.25,ey=a.y+a.h*.2,dur=1300;
      add({kind:'custom',x:0,y:0,ttl:dur,paint:(c,p)=>{const t=p.life/dur,e=t*t*(3-2*t),x=sx+(ex-sx)*e,y=sy+(ey-sy)*e-Math.sin(e*Math.PI)*a.h*.18;c.translate(x,y);c.rotate(Math.atan2(ey-sy,ex-sx)+Math.PI/4);c.font='38px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('🚀',0,0);if(Math.random()<.9)add({kind:'smoke',x,y,vx:rand(-.4,.4),vy:rand(-.4,.4),size:5,grow:.32,color:'rgba(245,245,250,.9)',ttl:800});}});
      setTimeout(()=>{for(let i=0;i<50;i++){const ang=i/50*Math.PI*2,v=rand(2,4.2);add({kind:i%3?'spark':'star',x:ex,y:ey,vx:Math.cos(ang)*v,vy:Math.sin(ang)*v,ay:.05,drag:.02,size:rand(3,5),color:pick(['#ffd166','#ff8a5c','#ffffff','#5dd6ff']),width:2,tail:2,ttl:1000});}add({kind:'glow',x:ex,y:ey,size:60,color:'rgba(255,200,120,.9)',ttl:400});sfx('boom');},dur);
    },
    gold(a){for(let i=0;i<90;i++)add({kind:'coin',x:a.x+rand(0,a.w),y:a.y-rand(10,160),vy:rand(2,3.6),ay:.02,size:rand(5,8),color:'#f2c14e',ttl:rand(1800,2500),seed:rand(0,9),delay:rand(0,900)});for(let i=0;i<24;i++)add({kind:'star',x:a.x+rand(0,a.w),y:a.y+rand(0,a.h),size:rand(2,4),color:'#fff1b0',ttl:700,delay:rand(300,1800),fadeIn:150});},
    crown(a){
      const cx=a.cx,cy=a.cy;
      add({kind:'custom',x:cx,y:cy,ttl:2400,paint:(c,p)=>{const t=p.life/p.ttl;c.rotate(t*1.2);for(let i=0;i<14;i++){c.rotate(Math.PI*2/14);const g=c.createLinearGradient(0,0,0,-a.h*.6);g.addColorStop(0,'rgba(255,214,107,.55)');g.addColorStop(1,'rgba(255,214,107,0)');c.fillStyle=g;c.beginPath();c.moveTo(0,0);c.lineTo(-14,-a.h*.6);c.lineTo(14,-a.h*.6);c.fill();}},fadeIn:300});
      add({kind:'custom',x:cx,y:cy,ttl:2400,paint:(c,p)=>{const t=Math.min(1,p.life/700),bounce=t<1?(1-Math.pow(1-t,3)):1,y=-a.h*.55*(1-bounce)+Math.sin(p.life/260)*3;c.font='84px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';c.textAlign='center';c.textBaseline='middle';c.shadowColor='rgba(255,200,80,.9)';c.shadowBlur=30;c.fillText('👑',0,y);}});
      for(let i=0;i<40;i++)add({kind:'star',x:cx+rand(-a.w*.4,a.w*.4),y:cy+rand(-a.h*.35,a.h*.35),size:rand(2,5),color:pick(['#ffe08a','#ffffff','#ffc94d']),ttl:900,delay:rand(500,2000),fadeIn:150});
    },
    sovereign(a){
      const pad=4,x0=a.x+pad,y0=a.y+pad,w=a.w-pad*2,h=a.h-pad*2,r=Math.min(w,h)*.08,per=2*(w+h),dur=2900;
      const at=d=>{d=((d%per)+per)%per;if(d<w)return [x0+w-d,y0];d-=w;if(d<h)return [x0,y0+d];d-=h;if(d<w)return [x0+d,y0+h];d-=w;return [x0+w,y0+h-d];};
      add({kind:'custom',x:0,y:0,ttl:dur+500,fadeIn:300,paint:(c)=>{const g=c.createRadialGradient(a.cx,a.cy,Math.min(w,h)*.18,a.cx,a.cy,Math.max(w,h)*.8);g.addColorStop(0,'rgba(8,20,14,0)');g.addColorStop(1,'rgba(4,10,7,.78)');c.fillStyle=g;c.fillRect(a.x,a.y,a.w,a.h);}});
      add({kind:'custom',x:0,y:0,ttl:dur+500,paint:(c,p)=>{
        const t=Math.min(1,p.life/(dur*.72)),ease=1-Math.pow(1-t,3),head=ease*per*.86,len=Math.min(head,per*.62),n=90,thick=Math.max(9,Math.min(w,h)*.05);
        if(head<=0)return;const pts=[];for(let i=0;i<=n;i++){const d=head-len*(1-i/n);if(d>=0)pts.push(at(d));}
        if(pts.length<3)return;const wave=p.life/180;
        // body: obsidian tube with an emerald sheen and gold diamonds
        c.lineCap='round';c.lineJoin='round';c.shadowColor='rgba(255,205,110,.55)';c.shadowBlur=16;
        const width=i=>thick*(.28+.72*Math.sin(Math.min(1,i/pts.length*1.08)*Math.PI*.9));
        for(let i=1;i<pts.length;i++){const [x1,y1]=pts[i-1],[x2,y2]=pts[i];c.strokeStyle='#07130d';c.lineWidth=width(i)+2.5;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();}
        c.shadowBlur=0;
        for(let i=1;i<pts.length;i++){const f=i/pts.length,[x1,y1]=pts[i-1],[x2,y2]=pts[i];c.strokeStyle=`rgb(${22+20*f},${92+50*f},${62+22*f})`;c.lineWidth=width(i)*.78;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();}
        for(let i=1;i<pts.length;i++){const [x1,y1]=pts[i-1],[x2,y2]=pts[i];c.strokeStyle='#e8c46a';c.lineWidth=Math.max(1.2,width(i)*.16);c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();}
        for(let i=3;i<pts.length-2;i+=3){const wd=width(i),[x1,y1]=pts[i-1],[x2,y2]=pts[i+1],ang=Math.atan2(y2-y1,x2-x1),[x,y]=pts[i];c.save();c.translate(x,y);c.rotate(ang);
          c.fillStyle='#fff1bf';c.beginPath();c.moveTo(-wd*.3,0);c.lineTo(0,-wd*.2);c.lineTo(wd*.3,0);c.lineTo(0,wd*.2);c.closePath();c.fill();
          c.fillStyle='rgba(8,24,16,.55)';for(const side of [-1,1]){c.beginPath();c.ellipse(0,side*wd*.3,wd*.16,wd*.07,0,0,7);c.fill();}c.restore();}
        // head with emerald eyes, a forked tongue and a small gold crown
        const [hx,hy]=pts[pts.length-1],[px,py]=pts[pts.length-4],ang=Math.atan2(hy-py,hx-px),hs=thick*1.05;
        c.save();c.translate(hx,hy);c.rotate(ang);
        if(Math.sin(wave*2)>.2){c.strokeStyle='#ff4d6d';c.lineWidth=1.6;c.beginPath();c.moveTo(hs*1.1,0);c.lineTo(hs*1.75,0);c.lineTo(hs*2,-hs*.22);c.moveTo(hs*1.75,0);c.lineTo(hs*2,hs*.22);c.stroke();}
        const hg=c.createLinearGradient(-hs,0,hs*1.3,0);hg.addColorStop(0,'#173326');hg.addColorStop(.6,'#24543c');hg.addColorStop(1,'#0e2018');c.fillStyle=hg;c.shadowColor='rgba(255,205,110,.7)';c.shadowBlur=14;
        c.beginPath();c.moveTo(-hs*.6,-hs*.55);c.quadraticCurveTo(hs*.6,-hs*.85,hs*1.25,-hs*.18);c.quadraticCurveTo(hs*1.4,0,hs*1.25,hs*.18);c.quadraticCurveTo(hs*.6,hs*.85,-hs*.6,hs*.55);c.closePath();c.fill();c.shadowBlur=0;
        c.strokeStyle='#e8c46a';c.lineWidth=1.4;c.stroke();
        for(const s of [-1,1]){c.fillStyle='#0b2a1c';c.beginPath();c.ellipse(hs*.55,s*hs*.36,hs*.2,hs*.13,s*.35,0,7);c.fill();c.fillStyle='#62ffaf';c.shadowColor='#62ffaf';c.shadowBlur=10;c.beginPath();c.ellipse(hs*.58,s*hs*.36,hs*.11,hs*.07,s*.35,0,7);c.fill();c.shadowBlur=0;}
        c.fillStyle='#f2cd6b';c.beginPath();c.moveTo(-hs*.35,-hs*.42);c.lineTo(-hs*.55,-hs*.95);c.lineTo(-hs*.2,-hs*.62);c.lineTo(0,-hs*1.05);c.lineTo(hs*.2,-hs*.62);c.lineTo(hs*.48,-hs*.92);c.lineTo(hs*.32,-hs*.42);c.closePath();c.fill();
        c.fillStyle='#62ffaf';c.beginPath();c.arc(0,-hs*.98,hs*.07,0,7);c.fill();
        c.restore();
      }});
      add({kind:'custom',x:a.cx,y:a.cy,ttl:dur,delay:800,fadeIn:450,paint:(c,p)=>{const t=Math.min(1,p.life/600),s=.85+.15*t;c.scale(s,s);c.textAlign='center';c.textBaseline='middle';
        const g=c.createLinearGradient(-110,0,110,0);g.addColorStop(0,'#9c6b1a');g.addColorStop(.5,'#fff1bf');g.addColorStop(1,'#9c6b1a');
        c.fillStyle='rgba(6,14,10,.72)';c.beginPath();c.roundRect?.(-104,-34,208,70,18);c.fill();c.strokeStyle=g;c.lineWidth=1.5;c.stroke();
        c.font='800 30px Tajawal, system-ui, sans-serif';c.shadowColor='rgba(0,0,0,.6)';c.shadowBlur=8;c.fillStyle=g;c.fillText('المدير',0,-7);c.shadowBlur=0;c.font='700 13px Tajawal, system-ui, sans-serif';c.fillStyle='#8ff0bb';c.fillText('سيّد الحلبة',0,21);}});
      for(let i=0;i<34;i++)add({kind:'star',x:a.x+rand(0,a.w),y:a.y+rand(0,a.h),size:rand(2,4.4),color:pick(['#7dffb3','#fff1bf','#e8c46a']),ttl:900,delay:rand(500,2600),fadeIn:150});
    }
  };
  function showMove(it,name,mine){
    banner(it,name,mine);
    if(reduced()||!effectsOn()||!ensureCanvas())return;
    MOVE_FX[it.fx]?.(area(),it);
  }

  /* ---------- incoming ---------- */
  function show(detail){
    const it=item(detail?.reaction||detail?.emote);if(!it)return;
    const myId=room?.state?.me?.id,mine=Boolean(detail.mine||myId&&detail.from===myId),name=String(detail.name||'لاعب').slice(0,20),origin=detail.origin||(mine?fab?.getBoundingClientRect?.():null);
    announce((mine?'أنت':name)+': '+(it.text||it.glyph+' '+it.name));
    sfx(it.type==='phrase'?'phrase':SOUND_FOR[it.fx]||'pop');
    if(it.type==='emote')showEmote(it,name,mine,origin);else if(it.type==='phrase')showPhrase(it,name,mine);else showMove(it,name,mine);
  }

  /* ---------- sending ---------- */
  function cooling(it){const now=Date.now();return now-lastSent<GAP.emote||it?.type==='move'&&now-lastMove<GAP.move;}
  function send(it){
    const ok=access(it);if(!ok.ok){explainLock(it,ok.why);return false;}
    if(cooling(it))return false;
    let sent=false;
    if(onlineMode())sent=Boolean(room.client.react?.(it.legacy||it.id));
    else if(localMode()){sent=true;show({emote:it.id,mine:true,origin:fab?.getBoundingClientRect?.()});botAnswer(it);}
    if(!sent)return false;
    lastSent=Date.now();if(it.type==='move')lastMove=lastSent;
    toggle(false);startCooldown(it.type==='move'?GAP.move:GAP.emote);
    return true;
  }
  function startCooldown(ms){if(!fab)return;fab.style.setProperty('--rx-cool-ms',ms+'ms');fab.classList.remove('is-cooling');void fab.offsetWidth;fab.classList.add('is-cooling');clearTimeout(coolTimer);coolTimer=setTimeout(()=>{fab.classList.remove('is-cooling');if(sheet&&!sheet.hidden)render();},ms);}
  /* Bots answer now and then with a free reaction that fits. */
  const REPLIES={emote:['emote-laugh','emote-wow','emote-clap','phrase-gg','emote-fire'],phrase:['phrase-gg','phrase-luck','emote-laugh','emote-angry','phrase-fast'],move:['emote-wow','emote-clap','phrase-gg','emote-fire']};
  function botAnswer(it){
    const t=table();const bots=(t?.bots||[]).filter(i=>Number.isInteger(i));if(!bots.length||Math.random()>.6)return;
    const index=pick(bots),name=t.players?.[index]?.name||'المنافس',reply=item(pick(REPLIES[it.type]||REPLIES.emote));
    setTimeout(()=>{if(localMode()&&reply)show({emote:reply.id,name,from:'bot-'+index});},rand(1100,2400));
  }
  function explainLock(it,why){
    if(!sheet)return;lockNote?.remove();
    lockNote=el('div','rx-lock-note');
    const text=why==='signin'?'سجّل الدخول لتستخدم تفاعلاتك المشتراة في غرف الأونلاين.':why==='exclusive'?'«'+it.name+'» حصري ولا يُباع.':'«'+it.name+'» متاح في المتجر بـ '+it.price+' ◈';
    lockNote.append(el('span',null,text));
    if(why==='buy'){const go=el('a','rx-lock-go','افتح المتجر');go.href='/shop?filter='+it.type+'#collection';go.target='_blank';go.rel='noopener';lockNote.append(go);}
    if(why==='signin'){const go=el('a','rx-lock-go','تسجيل الدخول');go.href='/social?auth=1';go.target='_blank';go.rel='noopener';lockNote.append(go);}
    sheet.querySelector('.rx-sheet-body')?.prepend(lockNote);
  }

  /* ---------- UI: button and sheet ---------- */
  function host(){const board=document.getElementById('board');return board?.parentElement||null;}
  function mount(){
    if(fab?.isConnected)return true;
    const h=host();if(!h)return false;
    h.classList.add('rx-host');
    fab=el('button','rx-fab');fab.type='button';fab.hidden=true;fab.setAttribute('aria-haspopup','dialog');fab.setAttribute('aria-expanded','false');fab.setAttribute('aria-label','تفاعل: إيموجي وعبارات وحركات');
    fab.append(el('i','rx-fab-ring'),el('span','rx-fab-face','😊'));
    fab.addEventListener('click',()=>toggle(sheet?.hidden!==false));
    h.append(fab);
    sheet=el('section','rx-sheet');sheet.id='rxSheet';sheet.hidden=true;sheet.setAttribute('role','dialog');sheet.setAttribute('aria-label','تفاعل مع اللاعبين');
    const head=el('header','rx-sheet-head'),title=el('h2',null,'تفاعل'),close=el('button','rx-close','×');close.type='button';close.setAttribute('aria-label','إغلاق');close.addEventListener('click',()=>{toggle(false);fab?.focus?.();});
    const tabs=el('div','rx-tabs');tabs.setAttribute('role','tablist');
    for(const [id,label] of TABS){const b=el('button','rx-tab',label);b.type='button';b.dataset.tab=id;b.setAttribute('role','tab');b.addEventListener('click',()=>{tab=id;render();});tabs.append(b);}
    head.append(title,tabs,close);
    const body=el('div','rx-sheet-body'),foot=el('footer','rx-sheet-foot'),shop=el('a','rx-shop-link','المزيد في المتجر');shop.href='/shop?filter=emote#collection';shop.target='_blank';shop.rel='noopener';foot.append(el('small','rx-hint'),shop);
    sheet.append(head,body,foot);document.body.append(sheet);
    fab.setAttribute('aria-controls',sheet.id);
    // Capture on window so Escape closes only this sheet and never also pauses the game underneath.
    window.addEventListener('keydown',event=>{if(event.key==='Escape'&&sheet&&!sheet.hidden){event.preventDefault();event.stopImmediatePropagation();toggle(false);fab?.focus?.();}},true);
    document.addEventListener('pointerdown',event=>{if(sheet&&!sheet.hidden&&!sheet.contains(event.target)&&!fab.contains(event.target))toggle(false);});
    return true;
  }
  function toggle(open){
    if(!sheet)return;sheet.hidden=!open;fab?.setAttribute('aria-expanded',String(open));
    if(open){lockNote?.remove();lockNote=null;render();sheet.querySelector('.rx-tab.is-active')?.focus?.();}
  }
  function tile(it){
    const state=access(it),b=el('button','rx-item is-'+it.type+' tier-'+tier(it)+(state.ok?'':' is-locked'));b.type='button';b.dataset.reaction=it.id;
    b.setAttribute('aria-label',(it.text||it.name)+(state.ok?'':state.why==='signin'?' — يحتاج تسجيل الدخول':' — مقفل، '+it.price+' عملة'));
    if(it.type==='phrase')b.append(el('span','rx-item-text',it.text||it.name));
    else{b.append(el('span','rx-item-glyph',it.glyph));if(it.type==='move'||!state.ok)b.append(el('small','rx-item-name',it.name));}
    if(!state.ok)b.append(el('i','rx-lock',state.why==='signin'?'🔑':state.why==='exclusive'?'★':it.price+' ◈'));
    else if(it.type==='move')b.append(el('i','rx-tier',TIER[tier(it)]));
    if(state.ok&&cooling(it))b.disabled=true;
    b.addEventListener('click',()=>send(it));
    return b;
  }
  function render(){
    if(!sheet)return;
    sheet.querySelectorAll('.rx-tab').forEach(b=>{const on=b.dataset.tab===tab;b.classList.toggle('is-active',on);b.setAttribute('aria-selected',String(on));});
    const body=sheet.querySelector('.rx-sheet-body');for(const child of [...body.children])if(child!==lockNote)child.remove();
    const list=visibleItems(tab),ready=list.filter(it=>access(it).ok),locked=list.filter(it=>!access(it).ok);
    const grid=el('div','rx-grid rx-grid-'+tab);for(const it of [...ready,...locked])grid.append(tile(it));body.append(grid);
    const hint=sheet.querySelector('.rx-hint');if(hint)hint.textContent=ready.length+' من '+list.length+' جاهزة'+(onlineMode()?'':' · طاولة على هذا الجهاز');
    const link=sheet.querySelector('.rx-shop-link');if(link)link.href='/shop?filter='+tab+'#collection';
  }
  function refresh(){
    if(!mount())return;
    const on=active();fab.hidden=!on;if(!on)toggle(false);
  }

  /* ---------- wiring ---------- */
  addEventListener('bs-board-room',event=>{room=event.detail||null;refresh();});
  addEventListener('bs-board-emote',event=>show(event.detail));
  addEventListener('bs-board-emote-locked',event=>{const it=item(event.detail?.emote);if(it){toggle(true);tab=it.type;render();explainLock(it,signedIn()?'buy':'signin');}});
  addEventListener('bs-career-change',()=>{if(sheet&&!sheet.hidden)render();});
  addEventListener('resize',()=>{if(canvas)size();},{passive:true});
  function watch(){
    refresh();
    if(typeof MutationObserver==='function'&&document.body&&!observer){observer=new MutationObserver(()=>refresh());observer.observe(document.body,{attributes:true,attributeFilter:['class']});}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch,{once:true});else watch();
  window.BS_REACTIONS=Object.freeze({show,preview,send:id=>send(item(id)),open:()=>{refresh();toggle(true);},close:()=>toggle(false),access:id=>access(item(id)),render});
})();
