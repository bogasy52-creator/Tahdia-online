import test from 'node:test';
import assert from 'node:assert/strict';
let shapes={};try{shapes=await import('../public/assets/js/arena-geometry.js')}catch{}

test('snake endpoints remain on the real cells and its body stays inside the board',()=>{
 assert.equal(typeof shapes.snakeGeometry,'function');
 for(const [a,b] of [[{x:58,y:23},{x:96,y:130}],[{x:250,y:70},{x:135,y:380}],[{x:58,y:220},{x:58,y:425}]]){
  const g=shapes.snakeGeometry(a,b,{width:390,height:490});
  assert.deepEqual(g.head,a);assert.deepEqual(g.points.at(-1),b);
  assert.ok(g.points.every(p=>p.x>0&&p.x<390&&p.y>0&&p.y<490));
  assert.ok(g.radius>=390/10*.23&&g.radius<=390/10*.32);
  assert.ok(g.headWidth>=390/10*1.16&&g.headWidth<=390/10*1.34,'heads must fit the neighboring cells');
 }
});
test('length changes the path rather than stretching the head',()=>{
 assert.equal(typeof shapes.snakeGeometry,'function');
 const a=shapes.snakeGeometry({x:100,y:80},{x:110,y:180},{width:390,height:490});
 const b=shapes.snakeGeometry({x:100,y:80},{x:110,y:430},{width:390,height:490});
 assert.ok(b.headWidth/a.headWidth<=1.15,'a longer fall must not stretch the head');assert.ok(b.radius>a.radius);
});
test('idle motion preserves endpoints and stays small between adjacent frames',()=>{
 assert.equal(typeof shapes.snakeGeometry,'function');
 const a={x:250,y:70},b={x:135,y:380},size={width:390,height:490};
 const p=shapes.snakeGeometry(a,b,size,{time:2000}),q=shapes.snakeGeometry(a,b,size,{time:2016});
 assert.deepEqual(p.points.at(-1),q.points.at(-1));
 assert.ok(p.points.every((point,i)=>Math.hypot(point.x-q.points[i].x,point.y-q.points[i].y)<.1));
});
