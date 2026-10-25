// Offline studio renderer for the hero characters (32.0.0): helmets and masks
// on a short bust and a round plinth, as signed distance fields ray marched
// in a fragment shader with the same studio lighting as the 3D stones.
window.HEROES_FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform int uHero;
uniform vec3 uColor;    // accent: plume, livery, cloth
uniform vec3 uGlow;     // eyes and neon
uniform vec3 uGlow2;    // second neon
uniform float uElev;
uniform float uYaw;
uniform vec4 uFrame;    // xmin xmax ymin ymax
uniform float uShadow;
uniform int uBase;      // 1: draw the plinth
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
float sdRCyl(vec3 p,float r,float h,float rr){vec2 d=vec2(length(p.xz)-r+rr,abs(p.y)-h+rr);return min(max(d.x,d.y),0.)+length(max(d,0.))-rr;}
float sdCone(vec3 p,vec3 a,vec3 b,float ra,float rb){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-mix(ra,rb,h);}

// materials
#define M_STEEL 1.
#define M_GOLD 2.
#define M_BRONZE 3.
#define M_BRASS 4.
#define M_WHITE 5.
#define M_LACQUER 6.
#define M_RED 7.
#define M_FABRIC 8.
#define M_SHEMAGH 9.
#define M_PLUME 10.
#define M_MIRROR 11.
#define M_GLOW 12.
#define M_GLASS 13.
#define M_VOID 14.
#define M_IVORY 15.
#define M_LEATHER 16.
#define M_PAINT 17.
#define M_PLINTH 18.
#define M_FUR 19.
#define M_ROBE 20.
#define M_GLOW2 21.
#define M_DARK 22.
#define M_VISOR 23.
#define M_GRAY 24.
#define M_BISHT 25.
#define M_BEARD 26.
#define M_LAME 27.
#define M_HILT 28.
#define M_DARKLEATHER 29.

vec2 U(vec2 a,vec2 b){return a.x<b.x?a:b;}
// cut b out of a; the walls of the cut take material m
vec2 carve(vec2 a,float b,float m){float d=max(a.x,-b);return vec2(d,-b>a.x?m:a.y);}
vec2 paint(vec2 a,float region,float m){return vec2(a.x,region<0.?m:a.y);}
float sdSeg2(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h);}

vec2 plinth(vec3 p){
  vec2 q=vec2(length(p.xz),p.y);
  float d=sdRBox2(q-vec2(0.,.07),vec2(.5,.07),.05);
  d=smin(d,sdRBox2(q-vec2(0.,.17),vec2(.41,.05),.035),.03);
  vec2 r=vec2(d,M_PLINTH);
  r=U(r,vec2(sdTorus(p-vec3(0.,.08,0.),vec2(.49,.022)),M_GOLD));
  r=U(r,vec2(sdTorus(p-vec3(0.,.205,0.),vec2(.375,.016)),M_GOLD));
  return r;
}
// chest and sloping shoulders, cut flat where the bust meets the plinth
float torsoD(vec3 p,float w){
  float chest=sdRBox(p-vec3(0.,.35,0.),vec3(w*.8,.14,.19),.11);
  float sh=min(sdCap(p,vec3(0.,.5,0.),vec3(w-.12,.43,0.),.12),sdCap(p,vec3(0.,.5,0.),vec3(-(w-.12),.43,0.),.12));
  float d=smin(chest,sh,.07);
  return smax(d,-(p.y-.2),.02);
}
vec2 torso(vec3 p,float w,float m){return vec2(torsoD(p,w),m);}
float neckCol(vec3 p,float r){return sdCyl(p-vec3(0.,.6,0.),r,.12);}
vec2 eyes(vec3 q,vec3 at,float r){
  vec3 e=q;e.x=abs(e.x);
  return vec2(sdEll(e-at,vec3(r*1.35,r*.7,r)),M_GLOW);
}

