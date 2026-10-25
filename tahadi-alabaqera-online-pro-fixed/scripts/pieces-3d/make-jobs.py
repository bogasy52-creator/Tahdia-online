import json,sys
cols=['#e0474c','#2f86e8','#f0b429','#22a565','#8b5cf6','#f2711c']
V=[('pawn-classic',0,0,'s'),('pawn-atlas',1,0,'s'),('pawn-rook',2,0,'g'),('pawn-onyx',2,2,'g'),('pawn-orbit',3,0,'g'),('pawn-lance',4,6,'s'),('pawn-lotus',5,1,'g'),('pawn-monolith',6,0,'s'),('pawn-prism',6,4,'s'),('pawn-jade',7,3,'g'),('pawn-amethyst',7,0,'g'),('pawn-gold',8,0,'g'),('pawn-crown',8,5,'g'),('pawn-orb',9,0,'g')]
M=['glass','metal','galaxy','pearl','royal']
jobs=[]
only=sys.argv[1] if len(sys.argv)>1 else ''
for name,shape,fin,trim in V:
    for ci,c in enumerate(cols):
        j={"name":f"{name}-{ci}","shape":shape,"finish":fin,"color":c,"trim":"#e7c36d" if trim=='g' else "#d9dde2","elev":0.42,"yaw":0.35,"frame":[-0.7,0.7,-0.25,1.95],"w":384,"h":604}
        if not only or only in j['name']:jobs.append(j)
for mi,m in enumerate(M):
    for ci,c in enumerate(cols):
        j={"name":f"marble-{m}-{ci}","shape":20,"marble":mi,"color":c,"elev":0.62,"yaw":0.4,"frame":[-0.65,0.65,-0.243,1.057],"w":384,"h":384}
        if not only or only in j['name']:jobs.append(j)
json.dump(jobs,open('jobs-all.json','w'))
print(len(jobs))
