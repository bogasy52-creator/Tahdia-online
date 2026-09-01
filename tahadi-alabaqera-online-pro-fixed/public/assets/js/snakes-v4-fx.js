const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

const REACTIONS=Object.freeze({
  die:Object.freeze([
    Object.freeze({name:'lift',duration:220,sound:'dice'}),
    Object.freeze({name:'tumble',duration:440}),
    Object.freeze({name:'impact',duration:150,sound:'diceImpact',haptic:[18,22,54]}),
    Object.freeze({name:'settle',duration:170}),
  ]),
  ladder:Object.freeze([
    Object.freeze({name:'wake',duration:160,sound:'ladderIgnite'}),
    Object.freeze({name:'climb',duration:720,sound:'ladderClimb'}),
    Object.freeze({name:'land',duration:220,sound:'ladderLand',haptic:[20,24,46]}),
  ]),
  snake:Object.freeze([
    Object.freeze({name:'track',duration:180,sound:'snakeHiss'}),
    Object.freeze({name:'strike',duration:310,sound:'snakeBite',haptic:[70,25,100]}),
    Object.freeze({name:'swallow',duration:760,sound:'snakeSwallow'}),
    Object.freeze({name:'grow',duration:480,sound:'snakeGrow',haptic:38}),
    Object.freeze({name:'release',duration:360,sound:'snakeRelease'}),
  ]),
});

const REDUCED_DURATIONS=Object.freeze({
  die:[40,90,50,40],
  ladder:[45,160,75],
  snake:[35,120,180,100,115],
});

const DIE_ROTATIONS=Object.freeze({
  1:Object.freeze({x:0,y:0}),
  2:Object.freeze({x:0,y:-90}),
  3:Object.freeze({x:90,y:0}),
  4:Object.freeze({x:-90,y:0}),
  5:Object.freeze({x:0,y:90}),
  6:Object.freeze({x:0,y:180}),
});

const PIECE_PROFILES=Object.freeze([
  Object.freeze({name:'الماسة',symbol:'◆',material:'amethyst'}),
  Object.freeze({name:'المدار',symbol:'●',material:'sapphire'}),
  Object.freeze({name:'الرمح',symbol:'▲',material:'topaz'}),
  Object.freeze({name:'النجمة',symbol:'✦',material:'emerald'}),
]);

export function createReactionPlan(kind,{reducedMotion=false}={}){
  const source=REACTIONS[kind];
  if(!source)throw new Error('invalid_reaction_kind');
  let elapsed=0;
  const phases=source.map((phase,index)=>{
    const duration=reducedMotion?REDUCED_DURATIONS[kind][index]:phase.duration;
    const planned={...phase,duration,at:elapsed};
    elapsed+=duration;
    return Object.freeze(planned);
  });
  const impact=phases.find(phase=>phase.name==='impact'||phase.name==='land'||phase.name==='strike');
  return Object.freeze({kind,reducedMotion,phases:Object.freeze(phases),total:elapsed,impactAt:impact?.at??0});
}

export function createBoardMovePlan(from,to,{reducedMotion=false}={}){
  const start=clamp(Math.trunc(Number(from)||0),0,100);
  const end=clamp(Math.trunc(Number(to)||0),0,100);
  const direction=end>=start?1:-1;
  const cells=[];
  for(let cell=start+direction;direction>0?cell<=end:cell>=end;cell+=direction)cells.push(cell);
  const duration=reducedMotion?clamp(110+cells.length*18,130,260):clamp(180+cells.length*58,260,680);
  const pulses=cells.map((cell,index)=>Object.freeze({cell,at:Math.round((index+1)/Math.max(1,cells.length)*duration)}));
  return Object.freeze({from:start,to:end,cells:Object.freeze(cells),pulses:Object.freeze(pulses),duration});
}

export function createSmoothMotionFrames(points,{lift=14}={}){
  const clean=(Array.isArray(points)?points:[]).map(point=>({x:Number(point?.x)||0,y:Number(point?.y)||0}));
  if(clean.length<2)return clean.map((point,index)=>Object.freeze({...point,scale:1,rotate:0,offset:index}));
  const segments=clean.length-1,frames=[Object.freeze({...clean[0],scale:1,rotate:0,offset:0})];
  for(let index=0;index<segments;index++){
    const a=clean[index],b=clean[index+1],base=index/segments,next=(index+1)/segments;
    const angle=clamp((b.x-a.x)*.055,-7,7);
    frames.push(Object.freeze({x:(a.x+b.x)/2,y:(a.y+b.y)/2-lift,scale:1.08,rotate:angle,offset:(base+next)/2}));
    frames.push(Object.freeze({...b,scale:index===segments-1?1:1.025,rotate:0,offset:next}));
  }
  return Object.freeze(frames);
}

export function createSnakeBodyProgress(samples=18){
  const count=clamp(Math.trunc(Number(samples)||18),3,48);
  return Object.freeze(Array.from({length:count},(_,index)=>{
    const distance=index/(count-1),wave=Math.sin(Math.PI*distance);
    return Object.freeze({distance,scale:.58+wave*.88,opacity:clamp(Math.sin(Math.PI*Math.min(1,distance*1.08))*1.18,0,1)});
  }));
}

export function getPieceProfile(index=0){
  const safe=((Math.trunc(Number(index)||0)%PIECE_PROFILES.length)+PIECE_PROFILES.length)%PIECE_PROFILES.length;
  return PIECE_PROFILES[safe];
}

export function getDieRotation(value){
  const result=DIE_ROTATIONS[Number(value)];
  if(!result)throw new Error('invalid_die_value');
  return result;
}
