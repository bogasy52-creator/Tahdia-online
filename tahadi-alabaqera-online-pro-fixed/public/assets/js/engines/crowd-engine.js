/* Zحف الجموع: deterministic, local single-player rules. No network rewards. */
export const CROWD = Object.freeze({ LEVELS:30, MAX_ARMY:9999, VIEW:76, LIMIT:90, SHOT_INTERVAL:.15, CROSSING_Z:5.8 });
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const finite=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
const levelOf=n=>clamp(Math.floor(finite(Number(n),1)),1,CROWD.LEVELS);
const armyOf=n=>clamp(Math.floor(finite(Number(n))),0,CROWD.MAX_ARMY);
function rng(seed){let s=(Number(seed)>>>0)||1;return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296;};}
export function applyCrowdGate(army,gate){
  const n=armyOf(army),v=clamp(Math.floor(finite(Number(gate?.value))),0,CROWD.MAX_ARMY);
  if(gate?.op==='+')return armyOf(n+v);
  if(gate?.op==='−'||gate?.op==='-')return armyOf(n-v);
  if(gate?.op==='×'||gate?.op==='*')return armyOf(n*v);
  if(gate?.op==='÷'||gate?.op==='/')return v>0?armyOf(n/v):n;
  return n;
}
export function crowdDaySeed(day){let hash=2166136261;for(const c of String(day)){hash=Math.imul(hash^c.charCodeAt(0),16777619);}return hash>>>0||1;}
export function makeCrowdCourse(level=1,seed){
  level=levelOf(level);const next=rng(seed??level*7919+250),rows=[];
  const gate=(op,value)=>({type:'gate',op,value,label:op+value});
  for(let r=0;r<12;r++){
    const plus=35+Math.floor(next()*45)+level*2;
    const cells=[gate('+',plus),gate(r%3===1?'×':'+',r%3===1?2:plus+25),gate('−',20+r*3)];
    // Seeded lane order keeps each course repeatable without a single safe lane.
    for(let i=2;i>0;i--){const j=Math.floor(next()*(i+1));[cells[i],cells[j]]=[cells[j],cells[i]];}
    if(r===5)cells[2]=gate('+',777);
    if(r===8)cells[Math.floor(next()*3)]=gate('÷',2);
    if(r===2||r===6||r===9){const lane=Math.floor(next()*3),hp=95+r*12+level*8;cells[lane]={type:'enemy',hp,maxHp:hp,defeated:false};}
    rows.push({id:r,z:48+r*37,cells,passed:false});
  }
  const hp=700+(level-1)*45;
  return {level,startArmy:40+level*2,speed:12+Math.min(3,(level-1)*.1),rows,boss:{type:'boss',z:48+12*37,hp,maxHp:hp,defeated:false},end:48+12*37};
}
export function createCrowdRun(level=1,{seed,daily=false}={}){
  const course=makeCrowdCourse(level,seed);
  return {...course,seed:seed??levelOf(level)*7919+250,daily:Boolean(daily),army:course.startArmy,x:0,steer:0,distance:0,elapsed:0,shotClock:0,bossClock:0,status:'running',score:0,stars:0,kills:0,gates:0,events:[]};
}
export function crowdLane(run){return clamp(Math.round(finite(run?.x))+1,0,2);}
export function crowdTarget(run){
  if(!run||run.status!=='running')return null;const lane=crowdLane(run);
  for(const row of run.rows){const cell=row.cells[lane],ahead=row.z-run.distance;if(!row.passed&&ahead>0&&ahead<48&&cell.type==='enemy'&&!cell.defeated)return {cell,row,z:row.z,lane};}
  const ahead=run.boss.z-run.distance;
  return run.rows.every(row=>row.passed)&&!run.boss.defeated&&ahead>0&&ahead<48?{cell:run.boss,z:run.boss.z,lane:1}:null;
}
function finish(run,status){
  run.status=status;run.stars=status==='won'?(run.army>=1000?3:run.army>=300?2:1):0;
  run.score=Math.round(run.gates*50+run.kills*120+run.army+(status==='won'?Math.max(0,CROWD.LIMIT-run.elapsed)*15:0));
  run.events.push({type:status});return run;
}
export function stepCrowdRun(run,delta,steer=run?.steer??0){
  if(!run||run.status!=='running')return run;
  const dt=clamp(finite(Number(delta)),0,.05);run.events=[];if(dt===0)return run;
  run.elapsed+=dt;run.steer=clamp(finite(Number(steer),run.x),-1,1);run.x+=(run.steer-run.x)*Math.min(1,dt*16);
  const atBoss=run.distance>=run.boss.z-20&&!run.boss.defeated;
  if(!atBoss)run.distance=Math.min(run.boss.z-20,run.distance+run.speed*dt);
  run.shotClock+=dt;
  if(run.shotClock>=CROWD.SHOT_INTERVAL){
    run.shotClock%=CROWD.SHOT_INTERVAL;const target=crowdTarget(run);
    if(target){const hit=Math.max(4,Math.round(run.army*.11)),cell=target.cell;cell.hp=Math.max(0,cell.hp-hit);run.events.push({type:'shot',x:run.x,z:target.z,lane:target.lane});if(cell.hp===0&&!cell.defeated){cell.defeated=true;run.kills++;run.events.push({type:'burst',z:target.z,lane:target.lane});}}
  }
  for(const row of run.rows){
    if(row.passed||row.z>run.distance+CROWD.CROSSING_Z)continue;
    row.passed=true;const lane=crowdLane(run),cell=row.cells[lane],before=run.army;
    if(cell.type==='gate'){run.army=applyCrowdGate(run.army,cell);run.gates++;run.events.push({type:'gate',label:cell.label,delta:run.army-before,lane,z:row.z});}
    else if(!cell.defeated){run.army=armyOf(run.army-Math.ceil(cell.hp*.36));run.events.push({type:'hit',delta:run.army-before,lane,z:row.z});}
  }
  if(atBoss){run.bossClock+=dt;if(run.bossClock>=.9){run.bossClock%=.9;const loss=Math.max(8,Math.ceil(run.boss.hp*.018));run.army=armyOf(run.army-loss);run.events.push({type:'hit',delta:-loss});}}
  if(run.army<=0||run.elapsed>=CROWD.LIMIT)return finish(run,'lost');
  if(run.boss.defeated)return finish(run,'won');
  return run;
}
export function normalizeCrowdProgress(value){
  const source=value&&typeof value==='object'?value:{},best={};
  for(let i=1;i<=CROWD.LEVELS;i++){const row=source.best?.[i];if(row&&typeof row==='object')best[i]={score:clamp(Math.floor(finite(Number(row.score))),0,100000),stars:clamp(Math.floor(finite(Number(row.stars))),0,3)};}
  return {unlocked:levelOf(source.unlocked),best,daily:source.daily&&typeof source.daily==='object'?{day:String(source.daily.day||'').slice(0,10),score:clamp(Math.floor(finite(Number(source.daily.score))),0,100000)}:null};
}
export function recordCrowdRun(progress,run,day=''){
  const out=normalizeCrowdProgress(progress);if(!run||run.status!=='won')return out;
  if(run.daily){const score=Math.max(out.daily?.day===day?out.daily.score:0,finite(run.score));out.daily={day:String(day).slice(0,10),score};return out;}
  const level=levelOf(run.level);if(level>out.unlocked)return out;
  const old=out.best[level]||{score:0,stars:0};out.best[level]={score:Math.max(old.score,run.score),stars:Math.max(old.stars,run.stars)};out.unlocked=Math.max(out.unlocked,Math.min(CROWD.LEVELS,level+1));return out;
}
