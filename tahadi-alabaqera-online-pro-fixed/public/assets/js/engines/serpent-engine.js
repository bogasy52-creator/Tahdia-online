/* Shared authoritative simulation. All distances are world units, time seconds. */
const TAU=Math.PI*2,MIN_MASS=24,MAX_MASS=180,SPACING=5;
export const SERPENT_SPEED=108,SERPENT_BOOST_SPEED=190,SERPENT_TURN_RATE=6.4;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
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
 const g={version:1,width:clamp(Number(options.width)||1800,800,2400),height:clamp(Number(options.height)||1800,800,2400),matchMode:options.matchMode==='survival'?'survival':'timed',duration:clamp(Number(options.duration)||120,.1,300),difficulty:['easy','medium','hard'].includes(options.difficulty)?options.difficulty:'medium',foodCount:clamp(Math.floor(options.foodCount??220),0,350),randomState:(Number(options.seed)>>>0)||41,nextFood:0,elapsed:0,tick:0,status:'playing',winners:[],events:[],snakes:[],food:[]};
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
function kill(g,s,by=null){
 if(!s.alive)return;s.alive=false;s.boost=false;s.respawnAt=s.bot&&g.matchMode!=='survival'?g.elapsed+3:null;
 if(by?.alive){by.kills++;by.score+=10;}
 for(let i=0;i<s.segments.length;i+=3){const p=s.segments[i];g.food.push(food(g,p.x,p.y,2));}
 g.food.push(food(g,s.x,s.y,5));g.events.push({type:'death',id:s.id,by:by?.id||null,x:s.x,y:s.y});
}
function move(g,s,dt){
 if(s.bot)botSteering(g,s);
 const delta=angleDelta(s.targetAngle,s.angle);s.angle+=clamp(delta,-SERPENT_TURN_RATE*dt,SERPENT_TURN_RATE*dt);
 if(s.mass<=MIN_MASS)s.boost=false;
 let speed=s.boost?SERPENT_BOOST_SPEED:SERPENT_SPEED;
 if(s.bot)speed*=g.difficulty==='easy'?.8:g.difficulty==='hard'?1:.93;
 if(s.boost){s.mass=Math.max(MIN_MASS,s.mass-4*dt);s.boostFoodTime=(s.boostFoodTime||0)+dt;if(s.boostFoodTime>=.25-1e-9){s.boostFoodTime=Math.max(0,s.boostFoodTime-.25);const tail=s.segments.at(-1)||s;g.food.push(food(g,tail.x,tail.y,1));}}else s.boostFoodTime=0;
 s.x+=Math.cos(s.angle)*speed*dt;s.y+=Math.sin(s.angle)*speed*dt;
 if(s.x<radius(s)||s.x>g.width-radius(s)||s.y<radius(s)||s.y>g.height-radius(s)){kill(g,s);return;}
 const old=s.segments[0]||s;if(distance(old,s)>=SPACING)s.segments.unshift({x:s.x,y:s.y});
 else if(!s.segments.length)s.segments.push({x:s.x,y:s.y});
 const count=Math.round(s.mass);while(s.segments.length<count)s.segments.push({...s.segments.at(-1)});s.segments.length=count;
}
export function stepSerpent(g,delta){
 if(g.status!=='playing')return g;const dt=clamp(Number(delta)||0,0,.1);if(dt===0)return g;
 g.elapsed=g.matchMode==='survival'?g.elapsed+dt:Math.min(g.duration,g.elapsed+dt);g.tick++;g.events=[];
 for(let i=0;i<g.snakes.length;i++){const s=g.snakes[i];if(!s.alive&&s.bot&&g.matchMode!=='survival'&&s.respawnAt<=g.elapsed){const born=makeSnake(g,s,i,g.snakes.length);born.score=s.score;born.kills=s.kills;g.snakes[i]=born;}if(g.snakes[i].alive)move(g,g.snakes[i],dt);}
 const doomed=new Map();
 for(let i=0;i<g.snakes.length;i++){const a=g.snakes[i];if(!a.alive)continue;
  for(let j=i+1;j<g.snakes.length;j++){const b=g.snakes[j];if(!b.alive||distance(a,b)>radius(a)+radius(b))continue;
   if(a.mass>b.mass*1.25)doomed.set(b.id,a);else if(b.mass>a.mass*1.25)doomed.set(a.id,b);else{doomed.set(a.id,null);doomed.set(b.id,null);}
  }
  for(const b of g.snakes){if(!b.alive||a.id===b.id||doomed.has(a.id)||doomed.has(b.id))continue;for(let j=7;j<b.segments.length;j+=2){if(distance(a,b.segments[j])<radius(a)+radius(b)*.76){doomed.set(a.id,b);break;}}}
 }
 for(const s of g.snakes)if(doomed.has(s.id))kill(g,s,doomed.get(s.id));
 const eaten=new Set();for(const s of g.snakes){if(!s.alive)continue;
  for(const f of g.food){if(!eaten.has(f.id)&&distance(s,f)<radius(s)+f.radius){eaten.add(f.id);s.mass=Math.min(MAX_MASS,s.mass+f.value);s.score+=f.value;g.events.push({type:'eat',id:s.id,x:f.x,y:f.y,value:f.value,kind:f.kind||'berry'});}}
 }
 if(eaten.size)g.food=g.food.filter(f=>!eaten.has(f.id));if(g.food.length>700)g.food=g.food.slice(-700);replenish(g);
 const humans=g.snakes.filter(s=>!s.bot),alive=humans.filter(s=>s.alive);
 const living=g.snakes.filter(s=>s.alive),survival=g.matchMode==='survival';
 if(survival?(living.length===0||g.snakes.length>1&&living.length===1):(g.elapsed>=g.duration||!alive.length||humans.length>1&&alive.length===1)){
  g.status='finished';const max=Math.max(...living.map(s=>s.score));g.winners=survival?living.map(s=>s.id):living.filter(s=>s.score===max).map(s=>s.id);for(const s of g.snakes)s.boost=false;
 }
 return g;
}
export function serpentSnapshot(g){
 return {version:1,tick:g.tick,width:g.width,height:g.height,matchMode:g.matchMode||'timed',elapsed:g.elapsed,duration:g.duration,status:g.status,winners:[...g.winners],events:g.events.map(e=>({...e})),snakes:g.snakes.map(({id,name,color,skin,bot,x,y,angle,boost,alive,mass,score,kills,segments})=>({id,name,color,skin,bot,x,y,angle,boost,alive,mass,score,kills,segments:segments.map(p=>({...p}))})),food:g.food.map(f=>({...f}))};
}
