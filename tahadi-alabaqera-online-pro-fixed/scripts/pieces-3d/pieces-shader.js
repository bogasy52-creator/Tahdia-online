// Offline studio renderer for the 3D game pieces (pawns and marbles).
// Signed distance fields, ray marched in a fragment shader; PBR-style
// shading with a studio environment, soft shadows and ambient occlusion.
window.PIECES_FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform int uShape;      // pawn shapes 0..9, marble 20
uniform int uFinish;     // per item finish
uniform int uMarble;     // marble style 0 glass 1 metal 2 galaxy 3 pearl 4 royal
uniform vec3 uColor;     // linear player colour
uniform vec3 uTrim;      // linear trim metal colour
uniform float uElev;
uniform float uYaw;
uniform vec4 uFrame;     // xmin xmax ymin ymax in screen units
uniform float uShadow;

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

// material ids: 1 body, 2 trim metal, 3 jewel, 4 dark, 5 crystal facets, 6 base, 7 marble
vec2 U(vec2 a,vec2 b){return a.x<b.x?a:b;}

vec2 pawnBase(vec3 p){
  vec2 q=vec2(length(p.xz),p.y);
  float d=sdRBox2(q-vec2(0.,.06),vec2(.46,.06),.045);
  d=smin(d,sdRBox2(q-vec2(0.,.145),vec2(.38,.05),.035),.03);
  vec2 r=vec2(d,6.);
  r=U(r,vec2(sdTorus(p-vec3(0.,.068,0.),vec2(.445,.02)),2.));
  return r;
}
vec2 classic(vec3 p,bool crown){
  vec2 q=vec2(length(p.xz),p.y);
  float body=sdTrap(q-vec2(0.,.6),.31,.105,.42);
  float flare=sdTorus(p-vec3(0.,.24,0.),vec2(.24,.07));
  body=smin(body,flare,.09);
  float neck=sdBox2(q-vec2(0.,1.09),vec2(.085,.06));
  float head=length(q-vec2(0.,1.25))-.205;
  float bn=smin(body,neck,.05);float d=smin(bn,head,.06);
  vec2 r=vec2(d,head<bn?8.:1.);
  r=U(r,vec2(sdRBox2(q-vec2(0.,1.02),vec2(.2,.036),.03),2.));
  if(crown){
    vec3 c=p-vec3(0.,1.33,0.);
    float rc=length(c.xz);
    float band=max(abs(rc-.172)-.022,abs(c.y)-.045)-.006;
    vec3 k=polar(c,5.);
    // a triangular plate following the band
    vec2 tp=vec2(k.z,c.y-.04);
    float tri=max(abs(tp.x)*1.15+tp.y*.62-.11,-tp.y);
    tri=max(tri,abs(rc-.18)-.016)-.004;
    float ball=length(k-vec3(.19,.21,0.))-.03;
    float cr=min(band,min(tri,ball));
    r=U(r,vec2(cr,2.));
    vec3 j=polar(c,5.);
    r=U(r,vec2(length(j-vec3(.196,0.,0.))-.024,3.));
  }
  return r;
}
vec2 spire(vec3 p){
  vec2 q=vec2(length(p.xz),p.y);
  float d=sdUCap(q-vec2(0.,.42),.27,.03,1.18);
  d=smin(d,sdRBox2(q-vec2(0.,.2),vec2(.27,.06),.04),.08);
  vec2 r=vec2(d,1.);
  r=U(r,vec2(sdTorus(p-vec3(0.,.62,0.),vec2(.245,.03)),2.));
  r=U(r,vec2(sdTorus(p-vec3(0.,.25,0.),vec2(.29,.022)),2.));
  return r;
}
vec2 rook(vec3 p){
  vec2 q=vec2(length(p.xz),p.y);
  float body=sdTrap(q-vec2(0.,.6),.3,.25,.42);
  float top=sdRBox2(q-vec2(0.,1.11),vec2(.335,.14),.03);
  float d=smin(body,top,.06);
  // hollow crown and six crenels
  d=smax(d,-max(q.x-.235,1.1-p.y),.015);
  vec3 k=polar(p,6.);
  float notch=max(sdBox2(vec2(k.z,k.y-1.25),vec2(.075,.1)),k.x-.5);
  notch=max(notch,.1-k.x);
  d=smax(d,-notch,.012);
  vec2 r=vec2(d,1.);
  r=U(r,vec2(sdTorus(p-vec3(0.,.975,0.),vec2(.29,.028)),2.));
  r=U(r,vec2(sdTorus(p-vec3(0.,.25,0.),vec2(.3,.02)),2.));
  // arched window on the front
  vec3 w=p-vec3(0.,.66,0.);
  float win=sdRBox2(vec2(w.x,w.y),vec2(.055,.12),.055);
  r.x=smax(r.x,-max(win,-(w.z-.15)),.008);
  r=U(r,vec2(max(sdRBox2(vec2(w.x,w.y),vec2(.05,.115),.05),abs(w.z-.215)-.02),4.));
  return r;
}
vec2 orbit(vec3 p){
  vec2 q=vec2(length(p.xz),p.y);
  float stem=sdTrap(q-vec2(0.,.33),.13,.07,.18);
  vec2 r=vec2(stem,2.);
  r=U(r,vec2(length(p-vec3(0.,.84,0.))-.34,1.));
  vec3 c=p-vec3(0.,.84,0.);c.xy*=rot(.36);c.yz*=rot(-.22);
  r=U(r,vec2(sdTorus(c,vec2(.5,.026)),2.));
  return r;
}
vec2 lance(vec3 p){
  vec2 q=vec2(length(p.xz),p.y);
  float body=sdTrap(q-vec2(0.,.62),.2,.115,.45);
  vec2 r=vec2(body,1.);
  r=U(r,vec2(sdRBox2(q-vec2(0.,1.09),vec2(.16,.035),.03),2.));
  vec3 t=p-vec3(0.,1.13,0.);
  vec3 k=polar(t,4.);
  float blade=sdUCap(vec2(length(t.xz)*.92+abs(k.z)*.25,t.y),.13,.008,.62);
  r=U(r,vec2(blade,2.));
  r=U(r,vec2(sdTorus(p-vec3(0.,.3,0.),vec2(.21,.02)),2.));
  return r;
}
float petal(vec3 k,float base,float y0,float tilt,float w,float h){
  vec3 e=k-vec3(base,y0,0.);
  e.xy*=rot(tilt);
  // an almond outline, widest in the middle and pointed at the tip
  float t=clamp(e.y/h,0.,1.);
  float hw=w*sin(3.14159*pow(t,.85))*(1.-.25*t)+.004;
  float d2=max(abs(e.z)-hw,max(-e.y,e.y-h));
  // cupped: the edges curl toward the centre
  float cup=e.x-2.2*e.z*e.z+.18*e.y*e.y;
  return max(d2*.8,abs(cup)-.016)-.008;
}
vec2 lotus(vec3 p){
  vec2 q=vec2(length(p.xz),p.y);
  vec2 r=vec2(sdTrap(q-vec2(0.,.3),.15,.08,.13),2.);
  r=U(r,vec2(sdTorus(p-vec3(0.,.44,0.),vec2(.12,.03)),2.));
  r=U(r,vec2(sdUCap(q-vec2(0.,.56),.13,.03,.62),3.));
  float d=1e9;
  for(int i=0;i<6;i++){
    vec3 k=p;k.xz*=rot(float(i)*PI/3.);
    d=min(d,petal(k,.05,.4,.26,.14,.66));
    vec3 o=p;o.xz*=rot(float(i)*PI/3.+PI/6.);
    d=min(d,petal(o,.09,.38,.62,.13,.5));
  }
  r=U(r,vec2(d,1.));
  return r;
}
vec2 monolith(vec3 p){
  vec3 k=polar(p,6.);
  float y=p.y;
  float rr=y<1.02?.29:.29*clamp((1.55-y)/.53,0.,1.);
  float d=(k.x-rr)*.86;
  d=max(d,.17-y);
  d=max(d,y-1.55);
  vec2 r=vec2(d-.004,5.);
  vec2 q=vec2(length(p.xz),p.y);
  r=U(r,vec2(sdRBox2(q-vec2(0.,.2),vec2(.32,.04),.03),2.));
  return r;
}
vec2 gem(vec3 p){
  vec2 q=vec2(length(p.xz),p.y);
  vec2 r=vec2(sdTrap(q-vec2(0.,.3),.1,.055,.14),2.);
  vec3 k=polar(p,8.);
  vec2 s=vec2(k.x,p.y);
  float pav=dot(s-vec2(0.,.44),normalize(vec2(.52,-.4)));
  float crw=dot(s-vec2(.38,.92),normalize(vec2(.2,.17)));
  float tab=p.y-1.1;
  float gir=k.x-.385;
  float g=max(max(pav,crw),max(tab,gir));
  r=U(r,vec2(g,3.));
  r=U(r,vec2(sdTorus(p-vec3(0.,.92,0.),vec2(.375,.018)),2.));
  return r;
}
vec2 orb(vec3 p){
  vec2 q=vec2(length(p.xz),p.y);
  vec2 r=vec2(sdTrap(q-vec2(0.,.3),.14,.06,.13),2.);
  vec3 k=polar(p,3.);
  float prong=min(sdCap(k,vec3(.05,.4,0.),vec3(.27,.6,0.),.026),sdCap(k,vec3(.27,.6,0.),vec3(.25,.9,0.),.022));
  prong=min(prong,length(k-vec3(.25,.92,0.))-.035);
  r=U(r,vec2(prong,2.));
  r=U(r,vec2(length(p-vec3(0.,.78,0.))-.31,3.));
  return r;
}
vec2 pawn(vec3 p){
  vec2 r=pawnBase(p);
  if(uShape==0)r=U(r,classic(p,false));
  else if(uShape==1)r=U(r,spire(p));
  else if(uShape==2)r=U(r,rook(p));
  else if(uShape==3)r=U(r,orbit(p));
  else if(uShape==4)r=U(r,lance(p));
  else if(uShape==5)r=U(r,lotus(p));
  else if(uShape==6)r=U(r,monolith(p));
  else if(uShape==7)r=U(r,gem(p));
  else if(uShape==8)r=U(r,classic(p,true));
  else r=U(r,orb(p));
  return r;
}
vec2 map(vec3 p){
  if(uShape>=20)return vec2(length(p-vec3(0.,.5,0.))-.5,7.);
  return pawn(p);
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
vec3 glassBall(vec3 p,vec3 n,vec3 v,vec3 tint){
  float nv=max(dot(n,v),0.);
  vec3 r=reflect(-v,n);
  vec3 t=refract(-v,n,1./1.5);
  float caustic=pow(max(dot(t,-KEY),0.),3.);
  vec3 body=tint*tint*.5+tint*(.35+1.5*caustic);
  body+=tint*.5*pow(1.-nv,1.5);
  float fr=.04+.96*pow(1.-nv,5.);
  vec3 c=body*(1.-fr*.5)+env(r)*fr*1.2;
  vec3 h=normalize(KEY+v);c+=vec3(1.)*pow(max(dot(n,h),0.),320.)*5.;
  c+=vec3(.8,.9,1.)*pow(max(dot(n,normalize(FILL+v)),0.),140.)*1.1;
  float sk=shadow(p+n*.004,KEY);c*=.75+.25*sk;
  return c;
}
vec3 jewel(vec3 p,vec3 n,vec3 v,vec3 tint,float milky){
  float nv=max(dot(n,v),0.);
  vec3 r=reflect(-v,n);
  vec3 t=refract(-v,n,1./1.75);
  // facets catch the light differently: a stable value per facet normal
  float facet=fract(sin(dot(floor(n*6.+.5),vec3(12.9898,78.233,37.719)))*43758.5453);
  vec3 inner=env(vec3(t.x,abs(t.y),t.z)*vec3(1.,1.,-1.));
  float lum=dot(inner,vec3(.3,.5,.2));
  vec3 deep=tint*tint*.55;
  vec3 body=mix(deep,tint*1.25,clamp(lum*.55+facet*.45,0.,1.));
  body+=tint*pow(facet,6.)*1.6;
  body=mix(body,mix(tint,vec3(1.),.3)*(.55+.45*(n.y*.5+.5)),milky);
  float fr=.05+.95*pow(1.-nv,5.);
  vec3 c=body*(1.-fr*.5)+env(r)*fr*1.15;
  vec3 h=normalize(KEY+v);c+=vec3(1.)*pow(max(dot(n,h),0.),260.)*4.5;
  c+=vec3(.8,.9,1.)*pow(max(dot(n,normalize(FILL+v)),0.),160.)*1.2;
  float sk=shadow(p+n*.004,KEY);c*=.72+.28*sk;
  return c;
}
// marble interiors
vec3 marbleInside(vec3 p,vec3 n,vec3 v,int style){
  vec3 c0=vec3(0.,.5,0.);
  vec3 t=refract(-v,n,1./1.5);
  vec3 q=p+t*.005;
  vec3 acc=vec3(0.);float trans=1.;
  for(int i=0;i<48;i++){
    vec3 lp=q-c0;if(length(lp)>.5)break;
    if(style==2){
      float d=fbm(lp*4.2+vec3(3.1));
      float neb=smoothstep(.45,.8,d);
      vec3 nc=mix(uColor*1.4,vec3(.7,.35,1.)*.9,smoothstep(.55,.85,fbm(lp*6.+9.)));
      acc+=trans*nc*neb*.09;trans*=1.-neb*.08;
      vec3 g=lp*55.;vec3 gi=floor(g),gf=fract(g)-.5;float hs=hash3(gi);
      vec3 off=vec3(hash3(gi+3.1),hash3(gi+7.7),hash3(gi+1.3))-.5;
      float sd=length(gf-off*.6);float st=step(.9,hs)*exp(-sd*sd*140.);
      acc+=trans*vec3(1.,.96,.88)*st*.9;
    }else{
      vec3 w=lp;float ang=w.y*7.5;w.xz*=rot(ang);
      float vane=style==4?max(abs(w.z)-.014,abs(abs(w.x)-.18)-.05):max(abs(w.z)-.016,abs(w.x)-.24);
      if(vane<0.){vec3 vc=style==4?vec3(1.,.72,.25):uColor*1.15;acc+=trans*vc*(.75+.5*(w.x/.27+1.)*.5);trans=0.;break;}
    }
    q+=t*.022;
  }
  vec3 back;
  if(style==2)back=vec3(.004,.006,.02);
  else back=mix(uColor*.35,uColor*.8,clamp(n.y*.5+.5,0.,1.));
  return acc+trans*back;
}
vec3 shadeMarble(vec3 p,vec3 n,vec3 v){
  int st=uMarble;
  float nv=max(dot(n,v),0.);
  vec3 r=reflect(-v,n);
  if(st==1){ // metal with a painted band
    vec3 lp=p-vec3(0.,.5,0.);
    vec3 b=lp;b.xy*=rot(.35);
    float band=smoothstep(.115,.105,abs(b.y));
    vec3 cMetal=shadeSurface(p,n,v,vec3(.82,.84,.86),1.,.18,0.);
    vec3 cPaint=shadeSurface(p,n,v,uColor,0.,.3,1.);
    return mix(cMetal,cPaint,band);
  }
  if(st==3){ // pearl
    vec3 base=mix(vec3(.92,.9,.88),uColor,.78);
    vec3 c=shadeSurface(p,n,v,base,0.,.35,.6);
    vec3 iri=.5+.5*cos(6.2831*(vec3(0.,.33,.67)+(1.-nv)*1.2+.15));
    c+=iri*pow(1.-nv,2.)*.25;
    return c;
  }
  vec3 inside=marbleInside(p,n,v,st);
  float fr=.04+.96*pow(1.-nv,5.);
  vec3 c=inside*(1.-fr)+env(r)*fr*1.1;
  vec3 h=normalize(KEY+v);c+=vec3(1.)*pow(max(dot(n,h),0.),400.)*5.;
  c+=vec3(1.)*pow(max(dot(n,normalize(FILL+v)),0.),120.)*.8;
  float sk=shadow(p+n*.004,KEY);c*=.75+.25*sk;
  return c;
}
vec3 shade(vec3 p,vec3 n,vec3 v,float m){
  if(m>7.5){if(uFinish==5)return glassBall(p,n,v,uColor);m=1.;}
  if(m>6.5)return shadeMarble(p,n,v);
  vec3 col=uColor;
  if(m<1.5){ // body
    if(uFinish==1)return uShape==5?glassBall(p,n,v,col):jewel(p,n,v,col,.0);          // glass body
    if(uFinish==2)return shadeSurface(p,n,v,col*.42,0.,.1,1.5); // onyx: deep glossy
    if(uFinish==6)return shadeSurface(p,n,v,col*.8,0.,.45,.5); // satin
    if(uFinish==3)return jewel(p,n,v,col,.55);         // jade: milky stone
    return shadeSurface(p,n,v,col,0.,.32,1.);
  }
  if(m<2.5)return shadeSurface(p,n,v,uTrim,1.,.2,0.);
  if(m<3.5){
    if(uShape==9||uShape==5||uShape==8)return glassBall(p,n,v,col);
    if(uFinish==4){vec3 j=jewel(p,n,v,col,0.);float nv=max(dot(n,v),0.);j+=(.5+.5*cos(6.2831*(vec3(0.,.33,.67)+nv*2.)))*.35*pow(1.-nv,1.5);return j;}
    return jewel(p,n,v,col,uFinish==3?.55:0.);
  }
  if(m<4.5)return shadeSurface(p,n,v,vec3(.02),0.,.4,0.);
  if(m<5.5){
    vec3 j=jewel(p,n,v,col,uFinish==3?.45:.12);
    if(uFinish==4){float nv=max(dot(n,v),0.);j+=(.5+.5*cos(6.2831*(vec3(0.,.33,.67)+nv*2.5+p.y)))*.4*pow(1.-nv,1.2);}
    return j;
  }
  // base: player colour, a little darker and satin
  return shadeSurface(p,n,v,col*.78,0.,.38,.7);
}
vec3 aces(vec3 x){const float a=2.51,b=.03,c=2.43,d=.59,e=.14;return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.,1.);}

