import {createPegsGame,PEG_COLORS,choosePegsMove} from './pegs-engine.js';
export const COLOR_MODES=Object.freeze(['bluff','vault']);
export const isColorState=s=>COLOR_MODES.includes(s?.mode);
const copy=s=>structuredClone(s);
const draw=rng=>Math.min(5,Math.max(0,Math.floor(rng()*6)));
function finish(s){
  const high=Math.max(...s.players.map(p=>p.score));
  s.ties=s.players.flatMap((p,i)=>p.score===high?[i]:[]);
  s.winner=s.ties[0];s.phase='over';return s;
}
function next(s,rng){
  s.turnNo++;s.pending=0;s.streak=0;s.die=null;
  if(s.turnNo>=s.players.length*3||(s.mode==='vault'&&s.pegs.every(p=>p.taken!==null)))return finish(s);
  s.sender=s.turnNo%s.players.length;s.turn=s.sender;
  s.phase=s.mode==='bluff'?'claim':'roll';s.claim=null;
  s.secretColor=s.mode==='bluff'?draw(rng):null;
  return s;
}
export function createColorTable(names,{mode='bluff',rng=Math.random,now=Date.now()}={}){
  if(!COLOR_MODES.includes(mode)||!Array.isArray(names)||names.length<2||names.length>6)throw Error('invalid_color_table');
  const base=createPegsGame(names,{rng,first:0,showMs:mode==='vault'?5000:0,now});
  return {...base,mode,sender:0,turn:0,turnNo:0,phase:mode==='bluff'?'claim':'roll',pending:0,streak:0,
    secretColor:mode==='bluff'?draw(rng):null,claim:null,highlights:[],startedAt:now};
}
export function playColorTable(state,seat,msg,{rng=Math.random,now=Date.now()}={}){
  if(!isColorState(state)||state.winner!==null)throw Error('match_over');
  if(seat!==state.turn)throw Error('wrong_turn');
  if(!Number.isSafeInteger(msg.seq)||msg.seq!==state.seq)throw Error('invalid_sequence');
  if(now<state.lookUntil)throw Error('look_phase');
  const s=copy(state);let event;
  if(s.mode==='bluff'){
    if(s.phase==='claim'&&msg.type==='color_claim'){
      if(!Number.isInteger(msg.color)||msg.color<0||msg.color>=6)throw Error('invalid_color');
      s.claim=msg.color;s.phase='answer';s.turn=(s.sender+1)%s.players.length;
      event={type:'claim',sender:s.sender,recipient:s.turn,claim:s.claim,ms:450};
    }else if(s.phase==='answer'&&msg.type==='color_answer'){
      if(!['trust','challenge'].includes(msg.answer))throw Error('invalid_action');
      const honest=s.claim===s.secretColor,challenged=msg.answer==='challenge';
      const winner=honest?(challenged?s.sender:seat):(challenged?seat:s.sender);
      const speaker=s.players[s.sender],recipient=s.players[seat];speaker.bluffStats={...(speaker.bluffStats||{}),claims:(speaker.bluffStats?.claims||0)+1,lies:(speaker.bluffStats?.lies||0)+(honest?0:1)};recipient.bluffStats={...(recipient.bluffStats||{}),answers:(recipient.bluffStats?.answers||0)+1,challenges:(recipient.bluffStats?.challenges||0)+(challenged?1:0)};
      const points=honest&&!challenged?1:2;s.players[winner].score+=points;
      event={type:'reveal',sender:s.sender,recipient:seat,color:s.secretColor,claim:s.claim,honest,answer:msg.answer,winner,points,ms:1500};
      if(!honest&&winner===s.sender)s.highlights=[...s.highlights,event].slice(-3);
      next(s,rng);
    }else throw Error('invalid_action');
  }else{
    if(s.phase==='roll'&&msg.type==='color_roll'){
      const available=[...new Set(s.pegs.filter(p=>p.taken===null).map(p=>p.c))];
      if(!available.length)throw Error('match_over');
      s.die=available[Math.min(available.length-1,Math.max(0,Math.floor(rng()*available.length)))];s.phase='pick';
      event={type:'roll',color:s.die,ms:650};
    }else if(s.phase==='pick'&&msg.type==='color_pick'){
      if(!Number.isInteger(msg.peg)||!s.pegs[msg.peg]||s.pegs[msg.peg].taken!==null)throw Error('invalid_peg');
      const peg=s.pegs[msg.peg],ok=peg.c===s.die;
      event={type:'pick',seat,peg:msg.peg,color:peg.c,die:s.die,ok,lost:ok?0:s.pending,ms:1100};
      s.reveals=[...(s.reveals||[]),{peg:msg.peg,c:peg.c,turn:s.turnNo}].slice(-40);
      if(ok){peg.taken=seat;s.players[seat].pegs.push(peg.c);s.pending++;s.streak++;s.phase='decide';s.die=null;
        if(s.pegs.every(p=>p.taken!==null)){s.players[seat].score+=s.pending;event.banked=s.pending;next(s,rng);}}
      else next(s,rng);
    }else if(s.phase==='decide'&&msg.type==='color_bank'){
      event={type:'bank',seat,points:s.pending,ms:1000};s.players[seat].score+=s.pending;next(s,rng);
    }else if(s.phase==='decide'&&msg.type==='color_continue'){
      s.phase='roll';event={type:'continue',seat,pending:s.pending,ms:300};
    }else throw Error('invalid_action');
  }
  s.seq++;s.last={...event,seq:s.seq};return s;
}
export function colorTimeout(state,{rng=Math.random,now=Date.now()}={}){
  if(state.winner!==null)return state;
  if(state.mode==='bluff')return playColorTable(state,state.turn,state.phase==='claim'?{type:'color_claim',color:draw(rng),seq:state.seq}:{type:'color_answer',answer:'trust',seq:state.seq},{rng,now:Math.max(now,state.lookUntil)});
  if(state.phase==='decide')return playColorTable(state,state.turn,{type:'color_bank',seq:state.seq},{rng,now});
  const s=copy(state);s.last={type:'timeout',seat:s.turn,lost:s.pending,seq:++s.seq,ms:500};return next(s,rng);
}
export function chooseColorMove(s,level='medium',rng=Math.random){
  if(s.mode==='bluff'){
    // The answering bot never reads the hidden color. Both choices remain plausible.
    if(s.phase==='answer'){
      const past=s.players[s.sender].bluffStats||{},lieRate=((past.lies||0)+1)/((past.claims||0)+3);
      const preferred=lieRate>1/3?'challenge':'trust',answer=level==='hard'?(rng()<.82?preferred:preferred==='trust'?'challenge':'trust'):rng()<(level==='easy'?.75:.5)?'trust':'challenge';
      return {type:'color_answer',answer,seq:s.seq};
    }
    const opponent=s.players[(s.sender+1)%s.players.length].bluffStats||{},challengeRate=((opponent.challenges||0)+1)/((opponent.answers||0)+2);
    const honestChance=level==='easy'?.85:level==='hard'?.15+.7*challengeRate:.55;
    return {type:'color_claim',color:rng()<honestChance?s.secretColor:(s.secretColor+1+Math.floor(rng()*5))%6,seq:s.seq};
  }
  if(s.phase==='decide')return {type:s.pending>=3||rng()<.35?'color_bank':'color_continue',seq:s.seq};
  if(s.phase==='roll')return {type:'color_roll',seq:s.seq};
  const move=choosePegsMove(s,level,rng);return {type:'color_pick',peg:move.peg,seq:s.seq};
}
export function publicColorTable(source,seat,now=Date.now()){
  const s=copy(source);
  if(s.mode==='bluff'){
    s.pegs=[];s.reveals=[];
    if(seat!==s.sender||s.phase==='over')delete s.secretColor;
  }else{
    const open=s.seq===0&&now<s.lookUntil;
    s.pegs=s.pegs.map(p=>p.taken===null&&!open?{...p,c:-1}:p);s.reveals=[];
    delete s.secretColor;
  }
  delete s.salt;return s;
}
export const COLOR_PALETTE=Object.freeze(PEG_COLORS.slice(0,4).concat(PEG_COLORS.slice(7,8),PEG_COLORS.slice(6,7)));
