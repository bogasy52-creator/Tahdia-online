/* Tahdia 33.8.0 — the emoji of the reactions, drawn and animated: glossy faces that blink, laugh,
   cry, steam and shiver, and objects that burn, spin and shine. The rarest come with a legendary
   entrance (light rays, a golden shock ring). One small stylesheet is added once; nothing is fetched.
   33.9.0: faces with depth (light from above, a warm bounce light below, shade at the rim, glossy
   eyes, a lit mouth), seven new faces that laugh and rage, and the duel: a move thrown from one
   player at another — it flies, it lands, and both faces answer it. */
(()=>{'use strict';
if(window.BS_EMOJI_ART)return;
let uid=0;
const INK='#3a210d';
// the face being drawn: its paints (mouth, tongue, tears, eyes) are defined once in its base
let cur='';
const MOUTH=()=>`url(#m${cur})`,TONGUE=()=>`url(#t${cur})`,TEAR=()=>`url(#d${cur})`;
const css=`
.bsf{display:block;width:100%;height:100%;overflow:visible}
.bsf [class]{transform-box:fill-box;transform-origin:center}
.bsf .bob{animation:bsf-bob 2.6s ease-in-out infinite;transform-origin:50% 90%}
.bsf .blink{animation:bsf-blink 3.4s infinite}
.bsf .shake{animation:bsf-shake .34s ease-in-out infinite}
.bsf .roll{animation:bsf-roll 1.3s ease-in-out infinite;transform-origin:50% 60%}
.bsf .tearL{animation:bsf-tearL 1s ease-in infinite}.bsf .tearR{animation:bsf-tearR 1s .5s ease-in infinite}
.bsf .stream{stroke-dasharray:7 7;animation:bsf-stream .55s linear infinite}
.bsf .steam{animation:bsf-steam 1.3s ease-out infinite;opacity:0}.bsf .steam.b{animation-delay:.65s}
.bsf .flush{animation:bsf-flush 1.1s ease-in-out infinite}
.bsf .glint{animation:bsf-glint 2.4s ease-in-out infinite}
.bsf .pulse{animation:bsf-pulse 1s ease-in-out infinite}
.bsf .wag{animation:bsf-wag .5s ease-in-out infinite;transform-origin:30% 10%}
.bsf .brow{animation:bsf-brow 1.6s ease-in-out infinite}
.bsf .look{animation:bsf-look 2.2s ease-in-out infinite}
.bsf .yawn{animation:bsf-yawn 2.6s ease-in-out infinite;transform-origin:50% 30%}
.bsf .zz{animation:bsf-zz 2.6s ease-out infinite;opacity:0}.bsf .zz.b{animation-delay:.9s}
.bsf .shiver{animation:bsf-shiver .12s linear infinite}
.bsf .glow{animation:bsf-glow 1.4s ease-in-out infinite}
.bsf .boom{animation:bsf-boom 1.6s ease-out infinite;transform-origin:50% 100%}
.bsf .flame1{animation:bsf-flame .42s ease-in-out infinite alternate;transform-origin:50% 100%}
.bsf .flame2{animation:bsf-flame .3s .1s ease-in-out infinite alternate-reverse;transform-origin:50% 100%}
.bsf .flame3{animation:bsf-flame .24s ease-in-out infinite alternate;transform-origin:50% 100%}
.bsf .ember{animation:bsf-ember 1.4s ease-out infinite;opacity:0}.bsf .ember.b{animation-delay:.5s}.bsf .ember.c{animation-delay:.95s}
.bsf .clapL{animation:bsf-clapL .5s ease-in-out infinite;transform-origin:20% 90%}.bsf .clapR{animation:bsf-clapR .5s ease-in-out infinite;transform-origin:80% 90%}
.bsf .hit{animation:bsf-hit .5s ease-out infinite;opacity:0}
.bsf .tumble{animation:bsf-tumble 1.6s cubic-bezier(.3,.7,.3,1) infinite}
.bsf .tongue{animation:bsf-tongue 1.2s ease-in-out infinite;transform-origin:0% 50%}
.bsf .slither{animation:bsf-slither 1.8s ease-in-out infinite}
.bsf .orbit{animation:bsf-orbit 3s linear infinite;transform-origin:50px 50px;transform-box:view-box}
.bsf .twinkle{animation:bsf-twinkle 1.2s ease-in-out infinite}.bsf .twinkle.b{animation-delay:.4s}.bsf .twinkle.c{animation-delay:.8s}
.bsf .rumble{animation:bsf-rumble .1s linear infinite}
.bsf .exhaust{animation:bsf-flame .16s ease-in-out infinite alternate;transform-origin:50% 0%}
.bsf .puff{animation:bsf-puff 1s ease-out infinite;opacity:0}.bsf .puff.b{animation-delay:.33s}.bsf .puff.c{animation-delay:.66s}
.bsf .shine{animation:bsf-shine 2.2s ease-in-out infinite}
.bsf .spin3d{animation:bsf-spin3d 2.8s ease-in-out infinite}
.bsf .rays{animation:bsf-rays 7s linear infinite;transform-origin:50px 50px;transform-box:view-box}
.bsf .vein{animation:bsf-vein .7s ease-in-out infinite}
.bsf .fill{animation:bsf-fill 2.6s ease-in-out infinite}
.bsf .cloud{animation:bsf-cloud 3.2s ease-in-out infinite}
.bsf .bolt{animation:bsf-bolt 1.9s steps(1) infinite}
.bsf .giggle{animation:bsf-giggle .26s ease-in-out infinite}
.bsf .tilt{animation:bsf-tilt 1.1s ease-in-out infinite;transform-origin:50% 85%}
.bsf .ha{animation:bsf-ha 1.4s ease-out infinite;opacity:0}.bsf .ha.b{animation-delay:.45s}.bsf .ha.c{animation-delay:.9s}
.bsf.is-still *,.is-still .bsf *{animation:none!important}
.bsf.is-still .ha{opacity:0!important}
@keyframes bsf-vein{50%{transform:scale(1.28)}}
@keyframes bsf-fill{0%{transform:translateY(62px)}55%,85%{transform:translateY(0)}100%{transform:translateY(4px)}}
@keyframes bsf-cloud{50%{transform:translateX(5px)}}
@keyframes bsf-bolt{0%,62%,72%,100%{opacity:0}64%,70%{opacity:1}}
@keyframes bsf-giggle{50%{transform:translateY(-1.6px) rotate(2deg)}}
@keyframes bsf-tilt{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(-16deg) translateY(-2px)}}
@keyframes bsf-ha{0%{transform:translate(0,4px) scale(.6);opacity:0}25%{opacity:1}100%{transform:translate(var(--hx,8px),-20px) scale(1.15);opacity:0}}
/* 33.9.0: the duel — a move thrown from one player at another */
.bsd{position:absolute;z-index:45;height:170px;transform:translate(-50%,-50%);pointer-events:none;animation:bsd-in .26s ease-out both;font-family:Tajawal,system-ui,sans-serif}
.bsd.out{animation:bsd-out .42s ease-in forwards}
.bsd::before{content:'';position:absolute;inset:8px 4% 18px;border-radius:26px;background:radial-gradient(ellipse at 50% 60%,#0b1226d9,#0b122600 72%)}
.bsd-actor{position:absolute;top:10px;width:104px;display:grid;justify-items:center;gap:5px}
.bsd-thrower{right:3%}.bsd-target{left:3%}
.bsd-face{position:relative;width:86px;height:86px;display:block;filter:drop-shadow(0 9px 14px #0009)}
.bsd-face>.bsf-wrap{position:absolute;inset:0;display:block;width:100%;height:100%}
.bsd-actor b{padding:3px 11px;border-radius:99px;background:#0b1226ec;border:1px solid #ffffff3a;color:#fff;font-weight:800;font-size:12.5px;line-height:1.3;white-space:nowrap;max-width:116px;overflow:hidden;text-overflow:ellipsis}
.bsd-target b{border-color:#ff9a8a88}.bsd.is-me .bsd-target b{background:#3a0f16ee}
.bsd-thrower.wind .bsd-face{animation:bsd-wind .32s ease-in-out}
.bsd-target.hit .bsd-face{animation:bsd-hit .55s cubic-bezier(.3,1.5,.5,1)}
.bsd-thrower.cheer .bsd-face{animation:bsd-cheer .5s ease-in-out 2}
.bsd-shot{position:absolute;left:0;top:0;width:50px;height:50px;margin:-25px 0 0 -25px;opacity:0;filter:drop-shadow(0 6px 8px #0008)}
.bsd-shot svg,.bsd-mark svg{width:100%;height:100%;display:block;overflow:visible}
.bsd-mark{position:absolute;top:10px;width:96px;height:96px;margin-left:-48px;pointer-events:none;animation:bsd-mark .5s cubic-bezier(.2,1.6,.4,1) both}
.bsd-mark .spin{animation:bsf-orbit 1.2s linear infinite;transform-origin:50px 50px;transform-box:view-box}
.bsd-mark .rise{animation:bsd-rise 1.4s ease-out infinite}.bsd-mark .rise.b{animation-delay:.35s}.bsd-mark .rise.c{animation-delay:.7s}
.bsd-mark .fall{animation:bsd-fall 1.6s ease-in infinite}.bsd-mark .fall.b{animation-delay:.4s}.bsd-mark .fall.c{animation-delay:.8s}
.bsd-reply{position:absolute;left:3%;bottom:-4px;width:104px;min-height:34px;border:1px solid #ffd36b;border-radius:99px;background:linear-gradient(180deg,#ffdc84,#f0a52c);color:#2b1903;font:900 13px/1.2 Tajawal,system-ui,sans-serif;cursor:pointer;pointer-events:auto;box-shadow:0 8px 18px #0008;animation:bsd-in .25s ease-out both}
.bsd-reply:focus-visible{outline:3px solid #fff;outline-offset:2px}
@keyframes bsd-in{from{opacity:0;transform:translate(-50%,-50%) scale(.86)}}
@keyframes bsd-out{to{opacity:0;transform:translate(-50%,-50%) scale(.94)}}
@keyframes bsd-wind{50%{transform:rotate(-16deg) translateX(10px) scale(1.05)}}
@keyframes bsd-hit{0%{transform:none}18%{transform:translateX(-16px) rotate(-14deg) scale(.9)}42%{transform:translateX(7px) rotate(6deg)}68%{transform:translateX(-3px) rotate(-2deg)}100%{transform:none}}
@keyframes bsd-cheer{50%{transform:translateY(-8px) rotate(6deg) scale(1.06)}}
@keyframes bsd-mark{from{transform:scale(.2);opacity:0}}
@keyframes bsd-rise{0%{transform:translateY(8px) scale(.6);opacity:0}25%{opacity:1}100%{transform:translateY(-34px) scale(1.1);opacity:0}}
@keyframes bsd-fall{0%{transform:translateY(-6px) rotate(0);opacity:0}20%{opacity:1}100%{transform:translateY(40px) rotate(120deg);opacity:0}}
@media (prefers-reduced-motion:reduce){.bsd,.bsd *{animation:none!important}}
.bsf.is-still .steam,.bsf.is-still .zz,.bsf.is-still .ember,.bsf.is-still .hit,.bsf.is-still .puff{opacity:0!important}
@keyframes bsf-bob{50%{transform:translateY(-3px) scale(1.02,.98)}}
@keyframes bsf-blink{0%,90%,100%{transform:scaleY(1)}94%{transform:scaleY(.08)}}
@keyframes bsf-shake{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(7deg) translateY(-2px)}}
@keyframes bsf-roll{0%,100%{transform:rotate(-24deg) translateX(-3px)}50%{transform:rotate(18deg) translateX(3px)}}
@keyframes bsf-tearL{0%{transform:translate(0,0) scale(.6);opacity:0}15%{opacity:1}100%{transform:translate(-16px,14px) scale(1);opacity:0}}
@keyframes bsf-tearR{0%{transform:translate(0,0) scale(.6);opacity:0}15%{opacity:1}100%{transform:translate(16px,14px) scale(1);opacity:0}}
@keyframes bsf-stream{to{stroke-dashoffset:-14}}
@keyframes bsf-steam{0%{transform:translate(0,0) scale(.4);opacity:0}20%{opacity:.95}100%{transform:translate(var(--sx,-10px),-14px) scale(1.5);opacity:0}}
@keyframes bsf-flush{50%{opacity:.55}}
@keyframes bsf-glint{0%,55%{transform:translateX(-46px)}85%,100%{transform:translateX(52px)}}
@keyframes bsf-pulse{50%{transform:scale(1.18)}}
@keyframes bsf-wag{0%,100%{transform:rotate(-10deg)}50%{transform:rotate(14deg)}}
@keyframes bsf-brow{0%,60%,100%{transform:translateY(0)}70%,85%{transform:translateY(-4px)}}
@keyframes bsf-look{0%,20%{transform:translateX(0)}35%,60%{transform:translateX(4px)}75%,90%{transform:translateX(-3px)}}
@keyframes bsf-yawn{0%,20%,100%{transform:scaleY(.45)}45%,70%{transform:scaleY(1.15)}}
@keyframes bsf-zz{0%{transform:translate(0,4px) scale(.6);opacity:0}25%{opacity:1}100%{transform:translate(10px,-18px) scale(1.2);opacity:0}}
@keyframes bsf-shiver{0%{transform:translateX(-1.4px)}50%{transform:translateX(1.4px)}100%{transform:translateX(-1.4px)}}
@keyframes bsf-glow{50%{opacity:.35}}
@keyframes bsf-boom{0%{transform:scale(.3) translateY(10px);opacity:0}25%{opacity:1}70%{transform:scale(1.08) translateY(-4px);opacity:1}100%{transform:scale(1.2) translateY(-8px);opacity:0}}
@keyframes bsf-flame{0%{transform:scale(1,1) skewX(0)}100%{transform:scale(.92,1.08) skewX(-4deg)}}
@keyframes bsf-ember{0%{transform:translate(0,0);opacity:0}20%{opacity:1}100%{transform:translate(var(--ex,6px),-26px) scale(.4);opacity:0}}
@keyframes bsf-clapL{0%,100%{transform:rotate(-16deg)}50%{transform:rotate(4deg)}}
@keyframes bsf-clapR{0%,100%{transform:rotate(16deg)}50%{transform:rotate(-4deg)}}
@keyframes bsf-hit{0%,40%{opacity:0;transform:scale(.6)}55%{opacity:1;transform:scale(1)}90%,100%{opacity:0;transform:scale(1.25)}}
@keyframes bsf-tumble{0%{transform:rotate(0) translateY(0)}35%{transform:rotate(200deg) translateY(-10px)}60%{transform:rotate(360deg) translateY(0)}72%{transform:rotate(360deg) translateY(-3px)}84%,100%{transform:rotate(360deg) translateY(0)}}
@keyframes bsf-tongue{0%,40%,100%{transform:scaleX(.2)}55%,85%{transform:scaleX(1)}}
@keyframes bsf-slither{0%,100%{transform:translateX(-2px) skewX(-3deg)}50%{transform:translateX(2px) skewX(3deg)}}
@keyframes bsf-orbit{to{transform:rotate(360deg)}}
@keyframes bsf-twinkle{0%,100%{transform:scale(.3) rotate(0);opacity:.2}50%{transform:scale(1.1) rotate(45deg);opacity:1}}
@keyframes bsf-rumble{0%{transform:translate(-.8px,.6px)}50%{transform:translate(.8px,-.6px)}100%{transform:translate(-.8px,.6px)}}
@keyframes bsf-puff{0%{transform:translate(0,0) scale(.4);opacity:.9}100%{transform:translate(-14px,12px) scale(1.6);opacity:0}}
@keyframes bsf-shine{0%,50%{transform:translateX(-60px) skewX(-20deg)}80%,100%{transform:translateX(60px) skewX(-20deg)}}
@keyframes bsf-spin3d{0%,100%{transform:scaleX(1)}50%{transform:scaleX(.72)}}
@keyframes bsf-rays{to{transform:rotate(360deg)}}
/* the legendary entrance: rays, a gold ring and a glow behind the emoji */
.rx-emote.tier-legendary::before,.rx-emote.tier-epic::before{content:'';position:absolute;left:50%;top:44%;width:220%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;pointer-events:none;z-index:-1}
.rx-emote.tier-legendary::before{background:repeating-conic-gradient(from 0deg,#ffe08a55 0 8deg,transparent 8deg 22deg);-webkit-mask:radial-gradient(circle,#000 18%,transparent 66%);mask:radial-gradient(circle,#000 18%,transparent 66%);animation:bsf-legend-rays 5s linear infinite,bsf-legend-in .7s cubic-bezier(.2,.9,.2,1) both}
.rx-emote.tier-epic::before{background:radial-gradient(circle,#b98cff66,transparent 62%);animation:bsf-legend-in .6s ease-out both}
.rx-emote.tier-legendary::after{content:'';position:absolute;left:50%;top:44%;width:70%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;border:3px solid #ffd36b;box-shadow:0 0 24px #ffd36b,inset 0 0 18px #ffd36b88;pointer-events:none;animation:bsf-legend-ring 1.1s .1s ease-out both}
@keyframes bsf-legend-rays{to{transform:translate(-50%,-50%) rotate(360deg)}}
@keyframes bsf-legend-in{from{opacity:0;transform:translate(-50%,-50%) scale(.3)}}
@keyframes bsf-legend-ring{from{opacity:1;transform:translate(-50%,-50%) scale(.4)}to{opacity:0;transform:translate(-50%,-50%) scale(2.6)}}
.bsf-wrap{display:block;width:var(--bsf-size,92px);aspect-ratio:1;flex:none}
.rx-emote .bsf-wrap,.sx-art-emote .bsf-wrap{filter:drop-shadow(0 8px 14px #0007)}
.sx-art-emote .bsf-wrap{--bsf-size:min(58%,118px);margin:auto}
.sx-art-emote.is-live .bsf-wrap{--bsf-size:min(62%,150px)}
.rx-item .bsf-wrap{--bsf-size:46px;filter:drop-shadow(0 3px 5px #0006)}
.rx-emote.tier-legendary .bsf-wrap{--bsf-size:118px;filter:drop-shadow(0 0 18px #ffd36baa) drop-shadow(0 10px 18px #0008)}
.rx-emote.tier-epic .bsf-wrap{--bsf-size:104px;filter:drop-shadow(0 0 14px #b98cff99) drop-shadow(0 8px 14px #0007)}
@media (prefers-reduced-motion:reduce){.bsf *{animation:none!important}.rx-emote::before,.rx-emote::after{animation:none!important;opacity:0}}
`;
function style(){try{if(document.getElementById?.('bs-emoji-faces'))return;const s=document.createElement('style');s.id='bs-emoji-faces';s.textContent=css;(document.head||document.documentElement||document.body)?.append?.(s);}catch{}}

/* ---------- the parts ---------- */
// 33.9.0: a face with depth — the key light from the top left, a warm bounce light from below, shade
// gathering at the rim, a soft contact shadow, a crisp gloss and a thin rim light
function face(id,{top='#fff8c8',mid='#ffd84a',low='#f5a322',rim='#c3600b',flush=null,bounce='#fff0a0'}={}){
  cur=id;
  return `<defs><radialGradient id="f${id}" cx="42%" cy="32%" r="74%"><stop offset="0" stop-color="${top}"/><stop offset=".42" stop-color="${mid}"/><stop offset=".84" stop-color="${low}"/><stop offset="1" stop-color="${rim}"/></radialGradient>`+
  `<radialGradient id="o${id}" cx="50%" cy="44%" r="56%"><stop offset=".72" stop-color="${rim}" stop-opacity="0"/><stop offset="1" stop-color="${rim}" stop-opacity=".62"/></radialGradient>`+
  `<radialGradient id="b${id}" cx="50%" cy="96%" r="58%"><stop offset="0" stop-color="${bounce}" stop-opacity=".8"/><stop offset="1" stop-color="${bounce}" stop-opacity="0"/></radialGradient>`+
  `<radialGradient id="g${id}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff" stop-opacity=".96"/><stop offset=".5" stop-color="#fff" stop-opacity=".4"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`+
  `<radialGradient id="c${id}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ff5068" stop-opacity=".62"/><stop offset="1" stop-color="#ff5068" stop-opacity="0"/></radialGradient>`+
  `<linearGradient id="e${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#63391a"/><stop offset="1" stop-color="#170900"/></linearGradient>`+
  `<radialGradient id="m${id}" cx="50%" cy="22%" r="85%"><stop offset="0" stop-color="#9b2414"/><stop offset=".6" stop-color="#5c0d06"/><stop offset="1" stop-color="#2c0402"/></radialGradient>`+
  `<linearGradient id="t${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9fac"/><stop offset="1" stop-color="#de3f57"/></linearGradient>`+
  `<linearGradient id="d${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4f6ff"/><stop offset=".5" stop-color="#6fd0ff"/><stop offset="1" stop-color="#2a9be0"/></linearGradient>`+
  `<filter id="h${id}" x="-40%" y="-80%" width="180%" height="260%"><feGaussianBlur stdDeviation="2.3"/></filter></defs>`+
  `<ellipse cx="50" cy="95.5" rx="27" ry="4.4" fill="#000" opacity=".34" filter="url(#h${id})"/>`+
  `<circle cx="50" cy="51" r="43" fill="url(#f${id})"/>`+
  (flush?`<circle class="flush" cx="50" cy="51" r="43" fill="${flush}" opacity="0"/>`:'')+
  `<circle cx="50" cy="51" r="43" fill="url(#o${id})"/>`+
  `<path d="M12 59 A43 43 0 0 0 88 59 A38 31 0 0 1 12 59Z" fill="url(#b${id})"/>`+
  `<ellipse cx="35" cy="23.5" rx="18.5" ry="9.6" fill="url(#g${id})" transform="rotate(-22 35 23.5)"/>`+
  `<ellipse cx="68.6" cy="19.6" rx="4.4" ry="2.3" fill="#fff" opacity=".55" transform="rotate(24 68.6 19.6)"/>`+
  `<circle cx="50" cy="51" r="42.3" fill="none" stroke="#fff" stroke-opacity=".24" stroke-width="1.1"/>`;
}
const cheeks=id=>`<ellipse cx="25" cy="62" rx="9" ry="6" fill="url(#c${id})"/><ellipse cx="75" cy="62" rx="9" ry="6" fill="url(#c${id})"/>`;
const dotEyes=(dx=0,ry=7.5)=>`<g class="blink"><ellipse cx="${36+dx}" cy="44" rx="5.4" ry="${ry}" fill="url(#e${cur})"/><ellipse cx="${64+dx}" cy="44" rx="5.4" ry="${ry}" fill="url(#e${cur})"/><circle cx="${34.2+dx}" cy="40.8" r="2.1" fill="#fff"/><circle cx="${62.2+dx}" cy="40.8" r="2.1" fill="#fff"/><circle cx="${37.6+dx}" cy="47.6" r=".9" fill="#fff" opacity=".7"/><circle cx="${65.6+dx}" cy="47.6" r=".9" fill="#fff" opacity=".7"/></g>`;
const happyEyes=(y=44)=>`<path d="M27 ${y} Q36 ${y-9} 45 ${y}" fill="none" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/><path d="M55 ${y} Q64 ${y-9} 73 ${y}" fill="none" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/>`;
const sparkle=(x,y,s=1,c='#fff',cls='twinkle')=>`<path class="${cls}" d="M${x} ${y-6*s} L${x+1.6*s} ${y-1.6*s} L${x+6*s} ${y} L${x+1.6*s} ${y+1.6*s} L${x} ${y+6*s} L${x-1.6*s} ${y+1.6*s} L${x-6*s} ${y} L${x-1.6*s} ${y-1.6*s}Z" fill="${c}"/>`;
const grin=(open=true)=>open?`<path d="M27 58 Q50 90 73 58 Z" fill="${MOUTH()}" stroke="#4a0a04" stroke-width="1.2" stroke-linejoin="round"/><path d="M30 59.5 Q50 65 70 59.5 L69 63 Q50 68.5 31 63 Z" fill="#fff"/><path d="M31 63 Q50 68.5 69 63" fill="none" stroke="#d9cfc0" stroke-width="1"/><ellipse cx="50" cy="76.5" rx="11" ry="6" fill="${TONGUE()}"/><path d="M50 72.5 V78" stroke="#c33a52" stroke-width="1" stroke-linecap="round"/>`:`<path d="M33 64 Q50 78 67 64" fill="none" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/>`;
const drop=(x,y,cls)=>`<path class="${cls}" d="M${x} ${y} c-3.6 5.4 -3.8 9 0 10.2 c3.8 -1.2 3.6 -4.8 0 -10.2z" fill="${TEAR()}" stroke="#fff" stroke-opacity=".6" stroke-width=".8"/>`;

const hand=(id,c1='#ffe08a',c2='#f2a52a')=>`<defs><linearGradient id="hd${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>`;
const ha=(x,y,s=10,cls='ha',hx=8)=>`<text class="${cls}" style="--hx:${hx}px" x="${x}" y="${y}" font-size="${s}" font-weight="900" font-family="Tajawal,Arial,sans-serif" fill="#fff" stroke="#9a4f08" stroke-width=".9" paint-order="stroke">ههه</text>`;
const vein=(x,y,s=1)=>`<g class="vein" transform="translate(${x} ${y}) scale(${s})"><path d="M-9 -3 Q-4 -4 -3 -9 M3 -9 Q4 -4 9 -3 M9 3 Q4 4 3 9 M-3 9 Q-4 4 -9 3" fill="none" stroke="#ff1f3a" stroke-width="3.2" stroke-linecap="round"/></g>`;
const RAGE={top:'#ffbba6',mid:'#f2462f',low:'#c8161d',rim:'#78050f',bounce:'#ff9b78',flush:null};

/* ---------- every emoji ---------- */
const ART={
  // 🤭 ضحكة مكتومة: eyes squeezed shut, a hand over the mouth, shoulders shaking
  giggle:id=>`<g class="giggle">${face(id)}${hand(id)}<path d="M26 44 Q35 36 44 44" fill="none" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/><path d="M56 44 Q65 36 74 44" fill="none" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/>${cheeks(id)}<path d="M40 64 Q50 70 60 64" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/><path d="M27 93 C22 80 27 66 38 62 C44 60 50 61 54 64 L61 59.5 C64.5 57.5 68 61 65.5 64 L59.5 70 L66 67.6 C69.4 66.6 71.4 71 68 73 L60.5 77 L65.5 77.3 C69 77.6 69.6 82 66 83 L56 86 C49 93 38 97 27 93Z" fill="url(#hd${id})" stroke="#c77b14" stroke-width="1.3" stroke-linejoin="round"/><path d="M44 74 Q49 72 53 75" fill="none" stroke="#c77b14" stroke-width="1.2" stroke-linecap="round"/>${ha(70,26,10,'ha',10)}${ha(78,36,8,'ha b',12)}</g>`,
  // 😆 هههههه: head thrown back, the biggest laugh, tears flying
  cackle:id=>`<g class="tilt"><g class="shake">${face(id)}<path d="M25 37 L41 43.5 L25 50" fill="none" stroke="${INK}" stroke-width="4.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M75 37 L59 43.5 L75 50" fill="none" stroke="${INK}" stroke-width="4.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M23 56 Q50 99 77 56 Z" fill="${MOUTH()}" stroke="#4a0a04" stroke-width="1.2" stroke-linejoin="round"/><path d="M26.5 57.5 Q50 64.5 73.5 57.5 L72.5 61.6 Q50 68.6 27.5 61.6Z" fill="#fff"/><ellipse cx="50" cy="81" rx="12.5" ry="6.6" fill="${TONGUE()}"/>${cheeks(id)}${drop(18,40,'tearL')}${drop(82,40,'tearR')}${drop(20,47,'tearL b')}</g>${ha(66,18,11,'ha',10)}${ha(14,22,9,'ha b',-12)}${ha(76,30,8,'ha c',14)}</g>`,
  // 🫵 أضحك عليك: laughing and pointing at you
  pointlaugh:id=>`<g class="shake">${face(id)}${hand(id)}${happyEyes(42)}${grin()}${cheeks(id)}${drop(21,41,'tearL')}${drop(79,41,'tearR')}<g class="wag" style="transform-origin:20% 90%"><path d="M8 96 C4 86 10 76 20 74 L44 70 C49 69.4 50.6 75 46 76.6 L33 79.4 L33.6 81 C38 81.4 38 86 34 86.6 L34.6 88 C38 88.6 37.4 93 33.6 93.4 L33.4 94.6 C36 95.6 35 99.6 31.6 99.4 L18 99.6 C14 99.8 10 99 8 96Z" fill="url(#hd${id})" stroke="#c77b14" stroke-width="1.3" stroke-linejoin="round"/></g></g>`,
  // 😡 معصّب: deep red, glaring, teeth clenched, a pulsing vein
  rage:id=>`<g class="shiver">${face(id,RAGE)}<path d="M23 31 L46 41" stroke="#3a0505" stroke-width="5.6" stroke-linecap="round"/><path d="M77 31 L54 41" stroke="#3a0505" stroke-width="5.6" stroke-linecap="round"/><g class="blink"><ellipse cx="36" cy="48" rx="7" ry="5" fill="#fff"/><ellipse cx="64" cy="48" rx="7" ry="5" fill="#fff"/><circle cx="37.5" cy="48.6" r="3" fill="#2a0303"/><circle cx="62.5" cy="48.6" r="3" fill="#2a0303"/></g><rect x="32" y="64" width="36" height="13" rx="5" fill="#fff" stroke="#3a0505" stroke-width="2.4"/><path d="M32 70.5 H68 M41 64 V77 M50 64 V77 M59 64 V77" stroke="#3a0505" stroke-width="1.6"/>${vein(78,22,1)}</g>`,
  // 🤬 يتفجّر: a black bar of curses over the mouth, smoke from the head
  explode:id=>`<g class="rumble">${face(id,RAGE)}<path d="M22 32 L46 42" stroke="#2a0303" stroke-width="5.8" stroke-linecap="round"/><path d="M78 32 L54 42" stroke="#2a0303" stroke-width="5.8" stroke-linecap="round"/><ellipse cx="36" cy="49" rx="5.4" ry="4.4" fill="#2a0303"/><ellipse cx="64" cy="49" rx="5.4" ry="4.4" fill="#2a0303"/><rect x="22" y="60" width="56" height="17" rx="5" fill="#120203"/><text x="50" y="73.4" text-anchor="middle" font-size="13" font-weight="900" font-family="Arial,sans-serif" fill="#ffd34d">#@$%!</text><g class="steam" style="--sx:-12px"><circle cx="34" cy="8" r="6" fill="#d9dde8"/><circle cx="27" cy="5" r="4.4" fill="#d9dde8"/></g><g class="steam b" style="--sx:12px"><circle cx="66" cy="8" r="6" fill="#d9dde8"/><circle cx="73" cy="5" r="4.4" fill="#d9dde8"/></g></g>`,
  // 😒 زعلان: unimpressed, looking away, a little storm overhead
  grumpy:id=>`<g class="bob">${face(id)}<g class="cloud"><path d="M30 14 Q29 4 39 5 Q43 -2 52 3 Q61 0 63 8 Q71 9 69 16 Z" fill="#7b8499" stroke="#566077" stroke-width="1.2"/><path class="bolt" d="M49 14 L44 23 L49 22.4 L46 30 L54 19.6 L49 20.4 L52 14Z" fill="#ffe04d"/></g><path d="M26 39 Q35 36 44 40" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/><path d="M56 40 Q65 36 74 39" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/><g class="look"><path d="M27 46 H45" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="41.5" cy="49" rx="4.2" ry="3.2" fill="url(#e${id})"/><path d="M55 46 H73" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="69.5" cy="49" rx="4.2" ry="3.2" fill="url(#e${id})"/></g><path d="M38 72 Q50 64 62 72" fill="none" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/></g>`,
  // 🥵 يغلي: the red rises up the face, steam from both ears
  fume:id=>`<g class="bob">${face(id)}<defs><clipPath id="k${id}"><circle cx="50" cy="51" r="43"/></clipPath><linearGradient id="r${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5a3c" stop-opacity=".2"/><stop offset=".25" stop-color="#ef2f22" stop-opacity=".78"/><stop offset="1" stop-color="#b0101a" stop-opacity=".92"/></linearGradient></defs><g clip-path="url(#k${id})"><rect class="fill" x="0" y="34" width="100" height="70" fill="url(#r${id})"/></g><path d="M25 37 L44 43" stroke="${INK}" stroke-width="4.8" stroke-linecap="round"/><path d="M75 37 L56 43" stroke="${INK}" stroke-width="4.8" stroke-linecap="round"/><path d="M28 49 Q36 45 44 49" fill="none" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/><path d="M56 49 Q64 45 72 49" fill="none" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/><path d="M34 72 L40 67 L45 72 L50 67 L55 72 L60 67 L66 72" fill="none" stroke="${INK}" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/><g class="steam" style="--sx:-14px"><circle cx="8" cy="50" r="5" fill="#f4f6ff"/><circle cx="4" cy="45" r="3.8" fill="#f4f6ff"/></g><g class="steam b" style="--sx:14px"><circle cx="92" cy="50" r="5" fill="#f4f6ff"/><circle cx="96" cy="45" r="3.8" fill="#f4f6ff"/></g></g>`,
  // 😂 ضحكتني
  laugh:id=>`<g class="shake">${face(id)}${happyEyes(43)}${grin()}${cheeks(id)}${drop(22,42,'tearL')}${drop(78,42,'tearR')}${drop(24,48,'tearL b')}</g>`,
  // 🤣 ميت ضحك: rolling over
  wheeze:id=>`<g class="roll">${face(id)}<path d="M27 37 L41 44 L27 50" fill="none" stroke="${INK}" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M73 37 L59 44 L73 50" fill="none" stroke="${INK}" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/>${grin()}<path class="stream" d="M22 48 C14 54 12 62 10 72" fill="none" stroke="${TEAR()}" stroke-width="5" stroke-linecap="round"/><path class="stream" d="M78 48 C86 54 88 62 90 72" fill="none" stroke="${TEAR()}" stroke-width="5" stroke-linecap="round"/></g>`,
  // 😮 واو
  wow:id=>`<g class="bob">${face(id)}<g class="brow"><path d="M27 29 Q36 22 45 28" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/><path d="M55 28 Q64 22 73 29" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/></g><g class="blink"><circle cx="36" cy="44" r="7.6" fill="#fff"/><circle cx="64" cy="44" r="7.6" fill="#fff"/><circle cx="36" cy="45" r="4.4" fill="${INK}"/><circle cx="64" cy="45" r="4.4" fill="${INK}"/><circle cx="34.6" cy="43" r="1.5" fill="#fff"/><circle cx="62.6" cy="43" r="1.5" fill="#fff"/></g><ellipse class="pulse" cx="50" cy="71" rx="8.5" ry="10.5" fill="${MOUTH()}"/><ellipse cx="50" cy="75" rx="5" ry="3.5" fill="${TONGUE()}" opacity=".7"/></g>`,
  // 😤 قهر: red, with steam from the nose
  angry:id=>`<g class="bob">${face(id,{top:'#ffd2a8',mid:'#ff8a4c',low:'#ec5a2c',rim:'#b8321a',flush:'#ff2a1a'})}<path d="M25 33 L45 41" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M75 33 L55 41" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><g class="blink"><ellipse cx="36" cy="48" rx="5" ry="4.6" fill="${INK}"/><ellipse cx="64" cy="48" rx="5" ry="4.6" fill="${INK}"/></g><path d="M35 74 Q50 63 65 74" fill="none" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/><g class="steam" style="--sx:-16px"><circle cx="22" cy="66" r="5" fill="#f4f6ff"/><circle cx="17" cy="62" r="4" fill="#f4f6ff"/><circle cx="25" cy="61" r="3.4" fill="#f4f6ff"/></g><g class="steam b" style="--sx:16px"><circle cx="78" cy="66" r="5" fill="#f4f6ff"/><circle cx="83" cy="62" r="4" fill="#f4f6ff"/><circle cx="75" cy="61" r="3.4" fill="#f4f6ff"/></g></g>`,
  // 😎 رايق: shades with a passing glint
  cool:id=>`<g class="bob">${face(id)}<defs><linearGradient id="s${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4a7a"/><stop offset=".55" stop-color="#121a33"/><stop offset="1" stop-color="#05070f"/></linearGradient><clipPath id="k${id}"><path d="M20 36 H46 Q47 55 33.5 55 Q20 55 20 41Z M54 36 H80 V41 Q80 55 66.5 55 Q53 55 54 36Z"/></clipPath></defs><path d="M14 37 H86" stroke="#0b0f1f" stroke-width="4" stroke-linecap="round"/><path d="M20 36 H46 Q47 55 33.5 55 Q20 55 20 41Z M54 36 H80 V41 Q80 55 66.5 55 Q53 55 54 36Z" fill="url(#s${id})" stroke="#05070f" stroke-width="2"/><g clip-path="url(#k${id})"><rect class="glint" x="30" y="30" width="9" height="30" fill="#fff" opacity=".75" transform="skewX(-20)"/></g><path d="M37 68 Q52 77 65 63" fill="none" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/></g>`,
  // 😭 دموع: two rivers
  cry:id=>`<g class="bob">${face(id)}<path d="M27 40 Q36 47 45 41" fill="none" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/><path d="M55 41 Q64 47 73 40" fill="none" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/><path class="stream" d="M32 47 C29 60 31 74 26 92" fill="none" stroke="${TEAR()}" stroke-width="7" stroke-linecap="round" opacity=".9"/><path class="stream" d="M68 47 C71 60 69 74 74 92" fill="none" stroke="${TEAR()}" stroke-width="7" stroke-linecap="round" opacity=".9"/><path d="M36 74 Q50 58 64 74 Q50 82 36 74Z" fill="${MOUTH()}"/><path d="M40 72 Q50 66 60 72" fill="none" stroke="#fff" stroke-width="2.4"/></g>`,
  // 🥺 تكفى: big shining eyes
  plead:id=>`<g class="bob">${face(id)}<path d="M26 31 Q35 26 44 31" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round" transform="rotate(-10 35 30)"/><path d="M56 31 Q65 26 74 31" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round" transform="rotate(10 65 30)"/><g><ellipse cx="36" cy="47" rx="9" ry="10" fill="#fff"/><ellipse cx="64" cy="47" rx="9" ry="10" fill="#fff"/><ellipse cx="36" cy="48.5" rx="7" ry="8" fill="#4b2a12"/><ellipse cx="64" cy="48.5" rx="7" ry="8" fill="#4b2a12"/><circle class="pulse" cx="33" cy="44.5" r="2.8" fill="#fff"/><circle class="pulse" cx="61" cy="44.5" r="2.8" fill="#fff"/><circle cx="38.5" cy="52" r="1.4" fill="#fff"/><circle cx="66.5" cy="52" r="1.4" fill="#fff"/><path d="M28 54 Q36 59 44 54" fill="none" stroke="${TEAR()}" stroke-width="2.4" stroke-linecap="round" opacity=".85"/><path d="M56 54 Q64 59 72 54" fill="none" stroke="${TEAR()}" stroke-width="2.4" stroke-linecap="round" opacity=".85"/></g><path d="M41 73 Q50 68 59 73" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/>${cheeks(id)}</g>`,
  // 😏 قلتها لك
  smirk:id=>`<g class="bob">${face(id)}<path class="brow" d="M56 30 Q65 25 74 31" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/><path d="M26 36 L45 37" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/><g class="look"><path d="M28 44 H45" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="41" cy="46.5" rx="4" ry="3.2" fill="${INK}"/><path d="M56 44 H73" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="69" cy="46.5" rx="4" ry="3.2" fill="${INK}"/></g><path d="M37 68 Q54 72 67 60" fill="none" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/></g>`,
  // 😜 طقطقة: a wink and a wagging tongue
  tongue:id=>`<g class="bob">${face(id)}<path d="M27 44 Q36 37 45 44" fill="none" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/><g class="blink"><ellipse cx="64" cy="43" rx="6.4" ry="8.4" fill="${INK}"/><circle cx="62" cy="40" r="2.2" fill="#fff"/></g><path d="M28 60 Q50 84 72 60 Z" fill="${MOUTH()}"/><g class="wag"><path d="M47 69 Q48 92 58 90 Q66 88 63 70Z" fill="${TONGUE()}" stroke="#d94a5a" stroke-width="1.2"/><path d="M55 72 L56 84" stroke="#d94a5a" stroke-width="1.4" stroke-linecap="round"/></g>${cheeks(id)}</g>`,
  // 🤨 متأكد؟: one brow up, eyes to the side
  sus:id=>`<g class="bob">${face(id)}<path class="brow" d="M55 27 Q64 20 74 27" fill="none" stroke="${INK}" stroke-width="3.8" stroke-linecap="round"/><path d="M26 38 L45 38" stroke="${INK}" stroke-width="3.8" stroke-linecap="round"/><g class="look"><ellipse cx="38" cy="46" rx="4.6" ry="3.4" fill="${INK}"/><ellipse cx="65" cy="44" rx="5" ry="6.6" fill="${INK}"/><circle cx="63.6" cy="41.6" r="1.6" fill="#fff"/></g><path d="M38 70 L62 67" stroke="${INK}" stroke-width="4" stroke-linecap="round"/></g>`,
  // 🥱 خذ وقتك: a long yawn and the z's
  yawn:id=>`<g class="bob">${face(id)}<path d="M27 42 Q36 47 45 42" fill="none" stroke="${INK}" stroke-width="3.8" stroke-linecap="round"/><path d="M55 42 Q64 47 73 42" fill="none" stroke="${INK}" stroke-width="3.8" stroke-linecap="round"/><g class="yawn"><ellipse cx="50" cy="70" rx="10" ry="12" fill="${MOUTH()}"/><ellipse cx="50" cy="76" rx="6" ry="4" fill="${TONGUE()}" opacity=".75"/></g><text class="zz" x="72" y="26" font-size="15" font-weight="900" fill="#e9f0ff" stroke="#3b4a86" stroke-width="1">z</text><text class="zz b" x="80" y="18" font-size="11" font-weight="900" fill="#e9f0ff" stroke="#3b4a86" stroke-width="1">z</text></g>`,
  // 😈 الخطة ماشية: purple, horns, a plotting grin
  evil:id=>`<g class="bob">${face(id,{top:'#e3c2ff',mid:'#a66cf5',low:'#7a3fd6',rim:'#4d1fa0'})}<path d="M18 24 Q14 8 26 4 Q22 14 30 20Z" fill="#7a3fd6" stroke="#4d1fa0" stroke-width="1.4"/><path d="M82 24 Q86 8 74 4 Q78 14 70 20Z" fill="#7a3fd6" stroke="#4d1fa0" stroke-width="1.4"/><path d="M26 36 L45 42" stroke="#2a0d55" stroke-width="4.4" stroke-linecap="round"/><path d="M74 36 L55 42" stroke="#2a0d55" stroke-width="4.4" stroke-linecap="round"/><g class="glow"><ellipse cx="37" cy="48" rx="5" ry="3.6" fill="#ffe56b"/><ellipse cx="63" cy="48" rx="5" ry="3.6" fill="#ffe56b"/></g><path d="M27 60 Q50 82 73 60 Q50 70 27 60Z" fill="#2a0d55"/><path d="M33 62 L37 67 L41 63 L45 68 L50 64 L55 68 L59 63 L63 67 L67 62" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></g>`,
  // 😈 شرير: a red devil in flames
  devil:id=>`<g class="bob"><g class="flame1" opacity=".85"><path d="M14 70 Q8 40 24 30 Q22 46 30 50 Q28 26 46 14 Q44 34 54 40 Q58 22 72 16 Q66 36 78 46 Q86 38 84 28 Q96 46 86 74Z" fill="#ff5a2a" opacity=".55"/></g>${face(id,{top:'#ffb0a0',mid:'#ef3b3b',low:'#c01e30',rim:'#7a0d1e'})}<path d="M18 26 Q12 6 28 2 Q22 14 31 21Z" fill="#2a0b10"/><path d="M82 26 Q88 6 72 2 Q78 14 69 21Z" fill="#2a0b10"/><path d="M25 37 L45 44" stroke="#2a0b10" stroke-width="5" stroke-linecap="round"/><path d="M75 37 L55 44" stroke="#2a0b10" stroke-width="5" stroke-linecap="round"/><g class="glow"><ellipse cx="37" cy="50" rx="5" ry="3.4" fill="#fff36b"/><ellipse cx="63" cy="50" rx="5" ry="3.4" fill="#fff36b"/></g><path d="M30 62 Q50 84 70 62 Q50 72 30 62Z" fill="#2a0b10"/><path d="M38 64 L41 70 L44 65 M56 65 L59 70 L62 64" fill="#fff" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></g>`,
  // 🤫 اسكت
  hush:id=>`<g class="bob">${face(id)}<g class="look"><ellipse cx="38" cy="42" rx="5" ry="7" fill="${INK}"/><ellipse cx="66" cy="42" rx="5" ry="7" fill="${INK}"/><circle cx="36.6" cy="39" r="1.8" fill="#fff"/><circle cx="64.6" cy="39" r="1.8" fill="#fff"/></g><path d="M38 70 Q50 74 62 70" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><rect x="44.5" y="52" width="11" height="34" rx="5.5" fill="#ffd27a" stroke="#d98e2b" stroke-width="1.6"/><rect x="46.6" y="53.6" width="6.8" height="7" rx="3" fill="#fff1d6" stroke="#e8b06a" stroke-width="1"/><path d="M46 68 Q50 70 54 68" fill="none" stroke="#d98e2b" stroke-width="1.2"/><path class="pulse" d="M70 66 Q76 70 70 76 M76 62 Q84 70 76 80" fill="none" stroke="#e9f0ff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/></g>`,
  // 🥶 تجمّدت: blue, shivering, icicles
  frost:id=>`<g class="shiver">${face(id,{top:'#e6fbff',mid:'#8fdcff',low:'#3a9be8',rim:'#1c5fb0'})}<path d="M24 34 Q35 29 45 34" fill="none" stroke="#123a6b" stroke-width="3.6" stroke-linecap="round"/><path d="M55 34 Q65 29 76 34" fill="none" stroke="#123a6b" stroke-width="3.6" stroke-linecap="round"/><g class="blink"><circle cx="36" cy="45" r="7" fill="#fff"/><circle cx="64" cy="45" r="7" fill="#fff"/><circle cx="36" cy="46" r="3.6" fill="#123a6b"/><circle cx="64" cy="46" r="3.6" fill="#123a6b"/></g><rect x="31" y="62" width="38" height="14" rx="5" fill="#fff" stroke="#123a6b" stroke-width="2.2"/><path d="M38.6 62 V76 M46.2 62 V76 M53.8 62 V76 M61.4 62 V76 M31 69 H69" stroke="#123a6b" stroke-width="1.6"/><path d="M30 88 L33 96 L36 88 M44 91 L46.5 99 L49 91 M58 90 L61 97 L64 90" fill="#e6fbff" stroke="#9fe0ff" stroke-width="1.2"/>${sparkle(18,26,.8,'#e6fbff')}${sparkle(84,30,.7,'#e6fbff','twinkle b')}${sparkle(80,80,.6,'#e6fbff','twinkle c')}</g>`,
  // 🤯 انفجر مخي: the top of the head goes off
  blast:id=>`<g>${face(id)}<g class="boom"><circle cx="50" cy="14" r="13" fill="#ffb347"/><circle cx="38" cy="10" r="9" fill="#ff7a3d"/><circle cx="62" cy="9" r="10" fill="#ff7a3d"/><circle cx="50" cy="4" r="8" fill="#ffd166"/><circle cx="30" cy="18" r="6" fill="#9aa3b5"/><circle cx="70" cy="18" r="6" fill="#9aa3b5"/></g><path d="M18 26 Q50 14 82 26" fill="none" stroke="#c96a0a" stroke-width="2.4" stroke-dasharray="4 4"/><g class="blink"><circle cx="36" cy="45" r="7.4" fill="#fff"/><circle cx="64" cy="45" r="7.4" fill="#fff"/><circle cx="36" cy="45" r="3" fill="${INK}"/><circle cx="64" cy="45" r="3" fill="${INK}"/></g><ellipse class="pulse" cx="50" cy="71" rx="8" ry="9.5" fill="${MOUTH()}"/></g>`,
  // 🔥 نار
  flame:id=>`<g><defs><radialGradient id="o${id}" cx="50%" cy="80%" r="70%"><stop offset="0" stop-color="#fff3b0"/><stop offset=".45" stop-color="#ffb02e"/><stop offset="1" stop-color="#ff4b1f"/></radialGradient></defs><ellipse cx="50" cy="95" rx="24" ry="4" fill="#000" opacity=".22"/><path class="flame1" d="M50 4 C58 22 76 30 78 54 C80 76 66 92 50 92 C34 92 20 80 22 60 C23 46 32 40 34 28 C40 38 44 40 46 36 C46 24 44 14 50 4Z" fill="url(#o${id})"/><path class="flame2" d="M50 34 C56 46 66 52 66 66 C66 80 58 88 50 88 C41 88 34 81 34 70 C34 60 41 56 42 48 C46 54 48 54 49 50 C49 44 47 40 50 34Z" fill="#ffd34d"/><path class="flame3" d="M50 56 C54 64 58 68 58 75 C58 82 54 86 50 86 C46 86 42 82 42 76 C42 70 47 66 50 56Z" fill="#fff8d6"/><circle class="ember" style="--ex:-8px" cx="34" cy="40" r="2.2" fill="#ffd34d"/><circle class="ember b" style="--ex:7px" cx="64" cy="34" r="1.8" fill="#ffb02e"/><circle class="ember c" style="--ex:-3px" cx="52" cy="22" r="1.6" fill="#fff3b0"/></g>`,
  // 👏 برافو: two hands meeting, with a spark at the clap
  clap:id=>`<g><defs><linearGradient id="h${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe2b0"/><stop offset=".6" stop-color="#ffc06a"/><stop offset="1" stop-color="#e8913a"/></linearGradient></defs><ellipse cx="50" cy="95" rx="26" ry="4" fill="#000" opacity=".22"/><g class="clapL"><path d="M24 88 C14 74 12 56 18 44 L22 30 C23 25 29 25 29 31 L29 40 L32 22 C33 16 40 17 39 23 L37 40 L41 20 C42 14 49 15 48 21 L45 42 L49 28 C50 23 57 24 55 30 L50 54 C49 64 46 74 40 84Z" fill="url(#h${id})" stroke="#c9792e" stroke-width="1.6" stroke-linejoin="round"/></g><g class="clapR"><path d="M76 88 C86 74 88 56 82 44 L78 30 C77 25 71 25 71 31 L71 40 L68 22 C67 16 60 17 61 23 L63 40 L59 20 C58 14 51 15 52 21 L55 42 L51 28 C50 23 43 24 45 30 L50 54 C51 64 54 74 60 84Z" fill="url(#h${id})" stroke="#c9792e" stroke-width="1.6" stroke-linejoin="round"/></g><g class="hit" stroke="#fff3b0" stroke-width="3.2" stroke-linecap="round"><path d="M50 8 V16"/><path d="M36 12 L40 19"/><path d="M64 12 L60 19"/></g></g>`,
  // 🎲 حظ النرد: the die tumbles and lands
  spin:id=>`<g><ellipse cx="50" cy="94" rx="24" ry="4" fill="#000" opacity=".22"/><g class="tumble"><path d="M50 14 L82 30 L50 46 L18 30Z" fill="#ffffff"/><path d="M18 30 L50 46 L50 86 L18 70Z" fill="#e3e6f0"/><path d="M82 30 L50 46 L50 86 L82 70Z" fill="#c9cede"/><path d="M50 14 L82 30 L82 70 L50 86 L18 70 L18 30Z" fill="none" stroke="#8a91a8" stroke-width="1.6" stroke-linejoin="round"/><ellipse cx="50" cy="30" rx="5" ry="2.8" fill="#d6283c"/><g fill="#1e2440"><ellipse cx="27" cy="44" rx="3" ry="3.6"/><ellipse cx="41" cy="72" rx="3" ry="3.6"/><ellipse cx="34" cy="58" rx="3" ry="3.6"/><ellipse cx="60" cy="50" rx="3" ry="3.6"/><ellipse cx="73" cy="66" rx="3" ry="3.6"/><ellipse cx="60" cy="68" rx="3" ry="3.6"/><ellipse cx="73" cy="48" rx="3" ry="3.6"/></g></g></g>`,
  // 🐍 لدغة
  slither:id=>`<g class="bob"><ellipse cx="50" cy="94" rx="30" ry="4" fill="#000" opacity=".22"/><g class="slither"><path d="M18 84 Q50 96 80 84 Q92 76 78 70 Q50 62 26 70 Q12 76 24 64 Q40 54 66 58" fill="none" stroke="#2f9a5a" stroke-width="13" stroke-linecap="round"/><path d="M18 84 Q50 96 80 84 Q92 76 78 70 Q50 62 26 70 Q12 76 24 64 Q40 54 66 58" fill="none" stroke="#6ee08f" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 7"/></g><path d="M66 58 Q60 40 64 30" fill="none" stroke="#2f9a5a" stroke-width="12" stroke-linecap="round"/><ellipse cx="68" cy="24" rx="15" ry="11" fill="#3fbf6b" stroke="#1f6e3f" stroke-width="1.6"/><ellipse cx="62" cy="20" rx="3.4" ry="4" fill="#fff36b"/><ellipse cx="62" cy="20.4" rx="1.1" ry="3" fill="#1b1b1b"/><ellipse cx="74" cy="20" rx="3.4" ry="4" fill="#fff36b"/><ellipse cx="74" cy="20.4" rx="1.1" ry="3" fill="#1b1b1b"/><path class="tongue" d="M82 27 H94 L98 23 M94 27 L98 31" fill="none" stroke="#ff4d6d" stroke-width="2.2" stroke-linecap="round"/></g>`,
  // 🧠 عبقري: a brain in a ring of sparks
  sparkle:id=>`<g class="bob"><defs><radialGradient id="b${id}" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#ffe0ef"/><stop offset=".55" stop-color="#ff9ec7"/><stop offset="1" stop-color="#d9578f"/></radialGradient></defs><ellipse cx="50" cy="94" rx="26" ry="4" fill="#000" opacity=".22"/><radialGradient id="w${id}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff36b" stop-opacity=".55"/><stop offset="1" stop-color="#fff36b" stop-opacity="0"/></radialGradient><circle class="glow" cx="50" cy="50" r="46" fill="url(#w${id})"/><path d="M50 20 C40 12 24 16 22 30 C12 34 12 50 20 56 C16 68 28 78 40 74 C44 82 56 82 60 74 C72 78 84 68 80 56 C88 50 88 34 78 30 C76 16 60 12 50 20Z" fill="url(#b${id})" stroke="#b8406f" stroke-width="2"/><path d="M50 20 V74 M34 30 Q42 36 36 44 Q30 52 38 58 M66 30 Q58 36 64 44 Q70 52 62 58 M24 46 Q32 44 34 50 M76 46 Q68 44 66 50" fill="none" stroke="#b8406f" stroke-width="2.2" stroke-linecap="round"/><g class="orbit">${sparkle(50,6,1,'#fff36b','')}${sparkle(92,52,.8,'#fff','')}${sparkle(10,58,.7,'#fff36b','')}</g></g>`,
  // 🚀 طيران
  launch:id=>`<g><g class="rumble"><g transform="rotate(40 50 50)"><path class="exhaust" d="M42 74 Q50 100 58 74Z" fill="#ffb02e"/><path class="exhaust" d="M45 74 Q50 92 55 74Z" fill="#fff3b0"/><path d="M50 8 C64 20 66 44 62 74 H38 C34 44 36 20 50 8Z" fill="#f4f6ff" stroke="#9aa3b5" stroke-width="1.6"/><path d="M50 8 C57 14 61 22 63 30 H37 C39 22 43 14 50 8Z" fill="#ef3b4f"/><circle cx="50" cy="44" r="8" fill="#3a6fe0" stroke="#9aa3b5" stroke-width="2.4"/><circle cx="47.6" cy="41.6" r="2.4" fill="#cfe0ff"/><path d="M38 56 L26 76 L38 72Z M62 56 L74 76 L62 72Z" fill="#ef3b4f" stroke="#b81f33" stroke-width="1.2"/></g></g><circle class="puff" cx="22" cy="80" r="6" fill="#eef1f8"/><circle class="puff b" cx="18" cy="86" r="5" fill="#eef1f8"/><circle class="puff c" cx="26" cy="88" r="4.5" fill="#eef1f8"/></g>`,
  // 👑 الملك: legendary — gold, jewels, light
  royal:id=>`<g><defs><linearGradient id="r${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2b8"/><stop offset=".45" stop-color="#ffcf4d"/><stop offset="1" stop-color="#c98a14"/></linearGradient><clipPath id="q${id}"><path d="M12 34 L30 52 L50 18 L70 52 L88 34 L80 78 H20Z"/></clipPath></defs><radialGradient id="y${id}" cx="50%" cy="50%" r="50%"><stop offset=".25" stop-color="#ffe08a" stop-opacity=".75"/><stop offset="1" stop-color="#ffe08a" stop-opacity="0"/></radialGradient><g class="rays">${[0,30,60,90,120,150,180,210,240,270,300,330].map(a=>`<path d="M50 50 L47 3 L53 3Z" fill="url(#y${id})" transform="rotate(${a} 50 50)"/>`).join('')}</g><ellipse cx="50" cy="93" rx="30" ry="4" fill="#000" opacity=".25"/><g class="bob"><path d="M12 34 L30 52 L50 18 L70 52 L88 34 L80 78 H20Z" fill="url(#r${id})" stroke="#a36a0c" stroke-width="2" stroke-linejoin="round"/><rect x="18" y="72" width="64" height="12" rx="3" fill="url(#r${id})" stroke="#a36a0c" stroke-width="2"/><circle cx="12" cy="33" r="5" fill="#ffcf4d" stroke="#a36a0c" stroke-width="1.6"/><circle cx="50" cy="16" r="5.4" fill="#ffcf4d" stroke="#a36a0c" stroke-width="1.6"/><circle cx="88" cy="33" r="5" fill="#ffcf4d" stroke="#a36a0c" stroke-width="1.6"/><ellipse cx="50" cy="58" rx="6" ry="8" fill="#e8304f" stroke="#fff" stroke-width="1.4"/><circle cx="32" cy="64" r="4.4" fill="#2fb3a8" stroke="#fff" stroke-width="1.2"/><circle cx="68" cy="64" r="4.4" fill="#3a6fe0" stroke="#fff" stroke-width="1.2"/><g clip-path="url(#q${id})"><rect class="shine" x="40" y="10" width="12" height="80" fill="#fff" opacity=".6"/></g></g>${sparkle(16,16,1,'#fff6c8')}${sparkle(86,14,.8,'#fff6c8','twinkle b')}${sparkle(90,60,.7,'#fff6c8','twinkle c')}</g>`,
  // 💎 ألماسة: legendary — facets, a turning glint, a rainbow
  prism:id=>`<g><defs><linearGradient id="d${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eaffff"/><stop offset=".5" stop-color="#7ff0ff"/><stop offset="1" stop-color="#2aa3d6"/></linearGradient><clipPath id="p${id}"><path d="M22 22 H78 L94 42 L50 92 L6 42Z"/></clipPath></defs><radialGradient id="w${id}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#7ff0ff" stop-opacity=".55"/><stop offset="1" stop-color="#7ff0ff" stop-opacity="0"/></radialGradient><circle class="glow" cx="50" cy="50" r="48" fill="url(#w${id})"/><ellipse cx="50" cy="96" rx="26" ry="3.6" fill="#000" opacity=".22"/><g class="spin3d"><path d="M22 22 H78 L94 42 L50 92 L6 42Z" fill="url(#d${id})" stroke="#1d7fb0" stroke-width="1.8" stroke-linejoin="round"/><path d="M6 42 H94 M22 22 L36 42 L50 22 L64 42 L78 22 M36 42 L50 92 L64 42" fill="none" stroke="#1d7fb0" stroke-width="1.4" stroke-linejoin="round" opacity=".8"/><path d="M22 22 L36 42 H6Z" fill="#fff" opacity=".45"/><path d="M50 22 L64 42 H36Z" fill="#fff" opacity=".3"/><g clip-path="url(#p${id})"><rect class="shine" x="44" y="0" width="10" height="100" fill="#fff" opacity=".7"/></g></g>${sparkle(14,16,.9,'#ff9ec7')}${sparkle(88,18,.8,'#fff36b','twinkle b')}${sparkle(90,70,.7,'#7dffb3','twinkle c')}${sparkle(10,70,.6,'#b28dff','twinkle b')}</g>`,
};
// the reaction's effect name → its drawing
const BY_FX={'face-giggle':'giggle','face-cackle':'cackle','face-point':'pointlaugh','face-rage':'rage','face-explode':'explode','face-grumpy':'grumpy','face-fume':'fume','face-laugh':'wheeze','face-smirk':'smirk','face-tongue':'tongue','face-sus':'sus','face-yawn':'yawn','face-evil':'evil',shake:'laugh',pop:'wow',steam:'angry',shine:'cool',tears:'cry',plead:'plead',hush:'hush',frost:'frost',blast:'blast',devil:'devil',flame:'flame',clap:'clap',spin:'spin',slither:'slither',sparkle:'sparkle',launch:'launch',royal:'royal',prism:'prism'};
// the same drawings for the talk emoji of the Baloot table
const BY_GLYPH={'🤭':'giggle','😆':'cackle','🫵':'pointlaugh','🤬':'explode','😒':'grumpy','🥵':'fume','😂':'laugh','🤣':'wheeze','😮':'wow','😱':'wow','😤':'angry','😡':'rage','😎':'cool','😭':'cry','🥺':'plead','😏':'smirk','😜':'tongue','🤨':'sus','🤔':'sus','🥱':'yawn','😈':'evil','🤫':'hush','🤐':'hush','🥶':'frost','🤯':'blast','🔥':'flame','👏':'clap','🎲':'spin','🐍':'slither','🧠':'sparkle','🚀':'launch','👑':'royal','💎':'prism'};
function kindOf(it){if(!it)return null;if(typeof it==='string')return ART[it]?it:BY_GLYPH[it]||null;if(it.type&&it.type!=='emote')return null;return BY_FX[it.fx]||BY_GLYPH[it.glyph]||null;}
const still=()=>{try{return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||window.BS_AUDIO?.getSettings?.().effects===false;}catch{return false;}};
/** An animated emoji for a reaction (or a glyph): a span holding its SVG, or null when there is none. */
function make(it,{size=null,label=''}={}){
  const kind=kindOf(it);if(!kind)return null;style();
  const id='bsf'+(++uid),wrap=document.createElement('span');
  wrap.className='bsf-wrap bsf-'+kind;if(size)wrap.style.setProperty('--bsf-size',size+'px');
  if(label){wrap.setAttribute('role','img');wrap.setAttribute('aria-label',label);}else wrap.setAttribute('aria-hidden','true');
  wrap.innerHTML=`<svg class="bsf${still()?' is-still':''}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${ART[kind](id)}</svg>`;
  return wrap;
}
/* ---------- 33.9.0: the duel — a move thrown at another player ----------
   The thrower winds up and throws, the thing flies in an arc and lands on the other face, which
   takes it (a splat, stars, hearts…) and answers with its own face; then the thrower answers back. */
const SHOT={
  tomato:id=>`<defs><radialGradient id="q${id}" cx="32%" cy="28%" r="78%"><stop offset="0" stop-color="#ffb08a"/><stop offset=".45" stop-color="#ef4b3f"/><stop offset="1" stop-color="#a5132c"/></radialGradient></defs><path d="M50 20C13 6 4 58 24 78Q50 99 76 78C97 55 86 7 50 20Z" fill="url(#q${id})"/><path d="M50 27L28 19 42 18 44 5 52 17 69 7 62 21 81 26 60 30 55 42Z" fill="#3f9a63" stroke="#2a6f45" stroke-width="1.2"/><ellipse cx="31" cy="42" rx="8" ry="13" fill="#fff" opacity=".45" transform="rotate(24 31 42)"/>`,
  slipper:id=>`<defs><linearGradient id="q${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5ab8ff"/><stop offset="1" stop-color="#1d5fb8"/></linearGradient></defs><path d="M30 8C16 10 12 30 14 50C16 72 22 92 40 94C58 96 66 80 66 62C66 44 70 30 62 16C56 6 42 6 30 8Z" fill="url(#q${id})" stroke="#123f80" stroke-width="2"/><path d="M28 14C22 20 20 40 22 56C24 74 30 86 40 88C52 90 58 78 58 62C58 46 62 32 56 22C50 12 36 10 28 14Z" fill="#9fd4ff" opacity=".55"/><path d="M40 30 L24 50 M40 30 L58 46" stroke="#f4f7ff" stroke-width="7" stroke-linecap="round"/><circle cx="40" cy="30" r="4.5" fill="#f4f7ff" stroke="#123f80" stroke-width="1.5"/>`,
  kiss:id=>`<defs><linearGradient id="q${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6f93"/><stop offset="1" stop-color="#c3123f"/></linearGradient></defs><path d="M8 48C20 30 34 28 50 40C66 28 80 30 92 48C80 52 70 54 50 54C30 54 20 52 8 48Z" fill="url(#q${id})" stroke="#8c0a2c" stroke-width="2" stroke-linejoin="round"/><path d="M8 48C24 58 34 76 50 76C66 76 76 58 92 48C78 56 66 58 50 58C34 58 22 56 8 48Z" fill="url(#q${id})" stroke="#8c0a2c" stroke-width="2" stroke-linejoin="round"/><path d="M30 64C40 70 46 70 54 68" fill="none" stroke="#ffd1dc" stroke-width="3" stroke-linecap="round" opacity=".8"/>`,
  balloon:id=>`<defs><radialGradient id="q${id}" cx="34%" cy="28%" r="80%"><stop offset="0" stop-color="#dff6ff"/><stop offset=".4" stop-color="#5ec8ff"/><stop offset="1" stop-color="#1667c8"/></radialGradient></defs><path d="M50 8C24 8 12 30 14 50C16 72 32 86 50 86C68 86 84 72 86 50C88 30 76 8 50 8Z" fill="url(#q${id})" opacity=".94"/><path d="M45 86 L50 94 L55 86Z" fill="#1667c8"/><ellipse cx="34" cy="30" rx="9" ry="14" fill="#fff" opacity=".55" transform="rotate(28 34 30)"/>`,
  pie:id=>`<defs><linearGradient id="q${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9edf5"/><stop offset="1" stop-color="#8f99ab"/></linearGradient></defs><ellipse cx="50" cy="62" rx="44" ry="20" fill="url(#q${id})" stroke="#69738a" stroke-width="2"/><path d="M8 56C10 34 30 26 50 28C70 26 90 34 92 56C80 66 20 66 8 56Z" fill="#fffaf0" stroke="#e6dccb" stroke-width="2"/><circle cx="34" cy="38" r="9" fill="#fff"/><circle cx="56" cy="34" r="11" fill="#fff"/><circle cx="72" cy="42" r="8" fill="#fff"/><circle cx="54" cy="24" r="7" fill="#e3263e" stroke="#9c0f24" stroke-width="1.5"/><path d="M54 17 Q58 8 66 6" fill="none" stroke="#3a7a2e" stroke-width="2"/>`,
  snowball:id=>`<defs><radialGradient id="q${id}" cx="34%" cy="30%" r="80%"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#e3f1ff"/><stop offset="1" stop-color="#98bfe6"/></radialGradient></defs><circle cx="50" cy="50" r="40" fill="url(#q${id})"/><circle cx="36" cy="60" r="4" fill="#c4dcf3"/><circle cx="62" cy="40" r="3" fill="#c4dcf3"/><circle cx="58" cy="66" r="3.5" fill="#c4dcf3"/><path d="M28 28 L31 34 L37 35 L31 37 L28 43 L26 37 L20 35 L26 34Z" fill="#fff"/>`,
  bouquet:id=>`<defs><radialGradient id="q${id}" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#ff8aa0"/><stop offset="1" stop-color="#c3123f"/></radialGradient></defs><path d="M34 52 L50 96 L66 52Z" fill="#f6e3b4" stroke="#c9a65a" stroke-width="2" stroke-linejoin="round"/><path d="M42 56 L50 80 L58 56" fill="none" stroke="#3a8a4c" stroke-width="3"/>${[[34,36],[50,26],[66,36],[42,50],[58,50]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="11" fill="url(#q${id})" stroke="#8c0a2c" stroke-width="1.4"/><path d="M${x-5} ${y} Q${x} ${y-7} ${x+5} ${y} Q${x} ${y+5} ${x-2} ${y-1}" fill="none" stroke="#7a0620" stroke-width="1.5"/>`).join('')}`,
  glove:id=>`<defs><radialGradient id="q${id}" cx="36%" cy="30%" r="80%"><stop offset="0" stop-color="#ff8a7a"/><stop offset=".5" stop-color="#e3242c"/><stop offset="1" stop-color="#8c0a12"/></radialGradient></defs><rect x="54" y="38" width="36" height="30" rx="7" fill="#f4f6ff" stroke="#9aa3b8" stroke-width="2"/><path d="M14 30C14 14 30 8 46 10C60 12 66 22 64 36L64 66C64 80 52 88 38 86C22 84 12 72 14 56Z" fill="url(#q${id})" stroke="#7a0610" stroke-width="2"/><path d="M22 40C26 34 36 34 42 40" fill="none" stroke="#7a0610" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="28" cy="22" rx="8" ry="5" fill="#fff" opacity=".45" transform="rotate(-20 28 22)"/>`,
};
const MARK={
  splat:(c='#e8463c',c2='#ffb08a')=>`<path d="M42 30Q32 4 36 32L22 26Q-2 14 24 40L10 48Q-4 60 30 56L22 80Q18 96 42 70L52 90Q58 104 62 72L80 82Q98 86 74 62L92 52Q104 40 74 44L82 24Q82 10 62 32L56 12Q48 0 50 28Z" fill="${c}" opacity=".94"/><circle cx="48" cy="52" r="17" fill="${c}"/><ellipse cx="42" cy="44" rx="9" ry="5" fill="${c2}" opacity=".65"/><path d="M30 70 Q30 82 28 90" stroke="${c}" stroke-width="4" stroke-linecap="round"/><path d="M66 70 Q67 80 66 88" stroke="${c}" stroke-width="3.4" stroke-linecap="round"/>`,
  stars:()=>`<g class="spin">${[0,72,144,216,288].map((a,i)=>{const r=a*Math.PI/180,x=50+Math.cos(r)*38,y=34+Math.sin(r)*13;return `<path d="M${x} ${y-8}L${x+2.4} ${y-2.4}L${x+8} ${y}L${x+2.4} ${y+2.4}L${x} ${y+8}L${x-2.4} ${y+2.4}L${x-8} ${y}L${x-2.4} ${y-2.4}Z" fill="${i%2?'#ffe56b':'#fff6c4'}" stroke="#c98a12" stroke-width="1"/>`;}).join('')}</g>`,
  hearts:()=>[[28,60,''],[54,54,' b'],[74,62,' c'],[42,40,' b']].map(([x,y,c])=>`<path class="rise${c}" d="M${x} ${y+8}C${x-12} ${y} ${x-10} ${y-10} ${x} ${y-4}C${x+10} ${y-10} ${x+12} ${y} ${x} ${y+8}Z" fill="#ff4d7d" stroke="#fff" stroke-width="1.2"/>`).join(''),
  splash:()=>`<path d="M50 22C44 36 30 40 26 54C22 68 34 82 50 82C66 82 78 68 74 54C70 40 56 36 50 22Z" fill="#5ec8ff" opacity=".55"/>${[[20,40,''],[80,36,' b'],[30,22,' c'],[72,20,''],[50,10,' b']].map(([x,y,c])=>`<path class="fall${c}" d="M${x} ${y}c-4 6 -4 10 0 11c4 -1 4 -5 0 -11z" fill="#6fd0ff" stroke="#fff" stroke-width=".8"/>`).join('')}`,
  cream:()=>`<circle cx="36" cy="40" r="15" fill="#fffdf6"/><circle cx="58" cy="34" r="17" fill="#fffdf6"/><circle cx="66" cy="56" r="13" fill="#fffdf6"/><circle cx="40" cy="62" r="12" fill="#fffdf6"/><circle cx="52" cy="50" r="14" fill="#fff"/><path d="M34 74 Q34 84 32 92 M62 70 Q63 80 62 86" stroke="#fffdf6" stroke-width="5" stroke-linecap="round"/><circle cx="56" cy="24" r="6" fill="#e3263e"/>`,
  snow:()=>`<circle cx="40" cy="38" r="13" fill="#f4faff"/><circle cx="60" cy="42" r="11" fill="#eaf4ff"/><circle cx="50" cy="56" r="12" fill="#ffffff"/>${[[24,30,''],[78,34,' b'],[30,64,' c'],[72,66,'']].map(([x,y,c])=>`<circle class="fall${c}" cx="${x}" cy="${y}" r="3.4" fill="#fff"/>`).join('')}`,
  petals:()=>[[24,20,''],[50,10,' b'],[76,22,' c'],[36,34,' b'],[64,36,'']].map(([x,y,c])=>`<ellipse class="fall${c}" cx="${x}" cy="${y}" rx="4.6" ry="7" fill="#ff5f7a" stroke="#c3123f" stroke-width=".8"/>`).join('')+MARK.hearts(),
};
// what each move throws, what it leaves, and how the two faces answer it (thrower: ready, after; target: before, after)
const DUEL=Object.freeze({
  tomato:{shot:'tomato',mark:()=>MARK.splat(),from:['smirk','cackle'],to:['wow','rage'],sound:['whoosh','splat'],arc:.34,spin:540},
  slipper:{shot:'slipper',mark:()=>MARK.stars(),from:['evil','pointlaugh'],to:['wow','blast'],sound:['whoosh','boom'],arc:.24,spin:1080},
  kiss:{shot:'kiss',mark:()=>MARK.hearts(),from:['cool','giggle'],to:['wow','plead'],sound:['whoosh','chime'],arc:.42,spin:0},
  water:{shot:'balloon',mark:()=>MARK.splash(),from:['smirk','cackle'],to:['wow','frost'],sound:['whoosh','splat'],arc:.4,spin:300},
  cake:{shot:'pie',mark:()=>MARK.cream(),from:['evil','wheeze'],to:['wow','tongue'],sound:['whoosh','splat'],arc:.3,spin:160},
  snow:{shot:'snowball',mark:()=>MARK.snow(),from:['smirk','laugh'],to:['wow','frost'],sound:['whoosh','pop'],arc:.38,spin:420},
  roses:{shot:'bouquet',mark:()=>MARK.petals(),from:['cool','plead'],to:['sus','plead'],sound:['whoosh','chime'],arc:.3,spin:0},
  punch:{shot:'glove',mark:()=>MARK.stars(),from:['rage','cool'],to:['wow','blast'],sound:['whoosh','boom'],arc:.04,spin:0},
});
function actorFace(box,kind){box.querySelector('.bsf-wrap')?.remove();const art=make(kind);if(art)box.prepend(art);}
/** Plays a duel move in `host` at the point `at` (x, y and the width it may take). */
function duel(kind,{host,at,from='',to='',mine=false,toMe=false,sound=()=>{},onReply=null}={}){
  const d=DUEL[kind];if(!d||!host||!at)return false;style();
  const id='bsd'+(++uid),node=document.createElement('div'),W=Math.round(Math.max(250,Math.min(at.w||340,430)));
  node.className='bsd bsd-'+kind+(toMe?' is-me':'');node.style.left=Math.round(at.x)+'px';node.style.top=Math.round(at.y)+'px';node.style.width=W+'px';
  node.setAttribute('role','img');node.setAttribute('aria-label',(mine?'أنت':from)+' ← '+(toMe?'أنت':to));
  const actor=(cls,kind0,name)=>{const box=document.createElement('div');box.className='bsd-actor '+cls;const faceBox=document.createElement('span');faceBox.className='bsd-face';const tag=document.createElement('b');tag.textContent=name;box.append(faceBox,tag);actorFace(faceBox,kind0);return box;};
  const A=actor('bsd-thrower',d.from[0],mine?'أنت':from||'لاعب'),B=actor('bsd-target',d.to[0],toMe?'أنت':to||'لاعب');
  const shot=document.createElement('span');shot.className='bsd-shot';shot.innerHTML=`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${SHOT[d.shot](id)}</svg>`;
  node.append(A,B,shot);host.append(node);
  const fx=W*.97-52,fy=56,tx=W*.03+52,ty=56,timers=[],later=(ms,fn)=>timers.push(setTimeout(fn,ms));
  const land=()=>{
    shot.style.opacity='0';sound(d.sound[1]);
    const mark=document.createElement('span');mark.className='bsd-mark';mark.style.left=tx+'px';mark.innerHTML=`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${d.mark()}</svg>`;node.append(mark);
    B.classList.add('hit');actorFace(B.querySelector('.bsd-face'),d.to[1]);
    later(260,()=>{A.classList.add('cheer');actorFace(A.querySelector('.bsd-face'),d.from[1]);});
    if(toMe&&typeof onReply==='function'){const reply=document.createElement('button');reply.type='button';reply.className='bsd-reply';reply.textContent='↩ رد عليه';reply.addEventListener('click',e=>{e.stopPropagation();reply.remove();onReply(kind);});node.append(reply);}
  };
  if(still()||!shot.animate){later(250,land);later(2600,()=>node.classList.add('out'));later(3050,()=>node.remove());return true;}
  later(170,()=>A.classList.add('wind'));
  later(430,()=>{
    sound(d.sound[0]);shot.style.opacity='1';
    const frames=[],n=12,peak=W*d.arc;
    for(let i=0;i<=n;i++){const t=i/n,x=fx+(tx-fx)*t,y=fy+(ty-fy)*t-Math.sin(Math.PI*t)*peak,sc=.75+.45*Math.sin(Math.PI*t)+(kind==='punch'?t*.5:0);frames.push({transform:`translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${(-d.spin*t).toFixed(0)}deg) scale(${sc.toFixed(2)})`});}
    const fly=shot.animate(frames,{duration:kind==='punch'?300:540,easing:'cubic-bezier(.35,.05,.6,1)',fill:'forwards'});
    fly.onfinish=land;
  });
  later(toMe&&onReply?3600:2900,()=>node.classList.add('out'));later(toMe&&onReply?4050:3350,()=>node.remove());
  return true;
}
window.BS_EMOJI_ART=Object.freeze({make,has:it=>Boolean(kindOf(it)),kinds:Object.keys(ART),duel,duels:Object.keys(DUEL)});
try{window.dispatchEvent(new Event('bs-emoji-ready'));}catch{}
})();
