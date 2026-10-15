/* Shared authoritative simulation. All distances are world units, time seconds. */
const TAU=Math.PI*2,MIN_MASS=24,MAX_MASS=180,SPACING=5;
export const SERPENT_SPEED=108,SERPENT_BOOST_SPEED=190,SERPENT_TURN_RATE=6.4;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const forgiving=g=>g.collisionMode==='tail-guard'||g.collisionMode==='predator';
export function serpentFrontParts(s){return s.mass>=60?6:4;}
export function followSerpentBody(segments,x,y,count){
 const body=segments.length?segments:[{x,y}];body[0]={x,y};
 while(body.length<count)body.push({...body.at(-1)});body.length=count;
 for(let i=1;i<body.length;i++){const prev=body[i-1],p=body[i],dx=prev.x-p.x,dy=prev.y-p.y,d=Math.hypot(dx,dy);if(d>SPACING){p.x=prev.x-dx/d*SPACING;p.y=prev.y-dy/d*SPACING;}}
 return body;
}
export function serpentSteeringAngle(g,s,desired){
 if(g.collisionMode!=='predator')return desired;
 const edge=radius(s)+30,dx=Math.cos(desired),dy=Math.sin(desired);
 if(s.x<edge&&dx<0||s.x>g.width-edge&&dx>0||s.y<edge&&dy<0||s.y>g.height-edge&&dy>0)return Math.atan2(g.height/2-s.y,g.width/2-s.x);
 return desired;
}
function random(g){let x=g.randomState|0;x^=x<<13;x^=x>>>17;x^=x<<5;g.randomState=x>>>0;return g.randomState/4294967296;}
const FOOD_TYPES=[['apple',1,0],['berry',1,4],['citrus',2,1],['grapes',2,2],['star',3,1],['gem',5,3]];
function food(g,x,y,value=1,kind='remains',hue=Math.floor(random(g)*5)){return {id:'f'+g.nextFood++,x:clamp(x,18,g.width-18),y:clamp(y,18,g.height-18),value,kind,radius:5+Math.sqrt(value),hue};}
function replenish(g){while(g.food.length<g.foodCount){const roll=random(g),index=roll<.25?0:roll<.5?1:roll<.73?2:roll<.91?3:roll<.98?4:5,[kind,value,hue]=FOOD_TYPES[index];g.food.push(food(g,25+random(g)*(g.width-50),25+random(g)*(g.height-50),value,kind,hue));}}
function makeSnake(g,player,index,count){
 const a=TAU*index/Math.max(1,count),x=g.width/2+Math.cos(a)*g.width*.29,y=g.height/2+Math.sin(a)*g.height*.29,angle=a+Math.PI;
 return {id:String(player.id),name:String(player.name||'لاعب').replace(/[<>\u0000-\u001f]/g,'').slice(0,24),skin:String(player.skin||'snake-wild'),color:player.color||['#5ce9bb','#d8a3ff','#ffc778','#71cfff','#ff92b1','#c4e779','#f6b695','#8babff'][index%8],bot:player.bot===true,x,y,angle,targetAngle:angle,boost:false,alive:true,mass:28,score:0,kills:0,segments:Array.from({length:28},(_,i)=>({x:x-Math.cos(angle)*i*SPACING,y:y-Math.sin(angle)*i*SPACING})),respawnAt:null};
}
export function createSerpentGame(players,options={}){
 if(!Array.isArray(players)||players.length<1||players.length>10||new Set(players.map(p=>p.id)).size!==players.length)throw new Error('invalid_players');
 const g={version:1,width:clamp(Number(options.width)||1800,800,2400),height:clamp(Number(options.height)||1800,800,2400),collisionMode:['tail-guard','predator'].includes(options.collisionMode)?options.collisionMode:'classic',nextTreasureAt:15,matchMode:options.matchMode==='survival'?'survival':'timed',duration:clamp(Number(options.duration)||120,.1,300),difficulty:['easy','medium','hard'].includes(options.difficulty)?options.difficulty:'medium',foodCount:clamp(Math.floor(options.foodCount??220),0,350),randomState:(Number(options.seed)>>>0)||41,nextFood:0,elapsed:0,tick:0,status:'playing',winners:[],events:[],snakes:[],food:[]};
 g.snakes=players.map((p,i)=>makeSnake(g,p,i,players.length));replenish(g);return g;
}
export function addSerpentBots(g,count){
 const add=clamp(Math.floor(Number(count)||0),0,10-g.snakes.length),total=g.snakes.length+add;
 for(let i=0;i<add;i++){const index=g.snakes.length;g.snakes.push(makeSnake(g,{id:'bot-'+index,name:['فهد','وميض','كوبرا','برق','طيف','شهاب','مرجان','صقر'][i%8],bot:true},index,total));}
 if(g.tick===0)g.snakes=g.snakes.map((s,i)=>makeSnake(g,s,i,total));
 return g;
}
export function steerSerpent(g,id,input){
 const s=g.snakes.find(s=>s.id===id);if(!s||!s.alive||s.bot||!input||typeof input.angle!=='number'||!Number.isFinite(input.angle))return false;
 s.targetAngle=Math.atan2(Math.sin(input.angle),Math.cos(input.angle));s.boost=input.boost===true&&s.mass>MIN_MASS;return true;
}
function radius(s){return 7+Math.sqrt(s.mass)*.55;}
function botSteering(g,s){
 if(forgiving(g)){
  if(g.elapsed<(s.nextThinkAt||0))return;
  s.nextThinkAt=g.elapsed+(g.difficulty==='hard'?.16:g.difficulty==='easy'?.38:.28);s.botThinkCount=(s.botThinkCount||0)+1;
  let best=null,bestValue=Infinity;const hx=Math.cos(s.angle),hy=Math.sin(s.angle);
  for(const f of g.food){const dx=f.x-s.x,dy=f.y-s.y,d2=dx*dx+dy*dy;if(d2<1600||dx*hx+dy*hy<Math.sqrt(d2)*.4)continue;const score=d2/Math.max(1,f.value);if(score<bestValue){best=f;bestValue=score;}}
  let x=best?.x??s.x+hx*240,y=best?.y??s.y+hy*240;
  x=clamp(x,90,g.width-90);y=clamp(y,90,g.height-90);
  let ax=x-s.x,ay=y-s.y,length=Math.hypot(ax,ay)||1;ax/=length;ay/=length;
  for(const other of g.snakes){if(!other.alive||other.id===s.id)continue;const p=other.segments.at(-1);if(!p)continue;const dx=s.x-p.x,dy=s.y-p.y,d=Math.hypot(dx,dy);if(d>1&&d<65){ax+=dx/d*(1-d/65);ay+=dy/d*(1-d/65);}}
  s.targetAngle=Math.atan2(ay,ax);s.boost=false;return;
 }
 const ahead=g.difficulty==='easy'?80:g.difficulty==='hard'?175:125;
 let best=null,bestDistance=Infinity;
 for(const f of g.food){const d=distance(s,f)/Math.sqrt(f.value);if(d<bestDistance){best=f;bestDistance=d;}}
 let ax=(best?.x??g.width/2)-s.x,ay=(best?.y??g.height/2)-s.y;
 const length=Math.hypot(ax,ay)||1;ax=ax/length;ay=ay/length;
 const edge=150;if(s.x<edge)ax+=2*(1-s.x/edge);if(s.x>g.width-edge)ax-=2*(1-(g.width-s.x)/edge);if(s.y<edge)ay+=2*(1-s.y/edge);if(s.y>g.height-edge)ay-=2*(1-(g.height-s.y)/edge);
 for(const other of g.snakes){if(!other.alive||other.id===s.id)continue;
  for(let i=0;i<other.segments.length;i+=4){const p=other.segments[i],d=distance(s,p);if(d<ahead&&d>1){const strength=(1-d/ahead)*2.6;ax+=(s.x-p.x)/d*strength;ay+=(s.y-p.y)/d*strength;}}
 }
 s.targetAngle=Math.atan2(ay,ax);s.boost=false;
}
function kill(g,s,by=null,reason='collision'){
 if(!s.alive)return;s.alive=false;s.boost=false;s.respawnAt=s.bot&&g.matchMode!=='survival'?g.elapsed+3:null;
 if(by?.alive){by.kills++;by.score+=10;if(reason==='front')by.mass=Math.min(MAX_MASS,by.mass+6);}
 for(let i=0;i<s.segments.length;i+=3){const p=s.segments[i];g.food.push(food(g,p.x,p.y,2));}
 g.food.push(food(g,s.x,s.y,5));g.events.push({type:'death',id:s.id,by:by?.id||null,x:s.x,y:s.y,reason});
}
function move(g,s,dt){
 if(s.bot)botSteering(g,s);
 const turn=s.bot&&forgiving(g)?(g.difficulty==='hard'?4.6:3.2):SERPENT_TURN_RATE,desired=serpentSteeringAngle(g,s,s.targetAngle),delta=angleDelta(desired,s.angle);s.angle+=clamp(delta,-turn*dt,turn*dt);if(desired!==s.targetAngle)s.targetAngle=desired;
 if(s.mass<=MIN_MASS)s.boost=false;
 let speed=s.boost?SERPENT_BOOST_SPEED:SERPENT_SPEED;
 if(s.bot)speed*=forgiving(g)?(g.difficulty==='easy'?.62:g.difficulty==='hard'?.92:.72):(g.difficulty==='easy'?.8:g.difficulty==='hard'?1:.93);
 if(s.boost){s.mass=Math.max(MIN_MASS,s.mass-4*dt);s.boostFoodTime=(s.boostFoodTime||0)+dt;if(s.boostFoodTime>=.25-1e-9){s.boostFoodTime=Math.max(0,s.boostFoodTime-.25);const tail=s.segments.at(-1)||s;g.food.push(food(g,tail.x,tail.y,1));}}else s.boostFoodTime=0;
 s.x+=Math.cos(s.angle)*speed*dt;s.y+=Math.sin(s.angle)*speed*dt;
 if(s.x<radius(s)||s.x>g.width-radius(s)||s.y<radius(s)||s.y>g.height-radius(s)){
  if(!forgiving(g)){kill(g,s);return;}
  const margin=radius(s)+1;s.x=clamp(s.x,margin,g.width-margin);s.y=clamp(s.y,margin,g.height-margin);
  s.targetAngle=Math.atan2(g.height/2-s.y,g.width/2-s.x);if(g.collisionMode!=='predator')s.angle=s.targetAngle;s.boost=false;
 }
 if(g.collisionMode==='predator'){s.segments=followSerpentBody(s.segments,s.x,s.y,Math.round(s.mass));return;}
 const old=s.segments[0]||s;if(distance(old,s)>=SPACING)s.segments.unshift({x:s.x,y:s.y});
 else if(!s.segments.length)s.segments.push({x:s.x,y:s.y});
 const count=Math.round(s.mass);while(s.segments.length<count)s.segments.push({...s.segments.at(-1)});s.segments.length=count;
}
function advanceSerpent(g,delta){
 if(g.status!=='playing')return g;const dt=clamp(Number(delta)||0,0,.1);if(dt===0)return g;
 g.elapsed=g.matchMode==='survival'?g.elapsed+dt:Math.min(g.duration,g.elapsed+dt);g.tick++;g.events=[];
 for(let i=0;i<g.snakes.length;i++){const s=g.snakes[i];if(!s.alive&&s.bot&&g.matchMode!=='survival'&&s.respawnAt<=g.elapsed){const born=makeSnake(g,s,i,g.snakes.length);born.score=s.score;born.kills=s.kills;g.snakes[i]=born;}if(g.snakes[i].alive)move(g,g.snakes[i],dt);}
 const doomed=new Map();
 const reasons=new Map();
 if(g.collisionMode==='predator'){
  const attacks=[];
  for(const a of g.snakes){if(!a.alive)continue;for(const b of g.snakes){if(!b.alive||a.id===b.id)continue;
   const contact=radius(a)*.65+radius(b)*.55;
   if(b.segments.slice(-serpentFrontParts(b)).some(p=>distance(a,p)<contact)){doomed.set(a.id,b);reasons.set(a.id,'tail');continue;}
   let nearest=-1,best=Infinity;for(let j=0;j<=serpentFrontParts(b);j++){const d=distance(a,b.segments[j]);if(d<best){best=d;nearest=j;}}
   if(best>=contact)continue;
   const p=b.segments[nearest],dx=p.x-a.x,dy=p.y-a.y;if(best<.01||dx*Math.cos(a.angle)+dy*Math.sin(a.angle)>best*.1)attacks.push({a,b,d:best});
  }}
  // Rear defense resolves first. A defeated attacker cannot eat another snake.
  const rearDeaths=new Set(doomed.keys());attacks.sort((a,b)=>a.d-b.d||a.a.id.localeCompare(b.a.id));
  for(const {a,b}of attacks)if(!rearDeaths.has(a.id)&&!rearDeaths.has(b.id)&&!doomed.has(b.id)){doomed.set(b.id,a);reasons.set(b.id,'front');}
 }else if(g.collisionMode==='tail-guard'){
  for(const a of g.snakes){if(!a.alive)continue;for(const b of g.snakes){if(!b.alive||a.id===b.id)continue;for(let j=Math.max(7,b.segments.length-8);j<b.segments.length;j+=2){if(distance(a,b.segments[j])<radius(a)+radius(b)*.76){doomed.set(a.id,b);break;}}if(doomed.has(a.id))break;}}
 }else{
 for(let i=0;i<g.snakes.length;i++){const a=g.snakes[i];if(!a.alive)continue;
  for(let j=i+1;j<g.snakes.length;j++){const b=g.snakes[j];if(!b.alive||distance(a,b)>radius(a)+radius(b))continue;
   if(a.mass>b.mass*1.25)doomed.set(b.id,a);else if(b.mass>a.mass*1.25)doomed.set(a.id,b);else{doomed.set(a.id,null);doomed.set(b.id,null);}
  }
  for(const b of g.snakes){if(!b.alive||a.id===b.id||doomed.has(a.id)||doomed.has(b.id))continue;for(let j=7;j<b.segments.length;j+=2){if(distance(a,b.segments[j])<radius(a)+radius(b)*.76){doomed.set(a.id,b);break;}}}
 }
 }
 for(const s of g.snakes)if(doomed.has(s.id)){const by=doomed.get(s.id);kill(g,s,g.collisionMode==='predator'&&doomed.has(by?.id)?null:by,reasons.get(s.id));}
 const eaten=new Set();for(const s of g.snakes){if(!s.alive)continue;
  for(const f of g.food){if(!eaten.has(f.id)&&distance(s,f)<radius(s)+f.radius){eaten.add(f.id);s.mass=Math.min(MAX_MASS,s.mass+f.value);s.score+=f.value;g.events.push({type:'eat',id:s.id,x:f.x,y:f.y,value:f.value,kind:f.kind||'berry'});}}
 }
 if(eaten.size)g.food=g.food.filter(f=>!eaten.has(f.id));if(g.food.length>700)g.food=g.food.slice(-700);replenish(g);
 if(forgiving(g)&&g.elapsed>=(g.nextTreasureAt||15)){
  g.nextTreasureAt=g.elapsed+15;const focus=g.snakes.find(s=>s.alive),x=clamp((focus?.x||g.width/2)+Math.cos(focus?.angle||0)*160,90,g.width-90),y=clamp((focus?.y||g.height/2)+Math.sin(focus?.angle||0)*160,90,g.height-90);
  for(let i=0;i<12;i++){const angle=i*TAU/12;g.food.push(food(g,x+Math.cos(angle)*55,y+Math.sin(angle)*55,i%3===0?5:3,i%3===0?'gem':'star'));}g.events.push({type:'treasure',x,y,tick:g.tick});
 }
 const humans=g.snakes.filter(s=>!s.bot),alive=humans.filter(s=>s.alive);
 const living=g.snakes.filter(s=>s.alive),survival=g.matchMode==='survival';
 if(survival?(living.length===0||g.snakes.length>1&&living.length===1):(g.elapsed>=g.duration||!alive.length||humans.length>1&&alive.length===1)){
  g.status='finished';const max=Math.max(...living.map(s=>s.score));g.winners=survival?living.map(s=>s.id):living.filter(s=>s.score===max).map(s=>s.id);for(const s of g.snakes)s.boost=false;
 }
 return g;
}
export function stepSerpent(g,delta){
 const dt=clamp(Number(delta)||0,0,.1);
 if(g.collisionMode!=='predator'||dt<=1/60+1e-9||g.status!=='playing')return advanceSerpent(g,dt);
 const count=Math.ceil(dt/(1/60)),tick=g.tick+1,events=[];
 for(let i=0;i<count&&g.status==='playing';i++){advanceSerpent(g,dt/count);events.push(...g.events);}
 g.tick=tick;g.events=events.map(e=>e.type==='treasure'?{...e,tick}:e);return g;
}
export function serpentSnapshot(g){
 return {version:1,tick:g.tick,width:g.width,height:g.height,collisionMode:g.collisionMode||'classic',matchMode:g.matchMode||'timed',elapsed:g.elapsed,duration:g.duration,status:g.status,winners:[...g.winners],events:g.events.map(e=>({...e})),snakes:g.snakes.map(({id,name,color,skin,bot,x,y,angle,boost,alive,mass,score,kills,segments})=>({id,name,color,skin,bot,x,y,angle,boost,alive,mass,score,kills,segments:segments.map(p=>({...p}))})),food:g.food.map(f=>({...f}))};
}
