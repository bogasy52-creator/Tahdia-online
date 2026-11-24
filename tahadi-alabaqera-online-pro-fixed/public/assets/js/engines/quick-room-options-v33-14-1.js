import {partyModes} from './party-modes.js';
export function quickRoomModes(game){return game==='baloot'?[{id:'open',label:'مفتوح'},{id:'strict',label:'مقيّد'}]:partyModes(game);}
export function quickRoomSeats(game,mode,max=20){
 if(game==='baloot')return[4];
 if(game==='ludo'||game==='zahra')return[2,3,4,6];
 if(game==='jackaroo'||game==='pegs'&&mode==='teams')return[4,6];
 if(game==='snakes')return[2,3,4];
 if(['billiards','carrom','hockey','jewels'].includes(game))return[2];
 const limit=game==='pegs'?6:game==='dice'?10:game==='tanks'?4:Math.max(2,Math.min(20,Number(max)||20));
 if(game==='tanks'&&mode==='teams')return[2,4];
 return Array.from({length:limit-1},(_,i)=>i+2);
}
export function normalizeQuickRoomChoice(game,choice={},max=20){
 choice=choice&&typeof choice==='object'?choice:{};
 const modes=quickRoomModes(game);if(!modes.length)throw Error('لعبة غير معروفة');
 const mode=modes.some(m=>m.id===choice.mode)?choice.mode:modes[0].id,options=quickRoomSeats(game,mode,max);
 const preferred={ludo:4,zahra:4,jackaroo:4,snakes:4,dice:3,pegs:2}[game]||Math.min(4,options.at(-1));
 const seats=options.includes(Number(choice.seats))?Number(choice.seats):options.includes(preferred)?preferred:options[0];
 return{mode,seats};
}
