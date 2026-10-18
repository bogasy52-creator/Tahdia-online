import {ARENA_POWERS,powerActive} from './engines/arena-drops-v24.js';
export function paintPowerDrop(c,d,now,reduced=false){
 const p=ARENA_POWERS[d.kind];if(!p)return;const r=22*(reduced?1:1+Math.sin(now/330+d.x)*.055);
 c.save();c.translate(d.x,d.y);c.strokeStyle=p.color;c.fillStyle='#092831';c.lineWidth=2.5;c.beginPath();for(let i=0;i<6;i++){const a=Math.PI/3*i;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.fill();c.stroke();
 c.strokeStyle=p.color;c.fillStyle=p.color;c.lineWidth=2.5;c.lineJoin='round';c.lineCap='round';c.beginPath();
 if(d.kind==='shield'){c.moveTo(0,-12);c.lineTo(10,-8);c.lineTo(8,4);c.quadraticCurveTo(5,10,0,13);c.quadraticCurveTo(-5,10,-8,4);c.lineTo(-10,-8);c.closePath();c.stroke();c.beginPath();c.moveTo(-4,0);c.lineTo(-1,4);c.lineTo(5,-4);c.stroke();}
 else if(d.kind==='ghost'){c.arc(0,-3,8,Math.PI,0);c.lineTo(8,10);c.lineTo(3,6);c.lineTo(0,10);c.lineTo(-3,6);c.lineTo(-8,10);c.closePath();c.stroke();for(const x of [-3,3]){c.beginPath();c.arc(x,-2,1.4,0,Math.PI*2);c.fill();}}
 else if(d.kind==='speed'){c.moveTo(3,-13);c.lineTo(-9,3);c.lineTo(-1,3);c.lineTo(-3,14);c.lineTo(10,-3);c.lineTo(2,-3);c.closePath();c.fill();}
 else{c.lineWidth=4;c.moveTo(-8,-9);c.lineTo(-8,3);c.bezierCurveTo(-8,14,8,14,8,3);c.lineTo(8,-9);c.stroke();c.strokeStyle='#f6f8e8';c.beginPath();c.moveTo(-8,-9);c.lineTo(-8,-5);c.moveTo(8,-9);c.lineTo(8,-5);c.stroke();}c.restore();
}
export function paintSnakePower(c,s,elapsed,now,reduced=false){
 const r=7+Math.sqrt(s.mass)*.55,shield=powerActive(s,'shield',elapsed),magnet=powerActive(s,'magnet',elapsed),speed=powerActive(s,'speed',elapsed);
 c.save();c.lineWidth=2;c.setLineDash([]);
 if(shield){c.strokeStyle='#98e9ff';c.fillStyle='#73d8f912';c.beginPath();c.arc(s.x,s.y,r*2.1,0,Math.PI*2);c.fill();c.stroke();}
 if(magnet){c.strokeStyle='#ffb7cb88';c.setLineDash([6,9]);c.lineDashOffset=reduced?0:-now/80;c.beginPath();c.arc(s.x,s.y,r+70,0,Math.PI*2);c.stroke();}
 if(speed){c.strokeStyle='#ffe18b';c.setLineDash([]);for(let i=0;i<3;i++){const x=s.x-Math.cos(s.angle)*(30+i*10),y=s.y-Math.sin(s.angle)*(30+i*10);c.beginPath();c.moveTo(x+Math.sin(s.angle)*5,y-Math.cos(s.angle)*5);c.lineTo(x,y);c.lineTo(x-Math.sin(s.angle)*5,y+Math.cos(s.angle)*5);c.stroke();}}
 c.restore();
}
