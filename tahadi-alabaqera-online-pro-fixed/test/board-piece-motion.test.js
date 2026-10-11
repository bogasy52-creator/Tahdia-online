import test from 'node:test';
import assert from 'node:assert/strict';
import {createStonePathFrames} from '../public/assets/js/board-piece-motion.js';
test('stones follow every circular-track waypoint rather than cutting across the table',()=>{
 const from={x:0,y:100},points=[{x:30,y:40},{x:100,y:0},{x:170,y:40}],to={x:200,y:100},frames=createStonePathFrames(from,points,to);
 const stops=frames.filter((_,i)=>i%2===0);assert.deepEqual(stops.map(f=>f.translate),['-200px 0px','-170px -60px','-100px -100px','-30px -60px','0px 0px']);
 assert.equal(frames.at(-1).offset,1);assert.ok(frames.every((f,i)=>!i||f.offset>frames[i-1].offset));
});
test('entering and finishing a stone has exactly one final waypoint and finite offsets',()=>{
 const from={x:20,y:10},to={x:50,y:40},frames=createStonePathFrames(from,[to],to);assert.equal(frames.length,3);assert.equal(frames.at(-1).translate,'0px 0px');assert.equal(frames.at(-1).scale,'1');assert.deepEqual(createStonePathFrames(null,[],to),[]);
});
