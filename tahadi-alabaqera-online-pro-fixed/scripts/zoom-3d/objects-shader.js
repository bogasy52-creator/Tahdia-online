// Offline studio renderer for the zoom challenge (32.0.0): everyday objects
// as signed distance fields, ray marched with a perspective camera over a
// seamless studio sweep. Glass is traced in two passes (surface, then what
// lies behind it) so bulbs and hourglasses read as glass.
window.OBJECTS_FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform int uObj;
uniform vec3 uTarget;
uniform float uDist;
uniform float uElev;
uniform float uYaw;
uniform float uFov;
uniform vec3 uBg;
uniform vec3 uFloor;
uniform vec3 uTint;
uniform int uFloorOn;
#define PI 3.14159265
// ---------- primitives ----------
float smin(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}
float smax(float a,float b,float k){return -smin(-a,-b,k);}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float sdBox2(vec2 p,vec2 b){vec2 d=abs(p)-b;return length(max(d,0.))+min(max(d.x,d.y),0.);}
float sdRBox2(vec2 p,vec2 b,float r){return sdBox2(p,b-r)-r;}
float sdUCap(vec2 p,float r1,float r2,float h){
  p.x=abs(p.x);float b=(r1-r2)/h,a=sqrt(1.-b*b),k=dot(p,vec2(-b,a));
  if(k<0.)return length(p)-r1;if(k>a*h)return length(p-vec2(0.,h))-r2;return dot(p,vec2(a,b))-r1;}
float sdTrap(vec2 p,float r1,float r2,float he){
  vec2 k1=vec2(r2,he),k2=vec2(r2-r1,2.*he);p.x=abs(p.x);
  vec2 ca=vec2(p.x-min(p.x,(p.y<0.)?r1:r2),abs(p.y)-he);
  vec2 cb=p-k1+k2*clamp(dot(k1-p,k2)/dot(k2,k2),0.,1.);
  float s=(cb.x<0.&&ca.y<0.)?-1.:1.;return s*sqrt(min(dot(ca,ca),dot(cb,cb)));}
float sdTorus(vec3 p,vec2 t){vec2 q=vec2(length(p.xz)-t.x,p.y);return length(q)-t.y;}
float sdCyl(vec3 p,float r,float h){vec2 d=abs(vec2(length(p.xz),p.y))-vec2(r,h);return min(max(d.x,d.y),0.)+length(max(d,0.));}
float sdCap(vec3 p,vec3 a,vec3 b,float r){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-r;}
float sdEll(vec3 p,vec3 r){float k0=length(p/r),k1=length(p/(r*r));return k0*(k0-1.)/k1;}
// fold the xz plane into one of n sectors around y
vec3 polar(vec3 p,float n){float a=atan(p.z,p.x),s=2.*PI/n;a=mod(a+s*.5,s)-s*.5;float r=length(p.xz);return vec3(r*cos(a),p.y,r*sin(a));}
float hash3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
  return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*noise3(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s;}


float sdRBox(vec3 p,vec3 b,float r){vec3 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.)-r;}
float sdBox(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}
float sdCone(vec3 p,vec3 a,vec3 b,float ra,float rb){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-mix(ra,rb,h);}
float sdSeg2(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h);}
float sdHexPrism(vec3 p,vec2 h){const vec3 k=vec3(-.8660254,.5,.57735);p=abs(p);p.xy-=2.*min(dot(k.xy,p.xy),0.)*k.xy;
  vec2 d=vec2(length(p.xy-vec2(clamp(p.x,-k.z*h.x,k.z*h.x),h.x))*sign(p.y-h.x),p.z-h.y);return min(max(d.x,d.y),0.)+length(max(d,0.));}
vec2 U(vec2 a,vec2 b){return a.x<b.x?a:b;}
float hash1(float n){return fract(sin(n)*43758.5453);}
float hash2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec3 rotY(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);}
vec3 rotX(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(p.x,c*p.y-s*p.z,s*p.y+c*p.z);}
vec3 rotZ(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(c*p.x-s*p.y,s*p.x+c*p.y,p.z);}

// ---------- materials ----------
#define M_ORANGE 1.
#define M_SOCCER 2.
#define M_FELT 3.
#define M_CUBE 4.
#define M_DOUGH 5.
#define M_ICING 6.
#define M_SPRINKLE 7.
#define M_MELON 8.
#define M_ALU 9.
#define M_BLACKGLASS 10.
#define M_BRASS 11.
#define M_GLOW 12.
#define M_PAINT 13.
#define M_WOOD 14.
#define M_GRAPHITE 15.
#define M_ERASER 16.
#define M_STEEL 17.
#define M_GOLD 18.
#define M_SAND 19.
#define M_DARKWOOD 20.
#define M_DATE 21.
#define M_CERAMIC 22.
#define M_CAPRED 23.
#define M_MUSHWHITE 24.
#define M_GILL 25.
#define M_WAFFLE 26.
#define M_SCOOP1 27.
#define M_SCOOP2 28.
#define M_STRAW 29.
#define M_LEAF 30.
#define M_MAGNET 31.
#define M_BLACK 32.
#define M_DIE 33.
#define M_PIP 34.
#define M_TERRACOTTA 35.
#define M_SOIL 36.
#define M_CACTUS 37.
#define M_VOID 38.

// ---------- objects (each stands on the floor at y = 0) ----------
vec2 basketball(vec3 p){return vec2(length(p-vec3(0.,.5,0.))-.5,M_ORANGE);}
vec2 soccer(vec3 p){return vec2(length(p-vec3(0.,.5,0.))-.5,M_SOCCER);}
vec2 tennis(vec3 p){return vec2(length(p-vec3(0.,.42,0.))-.42,M_FELT);}
vec2 rubik(vec3 p){vec3 q=rotY(p-vec3(0.,.45,0.),.62);return vec2(sdRBox(q,vec3(.45),.045),M_CUBE);}

