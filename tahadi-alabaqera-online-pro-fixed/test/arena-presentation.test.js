import test from 'node:test';
import assert from 'node:assert/strict';
import * as Presentation from '../public/assets/js/serpent-renderer.js';

test('arena camera shows more space as the snake grows and stays bounded on small screens',()=>{
 assert.equal(typeof Presentation.arenaZoom,'function');
 const small=Presentation.arenaZoom(390,844,28),large=Presentation.arenaZoom(390,844,180);
 assert.ok(large<small);assert.ok(large>=.34);assert.ok(Presentation.arenaZoom(1800,1200,24)<=1.1);
});

test('arena rank, danger and boost indicators come from the actual simulation without mutating it',()=>{
 assert.equal(typeof Presentation.arenaTelemetry,'function');
 const game={width:1800,height:1800,snakes:[{id:'me',x:30,y:600,mass:24,score:8,alive:true,kills:1},{id:'bot',score:20,alive:true},{id:'gone',score:2,alive:false}]};
 const before=structuredClone(game),info=Presentation.arenaTelemetry(game,'me');
 assert.equal(info.rank,2);assert.equal(info.alive,2);assert.equal(info.total,3);
 assert.equal(info.boost,0);assert.equal(info.danger,true);assert.equal(info.kills,1);assert.deepEqual(game,before);
 game.snakes[0].mass=100;game.snakes[0].x=900;assert.equal(Presentation.arenaTelemetry(game,'me').boost,1);
});

test('local cosmetic trial only accepts an accessible catalogue snake',()=>{
 assert.equal(typeof Presentation.resolveTrialSkin,'function');
 const catalogue=[{id:'snake-gold',type:'snake',name:'gold'},{id:'pawn-jade',type:'pawn'},{id:'secret',type:'snake',source:'owner'}];
 assert.equal(Presentation.resolveTrialSkin(catalogue,'?preview=snake-gold').id,'snake-gold');
 for(const query of ['?preview=pawn-jade','?preview=secret','?preview=not-real','?preview=%3Cscript%3E'])assert.equal(Presentation.resolveTrialSkin(catalogue,query),null);
});
