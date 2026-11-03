// «سباق الفوضى» (33.6.0): every character runs on its own up a three-lane track; you steer
// between lanes and use powers. Walls, timed gates, mud and springs stand in the way, and every
// fifteen seconds a wave of chaos re-deals parts of the track. Whoever trails gets the stronger
// powers and a following wind.
//
// The race is deterministic: the room, the practice game and every screen run this same
// simulation in steps of RACE_DT milliseconds, so a screen can carry the race forward between
// two snapshots of the room and only the players' own choices travel over the network.
export const RACE_LANES=3,RACE_ROWS=220,RACE_DT=100,RACE_COUNTDOWN=3500,RACE_MS=150000,RACE_GRACE=25000,CHAOS_EVERY=15000,CHAOS_WARN=2500;
export const RACE_SPEED=3.4;              // rows a second
export const GATE_CYCLE=2400,GATE_OPEN=1300;
export const RACE_POWERS=Object.freeze(['boost','shield','sticky','rocket','storm']);
export const RACE_HARMFUL=Object.freeze(['wall','gate','mud','spring','sticky']);
export const CHAOS_ZONES=Object.freeze([[38,54],[88,104],[138,154],[182,198]]);
const LANE_COOLDOWN=60,BOT_LANE_COOLDOWN=420;
function rand(seed){let x=seed>>>0;return()=>{x+=0x6D2B79F5;let t=x;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const pick=(r,n)=>Math.floor(r()*n);
const mix=(...v)=>v.reduce((h,x)=>Math.imul(h^(x>>>0),0x9e3779b1)>>>0,0x811c9dc5);
function weighted(r,rows){const total=rows.reduce((s,[,w])=>s+w,0);let x=r()*total;for(const [v,w] of rows){if((x-=w)<0)return v;}return rows.at(-1)[0];}

// —— the track ——
// One row of the track: one or two things in different lanes, and never all three lanes shut.
function feature(r,row,minRow){
 const kinds=[['wall',30],['gate',14],['mud',14],['spring',9],['box',20],['pad',13]];
 const hard=k=>k==='wall'||k==='gate'||k==='spring',items=[],lanes=[0,1,2];
 for(let i=lanes.length-1;i>0;i--){const j=pick(r,i+1);[lanes[i],lanes[j]]=[lanes[j],lanes[i]];}
 const count=r()<.5?1:2;
 for(let k=0;k<count;k++){let kind=weighted(r,kinds);if(row<minRow&&hard(kind))kind='box';if(k===1&&hard(kind)&&hard(items[0].kind)&&r()<.5)kind=r()<.5?'box':'pad';items.push({row,lane:lanes[k],kind,...(kind==='gate'?{phase:pick(r,GATE_CYCLE)}:{})});}
 return items;
}
const zoneOf=row=>CHAOS_ZONES.findIndex(([a,b])=>row>=a&&row<=b);
const tracks=new Map();
/** The track of a race: its fixed rows, and the rows of the chaos zones for every wave. */
export function raceTrack(seed){
 seed>>>=0;if(tracks.has(seed))return tracks.get(seed);
 const r=rand(mix(seed,0x7f4a7c15)),fixed=new Map();
 for(let row=10;row<RACE_ROWS-4;row+=3+pick(r,3)){if(zoneOf(row)>=0)continue;fixed.set(row,feature(r,row,12));}
 const waves=Math.ceil(RACE_MS/CHAOS_EVERY)+1;
 const chaos=CHAOS_ZONES.map(([from,to],z)=>({from,to,waves:Array.from({length:waves},(_,e)=>{const w=rand(mix(seed,z+1,e+1)),rows=new Map();for(let row=from+pick(w,2);row<=to;row+=3+pick(w,2))rows.set(row,feature(w,row,0).map(item=>({...item,wave:e})));return rows;})}));
 const track={seed,rows:RACE_ROWS,lanes:RACE_LANES,fixed,chaos};
 if(tracks.size>24)tracks.delete(tracks.keys().next().value);
 tracks.set(seed,track);return track;
}
/** The chaos wave in force at a time (0 before and during the first fifteen seconds). */
export const raceWave=(race,t)=>t<race.startAt?0:Math.floor((t-race.startAt)/CHAOS_EVERY);
/** What sits on a row at a time: the fixed things, the chaos zone's current wave, dropped traps. */
export function raceItems(track,race,row,t){
 const zone=zoneOf(row),fixed=track.fixed.get(row)||[];
 const wave=zone>=0?(track.chaos[zone].waves[Math.min(track.chaos[zone].waves.length-1,raceWave(race,t))].get(row)||[]):[];
 const dropped=race.dropped.filter(d=>d.row===row&&t<d.until).map(d=>({row,lane:d.lane,kind:'sticky',by:d.by}));
 return [...fixed,...wave,...dropped];
}
export const gateOpen=(race,item,t)=>((t-race.startAt+item.phase)%GATE_CYCLE+GATE_CYCLE)%GATE_CYCLE<GATE_OPEN;

// —— a race ——
export function createRace(players,seed,now){
 const t0=now,startAt=now+RACE_COUNTDOWN;
 return{seed:seed>>>0,t0,startAt,endsAt:startAt+RACE_MS,simAt:t0,over:false,overAt:0,firstAt:0,finished:0,dropped:[],events:[],eventId:0,
  runners:players.map((p,i)=>({pos:0,lane:i%RACE_LANES,stun:0,slow:0,boost:0,pad:0,shield:0,rocket:0,wait:false,power:null,done:null,place:0,lastLane:0,cleared:[],boxes:[],hits:0,used:0,wind:false}))};
}
function event(race,i,kind,t,extra={}){race.events.push({id:++race.eventId,i,kind,t,...extra});if(race.events.length>16)race.events.shift();}
/** Places so far: finished runners by place, then everyone else by distance. */
export function raceOrder(race){return race.runners.map((R,i)=>i).sort((a,b)=>{const A=race.runners[a],B=race.runners[b];if(A.done!==null||B.done!==null)return A.done===null?1:B.done===null?-1:A.place-B.place;return B.pos-A.pos||a-b;});}
function rankOf(race,i){return raceOrder(race).indexOf(i)+1;}
function drawPower(race,i,row,t){
 const n=race.runners.length,rank=rankOf(race,i),f=n>1?(rank-1)/(n-1):1,r=rand(mix(race.seed,i+1,row,Math.floor((t-race.t0)/RACE_DT)));
 // the leaders get guards; whoever trails gets the powers that catch up
 return weighted(r,[['shield',4-3*f],['sticky',3-2*f],['boost',3+f],['rocket',f>=.5?4*f:0],['storm',f>=.5?3*f:0]]);
}
function finish(race,i,at){const R=race.runners[i];R.done=Math.round(at);R.place=++race.finished;R.pos=RACE_ROWS;R.wait=false;if(race.finished===1){race.firstAt=R.done;race.endsAt=Math.min(race.endsAt,R.done+RACE_GRACE);}event(race,i,'finish',R.done,{place:R.place});}
function shielded(race,i,t){const R=race.runners[i];if(t<R.shield){R.shield=0;event(race,i,'shield',t);return true;}return false;}
// a runner meets a row: true when the run stops here (a wall, a closed gate, a spring)
function enter(race,track,i,row,t){
 const R=race.runners[i];
 for(const item of raceItems(track,race,row,t)){
  if(item.lane!==R.lane)continue;
  const key=row+':'+item.lane+':'+(item.wave??'f');
  if(item.kind==='box'){if(!R.boxes.includes(key)){R.boxes.push(key);if(!R.power){R.power=drawPower(race,i,row,t);event(race,i,'box',t,{power:R.power});}}continue;}
  if(item.kind==='pad'){R.pad=t+1200;continue;}
  if(item.kind==='sticky'){if(item.by===i)continue;if(!shielded(race,i,t)){R.slow=Math.max(R.slow,t+2200);R.hits++;event(race,i,'sticky',t,{by:item.by});}continue;}
  if(item.kind==='mud'){if(!shielded(race,i,t)){R.slow=Math.max(R.slow,t+1800);R.hits++;event(race,i,'mud',t);}continue;}
  if(item.kind==='wall'){if(R.cleared.includes(key))continue;R.cleared.push(key);if(shielded(race,i,t))continue;R.stun=t+900;R.pos=row-.02;R.hits++;event(race,i,'wall',t);return true;}
  if(item.kind==='gate'){if(gateOpen(race,item,t)||shielded(race,i,t))continue;R.wait=true;R.pos=row-.02;event(race,i,'gate',t);return true;}
  // a spring throws you back once; the second time over it you pass
  if(item.kind==='spring'){if(R.cleared.includes(key))continue;R.cleared.push(key);if(shielded(race,i,t))continue;R.pos=Math.max(0,row-5);R.stun=t+350;R.hits++;event(race,i,'spring',t);return true;}
 }
 return false;
}
function leader(race){let best=0;for(const R of race.runners)if(R.done===null)best=Math.max(best,R.pos);return best;}
function speed(race,i,t){const R=race.runners[i];let v=RACE_SPEED;if(t<R.boost)v*=1.55;else if(t<R.pad)v*=1.35;if(t<R.slow)v*=.5;R.wind=leader(race)-R.pos>18;if(R.wind)v*=1.12;return v;}
// —— powers ——
export function usePower(race,i,t){
 const R=race.runners[i],power=R.power;if(!power||R.done!==null||t<race.startAt)return false;
 R.power=null;R.used++;event(race,i,'power',t,{power});
 if(power==='boost')R.boost=t+3000;
 if(power==='shield')R.shield=t+8000;
 if(power==='sticky'){race.dropped=race.dropped.filter(d=>t<d.until);race.dropped.push({row:Math.max(1,Math.floor(R.pos)-1),lane:R.lane,by:i,until:t+15000});}
 if(power==='rocket'){R.rocket=t+700;R.wait=false;R.stun=0;if(R.pos+10>=RACE_ROWS)finish(race,i,t);else R.pos+=10;}
 if(power==='storm')race.runners.forEach((O,j)=>{if(j!==i&&O.done===null&&O.pos>R.pos&&O.pos-R.pos<=40&&!shielded(race,j,t)){O.slow=Math.max(O.slow,t+2000);event(race,j,'storm',t,{by:i});}});
 return true;
}
export function changeLane(race,i,lane,t,cooldown=LANE_COOLDOWN){
 const R=race.runners[i];
 if(!Number.isInteger(lane)||lane<0||lane>=RACE_LANES||Math.abs(lane-R.lane)!==1||R.done!==null||t-R.lastLane<cooldown)return false;
 R.lane=lane;R.lastLane=t;R.wait=false;return true;
}
// —— the computer runners ——
function danger(race,track,R,i,lane,t,ahead){
 for(let row=Math.floor(R.pos)+1;row<=Math.floor(R.pos)+ahead;row++)for(const item of raceItems(track,race,row,t)){
  if(item.lane!==lane)continue;
  if(item.kind==='wall'&&!R.cleared.includes(row+':'+lane+':'+(item.wave??'f')))return row;
  if(item.kind==='gate'&&!gateOpen(race,item,t+(row-R.pos)/RACE_SPEED*1000))return row;
  if(item.kind==='spring'||item.kind==='mud'||item.kind==='sticky'&&item.by!==i)return row;
 }
 return 0;
}
function goodies(race,track,R,lane,t,ahead){let n=0;for(let row=Math.floor(R.pos)+1;row<=Math.floor(R.pos)+ahead;row++)for(const item of raceItems(track,race,row,t))if(item.lane===lane&&(item.kind==='pad'||item.kind==='box'&&!R.power))n++;return n;}
export const BOT_SKILL=Object.freeze([.86,.72,.6,.8]);
function botThink(race,track,i,t){
 const R=race.runners[i],q=Math.round((t-race.t0)/RACE_DT);if(R.done!==null||t<race.startAt||(q+i)%3)return;
 const skill=BOT_SKILL[(i+race.seed)%BOT_SKILL.length],r=rand(mix(race.seed,i+101,q)),ahead=2+Math.round(skill*2);
 if(R.power&&r()<.35){
  const near=danger(race,track,R,i,R.lane,t,4),behind=race.runners.some((O,j)=>j!==i&&O.done===null&&R.pos-O.pos>0&&R.pos-O.pos<5);
  const go=R.power==='rocket'||R.power==='storm'||R.power==='boost'&&!danger(race,track,R,i,R.lane,t,7)||R.power==='shield'&&near||R.power==='sticky'&&behind;
  if(go){usePower(race,i,t);return;}
 }
 if(r()>skill*.55)return;   // a moment's hesitation: computer runners miss things too
 const here=danger(race,track,R,i,R.lane,t,ahead);
 const lanes=[R.lane-1,R.lane+1].filter(l=>l>=0&&l<RACE_LANES),score=l=>(danger(race,track,R,i,l,t,ahead)?0:2)+goodies(race,track,R,l,t,ahead)*.6;
 if(here||(R.wait&&lanes.length)){const best=lanes.sort((a,b)=>score(b)-score(a)||(r()<.5?-1:1))[0];if(best!==undefined&&score(best)>=2)changeLane(race,i,best,t,BOT_LANE_COOLDOWN);return;}
 const want=lanes.find(l=>score(l)>=2.6&&!danger(race,track,R,i,l,t,ahead));if(want!==undefined&&r()<.5)changeLane(race,i,want,t,BOT_LANE_COOLDOWN);
}
// —— the clock ——
/** Carry a race forward to `until`, step by step. `bots` lists who the computer steers. */
export function raceSim(race,bots,until){
 const track=raceTrack(race.seed);
 while(!race.over&&race.simAt+RACE_DT<=until){
  const t=race.simAt,dt=RACE_DT;
  if(t>=race.startAt){
   for(let i=0;i<race.runners.length;i++){
    const R=race.runners[i];if(R.done!==null)continue;
    if(bots[i])botThink(race,track,i,t);
    if(R.done!==null)continue;
    if(R.wait){const gate=raceItems(track,race,Math.floor(R.pos)+1,t).find(x=>x.kind==='gate'&&x.lane===R.lane);if(gate&&!gateOpen(race,gate,t))continue;R.wait=false;}
    if(t<R.stun)continue;
    const v=speed(race,i,t),from=R.pos,to=from+v*dt/1000;let stopped=false;
    for(let row=Math.floor(from)+1;row<=Math.floor(to);row++){
     if(row>=RACE_ROWS){finish(race,i,t+(RACE_ROWS-from)/v*1000);stopped=true;break;}
     if(enter(race,track,i,row,t)){stopped=true;break;}
    }
    if(!stopped)R.pos=to;
    if(R.cleared.length>6)R.cleared=R.cleared.filter(k=>Number(k.split(':')[0])>=R.pos-8);
    if(R.boxes.length>6)R.boxes=R.boxes.filter(k=>Number(k.split(':')[0])>=R.pos-8);
   }
   race.dropped=race.dropped.filter(d=>t<d.until);
  }
  race.simAt=t+dt;
  if(race.runners.every(R=>R.done!==null)||race.simAt>=race.endsAt){race.over=true;race.overAt=race.simAt;}
 }
 return race;
}
/** Move every time of a race by `delta` (the practice game's pause). */
export function shiftRace(race,delta){
 for(const key of ['t0','startAt','endsAt','simAt','firstAt','overAt'])if(race[key])race[key]+=delta;
 for(const R of race.runners){for(const key of ['stun','slow','boost','pad','shield','rocket','lastLane'])if(R[key])R[key]+=delta;if(R.done!==null)R.done+=delta;}
 for(const d of race.dropped)d.until+=delta;for(const e of race.events)e.t+=delta;
}
/** The final order: points by place for the standings, and the winner(s). */
export function raceResult(race){
 const order=raceOrder(race),n=order.length,points=order.map((i,k)=>({i,rank:k+1,score:(n-k)*10}));
 const first=race.runners[order[0]],winners=order.filter(i=>{const R=race.runners[i];return R.done!==null?R.place===1:first.done===null&&R.pos===first.pos;});
 return{order,points,winners};
}