float torusR=.36,torusr=.17;
float icingEdge(float u){return -.035+.03*sin(u*7.+.6)+.016*sin(u*13.+2.1)+.01*sin(u*23.);}
vec2 donut(vec3 p){
  vec3 q=p-vec3(0.,.165,0.);
  q.y*=1.08;
  vec2 t=vec2(length(q.xz)-torusR,q.y);
  float dough=length(t)-torusr;
  float u=atan(q.z,q.x);
  float icing=max(length(t)-torusr-.02,-(t.y-icingEdge(u)));
  icing+=.003*sin(u*31.+t.y*40.);
  vec2 r=U(vec2(dough,M_DOUGH),vec2(icing,M_ICING));
  // sprinkles lie on the icing, one per cell of the (u,v) grid
  float v=atan(t.y,t.x);
  float nu=64.,nv=16.;
  vec2 cell=vec2(floor(u/(2.*PI)*nu),floor(v/(2.*PI)*nv));
  vec2 cu=(cell+.5)/vec2(nu,nv)*2.*PI;
  float h=hash2(cell);
  if(h<.55&&cu.y>-.1){
    vec2 jitter=(vec2(hash2(cell+3.1),hash2(cell+7.7))-.5)*vec2(2.*PI/nu,2.*PI/nv)*.5;
    vec2 c=cu+jitter;
    float majorR=torusR+torusr*cos(c.y);
    vec2 d=vec2((u-c.x)*majorR,(v-c.y)*(torusr+.02));
    float ang=hash2(cell+11.3)*PI;
    vec2 dir=vec2(cos(ang),sin(ang))*.014;
    float s2=sdSeg2(d,-dir,dir);
    float above=icing;
    float sp=length(vec2(s2,above-.0055))-.0055;
    if(t.y>icingEdge(u)+.02)r=U(r,vec2(sp,M_SPRINKLE+fract(h*13.7)*.9));
  }
  return r;
}

vec2 watermelon(vec3 p){
  vec3 q=p-vec3(0.,.64,0.);
  q=rotY(q,.0);
  float R=.62;
  float d2=max(length(q.xy)-R,q.y);
  vec2 w=vec2(d2,abs(q.z)-.085);
  float d=min(max(w.x,w.y),0.)+length(max(w,0.))-.012;
  return vec2(d,M_MELON);
}

vec2 bulbSolid(vec3 p){
  vec2 r=vec2(1e9,0.);
  // screw base with threads, black insulator and the contact
  vec2 q=vec2(length(p.xz),p.y);
  float thread=.008*sin(p.y*95.+atan(p.z,p.x));
  float base=max(abs(q.y-.23)-.11,q.x-.13-thread);
  r=U(r,vec2(base,M_ALU));
  float ins=max(abs(q.y-.09)-.03,q.x-mix(.06,.12,smoothstep(.06,.12,q.y)));
  r=U(r,vec2(ins,M_BLACKGLASS));
  r=U(r,vec2(length(p-vec3(0.,.055,0.))-.045,M_BRASS));
  // stem, support wires and the glowing coil
  r=U(r,vec2(sdCone(p,vec3(0.,.34,0.),vec3(0.,.5,0.),.05,.02),M_BLACKGLASS));
  r=U(r,vec2(sdCap(p,vec3(-.015,.48,0.),vec3(-.07,.66,0.),.006),M_STEEL));
  r=U(r,vec2(sdCap(p,vec3(.015,.48,0.),vec3(.07,.66,0.),.006),M_STEEL));
  vec3 c=p-vec3(0.,.665,0.);
  float coil=length(vec2(length(c.yz)-.012,fract(c.x*90.)/90.-.0055))-.0028;
  coil=max(coil,abs(c.x)-.07);
  r=U(r,vec2(coil,M_GLOW));
  return r;
}
float bulbGlass(vec3 p){
  float s=length(p-vec3(0.,.73,0.))-.31;
  float n=sdCone(p,vec3(0.,.34,0.),vec3(0.,.56,0.),.14,.2);
  return smin(s,n,.08);
}

vec2 pencil(vec3 p){
  vec3 q=rotY(p,.55);
  q.y-=.072;
  vec3 h=vec3(q.z,q.y,q.x);
  h=rotZ(h,PI/6.);
  float body=sdHexPrism(h-vec3(0.,0.,-.12),vec2(.07,.42));
  vec2 r=vec2(body,M_PAINT);
  // the sharpened end: wood cone, graphite point
  vec3 a=vec3(.3,0.,0.),b=vec3(.52,0.,0.);
  float tip=sdCone(q,a,b,.072,.012);
  tip=max(tip,-(q.x-.3));
  r=U(r,vec2(tip,M_WOOD));
  r=U(r,vec2(max(sdCone(q,vec3(.46,0.,0.),vec3(.56,0.,0.),.028,.002),-(q.x-.47)),M_GRAPHITE));
  // ferrule and eraser
  vec3 f=vec3(q.y,q.x,q.z);
  float fer=sdCyl(f-vec3(0.,-.6,0.),.076+.003*sin(q.x*260.),.06);
  r=U(r,vec2(fer,M_ALU));
  float er=sdCyl(f-vec3(0.,-.7,0.),.07,.05)-.012;
  r=U(r,vec2(er,M_ERASER));
  return r;
}

vec2 padlock(vec3 p){
  vec3 q=rotY(p,-.35);
  float body=sdRBox(q-vec3(0.,.25,0.),vec3(.27,.23,.1),.05);
  vec2 r=vec2(body,M_BRASS);
  // keyhole
  vec3 k=q-vec3(0.,.22,.1);
  float hole=min(length(k.xy-vec2(0.,.03))-.035,sdBox(k-vec3(0.,-.03,0.),vec3(.016,.05,.05)));
  hole=max(hole,abs(k.z)-.03);
  r=vec2(max(r.x,-hole),-hole>r.x?M_VOID:r.y);
  // shackle
  vec3 s=q-vec3(0.,.5,0.);
  float arc=length(vec2(length(s.xy)-.17,s.z))-.036;
  arc=max(arc,-s.y);
  float legs=min(sdCap(q,vec3(-.17,.42,0.),vec3(-.17,.5,0.),.036),sdCap(q,vec3(.17,.42,0.),vec3(.17,.5,0.),.036));
  r=U(r,vec2(min(arc,legs),M_STEEL));
  return r;
}

float hgGlass(vec3 p){
  vec3 q=p;
  float lo=sdEll(q-vec3(0.,.31,0.),vec3(.2,.24,.2));
  float hi=sdEll(q-vec3(0.,.79,0.),vec3(.2,.24,.2));
  float neck=sdCyl(q-vec3(0.,.55,0.),.03,.06);
  return smin(smin(lo,hi,.06),neck,.05);
}
vec2 hourglass(vec3 p){
  vec2 q=vec2(length(p.xz),p.y);
  vec2 r=vec2(sdCyl(p-vec3(0.,.035,0.),.29,.035)-.008,M_DARKWOOD);
  r=U(r,vec2(sdCyl(p-vec3(0.,1.065,0.),.29,.035)-.008,M_DARKWOOD));
  vec3 pp=polar(rotY(p,.5),3.);
  r=U(r,vec2(sdCap(pp,vec3(.25,.07,0.),vec3(.25,1.03,0.),.022+.006*sin(p.y*30.)),M_DARKWOOD));
  // sand: a heap below, the rest above with a dip, and the falling thread
  float lo=sdEll(p-vec3(0.,.31,0.),vec3(.185,.225,.185));
  float heap=p.y-(.2+.11*(1.-smoothstep(0.,.17,q.x)));
  r=U(r,vec2(max(lo,heap),M_SAND));
  float hi=sdEll(p-vec3(0.,.79,0.),vec3(.185,.225,.185));
  float top=p.y-(.72+.25*q.x*q.x*4.);
  r=U(r,vec2(max(hi,top),M_SAND));
  r=U(r,vec2(sdCap(p,vec3(0.,.3,0.),vec3(0.,.6,0.),.005),M_SAND));
  return r;
}

