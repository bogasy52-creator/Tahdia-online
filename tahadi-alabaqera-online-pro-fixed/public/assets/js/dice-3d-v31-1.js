/* Tahdia 31.1.0 — the 3D die.
   A real rounded cube with carved pips, rendered on the GPU (WebGL, ray
   marched) with studio lighting, reflections and a soft shadow on the table.
   One hidden WebGL canvas draws every die on the page and copies each frame
   into the die's own canvas, so a page with many dice still uses a single
   context. The result face always ends on top. If WebGL is missing or the
   context is lost, pro-dice.js keeps its CSS cube. */
(function(root){
  'use strict';
  if(root.BS_DIE3D)return;
  const doc=root.document;
  // Faces of a standard die: opposite faces add up to 7.
  // +x:3  -x:4  +y:1  -y:6  +z:2  -z:5
  const NORMAL={1:[0,1,0],6:[0,-1,0],3:[1,0,0],4:[-1,0,0],2:[0,0,1],5:[0,0,-1]};
  /* Skins: colours come from the shop item; finish decides metal, glass,
     gloss and the pip shape. */
  const SKINS={
    'dice-ivory':{body:'#f4efe4',pip:'#0b1424',edge:'#f4efe4',round:.16,pipRound:1,pipSize:.088,metal:0,rough:.32,coat:1,glass:0,pattern:0},
    'dice-studio':{body:'#efe9db',pip:'#182027',edge:'#efe9db',round:.17,pipRound:1,pipSize:.09,metal:0,rough:.26,coat:1,glass:0,pattern:0},
    'dice-porcelain':{body:'#f1ebdc',pip:'#24313b',edge:'#d9b25e',edgeTint:.85,round:.18,pipRound:1,pipSize:.086,metal:0,rough:.18,coat:1.2,glass:0,pattern:0},
    'dice-midnight':{body:'#1e2a3e',pip:'#f6ecd9',edge:'#1e2a3e',round:.15,pipRound:1,pipSize:.09,metal:0,rough:.22,coat:1,glass:0,pattern:0},
    'dice-copper':{body:'#d39a68',pip:'#2a190d',edge:'#d39a68',round:.14,pipRound:1,pipSize:.088,metal:1,rough:.42,coat:0,glass:0,pattern:1},
    'dice-aurora':{body:'#a98de0',pip:'#241537',edge:'#a98de0',round:.16,pipRound:1,pipSize:.088,metal:0,rough:.24,coat:1,glass:0,pattern:4},
    'dice-gold':{body:'#e6b95f',pip:'#1d1404',edge:'#e6b95f',round:.14,pipRound:1,pipSize:.09,metal:1,rough:.22,coat:0,glass:0,pattern:0},
    'dice-nebula':{body:'#2a5fa3',pip:'#f3f4e7',edge:'#2a5fa3',round:.15,pipRound:1,pipSize:.1,metal:.55,rough:.3,coat:.6,glass:0,pattern:2},
    'dice-ruby':{body:'#b0304f',pip:'#fff3e0',edge:'#b0304f',round:.12,pipRound:1,pipSize:.088,metal:0,rough:.08,coat:1.3,glass:1,pattern:0},
    'dice-smoke':{body:'#3e4a52',pip:'#f2dfb9',edge:'#a6b8bd',edgeTint:.7,round:.12,pipRound:1,pipSize:.088,metal:0,rough:.1,coat:1.2,glass:.85,pattern:0},
    'dice-oxblood':{body:'#87283a',pip:'#fff3dc',edge:'#87283a',round:.2,pipRound:1,pipSize:.088,metal:0,rough:.14,coat:1.3,glass:.45,pattern:0},
    'dice-milled':{body:'#b4c0c4',pip:'#1b252b',edge:'#dfe5e2',edgeTint:.5,round:.07,pipRound:.32,pipSize:.085,metal:1,rough:.3,coat:0,glass:0,pattern:1},
    'dice-crystal':{body:'#1f9a86',pip:'#e2fff5',edge:'#9ff2dc',edgeTint:.6,round:.07,pipRound:.22,pipSize:.082,metal:0,rough:.05,coat:1.4,glass:1,pattern:0},
    'dice-obsidian':{body:'#151d26',pip:'#ecc878',edge:'#c4955c',edgeTint:.9,round:.11,pipRound:.36,pipSize:.085,metal:0,rough:.08,coat:1.4,glass:0,pattern:3}
  };
  const VERT='attribute vec2 a;varying vec2 v;void main(){v=a;gl_Position=vec4(a,0.,1.);}';
  const FRAG=`#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v;
uniform vec2 uRes;uniform mat3 uRot;uniform vec3 uPos;
uniform vec3 uBody,uPip,uEdge;uniform vec4 uMat;uniform vec4 uShape;uniform float uPattern,uEdgeTint,uShadow,uFov,uDist,uElev,uSmall;
const float PI=3.14159265;
const vec3 KEY=vec3(-.5129,.7614,.3966);
const vec3 FILL=vec3(.8253,.3069,.4743);
const vec3 RIM=vec3(.2357,.5185,-.8223);
float sdRBox(vec3 p,float r){vec3 q=abs(p)-vec3(.5-r);return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.)-r;}
float pipOne(vec2 q){float s=uShape.z,rr=s*uShape.y;vec2 d=abs(q)-vec2(s-rr);return length(max(d,0.))+min(max(d.x,d.y),0.)-rr;}
float pips(float n,vec2 q){
  float d=10.;
  if(n==1.||n==3.||n==5.)d=pipOne(q);
  if(n>=2.){d=min(d,pipOne(q-vec2(-.25,-.25)));d=min(d,pipOne(q-vec2(.25,.25)));}
  if(n>=4.){d=min(d,pipOne(q-vec2(-.25,.25)));d=min(d,pipOne(q-vec2(.25,-.25)));}
  if(n==6.){d=min(d,pipOne(q-vec2(-.25,0.)));d=min(d,pipOne(q-vec2(.25,0.)));}
  return d;}
float faceInfo(vec3 p,out vec2 q,out float fd){
  vec3 a=abs(p);float n;
  if(a.x>=a.y&&a.x>=a.z){q=p.zy;n=p.x>0.?3.:4.;fd=a.x;}
  else if(a.y>=a.z){q=p.xz;n=p.y>0.?1.:6.;fd=a.y;}
  else{q=p.xy;n=p.z>0.?2.:5.;fd=a.z;}
  return n;}
float smax(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return max(a,b)+h*h*k*.25;}
float die(vec3 p){
  float d=sdRBox(p,uShape.x);
  vec2 q;float fd;float n=faceInfo(p,q,fd);
  float pd=pips(n,q);
  float depth=.05;
  float hole=max(pd,-(fd-.5+depth));
  hole=max(hole,fd-.6);
  return smax(d,-hole,.012);}
vec3 toObj(vec3 p){return (p-uPos)*uRot;}
float map(vec3 p){return die(toObj(p));}
vec3 nrm(vec3 p){vec2 e=vec2(.0012,-.0012);return normalize(e.xyy*map(p+e.xyy)+e.yyx*map(p+e.yyx)+e.yxy*map(p+e.yxy)+e.xxx*map(p+e.xxx));}
vec3 env(vec3 r){
  float up=r.y;
  vec3 c=mix(vec3(.05,.055,.07),vec3(.5,.55,.64),smoothstep(-.1,.9,up));
  c+=vec3(1.,.96,.9)*6.*pow(max(dot(r,KEY),0.),40.);
  c+=vec3(1.,.97,.93)*1.1*pow(max(dot(r,KEY),0.),6.);
  c+=vec3(.75,.85,1.)*2.4*smoothstep(.93,.985,dot(r,FILL));
  c+=vec3(1.)*1.4*pow(max(dot(r,RIM),0.),18.);
  c+=vec3(.95,.93,.9)*.8*smoothstep(.16,0.,abs(up-.08));
  return mix(c,vec3(.035,.03,.028),smoothstep(0.,-.25,up));}
float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float D(float nh,float a){float a2=a*a,d=nh*nh*(a2-1.)+1.;return a2/(PI*d*d);}
vec3 F(vec3 f0,float c){return f0+(1.-f0)*pow(1.-c,5.);}
vec3 lit(vec3 n,vec3 vv,vec3 l,vec3 col,vec3 dif,vec3 f0,float rough){
  vec3 h=normalize(l+vv);float nl=max(dot(n,l),0.),nv=max(dot(n,vv),.001),nh=max(dot(n,h),0.);
  float a=max(rough*rough,.002),k=(rough+1.)*(rough+1.)/8.;
  float g=(nv/(nv*(1.-k)+k))*(nl/(nl*(1.-k)+k));
  vec3 fr=F(f0,max(dot(vv,h),0.));
  return (dif*(1.-fr)/PI+D(nh,a)*g*fr/(4.*nv*max(nl,.001)+.001))*col*nl*PI;}
vec3 shade(vec3 p,vec3 n,vec3 vv){
  vec3 o=toObj(p),on=n*uRot;
  vec2 q;float fd;float face=faceInfo(o,q,fd);
  bool inPip=pips(face,q)<.004&&fd<.497;
  vec3 a=abs(o);float mx=max(a.x,max(a.y,a.z)),mn=min(a.x,min(a.y,a.z)),md=a.x+a.y+a.z-mx-mn;
  float edge=smoothstep(.5-uShape.x*1.15,.5-uShape.x*.25,md);
  vec3 albedo=uBody;float metal=uMat.x,rough=uMat.y,glass=uMat.z,coat=uMat.w;
  if(uPattern==1.){float ring=sin(length(q)*230.)*.5+.5;rough=clamp(rough+ring*.08-.04,.05,1.);albedo*=.94+.06*ring;}
  if(uPattern==2.){float neb=noise(o*5.+3.)*.6+noise(o*11.)*.4;albedo=mix(albedo,vec3(.26,.1,.42),smoothstep(.45,.85,neb));albedo+=vec3(.9)*step(.985,hash(floor(o*70.)));}
  if(uPattern==3.){float vein=abs(noise(o*6.)-.5);albedo+=vec3(.08,.07,.06)*smoothstep(.06,.0,vein);}
  if(uPattern==4.){float sh=pow(1.-max(dot(n,vv),0.),2.);albedo=mix(albedo,albedo*vec3(.85,1.05,1.25),sh);}
  albedo=mix(albedo,uEdge,edge*uEdgeTint);
  if(inPip){albedo=uPip;metal=uEdgeTint>.85&&uPattern==3.?1.:metal*.5;rough=.35;glass=0.;coat=.4;}
  else if(uEdgeTint>.8&&edge>.5){metal=1.;rough=.25;}
  float ao=1.;{float h1=map(p+n*.03),h2=map(p+n*.08);ao=clamp(1.-1.6*((.03-h1)+(.08-h2)*.5),.25,1.);}
  vec3 f0=mix(vec3(.04),albedo,metal),dif=albedo*(1.-metal);
  vec3 c=vec3(0.);
  c+=lit(n,vv,KEY,vec3(1.,.96,.9)*2.05,dif,f0,rough);
  c+=lit(n,vv,FILL,vec3(.7,.8,1.)*.5,dif,f0,rough);
  c+=lit(n,vv,RIM,vec3(1.)*1.,dif,f0,rough);
  c+=dif*mix(vec3(.16,.13,.11),vec3(.42,.46,.55),n.y*.5+.5)*ao*.6;
  vec3 r=reflect(-vv,n);float nv=max(dot(n,vv),0.);
  c+=mix(env(r),vec3(.3,.32,.36)*(r.y*.5+.6),clamp(rough*1.6,0.,1.))*F(f0,nv)*ao*(metal>.5?1.:.8);
  if(glass>0.&&!inPip){
    vec3 t=refract(-vv,n,1./1.6);
    vec3 inner=env(vec3(t.x,abs(t.y),-t.z));
    float lum=dot(inner,vec3(.3,.5,.2));
    vec3 body=mix(uBody*uBody*.6,uBody*1.3,clamp(lum*.6+.25,0.,1.))+uBody*.5*pow(1.-nv,2.);
    float fr=.05+.95*pow(1.-nv,5.);
    vec3 g=body*(1.-fr*.5)+env(r)*fr;
    c=mix(c,g,glass);
  }
  if(coat>0.){float fc=.04+.96*pow(1.-nv,5.);c+=env(r)*fc*coat*ao*.7;vec3 h=normalize(KEY+vv);c+=vec3(1.)*pow(max(dot(n,h),0.),200.)*1.4*coat;}
  return c*ao;}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){
  vec2 uv=v;uv.x*=uRes.x/uRes.y;
  float ce=cos(uElev),se=sin(uElev);
  vec3 ro=vec3(0.,se,ce)*uDist+vec3(0.,.42,0.);
  vec3 fw=normalize(vec3(0.,.42,0.)-ro),rt=normalize(cross(fw,vec3(0.,1.,0.))),up=cross(rt,fw);
  float th=tan(uFov*.5);
  vec3 rd=normalize(fw+uv.x*th*rt+uv.y*th*up);
  float px=2.*th/uRes.y;
  // bounding sphere
  vec3 oc=ro-uPos;float b=dot(oc,rd),c=dot(oc,oc)-.81,disc=b*b-c;
  vec4 col=vec4(0.);
  if(disc>0.){
    float t=max(-b-sqrt(disc),0.),t1=-b+sqrt(disc),best=1e9,bestT=t;bool hit=false;
    for(int i=0;i<90;i++){
      float h=map(ro+rd*t);
      if(h<best){best=h;bestT=t;}
      if(h<.0006){hit=true;break;}
      t+=h*.9;if(t>t1)break;}
    if(hit||best<px*bestT*1.2){
      float tt=hit?t:bestT;vec3 p=ro+rd*tt,n=nrm(p);
      vec3 cc=shade(p,n,-rd);
      cc=aces(cc*.8);cc=pow(cc,vec3(1./2.2));
      float a=hit?1.:clamp(1.-best/(px*bestT*1.2),0.,1.);
      col=vec4(cc*a,a);}
  }
  if(col.a<1.&&rd.y<0.){
    float tg=-ro.y/rd.y;vec3 g=ro+rd*tg;
    float rg=length(g.xz-uPos.xz);
    if(rg<1.5){
      vec3 l=normalize(vec3(-.25,1.,.15));float res=1.,s=.02;
      for(int i=0;i<24;i++){float h=map(g+l*s);res=min(res,8.*h/s);s+=clamp(h,.03,.2);if(res<.01||s>3.)break;}
      float contact=1.-smoothstep(0.,.5+uPos.y*.3,max(rg-.35,0.));
      float sh=clamp((1.-clamp(res,0.,1.))*.55+contact*.35,0.,1.)*uShadow/(1.+uPos.y*1.4);
      sh*=smoothstep(1.5,.6,rg);
      col=vec4(col.rgb,col.a)+vec4(0.,0.,0.,sh)*(1.-col.a);}
  }
  gl_FragColor=col;
}`;
  let gl=null,canvas=null,prog=null,loc={},failed=false,lost=false;
  const views=new Set();
  function supported(){
    if(failed||lost)return false;if(gl)return true;
    try{
      if(root.BS_DIE3D_DISABLED||!doc?.createElement)throw new Error('off');
      canvas=doc.createElement('canvas');canvas.width=canvas.height=2;
      gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,preserveDrawingBuffer:true,powerPreference:'low-power'})||canvas.getContext('experimental-webgl',{alpha:true,premultipliedAlpha:true,preserveDrawingBuffer:true});
      if(!gl)throw new Error('no_webgl');
      const make=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'shader');return s;};
      prog=gl.createProgram();gl.attachShader(prog,make(gl.VERTEX_SHADER,VERT));gl.attachShader(prog,make(gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(prog);
      if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw new Error('link');
      gl.useProgram(prog);
      const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
      const a=gl.getAttribLocation(prog,'a');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
      for(const name of ['uRes','uRot','uPos','uBody','uPip','uEdge','uMat','uShape','uPattern','uEdgeTint','uShadow','uFov','uDist','uElev','uSmall'])loc[name]=gl.getUniformLocation(prog,name);
      canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;for(const view of [...views])view.fallback();});
      return true;
    }catch(error){failed=true;gl=null;return false;}
  }
  const lin=hex=>{const h=String(hex||'#888888').trim().replace('#','');const v=h.length===3?h.split('').map(c=>c+c).join(''):h.padEnd(6,'0');return [0,2,4].map(i=>Math.pow((parseInt(v.slice(i,i+2),16)||0)/255,2.2));};
  /* ---------- rotations ---------- */
  function quat(axis,angle){const s=Math.sin(angle/2),l=Math.hypot(...axis)||1;return [axis[0]/l*s,axis[1]/l*s,axis[2]/l*s,Math.cos(angle/2)];}
  function qmul(a,b){return [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];}
  function qslerp(a,b,t){let d=a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3];if(d<0){b=b.map(x=>-x);d=-d;}if(d>.9995){const r=a.map((x,i)=>x+(b[i]-x)*t);const l=Math.hypot(...r);return r.map(x=>x/l);}const th=Math.acos(d),s=Math.sin(th);return a.map((x,i)=>(x*Math.sin((1-t)*th)+b[i]*Math.sin(t*th))/s);}
  // column-major mat3 for GLSL: world = R * obj
  function qmat(q){const [x,y,z,w]=q;return [1-2*(y*y+z*z),2*(x*y+z*w),2*(x*z-y*w),2*(x*y-z*w),1-2*(x*x+z*z),2*(y*z+x*w),2*(x*z+y*w),2*(y*z-x*w),1-2*(x*x+y*y)];}
  // rotation that brings the face with `value` to the top, then a yaw
  function faceUp(value,yaw){
    const n=NORMAL[value]||NORMAL[1],up=[0,1,0],dot=n[1];let q;
    if(dot>.999)q=[0,0,0,1];else if(dot<-.999)q=quat([1,0,0],Math.PI);
    else{const axis=[n[1]*up[2]-n[2]*up[1],n[2]*up[0]-n[0]*up[2],n[0]*up[1]-n[1]*up[0]];q=quat(axis,Math.acos(dot));}
    return qmul(quat([0,1,0],yaw),q);
  }
  function skinFor(el){
    const id=el.closest?.('[data-dice-skin]')?.dataset?.diceSkin||doc.documentElement?.dataset?.dice||'dice-ivory';
    const base=SKINS[id]||SKINS['dice-ivory'],style=root.getComputedStyle?.(el),css=name=>style?.getPropertyValue(name)?.trim();
    // the shop item colours win when the page sets them (previews, custom stages)
    const body=SKINS[id]?base.body:(css('--die-color')||base.body),pip=SKINS[id]?base.pip:(css('--die-pip')||base.pip);
    return {...base,id,body,pip};
  }
  const reduced=()=>{try{return root.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true}catch{return false}};
  function draw(view,state){
    if(!gl||lost)return false;
    const w=view.canvas.width,h=view.canvas.height;if(!w||!h)return false;
    if(canvas.width<w||canvas.height<h){canvas.width=Math.max(canvas.width,w);canvas.height=Math.max(canvas.height,h);}
    gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    const s=view.skin;
    gl.uniform2f(loc.uRes,w,h);
    gl.uniformMatrix3fv(loc.uRot,false,qmat(state.q));
    gl.uniform3f(loc.uPos,state.x||0,.5+(state.h||0),state.z||0);
    gl.uniform3fv(loc.uBody,lin(s.body));gl.uniform3fv(loc.uPip,lin(s.pip));gl.uniform3fv(loc.uEdge,lin(s.edge||s.body));
    gl.uniform4f(loc.uMat,s.metal,s.rough,s.glass,s.coat);
    gl.uniform4f(loc.uShape,s.round,s.pipRound,s.pipSize,0);
    gl.uniform1f(loc.uPattern,s.pattern||0);gl.uniform1f(loc.uEdgeTint,s.edgeTint||0);gl.uniform1f(loc.uShadow,view.shadow);
    gl.uniform1f(loc.uFov,.52);gl.uniform1f(loc.uDist,view.dist);gl.uniform1f(loc.uElev,.95);gl.uniform1f(loc.uSmall,0);
    gl.drawArrays(gl.TRIANGLES,0,3);
    const c=view.ctx;c.clearRect(0,0,w,h);c.drawImage(canvas,0,canvas.height-h,w,h,0,0,w,h);
    return true;
  }
  function attach(el,{shadow=.6}={}){
    if(!el||el.__die3d)return el?.__die3d||null;
    if(!supported())return null;
    const cv=doc.createElement('canvas');cv.className='die3d-canvas';cv.setAttribute('aria-hidden','true');
    const ctx=cv.getContext('2d');if(!ctx)return null;
    const view={el,canvas:cv,ctx,skin:skinFor(el),shadow,dist:4.1,state:{q:faceUp(Number(el.dataset.value)||1,.42),h:0,x:0,z:0},value:Number(el.dataset.value)||1,yaw:.42,raf:0,disposed:false};
    el.appendChild(cv);el.classList.add('die3d');
    const size=()=>{const r=el.getBoundingClientRect(),dpr=Math.min(root.devicePixelRatio||1,2.25),css=Math.max(24,r.width||64)*1.6;const px=Math.round(css*dpr);if(cv.width!==px){cv.width=cv.height=px;}};
    view.render=()=>{if(view.disposed)return;size();draw(view,view.state);};
    view.set=value=>{if(!NORMAL[value])return;view.value=value;view.skin=skinFor(el);view.state={q:faceUp(value,view.yaw),h:0,x:0,z:0};view.render();};
    view.roll=(value,duration=1040)=>new Promise(resolve=>{
      if(!NORMAL[value]){resolve();return;}
      cancelAnimationFrame(view.raf);view.skin=skinFor(el);
      if(reduced()){view.set(value);resolve();return;}
      const start=view.state.q,yaw=(Math.random()-.5)*1.1+.42,target=faceUp(value,yaw);view.yaw=yaw;
      const ang=Math.random()*Math.PI*2,axis=[Math.cos(ang),Math.random()*.35-.17,Math.sin(ang)],turns=Math.PI*2*(1.6+Math.random()*.8);
      const dx=(Math.random()-.5)*.7,dz=(Math.random()-.5)*.5,t0=performance.now();
      const hop=t=>t<.36?Math.sin(t/.36*Math.PI)*.95:t<.6?Math.sin((t-.36)/.24*Math.PI)*.32:t<.76?Math.sin((t-.6)/.16*Math.PI)*.1:0;
      const frame=now=>{
        if(view.disposed){resolve();return;}
        const t=Math.max(0,Math.min(1,(now-t0)/duration)),k=Math.pow(1-t,2.3);
        const path=qmul(target,quat(axis,turns*k)),blend=Math.min(1,t/.12);
        view.state={q:qslerp(start,path,blend*blend*(3-2*blend)),h:hop(t),x:dx*k,z:dz*k};
        view.render();
        if(t<1)view.raf=requestAnimationFrame(frame);else{view.raf=0;view.state={q:target,h:0,x:0,z:0};view.render();resolve();}
      };
      view.raf=requestAnimationFrame(frame);
    });
    view.fallback=()=>{view.disposed=true;cancelAnimationFrame(view.raf);view.observer?.disconnect?.();cv.remove();el.classList.remove('die3d');views.delete(view);delete el.__die3d;};
    views.add(view);el.__die3d=view;view.render();
    // keep the picture sharp when the layout or the equipped skin changes
    if(typeof ResizeObserver==='function'){view.observer=new ResizeObserver(()=>{if(!view.raf)view.render();});view.observer.observe(el);}
    return view;
  }
  root.addEventListener?.('bs-career-change',()=>{for(const view of views){view.skin=skinFor(view.el);view.render();}});
  root.BS_DIE3D=Object.freeze({supported,attach,SKINS:Object.freeze({...SKINS}),faceUp});
})(typeof window!=='undefined'?window:globalThis);