// ---------- heroes ----------
vec2 knight(vec3 p){
  vec3 q=p-vec3(0.,.93,0.);
  float body=sdRCyl(q,.3,.3,.07);
  float dome=length((q-vec3(0.,.17,0.))*vec3(1.,1.3,1.))-.3;
  float shell=smin(body,dome,.1);
  shell-=.025*smoothstep(.0,.3,q.z)*(1.-smoothstep(0.,.14,abs(q.x)));
  vec2 r=vec2(shell,M_STEEL);
  float slit=max(sdBox(q-vec3(0.,.03,.3),vec3(.19,.022,.1)),-sdBox(q-vec3(0.,.03,.3),vec3(.022,.03,.12)));
  r=carve(r,slit,M_VOID);
  vec2 hp=q.xy-vec2(.09,-.12);vec2 cell=clamp(floor(hp/.045+.5),vec2(0.,-2.),vec2(2.,0.));
  float holes=max(length(hp-cell*.045)-.012,.2-q.z);
  r=carve(r,holes,M_VOID);
  r=U(r,eyes(q,vec3(.085,.03,.255),.022));
  r=U(r,vec2(max(shell-.014,abs(q.y-.1)-.024),M_GOLD));
  r=U(r,vec2(max(shell-.014,max(abs(q.x)-.022,max(-q.z,abs(q.y-.0)-.3))),M_GOLD));
  vec3 k=polar(q,20.);
  r=U(r,vec2(length(k-vec3(.302,-.24,0.))-.016,M_GOLD));
  vec3 pl=q-vec3(0.,.43,-.04);
  float plume=sdEll(pl,vec3(.055,.13,.27));
  plume+=.012*sin(pl.z*95.+sin(pl.y*40.)*2.)*smoothstep(-.1,.1,pl.y);
  r=U(r,vec2(plume,M_PLUME));
  r=U(r,vec2(sdRBox(q-vec3(0.,.33,-.04),vec3(.03,.04,.12),.02),M_GOLD));
  vec2 b=torso(p,.34,M_STEEL);
  // the gorget joins helmet and breastplate
  b=U(b,vec2(sdCone(p,vec3(0.,.5,0.),vec3(0.,.66,0.),.25,.22),M_STEEL));
  b=U(b,vec2(sdTorus(p-vec3(0.,.555,0.),vec2(.255,.018)),M_GOLD));
  b=U(b,vec2(max(abs(p.x)-.02,torsoD(p,.34)-.012),M_GOLD));
  return U(r,b);
}
vec2 samurai(vec3 p){
  vec3 q=p-vec3(0.,.95,0.);
  vec3 b=q-vec3(0.,.08,0.);
  float bowl=sdEll(b,vec3(.31,.25,.33));
  float ang=atan(b.z,b.x);
  bowl-=.006*smoothstep(-.2,.9,sin(ang*30.))*smoothstep(-.02,.1,b.y);
  bowl=max(bowl,-(b.y+.03));
  vec2 r=vec2(bowl,M_LACQUER);
  vec3 kk=polar(b,30.);
  r=U(r,vec2(length(kk-vec3(.27,.12,0.))-.011,M_GOLD));
  r=U(r,vec2(sdTorus(b-vec3(0.,-.01,0.),vec2(.31,.022)),M_GOLD));
  r=U(r,vec2(sdCyl(b-vec3(0.,.25,0.),.05,.018),M_GOLD));
  // shikoro: a flared lamellar neck guard, open at the face
  vec2 rq=vec2(length(q.xz),q.y);
  float sk=sdSeg2(rq,vec2(.3,.05),vec2(.45,-.2))-.02;
  sk=max(sk,q.z-.03);
  r=U(r,vec2(sk,M_LAME));
  // fukigaeshi: the turned-back wings beside the face
  vec3 f=vec3(abs(q.x),q.y,q.z)-vec3(.31,.0,.1);f.xz*=rot(-.6);
  r=U(r,vec2(sdRBox(f,vec3(.012,.07,.07),.008),M_LACQUER));
  r=U(r,vec2(max(sdRBox(f,vec3(.016,.075,.075),.008),-sdRBox(f,vec3(.03,.06,.06),.006)),M_GOLD));
  // kuwagata: tall gold horns in a U above the brow
  vec3 m=q-vec3(0.,.1,.31);m.yz*=rot(.18);
  float moon=max(length(m.xy-vec2(0.,.37))-.37,-(length(m.xy-vec2(0.,.45))-.37));
  moon=max(moon,abs(m.z)-.011);
  r=U(r,vec2(moon-.002,M_GOLD));
  r=U(r,vec2(sdEll(q-vec3(0.,.09,.29),vec3(.06,.055,.03)),M_GOLD));
  float face=sdEll(q-vec3(0.,-.1,.03),vec3(.22,.22,.24));
  r=U(r,vec2(face,M_VOID));
  r=U(r,eyes(q,vec3(.075,-.06,.245),.02));
  vec3 mq=q-vec3(0.,-.2,.08);
  float men=sdEll(mq,vec3(.2,.13,.2));
  men=max(men,mq.y-.03);
  men=smin(men,sdCap(q,vec3(0.,-.11,.24),vec3(0.,-.15,.27),.024),.02);
  men=max(men,-sdBox(mq-vec3(0.,-.05,.2),vec3(.07,.006,.05)));
  r=U(r,vec2(men,M_LACQUER));
  vec3 ms=vec3(abs(q.x),q.y,q.z)-vec3(.055,-.17,.26);ms.xy*=rot(.35);
  r=U(r,vec2(sdEll(ms,vec3(.06,.014,.02)),M_GOLD));
  vec2 t=torso(p,.33,M_LACQUER);
  t=U(t,vec2(neckCol(p,.2),M_LAME));
  // sode: lamellar shoulder plates hanging off each shoulder
  vec3 s=vec3(abs(p.x),p.y,p.z)-vec3(.315,.45,0.);s.xy*=rot(.32);
  float sode=sdRBox(s,vec3(.03,.13,.16),.02);
  t=U(t,vec2(sode,M_LAME));
  t=U(t,vec2(max(sdRBox(s,vec3(.035,.135,.165),.02),-sdRBox(s,vec3(.06,.12,.15),.02)),M_GOLD));
  return U(r,t);
}
vec2 astronaut(vec3 p){
  vec3 q=p-vec3(0.,.96,0.);
  float shell=length(q)-.36;
  vec3 n=normalize(q);
  float front=dot(n,normalize(vec3(0.,.04,1.)));
  vec2 r=vec2(shell,front>.42?M_MIRROR:M_WHITE);
  vec3 v=q;v.yz*=rot(-.04);
  r=U(r,vec2(length(vec2(length(v.xy)-.33,v.z-.15))-.026,M_GRAY));
  vec3 e=vec3(abs(q.x),q.y,q.z)-vec3(.35,.0,-.02);
  r=U(r,vec2(sdCyl(e.yxz,.075,.04),M_GRAY));
  r=U(r,vec2(length(e-vec3(.04,.0,0.))-.025,M_GLOW));
  r=U(r,vec2(sdBox(q-vec3(0.,.33,-.05),vec3(.04,.025,.08))-.01,M_GRAY));
  r=U(r,vec2(sdTorus(p-vec3(0.,.62,0.),vec2(.26,.035)),M_GRAY));
  vec2 t=torso(p,.36,M_WHITE);
  t=U(t,vec2(sdRBox(p-vec3(0.,.4,.27),vec3(.11,.07,.03),.02),M_GRAY));
  t=U(t,vec2(length(p-vec3(-.05,.42,.305))-.017,M_GLOW));
  t=U(t,vec2(length(p-vec3(.0,.42,.305))-.017,M_GLOW2));
  t=U(t,vec2(length(p-vec3(.05,.42,.305))-.017,M_GLOW));
  t=U(t,vec2(sdRBox(p-vec3(.2,.5,.22),vec3(.06,.035,.02),.01),M_PAINT));
  return U(r,t);
}
vec2 robot(vec3 p){
  vec3 q=p-vec3(0.,.95,0.);
  float h=sdRBox(q,vec3(.28,.28,.27),.13);
  vec2 r=vec2(h,M_DARK);
  float groove=max(abs(q.y-.03)-.05,.17-q.z);
  r=carve(r,groove,M_VOID);
  float vis=max(sdRBox(q-vec3(0.,.03,0.),vec3(.255,.04,.245),.12),.17-q.z);
  r=U(r,vec2(vis+.003,M_GLOW));
  vec3 e=vec3(abs(q.x),q.y,q.z)-vec3(.29,0.,0.);
  r=U(r,vec2(sdCyl(e.yxz,.1,.04),M_GRAY));
  r=U(r,vec2(sdTorus(e.yxz-vec3(0.,.035,0.),vec2(.075,.012)),M_GLOW));
  r=U(r,vec2(sdCap(q,vec3(.12,.27,-.05),vec3(.16,.47,-.08),.012),M_GRAY));
  r=U(r,vec2(length(q-vec3(.16,.48,-.08))-.035,M_GLOW2));
  for(int i=0;i<3;i++){float fi=float(i);r=carve(r,max(sdBox(q-vec3(0.,-.16-fi*.04,.27),vec3(.1-fi*.02,.008,.05)),.2-q.z),M_VOID);}
  vec2 t=torso(p,.34,M_DARK);
  for(int i=0;i<3;i++)t=U(t,vec2(sdTorus(p-vec3(0.,.58+float(i)*.055,0.),vec2(.15,.028)),M_GRAY));
  t=U(t,vec2(sdRBox(p-vec3(0.,.4,.27),vec3(.13,.05,.02),.02),M_GLOW));
  vec3 bolt=vec3(abs(p.x),p.y,p.z)-vec3(.24,.5,.13);
  t=U(t,vec2(length(bolt)-.03,M_GRAY));
  return U(r,t);
}
vec2 ninja(vec3 p){
  vec3 q=p-vec3(0.,.96,0.);
  float h=sdEll(q,vec3(.29,.31,.3));
  h+=.005*sin(q.y*70.+q.x*10.)*smoothstep(.05,.3,length(q.xz));
  vec2 r=vec2(h,M_FABRIC);
  float slit=max(abs(q.y-.02+q.x*q.x*.4)-.036,.12-q.z);
  r=carve(r,slit,M_VOID);
  r=U(r,eyes(q,vec3(.08,.02,.25),.022));
  float band=max(abs(q.y-.13)-.034,h-.012);
  r=U(r,vec2(band,M_PAINT));
  vec3 pl=q-vec3(0.,.13,.268);
  r=U(r,vec2(sdRBox(pl,vec3(.1,.03,.018),.01),M_STEEL));
  vec3 t1=q-vec3(0.,.13,-.29);
  r=U(r,vec2(length(t1)-.045,M_PAINT));
  r=U(r,vec2(sdCap(q,vec3(.02,.12,-.31),vec3(.13,-.12,-.36),.022),M_PAINT));
  r=U(r,vec2(sdCap(q,vec3(-.02,.12,-.31),vec3(-.07,-.16,-.33),.022),M_PAINT));
  // the katana rides over the right shoulder
  vec3 a=vec3(.17,.52,-.2),b=vec3(.33,1.04,-.27);
  r=U(r,vec2(sdCap(p,a,b,.03),M_HILT));
  vec3 d=normalize(b-a);vec3 rr=p-(a+d*.05);float hh=dot(rr,d);
  r=U(r,vec2(max(length(rr-d*hh)-.075,abs(hh)-.011)-.004,M_GOLD));
  r=U(r,vec2(length(p-b)-.04,M_GOLD));
  float td=torsoD(p,.32);
  vec2 t=vec2(td,M_FABRIC);
  t=U(t,vec2(neckCol(p,.19),M_FABRIC));
  t=U(t,vec2(sdTorus(p-vec3(0.,.62,0.),vec2(.185,.022)),M_PAINT));
  float strap=max(abs(dot(p-vec3(0.,.4,0.),normalize(vec3(1.,-1.1,0.))))-.03,td-.014);
  t=U(t,vec2(strap,M_PAINT));
  return U(r,t);
}
vec2 viking(vec3 p){
  vec3 q=p-vec3(0.,.95,0.);
  float dome=sdEll(q-vec3(0.,.06,0.),vec3(.31,.3,.32));
  dome=max(dome,-(q.y+.02));
  vec2 r=vec2(dome,M_STEEL);
  r=U(r,vec2(max(dome-.012,abs(q.y+.0)-.035),M_BRONZE));
  r=U(r,vec2(max(dome-.012,abs(q.x)-.025),M_BRONZE));
  r=U(r,vec2(max(dome-.012,abs(q.z)-.025),M_BRONZE));
  vec3 kk=polar(q,16.);
  r=U(r,vec2(length(kk-vec3(.315,-.0,0.))-.015,M_GOLD));
  float face=sdEll(q-vec3(0.,-.12,.03),vec3(.21,.22,.24));
  r=U(r,vec2(face,M_VOID));
  r=U(r,eyes(q,vec3(.08,-.07,.24),.021));
  vec3 g=vec3(abs(q.x),q.y,q.z)-vec3(.085,-.075,.25);
  r=U(r,vec2(sdTorus(g.xzy,vec2(.06,.014)),M_BRONZE));
  r=U(r,vec2(sdRBox(q-vec3(0.,-.1,.28),vec3(.022,.1,.018),.01),M_BRONZE));
  vec3 hq=vec3(abs(q.x),q.y,q.z);
  float horn=sdCone(hq,vec3(.27,.06,0.),vec3(.42,.16,-.02),.07,.05);
  horn=smin(horn,sdCone(hq,vec3(.42,.16,-.02),vec3(.5,.34,-.06),.05,.032),.02);
  horn=smin(horn,sdCone(hq,vec3(.5,.34,-.06),vec3(.47,.5,-.08),.032,.006),.02);
  r=U(r,vec2(horn,M_IVORY));
  // a braided beard below the mask
  vec3 bq=q-vec3(0.,-.27,.15);
  float beard=sdEll(bq,vec3(.17,.17,.13));
  beard=smin(beard,sdCap(q,vec3(-.05,-.36,.2),vec3(-.06,-.52,.22),.035),.04);
  beard=smin(beard,sdCap(q,vec3(.05,-.36,.2),vec3(.06,-.52,.22),.035),.04);
  beard+=.012*(fbm(q*vec3(30.,9.,30.))-.5);
  r=U(r,vec2(beard,M_BEARD));
  r=U(r,vec2(sdTorus((vec3(abs(q.x),q.y,q.z)-vec3(.058,-.47,.215)),vec2(.035,.012)),M_GOLD));
  vec2 t=torso(p,.34,M_LEATHER);
  float fur=sdTorus(p-vec3(0.,.56,0.),vec2(.23,.09));
  fur+=.02*(fbm(p*22.)-.5);
  t=U(t,vec2(fur,M_FUR));
  return U(r,t);
}
vec2 desert(vec3 p){
  vec3 q=p-vec3(0.,.96,0.);
  float h=sdEll(q,vec3(.3,.33,.31));
  h+=.006*sin(q.y*55.-q.x*14.+q.z*6.)*smoothstep(.05,.3,length(q.xz));
  float drape=sdCone(p,vec3(0.,.92,-.03),vec3(0.,.6,-.06),.28,.35);
  drape=max(drape,-(p.y-.57));
  drape+=.008*sin(atan(p.z,p.x)*14.)*smoothstep(.85,.6,p.y);
  h=smin(h,drape,.08);
  vec2 r=vec2(h,M_SHEMAGH);
  float slit=max(abs(q.y+q.x*q.x*.35)-.034,.14-q.z);
  r=carve(r,slit,M_VOID);
  r=U(r,eyes(q,vec3(.08,.0,.25),.022));
  vec3 ig=q-vec3(0.,.15,-.01);ig.yz*=rot(.12);
  r=U(r,vec2(sdTorus(ig,vec2(.272,.029)),M_LACQUER));
  r=U(r,vec2(sdTorus(ig-vec3(0.,.05,0.),vec2(.247,.027)),M_LACQUER));
  float td=torsoD(p,.35);
  vec2 t=vec2(td,M_BISHT);
  float trim=max(abs(abs(p.x)-.075)-.016,td-.012);
  trim=max(trim,-p.z);
  t=U(t,vec2(trim,M_GOLD));
  return U(r,t);
}
vec2 diver(vec3 p){
  vec3 q=p-vec3(0.,.97,0.);
  float shell=length(q*vec3(1.,.97,1.))-.35;
  vec2 r=vec2(shell,M_BRASS);
  vec3 w=q-vec3(0.,.0,.3);
  float win=length(w.xy)-.13;
  r=carve(r,max(win,-w.z-.08),M_DARK);
  r=U(r,vec2(max(length(w.xy)-.13,abs(w.z+.02)-.01),M_GLASS));
  r=U(r,vec2(sdTorus(w.xzy,vec2(.14,.03)),M_BRASS));
  for(int i=-1;i<=1;i++)r=U(r,vec2(sdRBox(w-vec3(float(i)*.06,0.,.02),vec3(.008,.13,.012),.004),M_BRASS));
  r=U(r,eyes(q,vec3(.055,.02,.24),.018));
  vec3 s=vec3(abs(q.x),q.y,q.z)-vec3(.3,.02,-.02);s.xz=s.zx;
  r=carve(r,max(length(s.xy)-.075,-(s.z)-.07),M_DARK);
  r=U(r,vec2(sdTorus(s.xzy,vec2(.08,.022)),M_BRASS));
  r=U(r,vec2(max(length(s.xy)-.075,abs(s.z+.01)-.008),M_GLASS));
  r=U(r,vec2(sdTorus((q-vec3(0.,.33,0.)),vec2(.07,.02)),M_BRASS));
  vec2 t=torso(p,.37,M_BRASS);
  t=U(t,vec2(sdTorus(p-vec3(0.,.62,0.),vec2(.27,.04)),M_BRASS));
  vec3 kk=polar(p-vec3(0.,.62,0.),12.);
  t=U(t,vec2(length(kk-vec3(.27,.03,0.))-.022,M_STEEL));
  vec3 bolt=vec3(abs(p.x),p.y,p.z)-vec3(.17,.42,.27);
  t=U(t,vec2(length(bolt)-.026,M_STEEL));
  return U(r,t);
}
vec2 racer(vec3 p){
  vec3 q=p-vec3(0.,.95,0.);
  float h=sdEll(q,vec3(.31,.33,.35));
  h=max(h,-(q.y+.27));
  vec2 r=vec2(h,M_PAINT);
  float vis=max(sdEll(q-vec3(0.,.0,.005),vec3(.312,.332,.352)),max(abs(q.y-.02)-.075,.12-q.z));
  r=U(r,vec2(vis,M_VISOR));
  r=carve(r,max(sdBox(q-vec3(0.,-.16,.3),vec3(.08,.01,.08)),.2-q.z),M_VOID);
  r=carve(r,max(sdBox(q-vec3(0.,-.2,.28),vec3(.06,.01,.08)),.2-q.z),M_VOID);
  r=U(r,vec2(sdRBox(q-vec3(0.,.24,-.26),vec3(.12,.012,.05),.01),M_DARK));
  vec2 t=torso(p,.34,M_PAINT);
  t=U(t,vec2(neckCol(p,.18),M_DARK));
  return U(r,t);
}
vec2 gladiator(vec3 p){
  vec3 q=p-vec3(0.,.93,0.);
  float dome=sdEll(q-vec3(0.,.05,0.),vec3(.29,.28,.3));
  vec2 r=vec2(dome,M_BRONZE);
  vec2 rq=vec2(length(q.xz),q.y);
  float brim=sdRBox2((rq-vec2(.33,-.05))*rot(.3),vec2(.055,.011),.01);
  r=U(r,vec2(brim,M_BRONZE));
  float grill=sdEll(q-vec3(0.,-.12,.07),vec3(.22,.2,.25));
  grill=max(grill,-sdEll(q-vec3(0.,-.12,.07),vec3(.2,.18,.23)));
  grill=max(grill,-(q.z-.0));
  vec2 gp=q.xy-vec2(0.,-.12);
  vec2 cell=floor(gp/.05+.5);
  float holes=length(gp-cell*.05)-.016;
  grill=max(grill,-holes);
  r=U(r,vec2(grill,M_BRONZE));
  r=U(r,vec2(sdEll(q-vec3(0.,-.12,.02),vec3(.19,.17,.21)),M_VOID));
  r=U(r,eyes(q,vec3(.07,-.07,.2),.02));
  vec3 c=q-vec3(0.,.3,-.02);
  float fin=max(abs(c.x)-.02,max(length(c.yz-vec2(-.15,0.))-.3,-c.y-.02));
  fin=max(fin,-(length(c.yz-vec2(-.15,0.))-.18));
  r=U(r,vec2(fin,M_BRONZE));
  vec3 pl=c-vec3(0.,.1,-.02);
  float plume=sdEll(pl,vec3(.035,.1,.2));
  plume+=.01*sin(pl.z*90.);
  r=U(r,vec2(plume,M_PLUME));
  vec2 t=torso(p,.33,M_DARKLEATHER);
  t=U(t,vec2(neckCol(p,.18),M_DARKLEATHER));
  // galerus: a tall bronze guard on the left shoulder
  float gal=sdEll(p-vec3(-.27,.53,0.),vec3(.16,.095,.19));
  gal=smin(gal,sdEll(p-vec3(-.33,.45,0.),vec3(.12,.07,.16)),.02);
  t=U(t,vec2(gal,M_BRONZE));
  t=U(t,vec2(sdTorus((p-vec3(-.27,.53,0.)).xzy*vec3(1.,1.,1.),vec2(.0,.0))+1.,M_BRONZE));
  t=U(t,vec2(max(abs(dot(p-vec3(0.,.38,0.),normalize(vec3(1.,1.2,0.))))-.028,torsoD(p,.33)-.013),M_BRONZE));
  return U(r,t);
}
vec2 falcon(vec3 p){
  vec3 q=p-vec3(0.,.95,0.);
  vec3 e=vec3(abs(q.x),q.y,q.z);
  // a falcon-head helm: the crown, the beak as a visor over the face
  float dome=sdEll(q-vec3(0.,.02,-.02),vec3(.29,.29,.32));
  float open=sdRBox(q-vec3(0.,-.17,.24),vec3(.17,.14,.2),.08);
  float h=max(dome,-open);
  float beak=sdCone(q,vec3(0.,.1,.2),vec3(0.,.02,.43),.11,.045);
  beak=smin(beak,sdCone(q,vec3(0.,.02,.43),vec3(0.,-.13,.43),.045,.01),.035);
  h=smin(h,beak,.08);
  // brow ridges over the falcon's eyes
  vec3 bq=e-vec3(.12,.12,.22);bq.xy*=rot(.35);
  h=smin(h,sdEll(bq,vec3(.1,.03,.07)),.035);
  vec2 r=vec2(h,M_GOLD);
  // the falcon's eyes glow on either side of the beak
  r=carve(r,sdEll(e-vec3(.13,.075,.235),vec3(.055,.032,.05)),M_VOID);
  r=U(r,vec2(sdEll(e-vec3(.13,.075,.22),vec3(.042,.022,.02)),M_GLOW));
  // tear streaks below them
  r=paint(r,max(sdBox(e-vec3(.15,-.02,.2),vec3(.024,.07,.12)),-.0),M_DARK);
  // the face is lost in the shadow under the beak
  r=U(r,vec2(sdEll(q-vec3(0.,-.12,.02),vec3(.22,.21,.25)),M_VOID));
  // swept wings at the temples
  for(int i=0;i<3;i++){
    float fi=float(i);
    vec3 w=e-vec3(.26,.06,-.08);
    w.xz*=rot(.55);
    w.xy*=rot(-(.55+fi*.3));
    r=U(r,vec2(sdEll(w-vec3(.13-fi*.015,0.,0.),vec3(.15-fi*.02,.045,.013)),M_GOLD));
  }
  // three crest feathers trailing from the crown
  for(int i=-1;i<=1;i++){
    float fi=float(i);
    r=U(r,vec2(sdCone(q,vec3(fi*.05,.24,-.1),vec3(fi*.11,.3,-.42),.045,.012),M_GOLD));
  }
  // a mantle of feathers over the shoulders
  vec3 c=polar(p,18.);
  vec3 l=c-vec3(.21,.6,0.);l.xy*=rot(.75);
  float mantle=sdEll(l,vec3(.1,.02,.045));
  vec3 c2=polar(p,18.);c2.xz*=rot(.1745);
  vec3 l2=c2-vec3(.27,.52,0.);l2.xy*=rot(.85);
  mantle=min(mantle,sdEll(l2,vec3(.1,.02,.05)));
  vec2 t=vec2(mantle,M_GOLD);
  t=U(t,vec2(torsoD(p,.33),M_DARK));
  t=U(t,vec2(neckCol(p,.18),M_DARK));
  return U(r,t);
}
vec2 cyber(vec3 p){
  vec3 q=p-vec3(0.,.96,0.);
  float h=sdEll(q,vec3(.3,.33,.33));
  h=max(h,-(q.y+.28));
  // swept fins at the back of the helmet
  vec3 f=vec3(abs(q.x),q.y,q.z)-vec3(.25,.08,-.18);f.xz*=rot(-.5);f.xy*=rot(.35);
  float fin=sdRBox(f,vec3(.012,.07,.16),.01);
  h=smin(h,fin,.03);
  vec2 r=vec2(h,M_LACQUER);
  float visor=max(abs(q.y-(.02-abs(q.x)*.32))-.055,.08-q.z);
  r=carve(r,max(visor,h-.004)-.0,M_VISOR);
  float v=abs(q.y-(.02-abs(q.x)*.32))-.012;
  v=max(v,.1-q.z);
  r=carve(r,max(v,h-.006),M_GLOW);
  float top=max(abs(q.x)-.012,.07-q.y);
  float side=max(abs(q.y-.14+q.z*.25)-.01,.2-abs(q.x));
  r=carve(r,max(min(top,side),h-.008),M_GLOW);
  float glow2=max(abs(q.y+.15)-.01,.15-q.z);
  r=carve(r,max(glow2,h-.008),M_GLOW2);
  float td=torsoD(p,.33);
  vec2 t=vec2(td,M_LACQUER);
  t=U(t,vec2(max(td-.006,abs(p.y-.46+abs(p.x)*.25)-.008),M_GLOW2));
  t=U(t,vec2(max(td-.006,max(abs(p.x)-.008,-p.z)),M_GLOW));
  t=U(t,vec2(neckCol(p,.17),M_DARK));
  for(int i=0;i<2;i++)t=U(t,vec2(sdTorus(p-vec3(0.,.6+float(i)*.06,0.),vec2(.17,.016)),M_GLOW));
  return U(r,t);
}