vec2 trophy(vec3 p){
  vec2 r=vec2(sdRBox(p-vec3(0.,.07,0.),vec3(.2,.07,.2),.015),M_BLACK);
  r=U(r,vec2(sdRBox(p-vec3(0.,.07,.2),vec3(.11,.035,.004),.003),M_GOLD));
  r=U(r,vec2(sdCyl(p-vec3(0.,.16,0.),.12,.02)-.01,M_GOLD));
  vec2 q=vec2(length(p.xz),p.y);
  float stem=sdCone(p,vec3(0.,.16,0.),vec3(0.,.42,0.),.04,.035);
  stem=smin(stem,length(p-vec3(0.,.29,0.))-.055,.03);
  r=U(r,vec2(stem,M_GOLD));
  vec3 c=p-vec3(0.,.74,0.);
  float outer=sdEll(c,vec3(.3,.36,.3));
  outer=max(outer,c.y-.1);
  float inner=sdEll(c,vec3(.275,.335,.275));
  float cup=max(outer,-inner);
  r=U(r,vec2(cup,M_GOLD));
  r=U(r,vec2(sdTorus(c-vec3(0.,.1,0.),vec2(.255,.016)),M_GOLD));
  vec3 h=vec3(abs(p.x),p.y,p.z)-vec3(.3,.66,0.);
  float handle=length(vec2(length(h.xy)-.1,h.z))-.022;
  handle=max(handle,-h.x+.0);
  r=U(r,vec2(handle,M_GOLD));
  return r;
}

vec2 dallah(vec3 p){
  vec3 o=rotY(p,.45);
  vec2 q=vec2(length(o.xz),o.y);
  float foot=sdRBox2(q-vec2(0.,.03),vec2(.2,.03),.012);
  float belly=sdEll(o-vec3(0.,.24,0.),vec3(.3,.21,.3));
  float waist=sdCone(o,vec3(0.,.4,0.),vec3(0.,.5,0.),.15,.105);
  float flare=sdCone(o,vec3(0.,.5,0.),vec3(0.,.63,0.),.105,.17);
  float body=smin(smin(smin(foot,belly,.04),waist,.06),flare,.04);
  // engraved bands on the belly and the neck
  body+=.004*smoothstep(.006,.0,abs(o.y-.33))+.004*smoothstep(.006,.0,abs(o.y-.12));
  vec2 r=vec2(body,M_BRASS);
  float lid=max(sdEll(o-vec3(0.,.63,0.),vec3(.16,.09,.16)),-(o.y-.63));
  r=U(r,vec2(lid,M_BRASS));
  r=U(r,vec2(sdCyl(o-vec3(0.,.735,0.),.03,.025),M_BRASS));
  r=U(r,vec2(length(o-vec3(0.,.79,0.))-.045,M_BRASS));
  r=U(r,vec2(sdCone(o,vec3(0.,.82,0.),vec3(0.,.95,0.),.028,.004),M_BRASS));
  // the beak-like spout
  float spout=sdCone(o,vec3(.18,.3,0.),vec3(.4,.55,0.),.07,.04);
  spout=smin(spout,sdCone(o,vec3(.4,.55,0.),vec3(.56,.72,0.),.04,.03),.03);
  vec3 b=o-vec3(.56,.72,0.);
  float beak=sdEll(rotZ(b,-.25)-vec3(.06,.0,0.),vec3(.1,.028,.04));
  spout=smin(spout,beak,.03);
  r=U(r,vec2(spout,M_BRASS));
  // the handle
  float handle=sdCap(o,vec3(-.24,.2,0.),vec3(-.4,.38,0.),.024);
  handle=smin(handle,sdCap(o,vec3(-.4,.38,0.),vec3(-.36,.56,0.),.024),.03);
  handle=smin(handle,sdCap(o,vec3(-.36,.56,0.),vec3(-.12,.6,0.),.024),.03);
  r=U(r,vec2(handle,M_BRASS));
  return r;
}

vec2 dates(vec3 p){
  vec2 q=vec2(length(p.xz),p.y);
  float plate=sdRBox2(q-vec2(0.,.02),vec2(.62,.02),.015);
  plate=min(plate,max(sdTorus(p-vec3(0.,.05,0.),vec2(.6,.03)),-p.y+.02));
  vec2 r=vec2(plate,M_CERAMIC);
  for(int i=0;i<8;i++){
    float fi=float(i);
    float a=fi*2.399+.3;
    float rad=fi<1.?0.:.16+.12*fract(fi*.618);
    vec3 c=vec3(cos(a)*rad,.1+.012*fract(fi*.37),sin(a)*rad);
    if(i==7)c=vec3(.05,.19,.03);
    vec3 d=rotY(p-c,a*1.7);
    d=rotZ(d,(fract(fi*.73)-.5)*.5);
    float e=sdEll(d,vec3(.135,.052,.052));
    e+=.0022*sin(d.x*55.+sin(d.y*40.)*1.5)*cos(d.z*38.+d.x*9.);
    r=U(r,vec2(e,M_DATE));
  }
  return r;
}

vec2 mushroom(vec3 p){
  float stem=sdCone(p,vec3(0.,.06,0.),vec3(0.,.46,0.),.11,.075);
  stem=smin(stem,sdEll(p-vec3(0.,.07,0.),vec3(.15,.075,.15)),.05);
  vec2 r=vec2(stem,M_MUSHWHITE);
  vec3 s=p-vec3(0.,.38,0.);
  float skirt=sdCone(p,vec3(0.,.4,0.),vec3(0.,.33,0.),.085,.13);
  skirt=max(skirt,-sdCone(p,vec3(0.,.4,0.),vec3(0.,.32,0.),.075,.12));
  r=U(r,vec2(skirt,M_MUSHWHITE));
  vec3 c=p-vec3(0.,.5,0.);
  float cap=sdEll(c,vec3(.42,.24,.42));
  cap=max(cap,-(c.y+.02));
  r=U(r,vec2(cap,M_CAPRED));
  r=U(r,vec2(max(sdEll(c,vec3(.41,.06,.41)),c.y+.02),M_GILL));
  // warts in two rings and on the crown
  for(int k=0;k<3;k++){
    float fk=float(k);
    float n=fk<.5?1.:(fk<1.5?6.:11.);
    float el=fk<.5?1.45:(fk<1.5?1.05:.62);
    vec3 pc=polar(rotY(c,fk*.7),n);
    vec3 at=vec3(.42*cos(el),.24*sin(el)+.01,0.);
    if(fk<.5)at=vec3(0.,.245,0.);
    r=U(r,vec2(sdEll(pc-at,vec3(.035,.018,.035)),M_MUSHWHITE));
  }
  return r;
}

