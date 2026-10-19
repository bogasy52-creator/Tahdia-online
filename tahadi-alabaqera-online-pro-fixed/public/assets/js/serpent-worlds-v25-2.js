/* Tahdia v25.3.0 — local arena worlds with compact obstacles and owner cosmetics.
 * Multiplayer physics/cosmetics remain server-authoritative and unchanged.
 */
export const SERPENT_WORLDS = Object.freeze({
 classic:Object.freeze({id:'classic',name:'الحلبة الأصلية',width:1400,height:1400,foodCount:260,obstacles:0,description:'حلبة سريعة بدون حواجز، مناسبة للتدريب والمواجهات.'}),
 neon:Object.freeze({id:'neon',name:'مدينة النيون',width:2000,height:2000,foodCount:335,obstacles:22,description:'أبراج مضيئة صغيرة، وممرات واسعة للالتفاف والمطاردة.'}),
 forest:Object.freeze({id:'forest',name:'غابة البرق',width:2400,height:2400,foodCount:350,obstacles:30,description:'أكبر خريطة: صخور صغيرة ومناطق طاقة وأكل غني.'}),
 crystals:Object.freeze({id:'crystals',name:'ساحة البلورات',width:2200,height:2200,foodCount:345,obstacles:26,description:'بلورات ملونة صغيرة واندفاعات كنوز متكررة.'})
});
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
function rnd(state){state.seed=(Math.imul(state.seed,1664525)+1013904223)>>>0;return state.seed/4294967296;}
function compactObstacles(game,preset){
 const state={seed:((Number(game.seed)||1234567)^(preset.width*73)^(preset.height*113))>>>0},result=[];
 for(let i=0,tries=0;i<preset.obstacles&&tries<preset.obstacles*40;tries++){
  const x=80+rnd(state)*(game.width-160),y=80+rnd(state)*(game.height-160),radius=19+Math.floor(rnd(state)*16);
  if(game.snakes?.some(s=>Math.hypot(s.x-x,s.y-y)<175))continue;
  if(result.some(o=>Math.hypot(o.x-x,o.y-y)<o.radius+radius+130))continue;
  result.push({x:Math.round(x),y:Math.round(y),radius,style:i%3});i++;
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
 if(world.ownerBadge){const snake=game.snakes.find(s=>s.id===world.ownerSnakeId&&!s.bot);if(snake)snake.mass=Math.max(Number(snake.mass)||30,36);}
 if(world.difficulty==='legendary')for(const s of game.snakes)if(s.bot)s.mass=Math.max(44,Number(s.mass)||0);
 upgradeFood(game,world,true);return world;
}
export function advanceSerpentWorld(game){
 const w=game?.world;if(!w||game.status!=='playing')return [];
 const events=[],seconds=Number(game.elapsed)||0,cycle=Math.floor(seconds/35),within=seconds%35;
 const active=w.id!=='classic'&&within>=18&&within<27;
 if(active&&!w.frenzy){w.lastFrenzyCycle=cycle;w.lastEvent='⚡ مطر الكنوز — أكل نادر وطاقة مضاعفة';w.lastEventAt=seconds;}
 w.frenzy=active;upgradeFood(game,w);
 for(const snake of game.snakes){
  if(!snake.alive)continue;
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
const THEMES={neon:['#0dd3e2','#15495a','#11b0e9'],forest:['#b1e66b','#215b43','#60c889'],crystals:['#d5a8ff','#534688','#a17bff']};
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
 const r=23+(animate?Math.sin(now/400)*2:0);ctx.save();ctx.translate(s.x,s.y);
 ctx.shadowColor='#fbd478';ctx.shadowBlur=20;ctx.strokeStyle='#dfad4a';ctx.lineWidth=3;ctx.globalAlpha=.85;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();
 ctx.rotate((Number(s.angle)||0)+Math.PI/2);ctx.shadowBlur=7;ctx.fillStyle='#ffd775';ctx.strokeStyle='#6d451c';ctx.lineWidth=2;
 ctx.beginPath();ctx.moveTo(-14,-26);ctx.lineTo(-14,-42);ctx.lineTo(-6,-35);ctx.lineTo(0,-48);ctx.lineTo(7,-35);ctx.lineTo(14,-42);ctx.lineTo(14,-26);ctx.closePath();ctx.fill();ctx.stroke();
 ctx.fillStyle='#f9f2c6';ctx.beginPath();ctx.arc(0,-35,3,0,Math.PI*2);ctx.fill();ctx.restore();
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
  if(w.ownerBadge){const snake=g.snakes.find(s=>s.id===w.ownerSnakeId&&s.alive);if(snake)paintRoyal(ctx,snake,now,animate);}
  ctx.restore();
 }
 ctx.restore();
}