vec2 hero(vec3 p){
  if(uHero==0)return desert(p);
  if(uHero==1)return ninja(p);
  if(uHero==2)return robot(p);
  if(uHero==3)return knight(p);
  if(uHero==4)return falcon(p);
  if(uHero==5)return astronaut(p);
  if(uHero==6)return samurai(p);
  if(uHero==7)return viking(p);
  if(uHero==8)return diver(p);
  if(uHero==9)return racer(p);
  if(uHero==10)return gladiator(p);
  return cyber(p);
}
vec2 map(vec3 p){
  vec2 r=hero(p);
  if(uBase==1)r=U(r,plinth(p));
  return r;
}
vec3 normalAt(vec3 p){vec2 e=vec2(.0007,-.0007);
  return normalize(e.xyy*map(p+e.xyy).x+e.yyx*map(p+e.yyx).x+e.yxy*map(p+e.yxy).x+e.xxx*map(p+e.xxx).x);}
float shadow(vec3 ro,vec3 rd){float res=1.,t=.012,ph=1e10;
  for(int i=0;i<40;i++){float h=map(ro+rd*t).x;float y=h*h/(2.*ph),d=sqrt(max(h*h-y*y,0.));res=min(res,10.*d/max(0.,t-y));ph=h;t+=clamp(h,.012,.16);if(res<.002||t>2.4||(ro+rd*t).y>2.1)break;}
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

vec3 cloth(vec3 p,vec3 n,vec3 v,vec3 albedo,float sheen){
  vec3 c=shadeSurface(p,n,v,albedo,0.,.85,0.);
  float nv=max(dot(n,v),0.);
  c+=albedo*sheen*pow(1.-nv,3.)*.6;
  return c;
}
vec3 shemagh(vec3 p){
  vec2 g=vec2(p.x*1.+p.z*.7,p.y)*24.;
  vec2 d=vec2(g.x+g.y,g.x-g.y)*.7071;
  float l1=smoothstep(.1,.04,abs(fract(d.x)-.5)),l2=smoothstep(.1,.04,abs(fract(d.y)-.5));
  float dot2=smoothstep(.16,.1,length(fract(d+.5)-.5));
  vec3 red=vec3(.5,.025,.04),white=vec3(.88,.86,.82);
  return mix(red,white,clamp(max(l1,l2)*.85+dot2*.7,0.,1.));
}
vec3 livery(vec3 p){
  vec3 q=p-vec3(0.,.95,0.);
  float stripe=smoothstep(.035,.03,abs(q.x))+smoothstep(.02,.016,abs(abs(q.x)-.07));
  float swoosh=smoothstep(.03,.02,abs(q.y-.1+q.z*.6))*step(.15,abs(q.x));
  vec3 base=uColor;
  vec3 c=mix(base,vec3(.92),clamp(stripe+swoosh,0.,1.));
  if(p.y<.62)c=mix(base*.9,vec3(.05),step(.5,fract((p.x+p.y)*6.))*.0+smoothstep(.02,.0,abs(p.y-.45))*.9);
  return c;
}
vec3 shade(vec3 p,vec3 n,vec3 v,float m){
  float nv=max(dot(n,v),0.);
  if(m<1.5)return shadeSurface(p,n,v,vec3(.62,.64,.67),1.,.22,0.);
  if(m<2.5)return shadeSurface(p,n,v,vec3(1.,.74,.32),1.,.2,0.);
  if(m<3.5)return shadeSurface(p,n,v,vec3(.78,.46,.24),1.,.28,0.);
  if(m<4.5)return shadeSurface(p,n,v,vec3(.86,.62,.3),1.,.24,0.);
  if(m<5.5)return shadeSurface(p,n,v,vec3(.86,.87,.88),0.,.3,1.);
  if(m<6.5)return shadeSurface(p,n,v,vec3(.025,.026,.03),0.,.12,1.4);
  if(m<7.5)return shadeSurface(p,n,v,vec3(.42,.035,.04),0.,.16,1.2);
  if(m<8.5)return cloth(p,n,v,vec3(.045,.05,.075),.8);
  if(m<9.5)return cloth(p,n,v,shemagh(p),.4);
  if(m<10.5){vec3 c=cloth(p,n,v,uColor,1.2);return c*(.85+.3*fbm(p*60.));}
  if(m<11.5){vec3 r=reflect(-v,n);vec3 c=env(r)*vec3(1.,.78,.42)*1.1;c+=vec3(1.,.9,.6)*pow(max(dot(n,normalize(KEY+v)),0.),300.)*4.;float sk=shadow(p+n*.004,KEY);return c*(.8+.2*sk);}
  if(m<12.5)return uGlow*3.2+vec3(1.)*pow(nv,8.)*.6;
  if(m<13.5){vec3 r=reflect(-v,n);float fr=.04+.96*pow(1.-nv,5.);vec3 c=vec3(.02,.05,.05)+env(r)*(.25+fr);c+=vec3(1.)*pow(max(dot(n,normalize(KEY+v)),0.),280.)*3.;return c;}
  if(m<14.5)return vec3(.008,.008,.01);
  if(m<15.5)return shadeSurface(p,n,v,vec3(.86,.8,.66),0.,.4,.6);
  if(m<16.5)return shadeSurface(p,n,v,vec3(.28,.16,.08),0.,.62,.2);
  if(m<17.5)return shadeSurface(p,n,v,livery(p),0.,.2,1.2);
  if(m<18.5)return shadeSurface(p,n,v,vec3(.07,.075,.085),0.,.35,.8);
  if(m<19.5){vec3 c=cloth(p,n,v,vec3(.32,.22,.14),.6);return c*(.7+.6*fbm(p*40.));}
  if(m<20.5)return cloth(p,n,v,vec3(.8,.74,.62),.5);
  if(m<21.5)return uGlow2*3.2+vec3(1.)*pow(nv,8.)*.6;
  if(m<22.5)return shadeSurface(p,n,v,vec3(.11,.12,.14),1.,.32,0.);
  if(m<23.5)return shadeSurface(p,n,v,vec3(.01,.012,.015),0.,.06,1.6);
  if(m<24.5)return shadeSurface(p,n,v,vec3(.45,.47,.5),1.,.35,0.);
  if(m<25.5)return cloth(p,n,v,vec3(.075,.05,.035),.9);
  if(m<26.5){vec3 c=cloth(p,n,v,vec3(.62,.27,.08),.7);return c*(.75+.5*fbm(p*vec3(60.,14.,60.)));}
  if(m<27.5){float s=fract(p.y/.042);bool lace=s>.8;vec3 c=lace?cloth(p,n,v,vec3(.62,.05,.06),.8):shadeSurface(p,n,v,vec3(.02,.021,.025),0.,.14,1.3);
    float dots=smoothstep(.012,.006,length(vec2(fract(atan(p.z,p.x)*8.)-.5,(s-.4)*.4)));if(!lace)c=mix(c,vec3(1.,.8,.4)*.9,dots*.9);return c;}
  if(m>28.5)return shadeSurface(p,n,v,vec3(.13,.075,.04),0.,.55,.3);
  float wrap=step(.5,fract((p.x+p.y*1.7+p.z)*24.))*step(.5,fract((p.x-p.y*1.7-p.z)*24.));
  return cloth(p,n,v,mix(vec3(.03,.035,.05),vec3(.75,.7,.6),wrap*.7),.5);
}
vec3 aces(vec3 x){const float a=2.51,b=.03,c=2.43,d=.59,e=.14;return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.,1.);}