vec2 icecream(vec3 p){
  vec3 q=p-vec3(0.,.05,0.);
  float cone=sdCone(q,vec3(0.,0.,0.),vec3(0.,.55,0.),.015,.17);
  vec2 r=vec2(cone,M_WAFFLE);
  vec3 s1=q-vec3(0.,.66,0.);
  float sc1=length(s1)-.2;
  float u=atan(s1.z,s1.x);
  sc1=smin(sc1,sdTorus(s1+vec3(0.,.1,0.),vec2(.17,.045+.012*sin(u*9.))),.05);
  sc1+=.008*sin(u*11.+s1.y*30.)*smoothstep(.1,-.1,s1.y);
  r=U(r,vec2(sc1,M_SCOOP1));
  vec3 s2=q-vec3(0.,.92,0.);
  float sc2=length(s2)-.17;
  float u2=atan(s2.z,s2.x);
  sc2=smin(sc2,sdTorus(s2+vec3(0.,.08,0.),vec2(.14,.04+.01*sin(u2*7.+1.))),.05);
  sc2+=.01*(noise3(s2*28.)-.5);
  r=U(r,vec2(sc2,M_SCOOP2));
  return r;
}

vec2 strawberry(vec3 p){
  // a rounded cone: the ellipsoid narrows towards the tip
  vec3 q=p-vec3(0.,.3,0.);
  float k=mix(.5,1.,smoothstep(-.27,.1,q.y));
  float body=sdEll(vec3(q.x/k,q.y,q.z/k),vec3(.26,.28,.26))*k;
  body=smax(body,q.y-.235,.05);
  vec2 r=vec2(body,M_STRAW);
  // sepals spread over the shoulders, and the short stem
  vec3 c=p-vec3(0.,.552,0.);
  for(int i=0;i<2;i++){
    vec3 lc=polar(rotY(c,.2+float(i)*.45),6.);
    vec3 lq=lc-vec3(.11+float(i)*.012,-float(i)*.008,0.);
    lq=rotZ(lq,.26+float(i)*.1);
    float w=.05*(1.-.65*smoothstep(-.02,.13,lq.x));
    float leaf=sdEll(lq-vec3(.03,0.,0.),vec3(.13,.016,max(w,.012)));
    r=U(r,vec2(leaf,M_LEAF));
  }
  r=U(r,vec2(sdCap(p,vec3(0.,.52,0.),vec3(.03,.67,.02),.017),M_LEAF));
  return r;
}
vec2 magnet(vec3 p){
  vec3 q=rotY(p,.45);
  vec3 a=q-vec3(0.,.42,0.);
  float arch=max(sdRBox2(vec2(length(a.xy)-.22,a.z),vec2(.075,.075),.02),-a.y);
  float legs=sdRBox(vec3(abs(q.x)-.22,q.y-.21,q.z),vec3(.075,.21,.075),.02);
  float red=min(arch,legs);
  red=max(red,-(q.y-.13));
  vec2 r=vec2(red,M_MAGNET);
  float tips=max(sdRBox(vec3(abs(q.x)-.22,q.y-.21,q.z),vec3(.075,.21,.075),.02),q.y-.13);
  r=U(r,vec2(tips,M_STEEL));
  return r;
}

vec2 bell(vec3 p){
  vec2 q=vec2(length(p.xz),p.y);
  // profile: a flared skirt to a heavy lip, a rounded crown
  float y=clamp((q.y-.08)/.66,0.,1.);
  float prof=mix(.42,.16,pow(y,.6))+.02*smoothstep(.15,0.,y);
  float side=(q.x-prof)*.8;
  float d=max(side,max(.08-q.y,q.y-.74));
  d=smin(d,length(p-vec3(0.,.72,0.))-.17,.06);
  d+=.004*smoothstep(.01,0.,abs(q.y-.24))+.004*smoothstep(.01,0.,abs(q.y-.5));
  vec2 r=vec2(d,M_GOLD);
  r=U(r,vec2(length(vec2(length(p.xy-vec2(0.,.92))-.07,p.z))-.024,M_GOLD));
  r=U(r,vec2(length(p-vec3(.0,.06,.0))-.07,M_BRASS));
  return r;
}

vec3 dieQ(vec3 p){return rotX(rotY(p-vec3(0.,.3,0.),.7),.0);}
vec2 die(vec3 p){
  vec3 q=dieQ(p);
  float d=sdRBox(q,vec3(.3),.06);
  return vec2(d,M_DIE);
}

vec2 cactus(vec3 p){
  vec2 q=vec2(length(p.xz),p.y);
  float pot=sdRBox2(q-vec2(0.,.15),vec2(mix(.19,.25,clamp(q.y/.3,0.,1.)),.15),.02);
  pot=max(pot,-(sdRBox2(q-vec2(0.,.3),vec2(.22,.03),.01)));
  pot=min(pot,sdTorus(p-vec3(0.,.29,0.),vec2(.25,.035)));
  vec2 r=vec2(pot,M_TERRACOTTA);
  r=U(r,vec2(sdCyl(p-vec3(0.,.27,0.),.23,.02),M_SOIL));
  float ribs=.012*cos(atan(p.z,p.x)*10.);
  float col=sdCap(p,vec3(0.,.25,0.),vec3(0.,.95,0.),.12)+ribs;
  float arm=sdCap(p,vec3(.08,.5,0.),vec3(.25,.55,0.),.065);
  arm=smin(arm,sdCap(p,vec3(.25,.55,0.),vec3(.27,.78,0.),.065),.06);
  float arm2=sdCap(p,vec3(-.08,.62,0.),vec3(-.22,.66,.0),.055);
  arm2=smin(arm2,sdCap(p,vec3(-.22,.66,0.),vec3(-.23,.82,0.),.055),.04);
  r=U(r,vec2(smin(smin(col,arm,.05),arm2,.05),M_CACTUS));
  return r;
}

