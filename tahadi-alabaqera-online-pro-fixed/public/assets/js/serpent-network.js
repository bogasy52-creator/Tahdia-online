/* Compact presentation frames; gameplay continues to use full precision on the server. */
const q=n=>Math.round(n*10)/10;
export function compactSerpentFrame(state,previous){
 const game=state.game,old=new Map(previous.game.food.map(f=>[f.id,f])),current=new Set(game.food.map(f=>f.id));
 const {food,...rest}=game;
 return {type:'frame',baseTick:previous.game.tick,foodAdded:food.filter(f=>!old.has(f.id)),foodRemoved:[...old.keys()].filter(id=>!current.has(id)),state:{...state,game:{...rest,snakes:game.snakes.map(s=>({...s,x:q(s.x),y:q(s.y),segments:s.segments.map(p=>[q(p.x),q(p.y)])}))}}};
}
export function applySerpentFrame(previous,packet){
 if(!previous?.game||previous.game.tick!==packet.baseTick)return null;
 const food=new Map(previous.game.food.map(f=>[f.id,f]));for(const id of packet.foodRemoved)food.delete(id);for(const f of packet.foodAdded)food.set(f.id,f);
 return {...packet.state,game:{...packet.state.game,food:[...food.values()],snakes:packet.state.game.snakes.map(s=>({...s,segments:s.segments.map(([x,y])=>({x,y}))}))}};
}
