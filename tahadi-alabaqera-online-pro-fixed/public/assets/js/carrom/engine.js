// Deterministic tabletop physics. Coordinates are independent of the display resolution.
export const SIZE = 1000, COIN_RADIUS = 18, STRIKER_RADIUS = 23, FIXED_DT = 1 / 120;
export const POCKETS = Object.freeze([[78,78],[922,78],[922,922],[78,922]]);
const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
const live = s => s.coins.filter(c => !c.pocketed);
const owner = c => c.kind === 'light' ? 0 : c.kind === 'dark' ? 1 : null;
const count = (s,seat) => s.coins.filter(c => owner(c) === seat && c.pocketed).length;
function emit(s,type,data={}) { s.events.push({type,...data}); }
function coin(id,kind,x,y) { return {id,kind,x,y,vx:0,vy:0,r:COIN_RADIUS,mass:1,pocketed:false}; }
function random(s) {
  s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;
  return s.seed/4294967296;
}
export function createCarrom({mode='ai',difficulty='normal',seed=7}={}) {
  const coins=[coin('queen','queen',500,500)];
  let number=0;
  for(const ring of [1,2])for(let i=0;i<ring*6;i++){
    const angle=i/(ring*6)*Math.PI*2, radius=ring*38;
    coins.push(coin('c'+number,number++%2?'dark':'light',500+Math.cos(angle)*radius,500+Math.sin(angle)*radius));
  }
  const s={mode:mode==='hotseat'?'hotseat':'ai',difficulty:difficulty==='expert'?'expert':'normal',
    seed:seed>>>0,coins,turn:0,turnNo:0,phase:'aim',winner:null,queen:{status:'board',owner:null,pending:null},
    due:[0,0],shots:[0,0],events:[],message:'حرّك الدافع ثم اسحب للتصويب',
    striker:{id:'striker',kind:'striker',x:500,y:825,vx:0,vy:0,r:STRIKER_RADIUS,mass:1.8,pocketed:false},shot:null};
  return s;
}
export function legalPosition(s,requested,seat=s.turn) {
  const y=seat===0?825:175, wanted=clamp(Number(requested)||500,220,780);
  const clear=x=>live(s).every(c=>Math.hypot(c.x-x,c.y-y)>c.r+STRIKER_RADIUS+2);
  if(clear(wanted))return wanted;
  for(let gap=8;gap<570;gap+=8)for(const x of [wanted-gap,wanted+gap])if(x>=220&&x<=780&&clear(x))return x;
  return null;
}
export function placeStriker(s,x) {
  if(s.phase!=='aim')return false;
  const position=legalPosition(s,x);
  if(position===null)return false;
  Object.assign(s.striker,{x:position,y:s.turn===0?825:175,vx:0,vy:0,pocketed:false});
  return true;
}
export function shootCarrom(s,{x=s.striker.x,angle,power}={},seat=s.turn) {
  if(s.phase!=='aim'||seat!==s.turn)throw Error('انتظر توقف الأحجار ودورك');
  if(!Number.isFinite(x)||x<220||x>780||!Number.isFinite(angle)||!Number.isFinite(power)||power<.08||power>1)throw Error('اضبط التصويب وقوة الضربة');
  const p=legalPosition(s,x,seat);
  if(p===null||Math.abs(p-x)>.1)throw Error('الدافع يتقاطع مع حجر؛ غيّر مكانه');
  launch(s,seat,x,Math.cos(angle)*(220+power*1250),Math.sin(angle)*(220+power*1250),power);
}
// 33.9.10: the striker leaves with its speed given whole, so a recorded shot replays the same on any phone
function launch(s,seat,x,vx,vy,power){
  Object.assign(s.striker,{x,y:seat===0?825:175,vx,vy,pocketed:false});
  s.phase='moving';s.shots[seat]++;
  s.shot={seat,captured:[],foul:false,ownBefore:count(s,seat),queenBefore:s.queen.pending,elapsed:0,quiet:0};
  s.events=[];emit(s,'strike',{power});s.message='الأحجار تتحرك…';
}
function respawn(s,c) {
  c.pocketed=false;c.vx=0;c.vy=0;
  for(let ring=0;ring<13;ring++)for(let i=0;i<Math.max(1,ring*8);i++){
    const a=i/Math.max(1,ring*8)*Math.PI*2,x=500+Math.cos(a)*ring*41,y=500+Math.sin(a)*ring*41;
    if(x<130||x>870||y<130||y>870)continue;
    if(live(s).every(other=>other===c||Math.hypot(other.x-x,other.y-y)>other.r+c.r+1)){c.x=x;c.y=y;return;}
  }
  c.x=500;c.y=500;
}
function returnQueen(s) {
  respawn(s,s.coins.find(c=>c.kind==='queen'));
  s.queen={status:'board',owner:null,pending:null};
}
function returnOne(s,seat,preferred=[]) {
  const c=[...preferred.map(id=>s.coins.find(c=>c.id===id)),...s.coins].find(c=>c&&owner(c)===seat&&c.pocketed);
  if(!c)return false;
  respawn(s,c);return true;
}
export function settleCarrom(s) {
  if(s.phase!=='moving'||!s.shot)return;
  const shot=s.shot,seat=shot.seat;
  const own=shot.captured.filter(id=>owner(s.coins.find(c=>c.id===id))===seat);
  const queen=shot.captured.includes('queen');
  let retained=own.length>0;
  s.message=retained?'دخل حجر لك · كمل دورك':'الدور للاعب التالي';
  if(shot.foul){
    for(const id of own)respawn(s,s.coins.find(c=>c.id===id));
    if(queen||s.queen.pending===seat)returnQueen(s);
    if(!returnOne(s,seat))s.due[seat]++;
    retained=false;s.message=s.due[seat]?'خطأ بالدافع · عليك حجر جزاء وفقدت الدور':'خطأ بالدافع · رجع حجر وفقدت الدور';
    emit(s,'foul');
  }else{
    while(s.due[seat]>0&&returnOne(s,seat,own)){s.due[seat]--;}
    const credited=own.filter(id=>s.coins.find(c=>c.id===id).pocketed).length;
    if(shot.queenBefore===seat&&!queen){
      if(credited&&s.due[seat]===0){
        s.queen={status:'covered',owner:seat,pending:null};
        s.message='غطّيت الملكة!';emit(s,'cover');
      }else{
        returnQueen(s);s.message='ما تغطّت الملكة · رجعت للطاولة';
      }
    }
    if(queen){
      if((shot.ownBefore>0||credited>0)&&s.due[seat]===0){
        s.queen=credited?{status:'covered',owner:seat,pending:null}:{status:'pending',owner:null,pending:seat};
        retained=true;s.message=credited?'الملكة مع التغطية!':'الملكة لك · غطّها بحجر في الضربة التالية';
        emit(s,credited?'cover':'queen');
      }else{
        returnQueen(s);retained=false;s.message='الملكة تحتاج حجرًا من لونك قبلها';
      }
    }
  }
  for(const p of [0,1]){
    if(count(s,p)===9&&s.queen.status!=='covered'){
      returnOne(s,p,shot.captured);s.message='غطّ الملكة قبل إنهاء آخر حجر';
    }
  }
  const winner=[0,1].find(p=>count(s,p)===9&&s.queen.status==='covered');
  s.turnNo++;
  if(winner!==undefined){
    s.winner=winner;s.phase='finished';s.message='انتهت الطاولة';emit(s,'win',{seat:winner});return;
  }
  s.turn=retained?seat:1-seat;s.phase='aim';s.shot=null;
  placeStriker(s,500);
}
function integrate(s,b,dt) {
  if(b.pocketed)return;
  b.x+=b.vx*dt;b.y+=b.vy*dt;
  for(const [x,y] of POCKETS)if(Math.hypot(b.x-x,b.y-y)<41-b.r*.17){
    b.pocketed=true;b.vx=0;b.vy=0;
    if(b.kind==='striker')s.shot.foul=true;else s.shot.captured.push(b.id);
    emit(s,'pocket',{id:b.id,kind:b.kind});return;
  }
  const mouthX=b.x<132||b.x>868,mouthY=b.y<132||b.y>868;
  if(!mouthY){
    if(b.x-b.r<73){b.x=73+b.r;b.vx=Math.abs(b.vx)*.88;emit(s,'rail');}
    if(b.x+b.r>927){b.x=927-b.r;b.vx=-Math.abs(b.vx)*.88;emit(s,'rail');}
  }
  if(!mouthX){
    if(b.y-b.r<73){b.y=73+b.r;b.vy=Math.abs(b.vy)*.88;emit(s,'rail');}
    if(b.y+b.r>927){b.y=927-b.r;b.vy=-Math.abs(b.vy)*.88;emit(s,'rail');}
  }
  // The outside of a pocket mouth remains a solid rounded corner.
  if(b.x<45+b.r){b.x=45+b.r;b.vx=Math.abs(b.vx)*.8;}
  if(b.x>955-b.r){b.x=955-b.r;b.vx=-Math.abs(b.vx)*.8;}
  if(b.y<45+b.r){b.y=45+b.r;b.vy=Math.abs(b.vy)*.8;}
  if(b.y>955-b.r){b.y=955-b.r;b.vy=-Math.abs(b.vy)*.8;}
  const speed=Math.hypot(b.vx,b.vy),scale=speed?Math.max(0,1-215*dt/speed):0;
  b.vx*=scale;b.vy*=scale;
}
function collide(s,a,b) {
  let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
  const radius=a.r+b.r;
  if(d>=radius)return;
  if(d<.0001){dx=1;dy=0;d=1;}
  const nx=dx/d,ny=dy/d,invA=1/a.mass,invB=1/b.mass;
  const overlap=radius-d+.01;
  a.x-=nx*overlap*invA/(invA+invB);a.y-=ny*overlap*invA/(invA+invB);
  b.x+=nx*overlap*invB/(invA+invB);b.y+=ny*overlap*invB/(invA+invB);
  const closing=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
  if(closing>=0)return;
  const impulse=-(1+.94)*closing/(invA+invB);
  a.vx-=impulse*nx*invA;a.vy-=impulse*ny*invA;
  b.vx+=impulse*nx*invB;b.vy+=impulse*ny*invB;
  if(closing< -80)emit(s,'collision',{strength:Math.min(1,-closing/1000)});
}
export function stepCarrom(s,dt=FIXED_DT) {
  if(s.phase!=='moving')return s;
  dt=clamp(Number(dt)||FIXED_DT,0,FIXED_DT);s.events=[];
  const bodies=[s.striker,...s.coins].filter(b=>!b.pocketed);
  for(const b of bodies)integrate(s,b,dt);
  for(let pass=0;pass<3;pass++)for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++)if(!bodies[i].pocketed&&!bodies[j].pocketed)collide(s,bodies[i],bodies[j]);
  s.shot.elapsed+=dt;
  const moving=bodies.some(b=>!b.pocketed&&Math.hypot(b.vx,b.vy)>3);
  s.shot.quiet=moving?0:s.shot.quiet+dt;
  if(s.shot.quiet>.2||s.shot.elapsed>12){
    for(const b of bodies){b.vx=0;b.vy=0;}
    settleCarrom(s);
  }
  return s;
}
function clearPath(s,from,to,ignore,clearance) {
  const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy);
  return live(s).every(c=>{
    if(c.id===ignore)return true;
    const t=((c.x-from.x)*dx+(c.y-from.y)*dy)/(length*length);
    if(t<=0||t>=1)return true;
    return Math.hypot(c.x-from.x-t*dx,c.y-from.y-t*dy)>clearance+c.r;
  });
}
export function chooseCarromShot(s,level=null) {
  const seat=s.turn,baseline=seat===0?825:175;
  let targets=live(s).filter(c=>owner(c)===seat);
  if(s.queen.status==='board'&&count(s,seat)>0)targets=[...targets,s.coins.find(c=>c.kind==='queen')];
  const choices=[];
  for(const c of targets)for(const [px,py] of POCKETS){
    const dx=px-c.x,dy=py-c.y,d=Math.hypot(dx,dy),ghost={x:c.x-dx/d*(c.r+STRIKER_RADIUS+.3),y:c.y-dy/d*(c.r+STRIKER_RADIUS+.3)};
    for(let x=220;x<=780;x+=56){
      if(legalPosition(s,x,seat)!==x)continue;
      const from={x,y:baseline},distance=Math.hypot(ghost.x-x,ghost.y-baseline);
      const straight=clearPath(s,from,ghost,c.id,STRIKER_RADIUS)&&clearPath(s,c,{x:px,y:py},c.id,COIN_RADIUS*.85);
      const alignment=((ghost.x-x)*dx+(ghost.y-baseline)*dy)/(distance*d);
      const score=(straight?800:0)+alignment*450-distance*.14-d*.2+(c.kind==='queen'?100:0);
      choices.push({x,angle:Math.atan2(ghost.y-baseline,ghost.x-x),power:clamp((distance*.48+d*.7)/1250,.3,.92),score});
    }
  }
  choices.sort((a,b)=>b.score-a.score);
  const best=choices[0]||{x:legalPosition(s,500,seat)||500,angle:seat===0?-Math.PI/2:Math.PI/2,power:.7};
  const how=level||s.difficulty,noise=(random(s)-.5)*(how==='expert'||how==='hard'?.008:how==='easy'?.07:.034);
  return {x:best.x,angle:best.angle+noise,power:best.power};
}
export function aimCarrom(s,angle) {
  const from=s.striker,dx=Math.cos(angle),dy=Math.sin(angle);
  let length=620,target=null;
  for(const c of live(s)){
    const px=c.x-from.x,py=c.y-from.y,dot=px*dx+py*dy,r=from.r+c.r,perp=px*px+py*py-dot*dot;
    if(dot<=0||perp>r*r)continue;
    const distance=dot-Math.sqrt(Math.max(0,r*r-perp));
    if(distance>0&&distance<length){length=distance;target=c;}
  }
  return {x:from.x+dx*length,y:from.y+dy*length,target};
}
export function carromScore(s) {return [0,1].map(seat=>({coins:count(s,seat),queen:s.queen.owner===seat?3:0,due:s.due[seat]}));}

