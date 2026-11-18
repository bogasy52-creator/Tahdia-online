(function(root){
 'use strict';if(root.BS_LEGEND_FRAMES)return;
 const doc=root.document,live=new Set(),seen=new Set(),palettes={eclipse:['#f6cf71','#58233c'],tide:['#68e5df','#12435c'],sakura:['#efb4cb','#60384b'],forge:['#ec9850','#4b171a'],astral:['#b8b0ff','#2c2355'],arabesque:['#e8c77d','#164f4f']};
 let serial=0,generation=0,queue=[],running=false,currentMatch='';
 const enabled=()=>{try{return root.localStorage?.getItem('bs-legend-scenes-v1')!=='off';}catch{return true;}};
 const setEnabled=value=>{try{root.localStorage?.setItem('bs-legend-scenes-v1',value?'on':'off');}catch{}if(!value)cancel();return enabled();};
 const reduced=()=>root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
 const spec=id=>root.BS_CAREER_CORE?.CATALOG?.find(i=>i.id===id&&i.type==='frame'&&i.collection==='legend-frames-33-11-5')||null;
 const node=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=String(text);return n;};
 try{for(const key of JSON.parse(root.sessionStorage?.getItem('bs-legend-seen-v1')||'[]'))if(typeof key==='string')seen.add(key);}catch{}
 function remember(key){seen.add(key);while(seen.size>96)seen.delete(seen.values().next().value);try{root.sessionStorage?.setItem('bs-legend-seen-v1',JSON.stringify([...seen]));}catch{}}
 function theme(el,item){const [edge,bed]=palettes[item.design]||palettes.eclipse;el.style.setProperty('--legend-edge',edge);el.style.setProperty('--legend-bed',bed);el.dataset.legendKind=item.entryEffect;el.dataset.legendFont=item.nameFont||'royal';}
 function decorateAvatar(el,id){
  if(!el)return;const item=spec(id),old=el.querySelector('.legend-ornament');
  if(!item){old?.remove();el.classList.remove('legend-decorated');delete el.dataset.legendFrame;return;}
  el.classList.add('legend-decorated');theme(el,item);if(el.dataset.legendFrame===id&&old)return;old?.remove();el.dataset.legendFrame=id;
  const art=node('span','legend-ornament');art.setAttribute('aria-hidden','true');art.innerHTML=root.BS_LEGEND_ART?.markup(id,'legend-'+(++serial)+'-')||'';el.append(art);
 }
 function decorateName(el,id){if(!el)return;const item=spec(id);el.classList.toggle('legend-name',Boolean(item));if(item){theme(el,item);el.dataset.legendFrame=id;}else{delete el.dataset.legendFrame;}}
 function makePortrait(id,player={}){
  const face=node('span','bs-avatar legend-scene-avatar'),src=root.BS_CAREER_CORE?.heroFace?.(player.character||'fox');
  if(src){const image=node('img');image.src=src;image.alt='';face.append(image);}else face.append(node('b',null,String(player.name||'أنت').slice(0,1)));
  decorateAvatar(face,id);return face;
 }
 function play(id,pose,{name='أنت',character='fox',container=null,preview=false}={}){
  const item=spec(id);if(!item||!['entry','win'].includes(pose)||(!preview&&(!enabled()||doc.visibilityState==='hidden')))return{destroy(){},finished:Promise.resolve()};
  const host=container||doc.fullscreenElement||doc.body;if(!host)return{destroy(){},finished:Promise.resolve()};
  const scene=node('div','legend-scene'+(preview?' is-preview':''));scene.dataset.pose=pose;scene.dataset.legendFrame=id;scene.setAttribute('aria-hidden','true');theme(scene,item);
  const stage=node('div','legend-scene-stage'),halo=node('i','legend-scene-halo'),rays=node('div','legend-scene-rays');
  if(['royal','gate'].includes(item.entryEffect)){stage.append(node('i','legend-gate is-left'),node('i','legend-gate is-right'));}
  stage.append(halo,rays,makePortrait(id,{name,character}));
  const title=node('strong','legend-scene-name',name);decorateName(title,id);stage.append(title,node('span','legend-scene-caption',pose==='win'?item.name+' · '+item.features.find(x=>x.startsWith('فوز:'))?.slice(4):item.name+' · '+item.features.find(x=>x.startsWith('دخول:'))?.slice(6)));
  if(!reduced())for(let i=0;i<(pose==='win'?18:10);i++){const p=node('i','legend-particle'),a=i*Math.PI*2/(pose==='win'?18:10);p.style.setProperty('--dx',Math.round(Math.cos(a)*(pose==='win'?210:150))+'px');p.style.setProperty('--dy',Math.round(item.entryEffect==='bloom'&&pose==='win'?Math.abs(Math.sin(a))*170+60:item.entryEffect==='wave'?-Math.abs(Math.sin(a))*160:Math.sin(a)*(pose==='win'?150:100))+'px');p.style.setProperty('--delay',i%5*.035+'s');rays.append(p);}
  scene.append(stage);host.append(scene);let resolve,ended=false,timer;const finished=new Promise(r=>{resolve=r;});
  const result={finished,destroy(){if(ended)return;ended=true;root.clearTimeout(timer);scene.remove();live.delete(result);resolve();}};live.add(result);
  timer=root.setTimeout(result.destroy,reduced()?850:pose==='win'?2200:1450);
  root.BS_AUDIO?.play?.('legend-'+item.design+'-'+pose,{volume:pose==='win'?.42:.32});
  try{root.dispatchEvent?.(new root.CustomEvent('bs-legend-effect',{detail:{id,pose,name,preview}}));}catch{}
  return result;
 }
 function cancel(){generation++;queue=[];running=false;for(const effect of [...live])effect.destroy();}
 function drain(){if(running||!queue.length)return;running=true;const ticket=generation,job=queue.shift(),effect=play(job.id,job.pose,job.player);effect.finished.then(()=>{if(ticket!==generation)return;running=false;drain();});}
 function frame(next){
  if(!next){cancel();currentMatch='';return;}if(!next.state||!Array.isArray(next.players)||!enabled())return;
  const match=String(next.code)+':'+String(next.startedAt||0),players=next.players,me=next.me?.index??-1;
  if(currentMatch&&currentMatch!==match)cancel();currentMatch=match;
  const add=(p,pose)=>{const id=p.look?.frame,key=match+':'+pose+':'+(p.id||p.index);if(!spec(id)||seen.has(key))return;remember(key);queue.push({id,pose,player:{name:p.name||'لاعب',character:p.look?.character||p.character||'fox'}});};
  if(next.status==='playing'){
   [...players].sort((a,b)=>(b.index===me)-(a.index===me)).forEach(p=>add(p,'entry'));drain();
  }else if(next.status==='finished'){
   const s=next.state,winners=Number.isInteger(s.winner)?players.filter(p=>p.index===s.winner):Number.isInteger(s.winnerTeam)?players.filter(p=>p.index%2===s.winnerTeam):[];
   if(winners.some(p=>spec(p.look?.frame)&&!seen.has(match+':win:'+(p.id||p.index)))){cancel();winners.forEach(p=>add(p,'win'));drain();}
  }
 }
 function roster(container,room){if(!container||!room?.players)return;for(const p of room.players){const parent=container.querySelector('[data-player-tag="'+p.index+'"]');if(!parent||parent.tagName?.toLowerCase()==='g')continue;decorateAvatar(parent.querySelector('.room-avatar,.lp-face,.bs-avatar'),p.look?.frame);decorateName(parent.querySelector('b'),p.look?.frame);}}
 const refresh=()=>{for(const el of doc.querySelectorAll('.bs-frame')){const cls=el.className?.split?.(/\s+/).find(c=>c.startsWith('bs-frame-'));if(cls)decorateAvatar(el,'frame-'+cls.slice(9));}};
 if(!doc.getElementById('legendFramesStyle')){const css=node('link');css.id='legendFramesStyle';css.rel='stylesheet';css.href='/assets/css/legend-frames-v33-11-5.css?v=33.11.5';(doc.head||doc.documentElement)?.append(css);}
 root.BS_LEGEND_FRAMES=Object.freeze({enabled,setEnabled,spec,decorateAvatar,decorateName,play,frame,cancel,roster,refresh});
 root.addEventListener?.('bs-board-room',e=>frame(e.detail?.state||null));root.addEventListener?.('pagehide',cancel);root.addEventListener?.('bs-career-change',()=>root.setTimeout(refresh,0));
 refresh();if(root.BS_BOARD_ROOM?.state)frame(root.BS_BOARD_ROOM.state);
})(typeof window!=='undefined'?window:globalThis);
