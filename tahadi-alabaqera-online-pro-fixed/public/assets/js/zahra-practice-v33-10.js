import {createLudoGame,getLegalLudoMoves,applyLudoMove,passLudoTurn} from './engines/ludo-engine.js?v=33.9.10';
import {boardGeometry} from './engines/board-geometry-v29.js?v=33.9.10';
const BOT_NAMES=['نورة','ماجد','ليان','فهد','سارة'];
function random(){const bytes=new Uint32Array(1);globalThis.crypto.getRandomValues(bytes);return bytes[0]/4294967296;}
function pause(ms,signal){return new Promise(resolve=>{if(signal.aborted){resolve();return;}let timer;const end=()=>{clearTimeout(timer);signal.removeEventListener('abort',end);resolve();};timer=setTimeout(end,ms);signal.addEventListener('abort',end,{once:true});});}
export function chooseZahraBotMove(state,roll){
 const legal=getLegalLudoMoves(state,roll),finish=boardGeometry(state).finish;let best=legal[0],score=-Infinity;
 for(const token of legal){const next=applyLudoMove(state,token,roll),from=state.players[state.turn].tokens[token],to=next.players[state.turn].tokens[token],value=(next.winner!==null?10000:0)+(to===finish?140:0)+(next.lastEvent.captured.length*55)+(from<0?20:0)+to*.35;
  if(value>score){score=value;best=token;}}
 return best;
}
// Practice owns no network connection or account rewards. Every frame uses the same rules as online.
export function createZahraPractice({onFrame=async()=>{},onError=()=>{},rng=random,delay=pause}={}){
 let session=null,game=null,pendingRoll=null,processing=false,lastTask=Promise.resolve(),generation=0,sequence=0;
 function view(){if(!session||!game)return null;return{local:true,localMode:session.mode,code:'تدريب',status:game.winner===null?'playing':'finished',state:structuredClone(game),pendingRoll,startedAt:session.startedAt,version:sequence,order:session.players.map(p=>p.id),players:session.players,me:{id:session.players[session.mode==='pass'?game.turn:0].id,index:session.mode==='pass'?game.turn:0,role:'host'}};}
 const alive=token=>Boolean(session&&generation===token&&!session.controller.signal.aborted);
 async function frame(token,animate){if(!alive(token))return false;sequence++;await onFrame(view(),{animate,signal:session.controller.signal});return alive(token);}
 async function throwDie(token){if(!alive(token))return;const roll=Math.max(1,Math.min(6,1+Math.floor(rng()*6)));if(getLegalLudoMoves(game,roll).length)pendingRoll=roll;else game=passLudoTurn(game,roll);await frame(token,true);}
 async function move(token,index){if(!alive(token))return;game=applyLudoMove(game,index,pendingRoll);pendingRoll=null;await frame(token,true);}
 async function bots(token){
  while(alive(token)&&game.winner===null&&session.mode==='ai'&&game.turn!==0){
   await delay(520,session.controller.signal);if(!alive(token))return;
   if(pendingRoll===null)await throwDie(token);else await move(token,chooseZahraBotMove(game,pendingRoll));
  }
 }
 function enqueue(work){const token=generation;processing=true;lastTask=(async()=>{try{await work(token);if(alive(token))await bots(token);}catch(error){if(alive(token))onError(error.message||'تعذرت الحركة');}finally{if(alive(token))processing=false;}})();return lastTask;}
 function leave(){generation++;session?.controller.abort();session=null;game=null;pendingRoll=null;processing=false;}
 return {
  get active(){return Boolean(session);},get busy(){return processing;},get snapshot(){return view();},get settled(){return lastTask;},
  start({count=2,mode='ai',name='أنت',look={}}={}){
   if(!Number.isInteger(count)||count<2||count>6)throw Error('ludo_requires_2_to_6_players');if(!['ai','pass'].includes(mode))throw Error('invalid_practice_mode');
   leave();const names=Array.from({length:count},(_,i)=>i===0?String(name||'أنت').slice(0,20):mode==='ai'?BOT_NAMES[i-1]:'لاعب '+(i+1));
   session={mode,controller:new AbortController(),startedAt:Date.now(),players:names.map((name,index)=>({id:'local-'+index,index,name,bot:mode==='ai'&&index>0,look:index===0?{pawn:look.pawn||'pawn-classic',dice:look.dice||'dice-ivory',character:look.character||'character-fox'}:{pawn:'pawn-classic',dice:'dice-ivory',character:'character-fox'}}))};game=createLudoGame(names);pendingRoll=null;sequence=0;
   return enqueue(async token=>{await frame(token,false);});
  },
  send(type,payload={}){
   if(!session||processing||game.winner!==null||(session.mode==='ai'&&game.turn!==0))return false;
   if(type==='roll'&&pendingRoll===null){enqueue(throwDie);return true;}
   if(type==='ludo_move'&&pendingRoll!==null&&getLegalLudoMoves(game,pendingRoll).includes(payload.token)){enqueue(token=>move(token,payload.token));return true;}
   return false;
  },leave
 };
}
