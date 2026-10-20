/* Tahdia v25.3.0 — local arena worlds with compact obstacles and owner cosmetics.
 * Multiplayer physics/cosmetics remain server-authoritative and unchanged.
 */
export const SERPENT_WORLDS = Object.freeze({
 classic:Object.freeze({id:'classic',name:'الحلبة الأصلية',width:1400,height:1400,foodCount:260,obstacles:0,description:'حلبة سريعة بدون حواجز، مناسبة للتدريب والمواجهات.'}),
 neon:Object.freeze({id:'neon',name:'مدينة النيون',width:2000,height:2000,foodCount:335,obstacles:22,description:'أبراج مضيئة صغيرة، وممرات واسعة للالتفاف والمطاردة.'}),
 forest:Object.freeze({id:'forest',name:'غابة البرق',width:2400,height:2400,foodCount:350,obstacles:30,description:'أكبر خريطة: صخور صغيرة ومناطق طاقة وأكل غني.'}),
 crystals:Object.freeze({id:'crystals',name:'ساحة البلورات',width:2200,height:2200,foodCount:345,obstacles:26,description:'بلورات ملونة صغيرة واندفاعات كنوز متكررة.'}),
 volcano:Object.freeze({id:'volcano',name:'فوهة البركان',width:2100,height:2100,foodCount:315,obstacles:34,description:'حلبة حمم متوهجة؛ مناطق الخطر تتبدل ومطر الكنوز أقصر.'}),
 ruins:Object.freeze({id:'ruins',name:'أطلال العمالقة',width:2300,height:1900,foodCount:330,obstacles:38,description:'أعمدة حجرية وممرات ضيقة تكافئ الالتفاف الذكي.'}),
 storm:Object.freeze({id:'storm',name:'عين العاصفة',width:2000,height:2200,foodCount:320,obstacles:24,description:'عاصفة طاقة دورية، بلورات عالية القيمة وتبدّل في الإيقاع.'})
});
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
function rnd(state){state.seed=(Math.imul(state.seed,1664525)+1013904223)>>>0;return state.seed/4294967296;}
function compactObstacles(game,preset){
 const state={seed:((Number(game.seed)||1234567)^(preset.width*73)^(preset.height*113))>>>0},result=[];
 if(preset.id==='ruins'){for(const [x,y,r] of [[.28,.30,43],[.72,.30,43],[.28,.70,43],[.72,.70,43],[.5,.5,31]]){const o={x:Math.round(game.width*x),y:Math.round(game.height*y),radius:r,style:1};if(!game.snakes?.some(s=>Math.hypot(s.x-o.x,s.y-o.y)<175))result.push(o);}}
 if(preset.id==='volcano'){for(let i=0;i<8;i++){const a=i*Math.PI/4,o={x:Math.round(game.width/2+Math.cos(a)*game.width*.22),y:Math.round(game.height/2+Math.sin(a)*game.height*.22),radius:24+(i%3)*7,style:2};if(!game.snakes?.some(s=>Math.hypot(s.x-o.x,s.y-o.y)<175))result.push(o);}}
 if(preset.id==='storm'){for(let i=0;i<6;i++){const a=i*Math.PI/3,o={x:Math.round(game.width/2+Math.cos(a)*game.width*.29),y:Math.round(game.height/2+Math.sin(a)*game.height*.29),radius:22,style:0};if(!game.snakes?.some(s=>Math.hypot(s.x-o.x,s.y-o.y)<175))result.push(o);}}
 for(let tries=0;result.length<preset.obstacles&&tries<preset.obstacles*60;tries++){
  const x=80+rnd(state)*(game.width-160),y=80+rnd(state)*(game.height-160),radius=19+Math.floor(rnd(state)*16);
  if(game.snakes?.some(s=>Math.hypot(s.x-x,s.y-y)<175))continue;
  if(result.some(o=>Math.hypot(o.x-x,o.y-y)<o.radius+radius+130))continue;
  result.push({x:Math.round(x),y:Math.round(y),radius,style:tries%3});
 }
 return result;
}
function moveFoodOffWalls(game,world){
 for(const piece of game.food||[]){
  const o=world.obstacles.find(w=>Math.hypot((piece.x||0)-w.x,(piece.y||0)-w.y)<w.radius+14);
  if(!o)continue;
  const a=((Number(String(piece.id).replace(/\D/g,''))||7)*2.399963229728653)% (Math.PI*2);
  const r=o.radius+25;piece.x=clamp(o.x+Math.cos(a)*r,22,game.width-22);piece.y=clamp(o.y+Math.sin(a)*r,22,game.height-22);
 }
}
function upgradeFood(game,world,force=false){
 if(!force&&game.elapsed<world.nextFoodUpgrade)return;
 world.nextFoodUpgrade=game.elapsed+1.5;
 const frenzy=world.frenzy,challenge=world.challenge==='treasure';
 const odds=frenzy?.5:challenge?.36:world.id==='crystals'?.25:.16;
 for(const piece of game.food||[]){
  if(piece.worldEnhanced)continue;
  const n=(Math.imul((Number(String(piece.id).replace(/\D/g,''))||0)+19,2654435761)>>>0)%997/997;
  if(n<odds){piece.kind=n<odds*.55?'gem':'star';piece.value=frenzy?7:challenge?6:world.id==='crystals'?5:4;piece.radius=5+Math.sqrt(piece.value);}
  piece.worldEnhanced=true;
 }
 moveFoodOffWalls(game,world);
}
export function ownerAllowed(access,catalog=[]){
 // Read from the existing server-backed account entitlement; never use an input name or URL flag.
 return access?.role==='owner'&&Array.isArray(catalog);
}
export function setupSerpentWorld(game,id,options={}){
 const p=SERPENT_WORLDS[id]||SERPENT_WORLDS.classic;
 if(!game||!Array.isArray(game.snakes)||!Array.isArray(game.food))throw new TypeError('Invalid serpent game');
 const world={id:p.id,name:p.name,challenge:options.challenge||'survival',difficulty:options.difficulty||game.difficulty,obstacles:compactObstacles(game,p),nextFoodUpgrade:0,frenzy:false,lastFrenzyCycle:-1,ownerSnakeId:options.ownerAllowed===true?options.ownerSnakeId:null,ownerBadge:options.ownerAllowed===true&&!!options.ownerSnakeId,lastEvent:'',lastEventAt:-100};
 game.world=world;
 if(world.difficulty==='legendary')for(const s of game.snakes)if(s.bot)s.mass=Math.max(44,Number(s.mass)||0);
 upgradeFood(game,world,true);return world;
}
export function advanceSerpentWorld(game){
 const w=game?.world;if(!w||game.status!=='playing')return [];
 const events=[],seconds=Number(game.elapsed)||0,cycle=Math.floor(seconds/35),within=seconds%35;
 const active=w.id!=='classic'&&within>=(w.id==='storm'?12:18)&&within<(w.id==='storm'?25:27);
 if(w.id==='volcano'&&Math.floor(seconds/14)!==Math.floor((seconds-.04)/14)){w.hotSector=(Math.floor(seconds/14)%4);w.lastEvent='🌋 تبدّلت منطقة الحمم — غيّر مسارك!';w.lastEventAt=seconds;}
 if(w.id==='storm'&&Math.floor(seconds/20)!==Math.floor((seconds-.04)/20)){w.lastEvent='🌩️ موجة عاصفة — البلورات أثمن الآن';w.lastEventAt=seconds;}
 if(active&&!w.frenzy){w.lastFrenzyCycle=cycle;w.lastEvent='⚡ مطر الكنوز — أكل نادر وطاقة مضاعفة';w.lastEventAt=seconds;}
 w.frenzy=active;upgradeFood(game,w);
 for(const snake of game.snakes){
  if(!snake.alive)continue;
  if(w.id==='volcano'&&w.hotSector!=null){const a=Math.atan2(snake.y-game.height/2,snake.x-game.width/2),sector=((Math.round(a/(Math.PI/2))+4)%4);if(sector===w.hotSector&&Math.hypot(snake.x-game.width/2,snake.y-game.height/2)>game.width*.18&&seconds>=(snake.lavaHitReady||0)){snake.lavaHitReady=seconds+1.8;snake.mass=Math.max(16,snake.mass-2);snake.targetAngle=Math.atan2(game.height/2-snake.y,game.width/2-snake.x);events.push({type:'lava',id:snake.id});if(!snake.bot){w.lastEvent='🔥 الحمم أحرقت طاقة — غيّر مسارك!';w.lastEventAt=seconds;}}}
  // A small obstacle blocks passage, but knocks the snake aside instead of instant death.
  const o=w.obstacles.find(o=>Math.hypot(snake.x-o.x,snake.y-o.y)<o.radius+14);
  if(o){const a=Math.atan2(snake.y-o.y,snake.x-o.x)||0,r=o.radius+15;
   const x=clamp(o.x+Math.cos(a)*r,24,game.width-24),y=clamp(o.y+Math.sin(a)*r,24,game.height-24),dx=x-snake.x,dy=y-snake.y;
   snake.x=x;snake.y=y;if(Array.isArray(snake.segments))for(const part of snake.segments){part.x+=dx;part.y+=dy;}
   if(seconds>=(snake.worldBumpReady||0)){
    snake.worldBumpReady=seconds+1.6;snake.mass=Math.max(16,(Number(snake.mass)||24)-1.5);
    snake.targetAngle=a+.2;snake.nextThinkAt=seconds+.4;
    events.push({type:'bump',id:snake.id});if(!snake.bot){w.lastEvent='انتبه! اصطدمت بحاجز وخسرت طاقة بسيطة';w.lastEventAt=seconds;}
   }
  }
  if(w.difficulty==='legendary'&&snake.bot){
   if(seconds-(snake.worldLastChase||0)>.33){snake.worldLastChase=seconds;
    const humans=game.snakes.filter(s=>s.alive&&!s.bot),nearest=humans.map(h=>({h,d:Math.hypot(h.x-snake.x,h.y-snake.y)})).sort((a,b)=>a.d-b.d)[0];
    if(nearest&&nearest.d<460){snake.targetAngle=Math.atan2(nearest.h.y-snake.y,nearest.h.x-snake.x);snake.nextThinkAt=seconds+.3;}
   }
  }
 }
 return events;
}
const THEMES={neon:['#0dd3e2','#15495a','#11b0e9'],forest:['#b1e66b','#215b43','#60c889'],crystals:['#d5a8ff','#534688','#a17bff'],volcano:['#ff7043','#54221e','#ffb04a'],ruins:['#d5bd8a','#504331','#f0dda8'],storm:['#72d9ff','#193b67','#d4f6ff']};
function paintObstacle(ctx,o,colors,now,animate){
 const [bright,dark,light]=colors,r=o.radius,pulse=animate?Math.sin(now/360+o.x/37)*.12:0;
 ctx.save();ctx.translate(o.x,o.y);ctx.shadowColor=bright;ctx.shadowBlur=7;
 ctx.fillStyle='#06121a';ctx.beginPath();ctx.arc(0,4,r+7,0,Math.PI*2);ctx.fill();
 ctx.shadowBlur=0;ctx.fillStyle=dark;ctx.strokeStyle=bright;ctx.lineWidth=3;
 ctx.beginPath();const corners=o.style===1?5:6;for(let k=0;k<corners;k++){const a=-Math.PI/2+k*2*Math.PI/corners,rr=r*(1+pulse)*(k%2?.93:1.07);const x=Math.cos(a)*rr,y=Math.sin(a)*rr;k?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();ctx.stroke();
 ctx.fillStyle=light;ctx.globalAlpha=.75;ctx.beginPath();ctx.arc(-r*.18,-r*.2,r*.22,0,Math.PI*2);ctx.fill();ctx.restore();
}
function paintGround(ctx,g,w,now,animate){
 const theme=THEMES[w.id];if(!theme)return;
 ctx.save();ctx.strokeStyle=theme[0];ctx.globalAlpha=.1;ctx.lineWidth=1;
 // Sparse luminous road markings; no full-screen overlays or simulated cave portals.
 const stride=w.id==='forest'?220:190;
 for(let x=stride;x<g.width;x+=stride)for(let y=stride;y<g.height;y+=stride){ctx.beginPath();ctx.moveTo(x-12,y);ctx.lineTo(x+12,y);ctx.moveTo(x,y-12);ctx.lineTo(x,y+12);ctx.stroke();}
 ctx.restore();
 for(const o of w.obstacles)paintObstacle(ctx,o,theme,now,animate);
 if(w.frenzy){ctx.save();ctx.strokeStyle=theme[0];ctx.globalAlpha=.3;ctx.lineWidth=2;ctx.strokeRect(18,18,g.width-36,g.height-36);ctx.restore();}
 for(const piece of g.food||[]){
  if(piece.kind!=='gem'&&piece.kind!=='star')continue;
  // Subtle glints around real edible objects rather than fake uncollectible decoration.
  ctx.save();ctx.strokeStyle=piece.kind==='gem'?'#a4efff':'#ffdb7f';ctx.globalAlpha=.42;ctx.lineWidth=2;
  const r=12+(animate?Math.sin(now/340+piece.x)*2:0);ctx.beginPath();ctx.arc(piece.x,piece.y,r,0,Math.PI*2);ctx.stroke();ctx.restore();
 }
}
function paintRoyal(ctx,s,now,animate){
 // Unique owner avatar: "Void Wyrm". No crown; a spectral dragon crest with rune orbit,
 // twin horns, glowing eyes and a moving eclipse aura. Cosmetic only.
 const t=animate?now/1000:0,r=27+(animate?Math.sin(t*3)*1.8:0);
 ctx.save();ctx.translate(s.x,s.y);
 // Eclipse rings and broken rune orbit
 ctx.globalCompositeOperation='lighter';
 ctx.shadowColor='#7cf7ff';ctx.shadowBlur=24;
 ctx.strokeStyle='#37dfff';ctx.lineWidth=3;ctx.globalAlpha=.8;
 ctx.beginPath();ctx.ellipse(0,0,r+8,r*.72,animate?t*.22:0,.2,Math.PI*1.82);ctx.stroke();
 ctx.strokeStyle='#c18cff';ctx.lineWidth=2;ctx.globalAlpha=.85;
 ctx.beginPath();ctx.ellipse(0,0,r+15,r*.9,animate?-t*.3:0,Math.PI*1.05,Math.PI*2.72);ctx.stroke();
 // Rune sparks travel around the head
 for(let k=0;k<6;k++){
  const a=(Math.PI*2*k/6)+(animate?t*(k%2?-.75:.9):0),rr=r+12+(k%2)*4;
  const x=Math.cos(a)*rr,y=Math.sin(a)*rr;
  ctx.save();ctx.translate(x,y);ctx.rotate(a+t);
  ctx.fillStyle=k%2?'#d6a4ff':'#9affff';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=12;
  ctx.beginPath();ctx.moveTo(0,-4);ctx.lineTo(3,0);ctx.lineTo(0,4);ctx.lineTo(-3,0);ctx.closePath();ctx.fill();ctx.restore();
 }
 // Dragon head silhouette oriented with the snake
 ctx.globalCompositeOperation='source-over';ctx.rotate((Number(s.angle)||0)+Math.PI/2);
 ctx.shadowColor='#27e7ff';ctx.shadowBlur=20;
 const grad=ctx.createLinearGradient(-18,-20,18,18);
 grad.addColorStop(0,'#d5fbff');grad.addColorStop(.38,'#36bde9');grad.addColorStop(1,'#5130a0');
 ctx.fillStyle=grad;ctx.strokeStyle='#b6fbff';ctx.lineWidth=2.2;
 ctx.beginPath();
 ctx.moveTo(0,-25);ctx.lineTo(10,-18);ctx.lineTo(19,-30);ctx.lineTo(17,-12);
 ctx.lineTo(23,-2);ctx.lineTo(12,8);ctx.lineTo(9,17);ctx.lineTo(0,22);
 ctx.lineTo(-9,17);ctx.lineTo(-12,8);ctx.lineTo(-23,-2);ctx.lineTo(-17,-12);
 ctx.lineTo(-19,-30);ctx.lineTo(-10,-18);ctx.closePath();ctx.fill();ctx.stroke();
 // Brow ridges and twin cyan eyes
 ctx.shadowColor='#f4ffff';ctx.shadowBlur=9;ctx.fillStyle='#f5ffff';
 for(const x of [-8,8]){ctx.beginPath();ctx.ellipse(x,-4,3.1,5.2,x*.025,0,Math.PI*2);ctx.fill();}
 ctx.fillStyle='#18264d';for(const x of [-8,8]){ctx.beginPath();ctx.arc(x,-3,1.4,0,Math.PI*2);ctx.fill();}
 // Energy fangs
 ctx.shadowBlur=7;ctx.fillStyle='#a6ffff';ctx.beginPath();
 ctx.moveTo(-5,11);ctx.lineTo(-2,17);ctx.lineTo(0,11);ctx.lineTo(2,17);ctx.lineTo(5,11);ctx.closePath();ctx.fill();
 ctx.restore();
}
function paintWorldEffects(ctx,g,w,now,animate){
 if(!animate)return;
 const t=now/1000,cx=g.width/2,cy=g.height/2;
 ctx.save();
 if(w.id==='volcano'){
  // Pulsing magma fissures and ember sparks around the currently dangerous sector.
  const a=(w.hotSector||0)*Math.PI/2;
  ctx.strokeStyle='#ff6738';ctx.shadowColor='#ff351d';ctx.shadowBlur=13;ctx.lineWidth=3;ctx.globalAlpha=.55;
  for(let k=0;k<7;k++){
   const rr=g.width*(.2+k*.035),ang=a-.32+k*.1;
   ctx.beginPath();ctx.moveTo(cx+Math.cos(ang)*rr,cy+Math.sin(ang)*rr);
   ctx.lineTo(cx+Math.cos(ang+.025)* (rr+28),cy+Math.sin(ang+.025)*(rr+28));
   ctx.lineTo(cx+Math.cos(ang-.018)*(rr+51),cy+Math.sin(ang-.018)*(rr+51));ctx.stroke();
  }
  for(let k=0;k<14;k++){const q=(t*.18+k/14)%1,ang=a-.48+q*.96,rr=g.width*(.16+q*.3);
   ctx.globalAlpha=.18+(1-q)*.55;ctx.fillStyle=k%2?'#ffd36b':'#ff542f';
   ctx.beginPath();ctx.arc(cx+Math.cos(ang)*rr,cy+Math.sin(ang)*rr,2+(k%3),0,Math.PI*2);ctx.fill();}
 }else if(w.id==='ruins'){
  // Ancient glyph rings pulse around the central relic; no solid collision geometry.
  ctx.translate(cx,cy);ctx.rotate(t*.045);ctx.strokeStyle='#e9cf91';ctx.shadowColor='#d4a85c';ctx.shadowBlur=9;ctx.globalAlpha=.3;ctx.lineWidth=2;
  for(let ring=0;ring<3;ring++){ctx.beginPath();ctx.ellipse(0,0,g.width*(.12+ring*.055),g.height*(.1+ring*.05),ring*.35,0,Math.PI*2);ctx.stroke();}
  for(let k=0;k<12;k++){const a=k*Math.PI/6,rr=Math.min(g.width,g.height)*.25;ctx.save();ctx.translate(Math.cos(a)*rr,Math.sin(a)*rr);ctx.rotate(-a);ctx.fillStyle='#ffe9ac';ctx.globalAlpha=.3+.15*Math.sin(t*2+k);ctx.fillRect(-2,-6,4,12);ctx.restore();}
 }else if(w.id==='storm'){
  // Moving wind bands and periodic lightning arcs at the arena edge.
  ctx.strokeStyle='#8beaff';ctx.shadowColor='#65dfff';ctx.shadowBlur=12;ctx.lineWidth=2;ctx.globalAlpha=.22;
  for(let k=0;k<9;k++){const y=(k* g.height/9 + (t*55)%g.height);ctx.beginPath();ctx.moveTo(20,y);ctx.bezierCurveTo(g.width*.32,y-24,g.width*.64,y+24,g.width-20,y-8);ctx.stroke();}
  if(Math.floor(t/8)%4===0){const side=Math.floor(t/8)%4;ctx.globalAlpha=.65;ctx.lineWidth=3;ctx.beginPath();
   if(side===0){ctx.moveTo(80,0);ctx.lineTo(120,70);ctx.lineTo(92,118);ctx.lineTo(175,188);}
   else if(side===1){ctx.moveTo(g.width,120);ctx.lineTo(g.width-85,155);ctx.lineTo(g.width-52,225);ctx.lineTo(g.width-160,280);}
   else if(side===2){ctx.moveTo(g.width-100,g.height);ctx.lineTo(g.width-140,g.height-75);ctx.lineTo(g.width-80,g.height-130);}
   else {ctx.moveTo(0,g.height-100);ctx.lineTo(75,g.height-145);ctx.lineTo(42,g.height-205);ctx.lineTo(132,g.height-245);}ctx.stroke();}
 }
 ctx.restore();
}
export function drawSerpentWorld(renderer,now=0){
 const g=renderer?.game,w=g?.world;if(!w||!renderer?.ctx)return;
 const ctx=renderer.ctx,views=renderer.viewRects?.();if(!Array.isArray(views))return;
 const animate=!renderer.reducedMotion&&renderer.quality!=='fast';
 ctx.save();ctx.setTransform(renderer.dpr||1,0,0,renderer.dpr||1,0,0);
 for(let i=0;i<views.length;i++){
  const v=views[i],camera=renderer.cameras?.get(renderer.ids[i]);if(!v||!camera)continue;
  ctx.save();ctx.beginPath();ctx.rect(v.x,v.y,v.w,v.h);ctx.clip();ctx.translate(v.x+v.w/2,v.y+v.h/2);ctx.scale(camera.zoom,camera.zoom);ctx.translate(-camera.x,-camera.y);
  if(w.id!=='classic')paintGround(ctx,g,w,now,animate);
  if(w.id==='volcano'){ctx.save();ctx.globalAlpha=.13;ctx.fillStyle='#ff522e';const a=(w.hotSector||0)*Math.PI/2;ctx.beginPath();ctx.moveTo(g.width/2,g.height/2);ctx.arc(g.width/2,g.height/2,g.width*.47,a-.46,a+.46);ctx.closePath();ctx.fill();ctx.restore();}
  if(w.id==='storm'&&w.frenzy){ctx.save();ctx.strokeStyle='#a8eaff';ctx.globalAlpha=.35;ctx.lineWidth=8;ctx.beginPath();ctx.arc(g.width/2,g.height/2,Math.min(g.width,g.height)*.32+Math.sin(now/160)*18,0,Math.PI*2);ctx.stroke();ctx.restore();}
  paintWorldEffects(ctx,g,w,now,animate);
  if(w.ownerBadge){const snake=g.snakes.find(s=>s.id===w.ownerSnakeId&&s.alive);if(snake)paintRoyal(ctx,snake,now,animate);}
  ctx.restore();
 }
 ctx.restore();
}
