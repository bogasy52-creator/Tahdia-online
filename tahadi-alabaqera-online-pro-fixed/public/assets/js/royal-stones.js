/* Faceted playing stones and short, bounded effects at real board positions. */
(function(root){
 'use strict';
 const palettes=[['#c9f7ff','#42c5f5','#15548b'],['#f4dbff','#bd75ee','#63369a'],['#fff0be','#f0c35e','#956329'],['#d0ffe8','#57d9a6','#216b55']];
 const characters=[{id:'princess',name:'الأميرة البنفسجية'},{id:'fairy',name:'جنيّة النعناع'},{id:'astronaut',name:'رائدة الفضاء'},{id:'fox',name:'الثعلب'},{id:'cat',name:'القطة الوردية'},{id:'robot',name:'الروبوت'}];
 let choices=['princess','fox','fairy','robot'],onlineChoices=null;try{const saved=JSON.parse(localStorage.getItem('bs-pawn-characters')||'null');if(Array.isArray(saved))choices=choices.map((value,index)=>characters.some(c=>c.id===saved[index])?saved[index]:value)}catch{}
 const characterId=player=>(onlineChoices||choices)[Math.abs(Number(player)||0)%4];
 const characterImages=new Map(),characterReady=Promise.all(characters.map(item=>new Promise(resolve=>{const image=new Image();characterImages.set(item.id,image);image.onload=()=>{for(const canvas of document.querySelectorAll('.crystal-sprite[data-art="character"]'))drawCharacter(canvas,Number(canvas.dataset.player));resolve()};image.onerror=resolve;image.src='assets/characters/'+item.id+'.webp';})));
 const source=new Image();source.src='assets/arena/objects.webp';
 const gemReady=new Promise(resolve=>{source.onload=()=>{for(const c of document.querySelectorAll('.crystal-sprite[data-art="royal"]'))draw(c,c.dataset.pawn,Number(c.dataset.player),{style:'royal'});resolve()};source.onerror=resolve;if(source.complete&&source.naturalWidth)resolve()}),ready=Promise.all([gemReady,characterReady]);
 const reduce=()=>root.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
 const characterBoard=document.body.classList.contains('game-snakes');
 try{const selected=localStorage.getItem('bs-piece-art');document.documentElement.dataset.pieceArt=selected==='original'?'original':characterBoard&&selected!=='royal'?'characters':'royal'}catch{document.documentElement.dataset.pieceArt=characterBoard?'characters':'royal'}
 function polygon(ctx,points,fill,stroke){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.9;ctx.stroke()}}
 function ellipse(ctx,x,y,rx,ry,fill){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill()}
 function linear(ctx,x1,y1,x2,y2,stops){const g=ctx.createLinearGradient(x1,y1,x2,y2);stops.forEach(([n,c])=>g.addColorStop(n,c));return g}
 function drawCharacter(canvas,player=0){
  const index=Math.abs(Number(player)||0)%4,id=characterId(player),image=characterImages.get(id);canvas.width=288;canvas.height=360;canvas.dataset.art='character';canvas.dataset.character=id;canvas.dataset.player=String(player);
  const ctx=canvas.getContext('2d');if(!ctx)return false;ctx.clearRect(0,0,288,360);
  ctx.strokeStyle=palettes[index][1];ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(144,339,92,12,0,0,Math.PI*2);ctx.stroke();
  if(image?.naturalWidth){const scale=Math.min(280/image.naturalWidth,354/image.naturalHeight),w=image.naturalWidth*scale,h=image.naturalHeight*scale;ctx.drawImage(image,(288-w)/2,356-h,w,h);}return true;
 }
 function draw(canvas,id='pawn-classic',player=0,options={}){
  const style=options.style||document.documentElement.dataset.pieceArt;if(style==='original')return false;if(style==='characters')return drawCharacter(canvas,player);
  canvas.width=288;canvas.height=360;canvas.dataset.art='royal';canvas.dataset.pawn=id;canvas.dataset.player=String(player);
  const ctx=canvas.getContext('2d');if(!ctx)return false;
  const [light,color,dark]=palettes[Math.abs(Number(player)||0)%4];
  ctx.setTransform(2,0,0,2,0,0);ctx.clearRect(0,0,144,180);
  ellipse(ctx,72,164,52,9,linear(ctx,20,158,120,170,[[0,'#01071200'],[.5,'#010712b8'],[1,'#01071200']]));
  const metal=linear(ctx,20,0,122,0,[[0,'#182e42'],[.18,'#7a91a5'],[.3,'#d7cba8'],[.52,'#42586f'],[.78,'#b8aa83'],[1,'#102234']]);
  polygon(ctx,[[24,137],[120,137],[116,155],[99,165],[44,165],[28,155]],metal,'#d3bc8060');
  ellipse(ctx,72,138,49,16,'#132b40');ellipse(ctx,72,138,46,12,metal);ellipse(ctx,72,137,36,8,'#071b2b');
  ctx.strokeStyle=color;ctx.lineWidth=2.2;ctx.beginPath();ctx.ellipse(72,147,46,10,0,0,Math.PI);ctx.stroke();
  polygon(ctx,[[47,117],[97,117],[105,130],[96,143],[47,143],[39,130]],metal,'#e2d0a570');
  ellipse(ctx,72,121,29,8,'#071b2b');ellipse(ctx,72,121,26,6,color);ellipse(ctx,72,122,20,4,dark);
  ctx.save();ctx.shadowColor=color;ctx.shadowBlur=10;
  if(id==='pawn-orb'){
   const g=ctx.createRadialGradient(56,48,2,74,73,42);g.addColorStop(0,'#ffffff');g.addColorStop(.22,light);g.addColorStop(.52,color);g.addColorStop(1,dark);
   ellipse(ctx,72,70,38,41,g);
   ctx.strokeStyle=light;ctx.lineWidth=1.1;ctx.beginPath();ctx.ellipse(72,70,36,13,-.38,0,Math.PI*2);ctx.stroke();
  }else if(id==='pawn-crown'){
   const gold=linear(ctx,39,35,103,98,[[0,'#fff0bb'],[.3,'#e8be6c'],[.7,'#916136'],[1,'#f7d27e']]);
   polygon(ctx,[[38,57],[51,72],[60,33],[73,67],[88,31],[94,73],[109,52],[99,110],[48,110]],gold,'#f9e7ba');
   for(const [x,y] of [[60,33],[88,31],[38,57],[109,52]])ellipse(ctx,x,y,4,4,light);
   polygon(ctx,[[72,77],[81,88],[73,102],[64,89]],color,light);
  }else{
   const tip=[72,15],left=[39,48],right=[105,48],bottom=[72,115],mid=[72,65];
   polygon(ctx,[tip,right,[98,92],bottom,[46,92],left],linear(ctx,38,34,105,106,[[0,light],[.25,color],[.68,dark],[1,color]]),light);
   polygon(ctx,[tip,left,mid],light);polygon(ctx,[tip,mid,right],color);
   polygon(ctx,[left,[46,92],mid],color);polygon(ctx,[mid,[46,92],bottom],dark);
   polygon(ctx,[mid,bottom,[98,92]],color);polygon(ctx,[mid,[98,92],right],dark);
   polygon(ctx,[[55,45],[72,25],[86,45],[72,65]],linear(ctx,55,30,86,66,[[0,'#ffffffcc'],[.5,light],[1,color]]),'#ffffffb0');
   ctx.strokeStyle='#ffffffaa';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(72,16);ctx.lineTo(40,48);ctx.lineTo(47,91);ctx.stroke();
   if(source.naturalWidth){ctx.save();ctx.filter='hue-rotate('+[0,77,-150,-41][Math.abs(Number(player)||0)%4]+'deg)'+(id==='pawn-onyx'?' brightness(.6)':'');ctx.drawImage(source,890,80,280,380,34,6,76,112);ctx.restore();}
  }
  ctx.restore();
  for(const x of [42,102]){ellipse(ctx,x,134,2.2,2.2,color);ellipse(ctx,x-.5,133.5,.8,.8,'#fff')}
  ctx.strokeStyle='#fff7cfbb';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(50,157);ctx.lineTo(88,157);ctx.stroke();
  return true;
 }
 function step(wrap,point,color,{landing=false}={}){
  if(!wrap||!point||reduce()||document.hidden||root.BS_PRO?.paused)return;
  const effects=wrap.querySelectorAll('.stone-step-fx');if(effects.length>=12)effects[0].remove();
  const el=document.createElement('span');el.className='stone-step-fx'+(landing?' stone-land-fx':'');el.setAttribute('aria-hidden','true');
  el.style.left=point.x+'px';el.style.top=point.y+'px';el.style.setProperty('--step-color',color);el.innerHTML='<i class="stone-ripple"></i>';
  for(let n=0;n<(landing?7:4);n++){const shard=document.createElement('b'),a=n/(landing?7:4)*Math.PI*2;shard.style.setProperty('--spark-x',Math.cos(a)*(landing?31:20)+'px');shard.style.setProperty('--spark-y',Math.sin(a)*(landing?26:16)-10+'px');el.appendChild(shard)}
  wrap.appendChild(el);el.addEventListener('animationend',()=>el.remove(),{once:true});setTimeout(()=>el.remove(),850);
 }
 root.BS_STONES={draw,step,ready,characters,characterName:player=>characters.find(c=>c.id===characterId(player))?.name,setOnlineCharacters:players=>{onlineChoices=Array.isArray(players)?['princess','fox','fairy','robot'].map((value,index)=>characters.some(c=>c.id===players[index]?.character)?players[index].character:value):null;}};
 const select=document.getElementById('pieceStyle');
 const pickers=document.getElementById('characterPickers'),syncPickers=()=>pickers?.classList.toggle('hidden',document.documentElement.dataset.pieceArt!=='characters');
 if(select){select.value=document.documentElement.dataset.pieceArt;syncPickers();select.addEventListener('change',()=>{document.documentElement.dataset.pieceArt=select.value;syncPickers();try{localStorage.setItem('bs-piece-art',select.value)}catch{}root.dispatchEvent(new CustomEvent('bs-piece-art-change'))})}
 for(let player=0;player<4;player++){const field=document.getElementById('pawnCharacter'+player),preview=document.getElementById('pawnPreview'+player);if(!field)continue;field.value=choices[player];const paint=()=>{if(preview){preview.src='assets/characters/'+choices[player]+'.webp';preview.alt=root.BS_STONES.characterName(player)}};paint();field.addEventListener('change',()=>{if(!characters.some(c=>c.id===field.value))return;choices[player]=field.value;paint();try{localStorage.setItem('bs-pawn-characters',JSON.stringify(choices))}catch{}root.dispatchEvent(new CustomEvent('bs-piece-art-change'))});}
 const ownCharacter=document.getElementById('onlineCharacter');if(ownCharacter){let chosen;try{chosen=localStorage.getItem('bs-online-character')}catch{}ownCharacter.value=characters.some(c=>c.id===chosen)?chosen:choices[0];const preview=()=>{const image=document.getElementById('onlineCharacterPreview');if(image){image.src='assets/characters/'+ownCharacter.value+'.webp';image.alt=characters.find(c=>c.id===ownCharacter.value)?.name||''}};preview();ownCharacter.addEventListener('change',()=>{preview();try{localStorage.setItem('bs-online-character',ownCharacter.value)}catch{}root.dispatchEvent(new CustomEvent('bs-online-character-change',{detail:{id:ownCharacter.value}}))});}
})(window);
