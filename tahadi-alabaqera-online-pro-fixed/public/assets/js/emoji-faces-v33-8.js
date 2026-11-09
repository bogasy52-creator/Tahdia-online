/* Tahdia 33.8.0 — the emoji of the reactions, drawn and animated: glossy faces that blink, laugh,
   cry, steam and shiver, and objects that burn, spin and shine. The rarest come with a legendary
   entrance (light rays, a golden shock ring). One small stylesheet is added once; nothing is fetched. */
(()=>{'use strict';
if(window.BS_EMOJI_ART)return;
let uid=0;
const INK='#3a210d',MOUTH='#5a1609',TONGUE='#ff6f7d',TEAR='#62cfff';
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
.bsf.is-still *,.is-still .bsf *{animation:none!important}
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
// a glossy face: base gradient, rim, under-shadow and the top gloss
function face(id,{top='#fff6b4',mid='#ffd84a',low='#f7a823',rim='#d9770f',flush=null}={}){
  return `<defs><radialGradient id="f${id}" cx="40%" cy="30%" r="78%"><stop offset="0" stop-color="${top}"/><stop offset=".38" stop-color="${mid}"/><stop offset=".82" stop-color="${low}"/><stop offset="1" stop-color="${rim}"/></radialGradient>`+
  `<radialGradient id="g${id}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`+
  `<radialGradient id="c${id}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ff6f7d" stop-opacity=".55"/><stop offset="1" stop-color="#ff6f7d" stop-opacity="0"/></radialGradient></defs>`+
  `<ellipse cx="50" cy="95" rx="28" ry="4.5" fill="#000" opacity=".22"/>`+
  `<circle cx="50" cy="51" r="43" fill="url(#f${id})"/>`+
  (flush?`<circle class="flush" cx="50" cy="51" r="43" fill="${flush}" opacity="0"/>`:'')+
  `<path d="M14 62 A43 43 0 0 0 86 62 A40 34 0 0 1 14 62Z" fill="${rim}" opacity=".22"/>`+
  `<ellipse cx="37" cy="25" rx="19" ry="10" fill="url(#g${id})" transform="rotate(-18 37 25)"/>`;
}
const cheeks=id=>`<ellipse cx="25" cy="62" rx="9" ry="6" fill="url(#c${id})"/><ellipse cx="75" cy="62" rx="9" ry="6" fill="url(#c${id})"/>`;
const dotEyes=(dx=0,ry=7.5)=>`<g class="blink"><ellipse cx="${36+dx}" cy="44" rx="5.2" ry="${ry}" fill="${INK}"/><ellipse cx="${64+dx}" cy="44" rx="5.2" ry="${ry}" fill="${INK}"/><circle cx="${34.4+dx}" cy="41" r="1.9" fill="#fff"/><circle cx="${62.4+dx}" cy="41" r="1.9" fill="#fff"/></g>`;
const happyEyes=(y=44)=>`<path d="M27 ${y} Q36 ${y-9} 45 ${y}" fill="none" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/><path d="M55 ${y} Q64 ${y-9} 73 ${y}" fill="none" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/>`;
const sparkle=(x,y,s=1,c='#fff',cls='twinkle')=>`<path class="${cls}" d="M${x} ${y-6*s} L${x+1.6*s} ${y-1.6*s} L${x+6*s} ${y} L${x+1.6*s} ${y+1.6*s} L${x} ${y+6*s} L${x-1.6*s} ${y+1.6*s} L${x-6*s} ${y} L${x-1.6*s} ${y-1.6*s}Z" fill="${c}"/>`;
const grin=(open=true)=>open?`<path d="M27 58 Q50 90 73 58 Z" fill="${MOUTH}"/><path d="M30 59.5 Q50 65 70 59.5 L69 63 Q50 68.5 31 63 Z" fill="#fff"/><ellipse cx="50" cy="76" rx="11" ry="6" fill="${TONGUE}"/>`:`<path d="M33 64 Q50 78 67 64" fill="none" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/>`;
const drop=(x,y,cls)=>`<path class="${cls}" d="M${x} ${y} c-3.6 5.4 -3.8 9 0 10.2 c3.8 -1.2 3.6 -4.8 0 -10.2z" fill="${TEAR}" stroke="#fff" stroke-opacity=".6" stroke-width=".8"/>`;

/* ---------- every emoji ---------- */
const ART={
  // 😂 ضحكتني
  laugh:id=>`<g class="shake">${face(id)}${happyEyes(43)}${grin()}${cheeks(id)}${drop(22,42,'tearL')}${drop(78,42,'tearR')}${drop(24,48,'tearL b')}</g>`,
  // 🤣 ميت ضحك: rolling over
  wheeze:id=>`<g class="roll">${face(id)}<path d="M27 37 L41 44 L27 50" fill="none" stroke="${INK}" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M73 37 L59 44 L73 50" fill="none" stroke="${INK}" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/>${grin()}<path class="stream" d="M22 48 C14 54 12 62 10 72" fill="none" stroke="${TEAR}" stroke-width="5" stroke-linecap="round"/><path class="stream" d="M78 48 C86 54 88 62 90 72" fill="none" stroke="${TEAR}" stroke-width="5" stroke-linecap="round"/></g>`,
  // 😮 واو
  wow:id=>`<g class="bob">${face(id)}<g class="brow"><path d="M27 29 Q36 22 45 28" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/><path d="M55 28 Q64 22 73 29" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/></g><g class="blink"><circle cx="36" cy="44" r="7.6" fill="#fff"/><circle cx="64" cy="44" r="7.6" fill="#fff"/><circle cx="36" cy="45" r="4.4" fill="${INK}"/><circle cx="64" cy="45" r="4.4" fill="${INK}"/><circle cx="34.6" cy="43" r="1.5" fill="#fff"/><circle cx="62.6" cy="43" r="1.5" fill="#fff"/></g><ellipse class="pulse" cx="50" cy="71" rx="8.5" ry="10.5" fill="${MOUTH}"/><ellipse cx="50" cy="75" rx="5" ry="3.5" fill="${TONGUE}" opacity=".7"/></g>`,
  // 😤 قهر: red, with steam from the nose
  angry:id=>`<g class="bob">${face(id,{top:'#ffd2a8',mid:'#ff8a4c',low:'#ec5a2c',rim:'#b8321a',flush:'#ff2a1a'})}<path d="M25 33 L45 41" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M75 33 L55 41" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><g class="blink"><ellipse cx="36" cy="48" rx="5" ry="4.6" fill="${INK}"/><ellipse cx="64" cy="48" rx="5" ry="4.6" fill="${INK}"/></g><path d="M35 74 Q50 63 65 74" fill="none" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/><g class="steam" style="--sx:-16px"><circle cx="22" cy="66" r="5" fill="#f4f6ff"/><circle cx="17" cy="62" r="4" fill="#f4f6ff"/><circle cx="25" cy="61" r="3.4" fill="#f4f6ff"/></g><g class="steam b" style="--sx:16px"><circle cx="78" cy="66" r="5" fill="#f4f6ff"/><circle cx="83" cy="62" r="4" fill="#f4f6ff"/><circle cx="75" cy="61" r="3.4" fill="#f4f6ff"/></g></g>`,
  // 😎 رايق: shades with a passing glint
  cool:id=>`<g class="bob">${face(id)}<defs><linearGradient id="s${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4a7a"/><stop offset=".55" stop-color="#121a33"/><stop offset="1" stop-color="#05070f"/></linearGradient><clipPath id="k${id}"><path d="M20 36 H46 Q47 55 33.5 55 Q20 55 20 41Z M54 36 H80 V41 Q80 55 66.5 55 Q53 55 54 36Z"/></clipPath></defs><path d="M14 37 H86" stroke="#0b0f1f" stroke-width="4" stroke-linecap="round"/><path d="M20 36 H46 Q47 55 33.5 55 Q20 55 20 41Z M54 36 H80 V41 Q80 55 66.5 55 Q53 55 54 36Z" fill="url(#s${id})" stroke="#05070f" stroke-width="2"/><g clip-path="url(#k${id})"><rect class="glint" x="30" y="30" width="9" height="30" fill="#fff" opacity=".75" transform="skewX(-20)"/></g><path d="M37 68 Q52 77 65 63" fill="none" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/></g>`,
  // 😭 دموع: two rivers
  cry:id=>`<g class="bob">${face(id)}<path d="M27 40 Q36 47 45 41" fill="none" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/><path d="M55 41 Q64 47 73 40" fill="none" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/><path class="stream" d="M32 47 C29 60 31 74 26 92" fill="none" stroke="${TEAR}" stroke-width="7" stroke-linecap="round" opacity=".9"/><path class="stream" d="M68 47 C71 60 69 74 74 92" fill="none" stroke="${TEAR}" stroke-width="7" stroke-linecap="round" opacity=".9"/><path d="M36 74 Q50 58 64 74 Q50 82 36 74Z" fill="${MOUTH}"/><path d="M40 72 Q50 66 60 72" fill="none" stroke="#fff" stroke-width="2.4"/></g>`,
  // 🥺 تكفى: big shining eyes
  plead:id=>`<g class="bob">${face(id)}<path d="M26 31 Q35 26 44 31" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round" transform="rotate(-10 35 30)"/><path d="M56 31 Q65 26 74 31" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round" transform="rotate(10 65 30)"/><g><ellipse cx="36" cy="47" rx="9" ry="10" fill="#fff"/><ellipse cx="64" cy="47" rx="9" ry="10" fill="#fff"/><ellipse cx="36" cy="48.5" rx="7" ry="8" fill="#4b2a12"/><ellipse cx="64" cy="48.5" rx="7" ry="8" fill="#4b2a12"/><circle class="pulse" cx="33" cy="44.5" r="2.8" fill="#fff"/><circle class="pulse" cx="61" cy="44.5" r="2.8" fill="#fff"/><circle cx="38.5" cy="52" r="1.4" fill="#fff"/><circle cx="66.5" cy="52" r="1.4" fill="#fff"/><path d="M28 54 Q36 59 44 54" fill="none" stroke="${TEAR}" stroke-width="2.4" stroke-linecap="round" opacity=".85"/><path d="M56 54 Q64 59 72 54" fill="none" stroke="${TEAR}" stroke-width="2.4" stroke-linecap="round" opacity=".85"/></g><path d="M41 73 Q50 68 59 73" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/>${cheeks(id)}</g>`,
  // 😏 قلتها لك
  smirk:id=>`<g class="bob">${face(id)}<path class="brow" d="M56 30 Q65 25 74 31" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/><path d="M26 36 L45 37" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/><g class="look"><path d="M28 44 H45" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="41" cy="46.5" rx="4" ry="3.2" fill="${INK}"/><path d="M56 44 H73" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="69" cy="46.5" rx="4" ry="3.2" fill="${INK}"/></g><path d="M37 68 Q54 72 67 60" fill="none" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/></g>`,
  // 😜 طقطقة: a wink and a wagging tongue
  tongue:id=>`<g class="bob">${face(id)}<path d="M27 44 Q36 37 45 44" fill="none" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/><g class="blink"><ellipse cx="64" cy="43" rx="6.4" ry="8.4" fill="${INK}"/><circle cx="62" cy="40" r="2.2" fill="#fff"/></g><path d="M28 60 Q50 84 72 60 Z" fill="${MOUTH}"/><g class="wag"><path d="M47 69 Q48 92 58 90 Q66 88 63 70Z" fill="${TONGUE}" stroke="#d94a5a" stroke-width="1.2"/><path d="M55 72 L56 84" stroke="#d94a5a" stroke-width="1.4" stroke-linecap="round"/></g>${cheeks(id)}</g>`,
  // 🤨 متأكد؟: one brow up, eyes to the side
  sus:id=>`<g class="bob">${face(id)}<path class="brow" d="M55 27 Q64 20 74 27" fill="none" stroke="${INK}" stroke-width="3.8" stroke-linecap="round"/><path d="M26 38 L45 38" stroke="${INK}" stroke-width="3.8" stroke-linecap="round"/><g class="look"><ellipse cx="38" cy="46" rx="4.6" ry="3.4" fill="${INK}"/><ellipse cx="65" cy="44" rx="5" ry="6.6" fill="${INK}"/><circle cx="63.6" cy="41.6" r="1.6" fill="#fff"/></g><path d="M38 70 L62 67" stroke="${INK}" stroke-width="4" stroke-linecap="round"/></g>`,
  // 🥱 خذ وقتك: a long yawn and the z's
  yawn:id=>`<g class="bob">${face(id)}<path d="M27 42 Q36 47 45 42" fill="none" stroke="${INK}" stroke-width="3.8" stroke-linecap="round"/><path d="M55 42 Q64 47 73 42" fill="none" stroke="${INK}" stroke-width="3.8" stroke-linecap="round"/><g class="yawn"><ellipse cx="50" cy="70" rx="10" ry="12" fill="${MOUTH}"/><ellipse cx="50" cy="76" rx="6" ry="4" fill="${TONGUE}" opacity=".75"/></g><text class="zz" x="72" y="26" font-size="15" font-weight="900" fill="#e9f0ff" stroke="#3b4a86" stroke-width="1">z</text><text class="zz b" x="80" y="18" font-size="11" font-weight="900" fill="#e9f0ff" stroke="#3b4a86" stroke-width="1">z</text></g>`,
  // 😈 الخطة ماشية: purple, horns, a plotting grin
  evil:id=>`<g class="bob">${face(id,{top:'#e3c2ff',mid:'#a66cf5',low:'#7a3fd6',rim:'#4d1fa0'})}<path d="M18 24 Q14 8 26 4 Q22 14 30 20Z" fill="#7a3fd6" stroke="#4d1fa0" stroke-width="1.4"/><path d="M82 24 Q86 8 74 4 Q78 14 70 20Z" fill="#7a3fd6" stroke="#4d1fa0" stroke-width="1.4"/><path d="M26 36 L45 42" stroke="#2a0d55" stroke-width="4.4" stroke-linecap="round"/><path d="M74 36 L55 42" stroke="#2a0d55" stroke-width="4.4" stroke-linecap="round"/><g class="glow"><ellipse cx="37" cy="48" rx="5" ry="3.6" fill="#ffe56b"/><ellipse cx="63" cy="48" rx="5" ry="3.6" fill="#ffe56b"/></g><path d="M27 60 Q50 82 73 60 Q50 70 27 60Z" fill="#2a0d55"/><path d="M33 62 L37 67 L41 63 L45 68 L50 64 L55 68 L59 63 L63 67 L67 62" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></g>`,
  // 😈 شرير: a red devil in flames
  devil:id=>`<g class="bob"><g class="flame1" opacity=".85"><path d="M14 70 Q8 40 24 30 Q22 46 30 50 Q28 26 46 14 Q44 34 54 40 Q58 22 72 16 Q66 36 78 46 Q86 38 84 28 Q96 46 86 74Z" fill="#ff5a2a" opacity=".55"/></g>${face(id,{top:'#ffb0a0',mid:'#ef3b3b',low:'#c01e30',rim:'#7a0d1e'})}<path d="M18 26 Q12 6 28 2 Q22 14 31 21Z" fill="#2a0b10"/><path d="M82 26 Q88 6 72 2 Q78 14 69 21Z" fill="#2a0b10"/><path d="M25 37 L45 44" stroke="#2a0b10" stroke-width="5" stroke-linecap="round"/><path d="M75 37 L55 44" stroke="#2a0b10" stroke-width="5" stroke-linecap="round"/><g class="glow"><ellipse cx="37" cy="50" rx="5" ry="3.4" fill="#fff36b"/><ellipse cx="63" cy="50" rx="5" ry="3.4" fill="#fff36b"/></g><path d="M30 62 Q50 84 70 62 Q50 72 30 62Z" fill="#2a0b10"/><path d="M38 64 L41 70 L44 65 M56 65 L59 70 L62 64" fill="#fff" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></g>`,
  // 🤫 اسكت
  hush:id=>`<g class="bob">${face(id)}<g class="look"><ellipse cx="38" cy="42" rx="5" ry="7" fill="${INK}"/><ellipse cx="66" cy="42" rx="5" ry="7" fill="${INK}"/><circle cx="36.6" cy="39" r="1.8" fill="#fff"/><circle cx="64.6" cy="39" r="1.8" fill="#fff"/></g><path d="M38 70 Q50 74 62 70" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><rect x="44.5" y="52" width="11" height="34" rx="5.5" fill="#ffd27a" stroke="#d98e2b" stroke-width="1.6"/><rect x="46.6" y="53.6" width="6.8" height="7" rx="3" fill="#fff1d6" stroke="#e8b06a" stroke-width="1"/><path d="M46 68 Q50 70 54 68" fill="none" stroke="#d98e2b" stroke-width="1.2"/><path class="pulse" d="M70 66 Q76 70 70 76 M76 62 Q84 70 76 80" fill="none" stroke="#e9f0ff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/></g>`,
  // 🥶 تجمّدت: blue, shivering, icicles
  frost:id=>`<g class="shiver">${face(id,{top:'#e6fbff',mid:'#8fdcff',low:'#3a9be8',rim:'#1c5fb0'})}<path d="M24 34 Q35 29 45 34" fill="none" stroke="#123a6b" stroke-width="3.6" stroke-linecap="round"/><path d="M55 34 Q65 29 76 34" fill="none" stroke="#123a6b" stroke-width="3.6" stroke-linecap="round"/><g class="blink"><circle cx="36" cy="45" r="7" fill="#fff"/><circle cx="64" cy="45" r="7" fill="#fff"/><circle cx="36" cy="46" r="3.6" fill="#123a6b"/><circle cx="64" cy="46" r="3.6" fill="#123a6b"/></g><rect x="31" y="62" width="38" height="14" rx="5" fill="#fff" stroke="#123a6b" stroke-width="2.2"/><path d="M38.6 62 V76 M46.2 62 V76 M53.8 62 V76 M61.4 62 V76 M31 69 H69" stroke="#123a6b" stroke-width="1.6"/><path d="M30 88 L33 96 L36 88 M44 91 L46.5 99 L49 91 M58 90 L61 97 L64 90" fill="#e6fbff" stroke="#9fe0ff" stroke-width="1.2"/>${sparkle(18,26,.8,'#e6fbff')}${sparkle(84,30,.7,'#e6fbff','twinkle b')}${sparkle(80,80,.6,'#e6fbff','twinkle c')}</g>`,
  // 🤯 انفجر مخي: the top of the head goes off
  blast:id=>`<g>${face(id)}<g class="boom"><circle cx="50" cy="14" r="13" fill="#ffb347"/><circle cx="38" cy="10" r="9" fill="#ff7a3d"/><circle cx="62" cy="9" r="10" fill="#ff7a3d"/><circle cx="50" cy="4" r="8" fill="#ffd166"/><circle cx="30" cy="18" r="6" fill="#9aa3b5"/><circle cx="70" cy="18" r="6" fill="#9aa3b5"/></g><path d="M18 26 Q50 14 82 26" fill="none" stroke="#c96a0a" stroke-width="2.4" stroke-dasharray="4 4"/><g class="blink"><circle cx="36" cy="45" r="7.4" fill="#fff"/><circle cx="64" cy="45" r="7.4" fill="#fff"/><circle cx="36" cy="45" r="3" fill="${INK}"/><circle cx="64" cy="45" r="3" fill="${INK}"/></g><ellipse class="pulse" cx="50" cy="71" rx="8" ry="9.5" fill="${MOUTH}"/></g>`,
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
const BY_FX={'face-laugh':'wheeze','face-smirk':'smirk','face-tongue':'tongue','face-sus':'sus','face-yawn':'yawn','face-evil':'evil',shake:'laugh',pop:'wow',steam:'angry',shine:'cool',tears:'cry',plead:'plead',hush:'hush',frost:'frost',blast:'blast',devil:'devil',flame:'flame',clap:'clap',spin:'spin',slither:'slither',sparkle:'sparkle',launch:'launch',royal:'royal',prism:'prism'};
// the same drawings for the talk emoji of the Baloot table
const BY_GLYPH={'😂':'laugh','🤣':'wheeze','😮':'wow','😱':'wow','😤':'angry','😡':'angry','😎':'cool','😭':'cry','🥺':'plead','😏':'smirk','😜':'tongue','🤨':'sus','🤔':'sus','🥱':'yawn','😈':'evil','🤫':'hush','🤐':'hush','🥶':'frost','🤯':'blast','🔥':'flame','👏':'clap','🎲':'spin','🐍':'slither','🧠':'sparkle','🚀':'launch','👑':'royal','💎':'prism'};
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
window.BS_EMOJI_ART=Object.freeze({make,has:it=>Boolean(kindOf(it)),kinds:Object.keys(ART)});
try{window.dispatchEvent(new Event('bs-emoji-ready'));}catch{}
})();
