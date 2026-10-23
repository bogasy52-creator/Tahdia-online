// Head plus exactly four neck segments. Rear guard is the last four segments.
export const ARENA_RULES='arena-v23',ARENA_FRONT_PARTS=4,ARENA_TAIL_PARTS=4;
const radius=s=>7+Math.sqrt(s.mass)*.55;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function touches(a,b,points){const contact=radius(a)+radius(b);return points.some(p=>p&&distance(a,p)<contact);}
export function resolveArenaCombat(snakes){
 const living=snakes.filter(s=>s.alive),dead=new Map(),reasons=new Map(),duels=[];
 // Rear contact is fatal regardless of length. Resolve it before frontal duels.
 for(const a of living){const hits=living.filter(b=>a.id!==b.id&&touches(a,b,b.segments.slice(-ARENA_TAIL_PARTS))).sort((x,y)=>distance(a,x.segments.at(-1))-distance(a,y.segments.at(-1))||x.id.localeCompare(y.id));if(hits.length){dead.set(a.id,hits[0]);reasons.set(a.id,'tail');}}
 const rear=new Set(dead.keys());
 for(let i=0;i<living.length;i++)for(let j=i+1;j<living.length;j++){
  const a=living[i],b=living[j];if(rear.has(a.id)||rear.has(b.id))continue;
  const frontContact=(attacker,other)=>{const squared=p=>{const x=attacker.x-p.x,y=attacker.y-p.y;return x*x+y*y;};let best=squared(other);for(let k=1;k<Math.min(other.segments.length,ARENA_FRONT_PARTS+1);k++)best=Math.min(best,squared(other.segments[k]));const contact=radius(attacker)+radius(other);if(best>=contact*contact)return false;for(let k=ARENA_FRONT_PARTS+1;k<other.segments.length;k++)if(squared(other.segments[k])<best)return false;return true;};
  if(frontContact(a,b)||frontContact(b,a))duels.push([a,b]);
 }
 // Snapshot lengths: scoring, boost and collection cannot change a duel halfway through resolution.
 for(const[a,b]of duels){const x=Math.round(a.mass),y=Math.round(b.mass);if(x===y){dead.set(a.id,null);dead.set(b.id,null);reasons.set(a.id,'draw');reasons.set(b.id,'draw');}else{const loser=x<y?a:b,winner=x>y?a:b,old=dead.get(loser.id);if(!dead.has(loser.id)||old&&winner.id.localeCompare(old.id)<0){dead.set(loser.id,winner);reasons.set(loser.id,'front');}}}
 return {dead,reasons};
}
export function arenaTurnRate(s){return s?.boost?10.4:9.2;}
