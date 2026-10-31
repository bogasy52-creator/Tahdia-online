/* Full-body actors, personal Foley and event-bound effects. */
(function(root){
 'use strict';
 const doc=root.document,active=new Set(),timers=new Set(),seen=new Set(),sounds=new Set();
 let epoch=0,lastMove=0,matchResult=null,activated=false,companion=null;
 const core=()=>root.BS_CAREER_CORE;
 const current=()=>core()?.heroOf(root.BS_CAREER?.get?.()?.equipped?.character)?.id||'fox';
 const reduced=()=>root.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
 const enabled=()=>root.BS_AUDIO?.getSettings?.().effects!==false;
 const host=()=>doc.querySelector('dialog[open]')||doc.fullscreenElement||doc.querySelector('body.serpent-active #arenaPlay')||doc.body;
 const node=(tag,cls)=>{const el=doc.createElement(tag);if(cls)el.className=cls;return el;};
 function signature(value){const id=String(value||current()).replace(/^character-/,''),rows=core()?.HERO_SIGNATURES;return rows&&Object.hasOwn(rows,id)?rows[id]:rows?.fox;}
 const style=node('link');style.rel='stylesheet';style.href='/assets/css/hero-effects.css?v=33.0.0-full1';doc.head?.append(style);
 function later(fn,ms){const version=epoch,id=setTimeout(()=>{timers.delete(id);if(version===epoch)fn();},ms);timers.add(id);return id;}
 function remember(key){if(seen.has(key))return false;seen.add(key);if(seen.size>120)seen.delete(seen.values().next().value);return true;}
 function remove(el){el?._heroRestore?.();for(const actor of el?.querySelectorAll?.('.character-actor')||[])root.BS_CHARACTERS?.dispose(actor);if(el?.classList?.contains('character-actor'))root.BS_CHARACTERS?.dispose(el);el?.remove();active.delete(el);}
 function stopSound(audio){try{audio.pause();audio.currentTime=0;}catch{}sounds.delete(audio);}
 function stopSounds(){for(const audio of [...sounds])stopSound(audio);}
 function cancel(){epoch++;for(const id of timers)clearTimeout(id);timers.clear();for(const el of [...active])remove(el);active.clear();stopSounds();root.BS_CHARACTERS?.cancel();}
 function unlock(){activated=true;root.BS_AUDIO?.unlock?.();}
 function canSound(){const settings=root.BS_AUDIO?.getSettings?.()||{};return !doc.hidden&&enabled()&&!settings.muted&&Number(settings.volume??.72)>0&&!root.BS_AUDIO?.contentActive?.()&&(activated||root.navigator?.userActivation?.hasBeenActive);}
 function sound(value,kind='entry'){
  const spec=signature(value);if(!spec||!canSound()||!root.Audio)return null;
  const settings=root.BS_AUDIO?.getSettings?.()||{},audio=new root.Audio('/assets/sounds/character-foley-v33/'+spec.id+'-'+kind+'.wav');
  audio.preload='auto';audio._heroGainFactor=kind==='move'?.27:.62;audio.volume=Math.min(1,Math.max(0,Number(settings.volume??.72)*audio._heroGainFactor));
  // Never leave a delayed cue waiting behind a completed round or another preview.
  stopSounds();sounds.add(audio);const version=epoch;
  const done=()=>sounds.delete(audio);audio.onended=done;audio.onerror=done;
  try{const result=Promise.resolve(audio.play());result.then(()=>{if(version!==epoch||!canSound())stopSound(audio);}).catch(()=>stopSound(audio));return {audio,played:result};}catch{stopSound(audio);return null;}
 }
 function portrait(value,{piece=false,pose='idle',staticIdle=false}={}){
  if(root.BS_CHARACTERS)return root.BS_CHARACTERS.actor(value,{piece,pose,staticIdle});
  const spec=signature(value),el=node('span','hero-original'+(piece?' hero-original-piece':''));el.dataset.hero=spec.id;el.setAttribute('aria-hidden','true');
  const img=node('img','hero-original-art');img.src=core().heroArt(spec.id);img.alt='';img.draggable=false;el.append(img);return el;
 }
 const MOTIFS={
  dust:'M8 70 Q45 48 90 70 M15 80 Q52 62 84 77 M25 88 Q52 80 74 87',
  shuriken:'M12 70 L86 24 M19 81 L94 35 M66 15 L69 28 L83 30 L70 34 L68 48 L64 35 L50 31 L64 28 Z',
  circuit:'M12 78 V48 H28 V24 M88 78 V53 H74 V32 M27 86 H47 V71 H68 M38 18 H61 V30',
  shield:'M50 9 L83 23 V48 Q80 73 50 89 Q20 73 17 48 V23 Z M50 19 L73 29 V48 Q70 65 50 77',
  feather:'M7 66 Q26 30 43 43 M93 66 Q74 30 57 43 M13 71 Q31 52 43 53 M87 71 Q69 52 57 53 M22 77 Q35 67 43 65 M78 77 Q65 67 57 65',
  orbit:'M11 56 A40 15 -24 1 0 89 43 A40 15 -24 1 0 11 56 M30 13 A22 43 28 0 1 70 88',
  streak:'M5 70 H37 M0 59 H31 M10 81 H43 M63 20 H93 M71 31 H100',
  bubble:'M25 67 A8 8 0 1 0 25 51 A8 8 0 1 0 25 67 M79 44 A6 6 0 1 0 79 32 A6 6 0 1 0 79 44 M67 79 A10 10 0 1 0 67 59 A10 10 0 1 0 67 79 M40 27 A4 4 0 1 0 40 19 A4 4 0 1 0 40 27',
  thunder:'M33 8 L19 41 L33 38 L22 72 L46 34 L32 37 Z M76 23 L62 50 L75 48 L65 85 L89 43 L76 46 Z',
  ember:'M13 72 L25 60 M15 43 L27 49 M32 15 L39 31 M80 71 L72 58 M91 43 L76 48 M69 14 L63 29 M43 88 L47 76',
  prism:'M50 9 L89 76 H11 Z M50 9 V59 L89 76 M50 59 L11 76 M29 39 H71 M21 58 H79',
  slash:'M18 77 Q19 29 80 16 Q36 31 27 73 M30 88 Q59 82 84 47'
 };
 function effect(container,spec,kind='entry',{lasting=false}={}){
  if(!enabled())return null;
  const layer=node('span','hero-effect hero-effect-'+kind+' effect-'+spec.effect);layer.dataset.effect=spec.effect;layer.style.setProperty('--hero-color',spec.color);layer.setAttribute('aria-hidden','true');
  const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 100 100');svg.classList.add('hero-motif');
  const path=doc.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',MOTIFS[spec.effect]);svg.append(path);layer.append(svg);
  if(!reduced())for(let i=0;i<(kind==='win'?10:6);i++){const bit=node('i','hero-spark');bit.style.setProperty('--n',String(i));bit.style.setProperty('--angle',i*360/(kind==='win'?10:6)+'deg');layer.append(bit);}
  container.append(layer);if(!lasting)later(()=>remove(layer),1500);return layer;
 }
 function decorate(stage,spec,kind){stage.dataset.hero=spec.id;stage.dataset.pose=kind;stage.style.setProperty('--hero-color',spec.color);stage.append(portrait(spec.id,{pose:kind==='move'?'walk':kind}));if(!root.BS_CHARACTERS)effect(stage,spec,kind);return stage;}
 function mountCompanion(){
  if(!games.has(route)||!root.BS_CHARACTERS)return null;
  const id=current();if(companion?.isConnected&&companion.dataset.hero===id)return companion;
  if(companion){root.BS_CHARACTERS.dispose(companion);companion.remove();}
  const identity=doc.querySelector('#bsGameCommand .bs-command-identity'),header=identity||doc.querySelector('.bs-topbar .bs-brand,.party-brand');if(!header)return null;
  const mark=identity?.querySelector('span');if(mark?.textContent==='BS')mark.remove();
  companion=portrait(id,{staticIdle:false});companion.classList.add('hero-companion');header.prepend(companion);return companion;
 }
 function enter(value,{key='page:'+location.pathname,container=host(),preview=false,name=''}={}){
  const spec=signature(value);if(!spec||doc.hidden||!enabled()||!preview&&!remember('entry:'+key))return null;
  const stage=decorate(node('div','hero-entry'),spec,'entry'),copy=node('span','hero-entry-copy');copy.append(node('b'),node('small'));copy.children[0].textContent=name||core().heroOf(spec.id)?.name||'';copy.children[1].textContent=spec.entry;stage.append(copy);container.append(stage);active.add(stage);stage.dataset.soundPlayed=String(Boolean(sound(spec.id,'entry')));if(!preview)later(()=>remove(stage),2400);return stage;
 }
 function move(target,value=current(),{force=false}={}){
  if(!target||doc.hidden||!enabled())return;const spec=signature(value),now=Date.now();if(!spec||!force&&now-lastMove<550)return;lastMove=now;
  const actor=target.classList?.contains('character-actor')?target:target.querySelector?.('.character-actor');
  const own=spec.id===current()?mountCompanion():null;
  if(actor)root.BS_CHARACTERS?.setState(actor,'walk',{loop:false});
  if(own&&own!==actor)root.BS_CHARACTERS?.setState(own,'walk',{loop:false});
  // Place the effect inside the moving pawn so it follows the real CSS transform.
  // Do not sample coordinates before the pawn has been placed on the board.
  const position=root.getComputedStyle?.(target)?.position,oldPosition=target.style.position;
  if(position==='static')target.style.position='relative';
  const anchor=node('span','hero-move-anchor');anchor._heroRestore=()=>{if(position==='static')target.style.position=oldPosition||'';};target.append(anchor);active.add(anchor);effect(anchor,spec,'move');
  later(()=>{remove(anchor);if(position==='static')target.style.position=oldPosition||'';},1500);
  sound(spec.id,'move');return anchor;
 }
 function victory(value,{container=host(),key='result',preview=false}={}){
  const spec=signature(value);if(!spec||doc.hidden||!enabled()||!preview&&!remember('win:'+key))return null;
  const own=spec.id===current()?mountCompanion():null;if(own)root.BS_CHARACTERS?.setState(own,'win',{loop:false});
  const stage=decorate(node('div','hero-victory'),spec,'win'),label=node('small','hero-victory-label');label.textContent=spec.victory;stage.append(label);container.append(stage);active.add(stage);stage.dataset.soundPlayed=String(Boolean(sound(spec.id,'win')));if(!preview)later(()=>remove(stage),5500);return stage;
 }
 function preview(container,value,pose='entry',options={}){
  const spec=signature(value);if(!spec)return()=>{};const kind=pose==='move'?'move':pose==='win'?'win':'entry';
  const actor=container.querySelector?.('.character-actor');
  if(actor&&root.BS_CHARACTERS){root.BS_CHARACTERS.setState(actor,kind==='move'?'walk':kind,{loop:kind==='move',explicit:true});if(options.sound!==false)sound(spec.id,kind);return()=>{root.BS_CHARACTERS.setState(actor,'idle');stopSounds();};}
  // Use the shop's existing full-size artwork. A preview never replaces or crops it.
  const embedded=options.artwork===true,stage=embedded?node('span','hero-preview-overlay'):decorate(node('div','hero-preview-stage'),spec,kind);
  if(!embedded)container.replaceChildren();else{stage.dataset.hero=spec.id;stage.dataset.pose=kind;effect(stage,spec,kind);}
  container.append(stage);active.add(stage);
  if(options.sound!==false)sound(spec.id,kind);
  return()=>{remove(stage);stopSounds();};
 }
 function sample(value,kind='win'){unlock();return sound(value,kind);}
 function frame(room){matchResult=null;const state=room?.state;if(!state)return;if(room.status==='playing'&&room.startedAt)enter(current(),{key:'room:'+room.code+':'+room.startedAt});let seat=Number.isInteger(state.winner)?state.winner:null;const me=room.me?.index??0;if(seat===null&&Number.isInteger(state.winnerTeam))seat=me%2===state.winnerTeam?me:state.players?.findIndex((_,i)=>i%2===state.winnerTeam);if(seat===null||seat<0)return;const player=room.players?.find(p=>p.index===seat),hero=core()?.heroOf(player?.character||player?.look?.character)?.id||'fox';matchResult={hero,self:seat===me||Number.isInteger(state.winnerTeam)&&me%2===state.winnerTeam};}
 root.BS_HERO_FX=Object.freeze({frame,result:()=>matchResult,signature,current,portrait,rig:portrait,enter,move,victory,preview,sample,cancel,unlock,mountCompanion});
 doc.addEventListener('pointerdown',unlock,{capture:true,once:true});doc.addEventListener('keydown',unlock,{capture:true,once:true});
 root.addEventListener('bs-audio-change',()=>{const settings=root.BS_AUDIO?.getSettings?.()||{};if(!enabled())cancel();else if(settings.muted||Number(settings.volume??.72)<=0)stopSounds();else for(const audio of sounds)audio.volume=Math.min(1,Math.max(0,Number(settings.volume??.72)*audio._heroGainFactor));});
 root.addEventListener('pagehide',cancel);doc.addEventListener('visibilitychange',()=>{if(doc.hidden)cancel();});root.addEventListener('bs-social-session',cancel);
 root.addEventListener('bs-match-pause',event=>{if(event.detail?.paused)stopSounds();});
 const games=new Set(['baloot','snakes','jackaroo','zahra','dice','serpent','party','journey','paths-online','sudoku','picture','quiz','online','local','memory','logic','reaction','puzzle','labyrinth','focus','cipher','patterns','survival']);
 const route=location.pathname.replace(/\.html$/,'').split('/').pop();
 const setupCompanion=()=>Promise.resolve(root.BS_CAREER?.ready).then(mountCompanion).catch(()=>{});
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',setupCompanion,{once:true});else setupCompanion();
 root.addEventListener('bs-career-change',setupCompanion);root.addEventListener('bs-social-session',()=>{if(companion){remove(companion);companion=null;}setupCompanion();});
 if(games.has(route)&&!new Set(['labyrinth','focus','cipher','patterns','survival','snakes','jackaroo','zahra','dice','baloot','memory','logic','reaction','puzzle','journey']).has(route))doc.addEventListener('click',event=>{const button=event.target.closest?.('button');if(!button||button.matches?.('[data-audio-toggle],[data-settings-open]'))return;const version=epoch;Promise.resolve(root.BS_CAREER?.ready).then(()=>{if(version===epoch&&!doc.hidden)enter(current(),{key:route+':'+(root.BS_CAREER?.account?.()||'guest')});}).catch(()=>{});});
})(window);