vec2 object(vec3 p){
  if(uObj==0)return basketball(p);
  if(uObj==1)return soccer(p);
  if(uObj==2)return tennis(p);
  if(uObj==3)return rubik(p);
  if(uObj==4)return donut(p);
  if(uObj==5)return watermelon(p);
  if(uObj==6)return bulbSolid(p);
  if(uObj==7)return pencil(p);
  if(uObj==8)return padlock(p);
  if(uObj==9)return hourglass(p);
  if(uObj==10)return trophy(p);
  if(uObj==11)return dallah(p);
  if(uObj==12)return dates(p);
  if(uObj==13)return mushroom(p);
  if(uObj==14)return icecream(p);
  if(uObj==15)return strawberry(p);
  if(uObj==16)return magnet(p);
  if(uObj==17)return bell(p);
  if(uObj==18)return die(p);
  return cactus(p);
}
float glassD(vec3 p){
  if(uObj==6)return bulbGlass(p);
  if(uObj==9)return hgGlass(p);
  return 1e9;
}
vec2 map(vec3 p){return object(p);}
// every object fits in this sphere; rays that miss it skip the march
const vec3 BC=vec3(0.,.55,0.);const float BR=1.3;
vec2 bound(vec3 ro,vec3 rd){vec3 oc=ro-BC;float b=dot(oc,rd);float c=dot(oc,oc)-BR*BR;float h=b*b-c;if(h<0.)return vec2(-1.);h=sqrt(h);return vec2(-b-h,-b+h);}
vec3 normalAt(vec3 p){vec2 e=vec2(.0005,-.0005);
  return normalize(e.xyy*map(p+e.xyy).x+e.yyx*map(p+e.yyx).x+e.yxy*map(p+e.yxy).x+e.xxx*map(p+e.xxx).x);}
vec3 glassNormal(vec3 p){vec2 e=vec2(.0005,-.0005);
  return normalize(e.xyy*glassD(p+e.xyy)+e.yyx*glassD(p+e.yyx)+e.yxy*glassD(p+e.yxy)+e.xxx*glassD(p+e.xxx));}
float shadow(vec3 ro,vec3 rd){
  vec2 bs=bound(ro,rd);if(bs.y<=0.)return 1.;
  float res=1.,t=max(.012,bs.x),te=bs.y;
  for(int i=0;i<64;i++){float h=map(ro+rd*t).x;res=min(res,9.*h/t);t+=clamp(h*.8,.008,.12);if(res<.002||t>te)break;}
  return clamp(res,0.,1.);}
float ao(vec3 p,vec3 n){float o=0.,s=1.;for(int i=0;i<5;i++){float h=.012+.06*float(i);float d=map(p+n*h).x;o+=(h-d)*s;s*=.82;}return clamp(1.-2.2*o,0.,1.);}
// ---------- lighting ----------
const vec3 KEY=normalize(vec3(-.55,.78,.5));
const vec3 FILL=normalize(vec3(.8,.32,.45));
const vec3 RIM=normalize(vec3(.25,.55,-.8));
vec3 env(vec3 r){
  float up=r.y;
  vec3 c=mix(vec3(.05,.055,.07),vec3(.5,.55,.64),smoothstep(-.1,.9,up));
  c+=vec3(1.,.96,.9)*6.5*pow(max(dot(r,KEY),0.),48.);
  c+=vec3(1.,.97,.93)*1.2*pow(max(dot(r,KEY),0.),6.);
  c+=vec3(.75,.85,1.)*2.6*smoothstep(.93,.985,dot(r,FILL));
  c+=vec3(1.)*1.6*pow(max(dot(r,RIM),0.),18.);
  c+=vec3(.95,.93,.9)*.9*smoothstep(.16,.0,abs(up-.08));
  c=mix(c,vec3(.035,.03,.028),smoothstep(.0,-.25,up));
  return c;
}
float D_ggx(float nh,float a){float a2=a*a;float d=nh*nh*(a2-1.)+1.;return a2/(PI*d*d);}
float G_s(float nv,float nl,float a){float k=(a+1.)*(a+1.)/8.;return (nv/(nv*(1.-k)+k))*(nl/(nl*(1.-k)+k));}
vec3 F_s(vec3 f0,float c){return f0+(1.-f0)*pow(1.-c,5.);}
vec3 light(vec3 n,vec3 v,vec3 l,vec3 col,vec3 albedo,vec3 f0,float rough,float sh){
  vec3 h=normalize(l+v);float nl=max(dot(n,l),0.),nv=max(dot(n,v),.001),nh=max(dot(n,h),0.),vh=max(dot(v,h),0.);
  float a=rough*rough;vec3 F=F_s(f0,vh);
  vec3 spec=D_ggx(nh,a)*G_s(nv,nl,a)*F/(4.*nv*max(nl,.001)+.001);
  vec3 kd=(1.-F);
  return (kd*albedo/PI*1.0+spec)*col*nl*sh*PI;
}
vec3 shadeSurface(vec3 p,vec3 n,vec3 v,vec3 albedo,float metal,float rough,float coat){
  float occ=ao(p,n);
  float sk=shadow(p+n*.003,KEY);
  vec3 f0=mix(vec3(.04),albedo,metal);
  vec3 dif=albedo*(1.-metal);
  vec3 c=vec3(0.);
  c+=light(n,v,KEY,vec3(1.,.96,.9)*2.05,dif,f0,rough,sk);
  c+=light(n,v,FILL,vec3(.7,.8,1.)*.55,dif,f0,rough,1.);
  c+=light(n,v,RIM,vec3(1.)*1.1,dif,f0,rough,1.);
  vec3 amb=mix(vec3(.16,.13,.11),vec3(.42,.46,.55),n.y*.5+.5);
  c+=dif*amb*occ*.6;
  vec3 r=reflect(-v,n);
  float nv=max(dot(n,v),0.);
  vec3 fr=F_s(f0,nv);
  float blur=rough;
  vec3 e=mix(env(r),vec3(.3,.32,.36)*(r.y*.5+.6),clamp(blur*1.6,0.,1.));
  c+=e*fr*occ*(metal>.5?1.:.8);
  if(coat>0.){float fc=.04+.96*pow(1.-nv,5.);c+=env(r)*fc*coat*occ;
    vec3 h=normalize(KEY+v);c+=vec3(1.)*pow(max(dot(n,h),0.),220.)*1.6*coat*sk;}
  return c;
}