/* ---------- 33.9.10: the online table — two players, the room plays each shot to its end ---------- */
const strip=s=>{const {shotRec,last,events,...rest}=s;return structuredClone({...rest,events:[]});};
export function createCarromDuel(names=['لاعب 1','لاعب 2'],{rng=Math.random,first=0}={}){
  const s=createCarrom({mode:'ai',seed:Math.floor(rng()*4294967296)});
  s.mode='online';s.players=names.slice(0,2).map((n,i)=>({name:String(n||'لاعب '+(i+1)).slice(0,20)}));
  s.turn=first===1?1:0;s.seq=0;s.last=null;s.shotRec=null;s.message='';
  placeStriker(s,500);
  return s;
}
/** One shot of a player, played on the room to the moment every coin stands still. */
export function playCarromShot(state,seat,{x,angle,power}={}){
  if(state.winner!==null&&state.winner!==undefined)throw Error('match_over');
  if(seat!==state.turn)throw Error('wrong_turn');
  x=Number(x);angle=Number(angle);power=Number(power);
  const before=strip(state),s=strip(state);s.phase='aim';
  shootCarrom(s,{x,angle,power},seat);
  const rec={seq:(state.seq||0)+1,by:seat,x,vx:s.striker.vx,vy:s.striker.vy,power,before},shot=s.shot;
  let n=0;while(s.phase==='moving'&&n<2000){stepCarrom(s,FIXED_DT);n++;}
  s.events=[];s.seq=rec.seq;s.shotRec=rec;
  s.last={seq:rec.seq,by:seat,ms:Math.round(n*FIXED_DT*1000),captured:shot.captured.slice(),foul:!!shot.foul,again:s.turn===seat&&s.winner===null,message:s.message};
  return s;
}
/** The shot again, from the state before it, for the page to animate (`step` each 1/120 s). */
export function replayCarromShot(rec){
  const s=structuredClone(rec.before);s.phase='aim';
  launch(s,rec.by,rec.x,rec.vx,rec.vy,rec.power||.5);
  return s;
}
/** Time ran out: the turn passes. */
export function carromTimeout(state){
  if(state.winner!==null&&state.winner!==undefined)return state;
  const s=strip(state),seat=s.turn;s.turn=1-seat;s.turnNo++;s.phase='aim';s.shot=null;s.seq=(state.seq||0)+1;
  placeStriker(s,500);s.message='خلص الوقت · الدور للاعب الثاني';
  s.last={seq:s.seq,by:seat,ms:0,captured:[],foul:false,again:false,timeout:true,message:s.message};s.shotRec=null;
  return s;
}
export function carromProgress(state,seat){return count(state,seat)+(state.queen?.owner===seat?3:0);}