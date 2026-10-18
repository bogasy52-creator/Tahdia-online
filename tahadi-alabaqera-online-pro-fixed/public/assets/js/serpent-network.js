/* Compact presentation frames; gameplay continues to use full precision on the server. */
const q=n=>Math.round(n*10)/10;
function packedBody(points){
 if(points.length<128)return null;
 const origin=[Math.round(points[0].x*2),Math.round(points[0].y*2)],bytes=new Uint8Array((points.length-1)*2);let x=origin[0],y=origin[1];
 for(let i=1;i<points.length;i++){const nx=Math.round(points[i].x*2),ny=Math.round(points[i].y*2),dx=nx-x,dy=ny-y;if(Math.abs(dx)>127||Math.abs(dy)>127)return null;bytes[(i-1)*2]=dx&255;bytes[(i-1)*2+1]=dy&255;x=nx;y=ny;}
 return {origin,count:points.length,data:btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''))};
}
function unpackBody(body){
 if(!body||!Number.isInteger(body.count)||body.count<1||body.count>2048||!Array.isArray(body.origin)||body.origin.length!==2||body.origin.some(n=>!Number.isInteger(n)||Math.abs(n)>1e7)||typeof body.data!=='string'||body.data.length>6000)return null;
 let raw;try{raw=atob(body.data);}catch{return null;}if(raw.length!==(body.count-1)*2)return null;
 let[x,y]=body.origin;const points=[{x:x/2,y:y/2}];for(let i=0;i<raw.length;i+=2){const dx=raw.charCodeAt(i),dy=raw.charCodeAt(i+1);x+=dx>127?dx-256:dx;y+=dy>127?dy-256:dy;points.push({x:x/2,y:y/2});}return points;
}
export function compactSerpentFrame(state,previous,packed=false){
 const game=state.game,old=new Map(previous.game.food.map(f=>[f.id,f])),current=new Set(game.food.map(f=>f.id));
 const {food,...rest}=game;
 return {type:'frame',baseTick:previous.game.tick,foodAdded:food.filter(f=>!old.has(f.id)),foodRemoved:[...old.keys()].filter(id=>!current.has(id)),state:{...state,game:{...rest,snakes:game.snakes.map(s=>{const body=packed?packedBody(s.segments):null;return {...s,x:q(s.x),y:q(s.y),segments:body?undefined:s.segments.map(p=>[q(p.x),q(p.y)]),...(body?{body}:{} )};})}}};
}
export function applySerpentFrame(previous,packet){
 if(!previous?.game||previous.game.tick!==packet.baseTick)return null;
 const food=new Map(previous.game.food.map(f=>[f.id,f]));for(const id of packet.foodRemoved)food.delete(id);for(const f of packet.foodAdded)food.set(f.id,f);
 const snakes=[];for(const s of packet.state.game.snakes){const segments=s.body?unpackBody(s.body):s.segments?.map(([x,y])=>({x,y}));if(!segments)return null;const {body,...rest}=s;snakes.push({...rest,segments});}return {...packet.state,game:{...packet.state.game,food:[...food.values()],snakes}};
}