vec3 bumpN(vec3 n,vec3 p,float freq,float amt){
  vec2 e=vec2(.002,0.);
  float b0=noise3(p*freq);
  vec3 g=vec3(noise3((p+e.xyy)*freq)-b0,noise3((p+e.yxy)*freq)-b0,noise3((p+e.yyx)*freq)-b0)/e.x;
  return normalize(n-amt*(g-n*dot(g,n))/freq);
}
// one panel colour per sticker of the cube, the centres fixed
vec3 cubeColour(int face,vec2 cell,float side){
  vec3 C[6]=vec3[6](vec3(.95),vec3(1.,.8,0.),vec3(.75,.03,.05),vec3(1.,.38,0.),vec3(0.,.16,.62),vec3(0.,.48,.16));
  if(cell.x==1.&&cell.y==1.)return C[face];
  int k=int(floor(hash2(cell+vec2(float(face)*7.3,side*3.1))*6.));
  return C[k];
}
float soccerMask(vec3 n,out float seam){
  const float PHI=1.618034;
  vec3 V[12]=vec3[12](vec3(0,1,PHI),vec3(0,-1,PHI),vec3(0,1,-PHI),vec3(0,-1,-PHI),vec3(1,PHI,0),vec3(-1,PHI,0),vec3(1,-PHI,0),vec3(-1,-PHI,0),vec3(PHI,0,1),vec3(-PHI,0,1),vec3(PHI,0,-1),vec3(-PHI,0,-1));
  float best=-2.;vec3 v=vec3(0.);
  for(int i=0;i<12;i++){vec3 c=normalize(V[i]);float d=dot(n,c);if(d>best){best=d;v=c;}}
  vec3 nb=vec3(0.);
  for(int i=0;i<12;i++){vec3 c=normalize(V[i]);float d=dot(v,c);if(d>.4&&d<.5){nb=c;break;}}
  vec3 t1=normalize(nb-v*dot(nb,v)),t2=cross(v,t1);
  float ang=atan(dot(n,t2),dot(n,t1));
  float r=acos(clamp(dot(n,v),-1.,1.));
  float seg=2.*PI/5.;
  float a=mod(ang,seg)-seg*.5;
  float ri=.2829;
  float edge=r*cos(a)-ri;
  float IP=1./PHI;
  vec3 F[20]=vec3[20](vec3(1,1,1),vec3(1,1,-1),vec3(1,-1,1),vec3(1,-1,-1),vec3(-1,1,1),vec3(-1,1,-1),vec3(-1,-1,1),vec3(-1,-1,-1),
    vec3(0,IP,PHI),vec3(0,IP,-PHI),vec3(0,-IP,PHI),vec3(0,-IP,-PHI),vec3(IP,PHI,0),vec3(IP,-PHI,0),vec3(-IP,PHI,0),vec3(-IP,-PHI,0),
    vec3(PHI,0,IP),vec3(PHI,0,-IP),vec3(-PHI,0,IP),vec3(-PHI,0,-IP));
  float d1=-2.,d2=-2.;
  for(int i=0;i<20;i++){float d=dot(n,normalize(F[i]));if(d>d1){d2=d1;d1=d;}else if(d>d2)d2=d;}
  float gap=acos(clamp(d2,-1.,1.))-acos(clamp(d1,-1.,1.));
  seam=min(smoothstep(.012,.0,abs(edge)),1.);
  seam=max(seam,smoothstep(.016,.0,gap)*step(.0,edge));
  return step(edge,0.);
}
vec3 seamCurve(float t){return vec3(.7*cos(t)+.3*cos(3.*t),.7*sin(t)-.3*sin(3.*t),.9165*sin(2.*t));}
vec3 tennisSeam(vec3 n){
  // coarse search along the seam, then a golden-section refinement
  float best=-2.,bt=0.;
  for(int i=0;i<96;i++){float t=float(i)/96.*2.*PI;float d=dot(n,seamCurve(t));if(d>best){best=d;bt=t;}}
  float a=bt-2.*PI/96.,b=bt+2.*PI/96.;
  for(int i=0;i<14;i++){float m1=b-(b-a)*.618,m2=a+(b-a)*.618;if(dot(n,seamCurve(m1))>dot(n,seamCurve(m2)))b=m2;else a=m1;}
  best=dot(n,seamCurve((a+b)*.5));
  float d=acos(clamp(best,-1.,1.));
  return vec3(d);
}
vec3 shade(vec3 p,vec3 n,vec3 v,float m){
  if(m<1.5){
    vec3 c0=p-vec3(0.,.5,0.);vec3 q=rotX(rotY(normalize(c0),.7),.45);
    float s=min(min(abs(q.x),abs(q.y)),abs(abs(q.z)-.72));
    float seam=smoothstep(.022,.014,s);
    vec3 nn=bumpN(n,p,170.,.35);
    nn=normalize(mix(nn,n,seam));
    vec3 alb=mix(vec3(.78,.27,.06)*(.85+.3*noise3(p*14.)),vec3(.02),seam);
    return shadeSurface(p,nn,v,alb,0.,mix(.62,.5,seam),.1);
  }
  if(m<2.5){
    vec3 q=rotY(rotX(normalize(p-vec3(0.,.5,0.)),.35),.5);
    float seam;float black=soccerMask(q,seam);
    vec3 alb=mix(vec3(.9,.9,.88),vec3(.02,.02,.025),black);
    alb=mix(alb,vec3(.2),seam*.85);
    return shadeSurface(p,n,v,alb,0.,.42,.22);
  }
  if(m<3.5){
    vec3 q=rotY(rotX(normalize(p-vec3(0.,.42,0.)),.9),.4);
    float d=tennisSeam(q).x;
    float seam=smoothstep(.03,.022,d);
    vec3 nn=bumpN(n,p,320.,.8);
    nn=normalize(mix(nn,n,seam*.9));
    vec3 alb=mix(vec3(.66,.86,.06)*(.9+.2*noise3(p*40.)),vec3(.95,.95,.9),seam);
    vec3 c=shadeSurface(p,nn,v,alb,0.,.95,0.);
    c+=alb*pow(1.-max(dot(n,v),0.),2.5)*.5*(1.-seam);
    return c;
  }
  if(m<4.5){
    vec3 q=rotY(p-vec3(0.,.45,0.),.62);
    vec3 a=abs(q);int face;vec2 uv;float side;
    if(a.x>a.y&&a.x>a.z){face=q.x>0.?2:3;uv=q.zy;side=sign(q.x);}else if(a.y>a.z){face=q.y>0.?0:1;uv=q.xz;side=sign(q.y);}else{face=q.z>0.?4:5;uv=q.xy;side=sign(q.z);}
    vec2 g=(uv+.45)/.3;vec2 cell=clamp(floor(g),0.,2.);vec2 f=fract(g)-.5;
    float st=sdRBox2(f,vec2(.42),.09);
    if(st<0.){vec3 col=cubeColour(face,cell,side);return shadeSurface(p,n,v,col,0.,.22,.45);}
    return shadeSurface(p,n,v,vec3(.015),0.,.4,.3);
  }
  if(m<5.5){vec3 alb=vec3(.74,.43,.17)*(.8+.35*noise3(p*30.));alb=mix(alb,vec3(.95,.82,.6),smoothstep(.0,.08,-(p.y-.08))*.5);return shadeSurface(p,bumpN(n,p,90.,.25),v,alb,0.,.75,0.);}
  if(m<6.5)return shadeSurface(p,n,v,vec3(.93,.42,.6),0.,.14,1.1);
  if(m<7.95){float k=fract((m-7.)*1.11);vec3 c=k<.2?vec3(.95,.85,.1):k<.4?vec3(.1,.55,.95):k<.6?vec3(.98,.98,.95):k<.8?vec3(.2,.75,.3):vec3(.6,.25,.85);return shadeSurface(p,n,v,c,0.,.25,.8);}
  if(m<8.5){
    vec3 q=p-vec3(0.,.64,0.);float r=length(q.xy);float R=.62;
    bool face=abs(q.z)>.078&&abs(n.z)>.6;
    if(!face||r>R-.03){
      float stripe=.5+.5*sin(atan(q.y,q.x)*22.+sin(q.z*40.)*1.5);
      vec3 rind=mix(vec3(.05,.22,.06),vec3(.25,.5,.15),stripe*.8);
      if(face)rind=mix(vec3(.75,.85,.55),vec3(.07,.3,.08),smoothstep(R-.035,R-.012,r));
      return shadeSurface(p,n,v,rind,0.,.35,.6);
    }
    if(r>R-.075){vec3 c=mix(vec3(.93,.95,.78),vec3(.95,.45,.4),smoothstep(R-.06,R-.075,r));return shadeSurface(p,n,v,c,0.,.4,.3);}
    // seeds: two arcs of teardrops on the cut faces
    vec2 sp=q.xy;float best=1e9;
    for(int i=0;i<14;i++){float fi=float(i);float arc=i<8?.38:.22;float a=PI+(fi<8.?(fi+.5)/8.:(fi-7.5)/6.)*PI;
      if(i>=8)a=PI+((fi-8.)+.5)/6.*PI;
      vec2 c=vec2(cos(a),sin(a))*arc;vec2 d=sp-c;float rot=a+PI*.5;d=vec2(cos(rot)*d.x+sin(rot)*d.y,-sin(rot)*d.x+cos(rot)*d.y);
      best=min(best,length(d/vec2(.016,.028))-1.);}
    vec3 flesh=mix(vec3(.95,.2,.25),vec3(.82,.05,.12),smoothstep(.0,.5,r))*(.85+.3*noise3(p*60.));
    if(best<0.)return shadeSurface(p,n,v,vec3(.02,.015,.01),0.,.15,1.);
    vec3 c=shadeSurface(p,bumpN(n,p,120.,.3),v,flesh,0.,.3,.9);
    return c;
  }
  if(m<9.5)return shadeSurface(p,n,v,vec3(.8,.82,.85),1.,.28,0.);
  if(m<10.5)return shadeSurface(p,n,v,vec3(.02),0.,.1,1.);
  if(m<11.5)return shadeSurface(p,n,v,vec3(.92,.7,.36),1.,.22,0.);
  if(m<12.5)return vec3(1.,.75,.35)*6.;
  if(m<13.5){vec3 q=rotY(p,.55);float a=atan(q.z,q.y-.072);float edge=.3+.022*cos(a*6.)-.012;
    if(q.x>edge)return shadeSurface(p,n,v,vec3(.85,.62,.38)*(.85+.3*noise3(vec3(q.x*8.,q.y*60.,q.z*60.))),0.,.75,0.);
    return shadeSurface(p,n,v,uTint,0.,.22,1.);}
  if(m<14.5)return shadeSurface(p,n,v,vec3(.85,.62,.38)*(.8+.35*noise3(vec3(p.x*120.,p.y*20.,p.z*120.))),0.,.75,0.);
  if(m<15.5)return shadeSurface(p,n,v,vec3(.1,.1,.11),.4,.35,0.);
  if(m<16.5)return shadeSurface(p,n,v,vec3(.95,.5,.52),0.,.8,0.);
  if(m<17.5)return shadeSurface(p,n,v,vec3(.75,.77,.8),1.,.2,0.);
  if(m<18.5)return shadeSurface(p,n,v,vec3(1.,.76,.3),1.,.16,0.);
  if(m<19.5){vec3 alb=vec3(.9,.72,.45)*(.75+.5*hash2(floor(p.xz*400.)+floor(p.y*400.)));return shadeSurface(p,bumpN(n,p,400.,.6),v,alb,0.,.9,0.);}
  if(m<20.5){vec3 alb=vec3(.36,.19,.08)*(.75+.4*noise3(vec3(p.x*6.,p.y*80.,p.z*6.)));return shadeSurface(p,n,v,alb,0.,.3,.8);}
  if(m<21.5){float wr=noise3(vec3(p.x*30.,p.y*90.,p.z*30.));vec3 alb=mix(vec3(.1,.03,.01),vec3(.3,.12,.035),noise3(p*16.))*(.7+.5*wr);return shadeSurface(p,bumpN(bumpN(n,p,70.,.55),p,190.,.25),v,alb,0.,.38,.55);}
  if(m<22.5)return shadeSurface(p,n,v,vec3(.93,.93,.9),0.,.2,1.);
  if(m<23.5)return shadeSurface(p,bumpN(n,p,40.,.1),v,vec3(.82,.06,.04),0.,.25,.9);
  if(m<24.5)return shadeSurface(p,n,v,vec3(.95,.92,.84),0.,.6,0.);
  if(m<25.5){float a=atan(p.z,p.x);float g=.5+.5*sin(a*90.);return shadeSurface(p,n,v,mix(vec3(.85,.78,.62),vec3(.6,.5,.38),g),0.,.7,0.);}
  if(m<26.5){vec3 q=p-vec3(0.,.05,0.);float a=atan(q.z,q.x);float gx=abs(fract((a*3.+q.y*14.))-.5),gy=abs(fract((a*3.-q.y*14.))-.5);
    float grid=smoothstep(.06,.02,min(gx,gy));vec3 alb=mix(vec3(.86,.6,.3),vec3(.6,.34,.12),grid);return shadeSurface(p,bumpN(n,p,50.,.2),v,alb,0.,.7,0.);}
  if(m<27.5)return shadeSurface(p,bumpN(n,p,60.,.15),v,vec3(.97,.58,.68),0.,.45,.2);
  if(m<28.5){float chip=step(.72,noise3(p*38.));vec3 alb=mix(vec3(.62,.9,.74),vec3(.2,.1,.05),chip);return shadeSurface(p,bumpN(n,p,60.,.15),v,alb,0.,.45,.2);}
  if(m<29.5){
    vec3 q=p-vec3(0.,.02,0.);float a=atan(q.z,q.x);vec2 g=vec2(a*7./PI,q.y*26.);g.x+=.5*floor(g.y);vec2 f=fract(g)-.5;
    float seed=length(f*vec2(1.,1.4))-.17;
    vec3 alb=vec3(.85,.04,.08);
    if(seed<0.){alb=mix(vec3(1.,.85,.35),vec3(.5,.02,.05),smoothstep(-.1,0.,seed)*.3);}
    vec3 nn=seed<.05?normalize(n+vec3(f.x,0.,f.y)*.3):n;
    return shadeSurface(p,nn,v,alb,0.,.2,1.1);
  }
  if(m<30.5)return shadeSurface(p,n,v,vec3(.08,.38,.06),0.,.45,.3);
  if(m<31.5)return shadeSurface(p,n,v,vec3(.8,.05,.06),0.,.2,1.);
  if(m<32.5)return shadeSurface(p,n,v,vec3(.02),0.,.25,.8);
  if(m<33.5){
    vec3 q=dieQ(p);vec3 a=abs(q);vec2 uv;float val;
    if(a.x>a.y&&a.x>a.z){uv=q.zy;val=q.x>0.?3.:4.;}else if(a.y>a.z){uv=q.xz;val=q.y>0.?1.:6.;}else{uv=q.xy;val=q.z>0.?2.:5.;}
    float pip=1e9;float s=.15;
    if(val==1.||val==3.||val==5.)pip=min(pip,length(uv));
    if(val>1.){pip=min(pip,length(uv-vec2(s,s)));pip=min(pip,length(uv+vec2(s,s)));}
    if(val>3.){pip=min(pip,length(uv-vec2(s,-s)));pip=min(pip,length(uv+vec2(s,-s)));}
    if(val==6.){pip=min(pip,length(uv-vec2(s,0.)));pip=min(pip,length(uv+vec2(s,0.)));}
    if(pip<.055)return shadeSurface(p,n,v,val==1.?vec3(.7,.02,.04):vec3(.02),0.,.2,1.);
    return shadeSurface(p,n,v,vec3(.95,.94,.9),0.,.2,1.);
  }
  if(m<35.5)return shadeSurface(p,bumpN(n,p,80.,.2),v,vec3(.72,.33,.18)*(.85+.3*noise3(p*20.)),0.,.8,0.);
  if(m<36.5)return shadeSurface(p,bumpN(n,p,200.,.6),v,vec3(.16,.1,.06),0.,.95,0.);
  if(m<37.5){float a=atan(p.z,p.x);float crest=smoothstep(.85,1.,cos(a*10.));vec2 g=vec2(a*10./(2.*PI),p.y*18.);float sp=step(length(fract(g)-.5),.12)*crest;
    vec3 alb=mix(vec3(.16,.45,.18),vec3(.95,.93,.8),sp);return shadeSurface(p,n,v,alb,0.,.5,.4);}
  return vec3(.005);
}
vec3 aces(vec3 x){const float a=2.51,b=.03,c=2.43,d=.59,e=.14;return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.,1.);}