void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  float X=mix(uFrame.x,uFrame.y,uv.x),Y=mix(uFrame.z,uFrame.w,uv.y);
  float ce=cos(uElev),se=sin(uElev);
  vec3 fwd=normalize(vec3(0.,-se,-ce));
  vec3 right=vec3(1.,0.,0.),up=vec3(0.,ce,-se);
  vec3 ro=right*X+up*Y-fwd*4.;vec3 rd=fwd;
  // object yaw
  mat2 yr=rot(uYaw);
  ro.xz=yr*ro.xz;rd.xz=yr*rd.xz;
  float t0=0.,t1=9.;bool inb=true;
  { // ray vs cylinder r .64 around y, y in [0,2.05]
    float R=.64;vec2 o=ro.xz,d=rd.xz;float a=dot(d,d),b=dot(o,d),c=dot(o,o)-R*R,disc=b*b-a*c;
    if(a<1e-6){inb=c<0.;}else if(disc<0.)inb=false;else{float sq=sqrt(disc);t0=(-b-sq)/a;t1=(-b+sq)/a;}
    float ya=(0.-ro.y)/rd.y,yb=(2.05-ro.y)/rd.y;float ty0=min(ya,yb),ty1=max(ya,yb);
    t0=max(t0,ty0);t1=min(t1,ty1);if(t1<t0)inb=false;
  }
  float t=max(t0,0.);vec2 h=vec2(1e9,0.);bool hit=false;
  if(inb)for(int i=0;i<200;i++){
    vec3 p=ro+rd*t;h=map(p);
    if(h.x<.0004){hit=true;break;}
    t+=h.x*.8;
    if(t>t1)break;
  }
  if(hit){
    vec3 p=ro+rd*t,n=normalAt(p),v=-rd;
    vec3 c=shade(p,n,v,h.y);
    c=aces(c*.76);c=mix(vec3(dot(c,vec3(.299,.587,.114))),c,1.12);c=pow(c,vec3(1./2.2));
    outColor=vec4(c,1.);return;
  }
  // ground: soft contact shadow only
  if(rd.y<0.){
    float tg=-ro.y/rd.y;vec3 g=ro+rd*tg;
    float rmax=uShape>=20?.66:.95;float rg=length(g.xz);if(rg>rmax){outColor=vec4(0.);return;}
    float d=map(g+vec3(0.,.002,0.)).x;
    float contact=1.-smoothstep(0.,.24,d);
    float s=rg<.8?1.-shadow(g+vec3(0.,.003,0.),normalize(vec3(-.3,1.,.15))):0.;
    float a=uShadow*clamp(contact*.6+s*.4,0.,1.)*smoothstep(rmax,rmax*.4,rg);
    outColor=vec4(0.,0.,0.,a);return;
  }
  outColor=vec4(0.);
}`;
