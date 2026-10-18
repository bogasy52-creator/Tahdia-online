// Shared simulation-time powers. The server and solo game use these exact rules.
export const ARENA_POWERS=Object.freeze({shield:{name:'حماية',icon:'⬡',color:'#8de8ff',duration:6},ghost:{name:'اختفاء وعبور',icon:'◌',color:'#dec1ff',duration:4},speed:{name:'سرعة',icon:'ϟ',color:'#ffe18b',duration:5},magnet:{name:'مغناطيس',icon:'∩',color:'#ffb7cb',duration:7}});
const kinds=Object.keys(ARENA_POWERS);
export const powerActive=(snake,kind,elapsed)=>Number(snake?.powers?.[kind])>elapsed;
export const dropLimit=alive=>alive>4?3:alive>0?2:0;
export const arenaSpeed=(snake,boost,elapsed)=>(boost?190:108)*(powerActive(snake,'speed',elapsed)?1.35:1);
export function updateArenaDrops(g,random){
 if(!g.powerDrops||g.collisionMode!=='arena-v23')return;
 const living=g.snakes.filter(s=>s.alive),limit=dropLimit(living.length);
 g.drops=(g.drops||[]).filter(d=>d.expiresAt>g.elapsed).slice(0,limit);
 if(g.elapsed>=g.nextDropAt){
  const offset=g.nextDropKind||0;
  while(g.drops.length<limit){
   let position=null;
   for(let tries=0;tries<48;tries++){
    const p={x:90+random(g)*(g.width-180),y:90+random(g)*(g.height-180)};
    if(living.every(s=>Math.hypot(p.x-s.x,p.y-s.y)>150&&s.segments.every((q,i)=>i%4||Math.hypot(p.x-q.x,p.y-q.y)>38))&&g.drops.every(d=>Math.hypot(p.x-d.x,p.y-d.y)>120)){position=p;break;}
   }
   if(!position)break;
   const kind=kinds[(offset+g.nextDropId)%kinds.length];
   g.drops.push({id:'drop-'+g.nextDropId++,kind,...position,expiresAt:g.elapsed+18});
  }
  g.nextDropAt=g.elapsed+12;
 }
 const collected=new Set();
 for(const drop of g.drops){
  const winner=living.filter(s=>Math.hypot(s.x-drop.x,s.y-drop.y)<24+Math.sqrt(s.mass)*.55).sort((a,b)=>Math.hypot(a.x-drop.x,a.y-drop.y)-Math.hypot(b.x-drop.x,b.y-drop.y)||a.id.localeCompare(b.id))[0];
  if(!winner)continue;
  winner.powers||={};winner.powers[drop.kind]=g.elapsed+ARENA_POWERS[drop.kind].duration;
  collected.add(drop.id);g.events.push({type:'power',id:winner.id,kind:drop.kind,x:drop.x,y:drop.y,until:winner.powers[drop.kind],dropId:drop.id});
 }
 if(collected.size)g.drops=g.drops.filter(d=>!collected.has(d.id));
 for(const s of g.snakes)if(s.powers)for(const kind of kinds)if(!s.alive||s.powers[kind]<=g.elapsed)delete s.powers[kind];
}
