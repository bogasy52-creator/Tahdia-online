import test from 'node:test';
import assert from 'node:assert/strict';
import {createSnakesGame,playSnakesRoll,DEFAULT_SNAKES_JUMPS} from '../public/assets/js/engines/snakes-engine.js';
import {snakeGeometry} from '../public/assets/js/arena-geometry.js';

test('the separated gold snake drops from 68 to 50 on the same board used by gameplay',()=>{
 const board=createSnakesGame(['A','B']);board.players[0].position=67;
 const next=playSnakesRoll(board,1);
 assert.equal(next.lastEvent.landed,68);
 assert.equal(next.lastEvent.jumpType,'snake');
 assert.equal(next.players[0].position,50);
});

test('each snake body clears all neighboring head rectangles at phone and desktop sizes',()=>{
 const rows=[8.6,9.06,10.55,9.89,9.99,10.18,10.27,10.27,10.64,10.55];
 for(const width of [310,390,709]){
  const height=width*1.307;
  function center(n){const level=Math.floor((n-1)/10),row=9-level,col=level%2===0?(n-1)%10:9-(n-1)%10;return{x:(col+.5)*width/10,y:(rows.slice(0,row).reduce((a,b)=>a+b,0)+rows[row]/2)*height/100}}
  const shapes=Object.entries(DEFAULT_SNAKES_JUMPS).filter(([from,to])=>from>to).map(([from,to])=>({from:Number(from),g:snakeGeometry(center(Number(from)),center(to),{width,height},{route:Number(from),motion:false})}));
  for(const {from,g} of shapes)for(const other of shapes){
   if(other.from===from)continue;
   const h=other.g,hw=h.headWidth,hh=hw*480/610,x1=h.head.x-h.side*hw*.68,x2=h.head.x+h.side*hw*.32;
   for(const p of g.points){
    const dx=Math.max(Math.min(x1,x2)-p.x,0,p.x-Math.max(x1,x2)),dy=Math.max(h.head.y-hh*.52-p.y,0,p.y-(h.head.y+hh*.48));
    assert.ok(Math.hypot(dx,dy)>g.radius+width*.004,`${from} body touches ${other.from} head at width ${width}`);
   }
  }
 }
});
