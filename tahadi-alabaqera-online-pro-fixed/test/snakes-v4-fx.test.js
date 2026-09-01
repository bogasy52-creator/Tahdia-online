import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  createBoardMovePlan,
  createReactionPlan,
  createSmoothMotionFrames,
  createSnakeBodyProgress,
  getDieRotation,
  getPieceProfile,
} from '../public/assets/js/snakes-v4-fx.js';

test('board movement lights every traversed cell on a smooth bounded timeline', () => {
  const plan=createBoardMovePlan(11,17);
  assert.deepEqual(plan.cells,[12,13,14,15,16,17]);
  assert.equal(plan.pulses.length,6);
  assert.ok(plan.duration>=420&&plan.duration<=680);
  assert.ok(plan.pulses.every((pulse,index)=>pulse.cell===12+index));
  assert.ok(plan.pulses.every((pulse,index,list)=>index===0||pulse.at>list[index-1].at));
});

test('motion frames add an arc between cells instead of snapping square-to-square', () => {
  const frames=createSmoothMotionFrames([{x:0,y:0},{x:100,y:0},{x:100,y:100}]);
  assert.equal(frames[0].offset,0);
  assert.equal(frames.at(-1).offset,1);
  assert.ok(frames.length>3,'each cell transition should include an airborne frame');
  assert.ok(frames.some(frame=>frame.y<0),'the stone should visibly lift between cells');
  assert.ok(frames.every((frame,index,list)=>index===0||frame.offset>=list[index-1].offset));
});

test('snake reaction is a complete hunt, bite, swallow, growth and release sequence', () => {
  const plan=createReactionPlan('snake');
  assert.deepEqual(plan.phases.map(phase=>phase.name),['track','strike','swallow','grow','release']);
  assert.deepEqual(plan.phases.map(phase=>phase.sound),['snakeHiss','snakeBite','snakeSwallow','snakeGrow','snakeRelease']);
  assert.ok(plan.total>=1900&&plan.total<=2400);
  assert.deepEqual(plan.phases.find(phase=>phase.name==='strike').haptic,[70,25,100]);
});

test('ladder and die plans include physical activation and landing impact', () => {
  const ladder=createReactionPlan('ladder');
  assert.deepEqual(ladder.phases.map(phase=>phase.name),['wake','climb','land']);
  assert.equal(ladder.phases.at(-1).sound,'ladderLand');

  const die=createReactionPlan('die');
  assert.deepEqual(die.phases.map(phase=>phase.name),['lift','tumble','impact','settle']);
  assert.equal(die.impactAt,die.phases.find(phase=>phase.name==='impact').at);
  assert.equal(die.phases.find(phase=>phase.name==='impact').sound,'diceImpact');
});

test('reduced motion keeps all game phases but finishes quickly', () => {
  const normal=createReactionPlan('snake');
  const reduced=createReactionPlan('snake',{reducedMotion:true});
  assert.deepEqual(reduced.phases.map(phase=>phase.name),normal.phases.map(phase=>phase.name));
  assert.ok(reduced.total<normal.total/2);
});

test('swallowed stone travels from the head through the full snake body', () => {
  const progress=createSnakeBodyProgress(15);
  assert.equal(progress.length,15);
  assert.equal(progress[0].distance,0);
  assert.equal(progress.at(-1).distance,1);
  assert.ok(progress.slice(1).every((point,index)=>point.distance>progress[index].distance));
  assert.ok(progress.some(point=>point.scale>1.2));
});

test('professional pieces stay distinguishable without relying on color', () => {
  const profiles=Array.from({length:4},(_,index)=>getPieceProfile(index));
  assert.equal(new Set(profiles.map(profile=>profile.symbol)).size,4);
  assert.equal(new Set(profiles.map(profile=>profile.name)).size,4);
  assert.deepEqual(getPieceProfile(5),profiles[1]);
});

test('the 3D die exposes a stable orientation for every legal result', () => {
  const rotations=Array.from({length:6},(_,index)=>getDieRotation(index+1));
  assert.equal(new Set(rotations.map(rotation=>`${rotation.x}:${rotation.y}`)).size,6);
  assert.throws(()=>getDieRotation(0),/invalid_die_value/);
  assert.throws(()=>getDieRotation(7),/invalid_die_value/);
});

test('snake heads render in a dedicated top layer so crossings cannot cut them off', async() => {
  const html=await readFile(new URL('../public/snakes.html',import.meta.url),'utf8');
  assert.match(html,/class="snake-head-layer"/);
  assert.match(html,/class="snake-head-creature"/);
  assert.match(html,/snakeVisualParts\(/);
});