void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  float X=mix(uFrame.x,uFrame.y,uv.x),Y=mix(uFrame.z,uFrame.w,uv.y);
  float ce=cos(uElev),se=sin(uElev);
  vec3 fwd=normalize(vec3(0.,-se,-ce));
  vec3 right=vec3(1.,0.,0.),up=vec3(0.,ce,-se);
  vec3 ro=right*X+up*Y-fwd*4.;vec3 rd=fwd;
  mat2 yr=rot(uYaw);
  ro.xz=yr*ro.xz;rd.xz=yr*rd.xz;
  float t0=0.,t1=9.;bool inb=true;
  {
    float R=.78;vec2 o=ro.xz,d=rd.xz;float a=dot(d,d),b=dot(o,d),c=dot(o,o)-R*R,disc=b*b-a*c;
    if(a<1e-6){inb=c<0.;}else if(disc<0.)inb=false;else{float sq=sqrt(disc);t0=(-b-sq)/a;t1=(-b+sq)/a;}
    float ya=(0.-ro.y)/rd.y,yb=(1.75-ro.y)/rd.y;float ty0=min(ya,yb),ty1=max(ya,yb);
    t0=max(t0,ty0);t1=min(t1,ty1);if(t1<t0)inb=false;
  }
  float t=max(t0,0.);vec2 h=vec2(1e9,0.);bool hit=false;
  if(inb)for(int i=0;i<240;i++){
    vec3 p=ro+rd*t;h=map(p);
    if(h.x<.0004){hit=true;break;}
    t+=h.x*.75;
    if(t>t1)break;
  }
  if(hit){
    vec3 p=ro+rd*t,n=normalAt(p),v=-rd;
    vec3 c=shade(p,n,v,h.y);
    c=aces(c*.78);c=mix(vec3(dot(c,vec3(.299,.587,.114))),c,1.1);c=pow(c,vec3(1./2.2));
    outColor=vec4(c,1.);return;
  }
  if(rd.y<0.&&uBase==1){
    float tg=-ro.y/rd.y;vec3 g=ro+rd*tg;
    float rmax=.95;float rg=length(g.xz);if(rg>rmax){outColor=vec4(0.);return;}
    float d=map(g+vec3(0.,.002,0.)).x;
    float contact=1.-smoothstep(0.,.24,d);
    float s=rg<.85?1.-shadow(g+vec3(0.,.003,0.),normalize(vec3(-.3,1.,.15))):0.;
    float a=uShadow*clamp(contact*.6+s*.4,0.,1.)*smoothstep(rmax,rmax*.4,rg);
    outColor=vec4(0.,0.,0.,a);return;
  }
  outColor=vec4(0.);
}`;