vec3 backdrop(vec3 ro,vec3 rd){
  // a seamless studio sweep: the floor fades into the wall colour
  vec3 wall=mix(uBg*.55,uBg*1.08,smoothstep(-.15,.55,rd.y));
  if(rd.y<0.&&uFloorOn==1){
    float t=-ro.y/rd.y;vec3 g=ro+rd*t;
    float dist=length(g.xz-uTarget.xz);
    float sh=shadow(g+vec3(0.,.002,0.),KEY);
    float occ=1.;
    for(int i=0;i<4;i++){float h=.03+.08*float(i);occ-=(h-map(g+vec3(0.,h,0.)).x)*.6/float(i+1);}
    occ=clamp(occ,0.,1.);
    vec3 c=uFloor*(.45+.75*sh)*(.35+.65*occ);
    return mix(c,wall,smoothstep(1.6,6.,dist));
  }
  return wall;
}

void main(){
  vec3 ta=uTarget;
  vec3 ro=ta+uDist*vec3(cos(uElev)*sin(uYaw),sin(uElev),cos(uElev)*cos(uYaw));
  vec3 ww=normalize(ta-ro),uu=normalize(cross(ww,vec3(0.,1.,0.))),vv=cross(uu,ww);
  vec2 pp=(2.*gl_FragCoord.xy-uRes)/uRes.y;
  float f=1./tan(uFov*.5);
  vec3 rd=normalize(pp.x*uu+pp.y*vv+f*ww);
  vec2 bs=bound(ro,rd);
  float t=max(bs.x,0.),tmax=bs.y;
  vec2 h=vec2(1e9,0.);bool hit=false,glass=false;float tg=0.;
  for(int i=0;i<360;i++){
    if(bs.y<=0.)break;
    vec3 p=ro+rd*t;
    vec2 s=map(p);
    float g=glass?1e9:glassD(p);
    float d=min(s.x,g);
    if(d<.0003+.0003*t){
      if(g<s.x){glass=true;tg=t;t+=.01;continue;}
      h=s;hit=true;break;
    }
    t+=d*.8;
    if(t>tmax)break;
  }
  vec3 col;
  vec3 v=-rd;
  if(hit){
    vec3 p=ro+rd*t;vec3 n=normalAt(p);
    col=shade(p,n,v,h.y);
  }else col=backdrop(ro,rd);
  if(glass){
    vec3 p=ro+rd*tg;vec3 n=glassNormal(p);
    float nv=max(dot(n,v),0.);float fr=.04+.96*pow(1.-nv,5.);
    vec3 refl=env(reflect(-v,n));
    vec3 hl=vec3(1.)*pow(max(dot(n,normalize(KEY+v)),0.),300.)*5.;
    col=col*vec3(.94,.97,1.)*(1.-fr*.8)+refl*fr*.9+hl;
  }
  if(uObj==6){
    // the filament's warm halo inside the bulb
    vec3 c0=vec3(0.,.665,0.);vec3 oc=ro-c0;float b=dot(oc,rd);vec3 cl=oc-rd*b;float dd=length(cl);
    col+=vec3(1.,.7,.35)*.12/(.02+dd*dd*60.);
  }
  col=aces(col*.85);
  col=pow(col,vec3(1./2.2));
  // a gentle vignette like a lens
  vec2 uv=gl_FragCoord.xy/uRes;col*=.88+.12*smoothstep(.95,.2,length(uv-.5));
  outColor=vec4(col,1.);
}`;
