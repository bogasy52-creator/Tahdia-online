import ctypes as C,os,re,json
from pathlib import Path
os.environ['EGL_PLATFORM']='surfaceless'
e=C.CDLL('libEGL.so.1');P=C.c_void_p;I=C.c_int;U=C.c_uint;F=C.c_float

def ef(n,ret,args):f=getattr(e,n);f.restype=ret;f.argtypes=args;return f
display=ef('eglGetDisplay',P,[P])(None);a=I();b=I();assert ef('eglInitialize',U,[P,C.POINTER(I),C.POINTER(I)])(display,C.byref(a),C.byref(b)),'EGL initialization unavailable'
assert ef('eglBindAPI',U,[U])(0x30A0)
attrs=(I*15)(0x3024,8,0x3023,8,0x3022,8,0x3021,8,0x3033,1,0x3040,4,0x3038,0,0);conf=P();num=I();assert ef('eglChooseConfig',U,[P,C.POINTER(I),C.POINTER(P),I,C.POINTER(I)])(display,attrs,C.byref(conf),1,C.byref(num)) and num.value
ctx=ef('eglCreateContext',P,[P,P,P,C.POINTER(I)])(display,conf,None,(I*3)(0x3098,2,0x3038));surface=ef('eglCreatePbufferSurface',P,[P,P,C.POINTER(I)])(display,conf,(I*5)(0x3057,256,0x3056,256,0x3038));assert ctx and surface
assert ef('eglMakeCurrent',U,[P,P,P,P])(display,surface,surface,ctx)
get=ef('eglGetProcAddress',P,[C.c_char_p])
def gl(n,ret,args):return C.CFUNCTYPE(ret,*args)(get(n.encode()))
source=(Path(__file__).resolve().parents[1]/'public/assets/js/dice-3d-v31-1.js').read_text();vert=re.search(r"const VERT='(.*?)';",source)[1];frag=re.search(r'const FRAG=`([\s\S]*?)`;',source)[1]
shaders=[]
for typ,s in [(0x8B31,vert),(0x8B30,frag)]:
 sh=gl('glCreateShader',U,[U])(typ);data=C.c_char_p(s.encode());gl('glShaderSource',None,[U,I,C.POINTER(C.c_char_p),C.POINTER(I)])(sh,1,C.byref(data),None);gl('glCompileShader',None,[U])(sh);ok=I();gl('glGetShaderiv',None,[U,U,C.POINTER(I)])(sh,0x8B81,C.byref(ok));buf=C.create_string_buffer(16384);gl('glGetShaderInfoLog',None,[U,I,C.POINTER(I),P])(sh,len(buf),None,buf);assert ok.value,buf.value.decode();shaders.append(sh)
prog=gl('glCreateProgram',U,[])()
for sh in shaders:gl('glAttachShader',None,[U,U])(prog,sh)
gl('glLinkProgram',None,[U])(prog);ok=I();gl('glGetProgramiv',None,[U,U,C.POINTER(I)])(prog,0x8B82,C.byref(ok));assert ok.value,'Shader link failed'
print(json.dumps({'runtime':'native EGL / OpenGL ES','egl':str(a.value)+'.'+str(b.value),'vertex_compiled':True,'fragment_compiled':True,'program_linked':True,'patterns':list(range(5,11))}))
