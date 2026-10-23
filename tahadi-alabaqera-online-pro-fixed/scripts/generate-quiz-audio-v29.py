"""Original, deterministic sound-count/rhythm questions. No external recordings."""
from pathlib import Path
import numpy as np,wave,json,hashlib
root=Path(__file__).resolve().parents[1];out=root/'public/assets/sounds-v29';out.mkdir(exist_ok=True);rate=24000
clips=[];questions=[]
def make(index,title,answer,wrong,starts,freqs,value):
 length=max(starts)+.6;t=np.arange(int(length*rate))/rate;y=np.zeros_like(t)
 for j,start in enumerate(starts):
  u=t-start;mask=(u>=0)&(u<.18);a=u[mask];frequency=freqs[j%len(freqs)];env=(1-np.exp(-a*500))*np.exp(-a*24)
  y[mask]+=env*(np.sin(2*np.pi*frequency*a)+.25*np.sin(2*np.pi*frequency*2.7*a))
 active=np.abs(y)>.0005;rms=np.sqrt(np.mean(y[active]**2));y*=10**(-16.5/20)/rms;peak=max(abs(y));assert peak<.96
 pcm=np.round(y*32767).astype('<i2');name=f'pattern-{index:02d}.wav';path=out/name
 with wave.open(str(path),'wb')as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes(pcm.tobytes())
 clips.append({'file':name,'seconds':len(y)/rate,'pulseStarts':starts,'frequencies':freqs,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'peakDb':float(20*np.log10(peak)),'activeRmsDb':-16.5,'answer':answer})
 questions.append({'id':f'sound-v29-{index:02d}','v':value,'q':title,'a':answer,'distractors':wrong,'media':'sound','replays':2,'src':'assets/sounds-v29/'+name,'kind':'audio_pattern','mediaFamily':f'pattern:{index}','credit':'مقطع أصلي مصمّم للتحدي؛ عدد النغمات والإيقاع مطابقان للإجابة'})
for i,n in enumerate([2,3,4,5],1):make(i,f'كم نقرة تسمع في هذا المقطع؟ التحدي {i}.',f'{n} نقرات',[f'{k} نقرات'for k in range(1,7)if k!=n][:3],[.3+j*.48 for j in range(n)],[330],100)
for i,(seq,answer,wrong)in enumerate([
 ([300,450,600,750],'ترتفع تدريجيًا',['تنخفض تدريجيًا','ثابتة','عالٍ ثم منخفض بالتناوب']),
 ([750,600,450,300],'تنخفض تدريجيًا',['ترتفع تدريجيًا','ثابتة','منخفض ثم عالٍ بالتناوب']),
 ([300,750,300,750],'منخفض ثم عالٍ بالتناوب',['عالٍ ثم منخفض بالتناوب','ترتفع تدريجيًا','تنخفض تدريجيًا']),
 ([750,300,750,300],'عالٍ ثم منخفض بالتناوب',['منخفض ثم عالٍ بالتناوب','ترتفع تدريجيًا','ثابتة'])],5):make(i,f'كيف يتغيّر ارتفاع النغمات؟ استمع إلى النمط {i-4}.',answer,wrong,[.3,.85,1.4,1.95],seq,200)
for i,(starts,answer,wrong)in enumerate([
 ([.3,.8,1.3,1.8,2.3],'منتظم بفواصل متساوية',['يتسارع','يتباطأ','نقرتان ثم توقف طويل']),
 ([.3,1.1,1.7,2.1,2.3],'يتسارع',['يتباطأ','منتظم بفواصل متساوية','كل النقرات في لحظة واحدة']),
 ([.3,.5,.9,1.5,2.3],'يتباطأ',['يتسارع','منتظم بفواصل متساوية','نقرتان فقط']),
 ([.3,.55,1.8,2.05],'مجموعتان، في كل مجموعة نقرتان',['أربع نقرات بفواصل متساوية','ثلاث مجموعات','مجموعة واحدة من نقرتين'])],9):make(i,f'أي وصف يطابق إيقاع المقطع {i-8}؟',answer,wrong,starts,[480],300)
(out/'manifest.json').write_text(json.dumps({'version':29,'license':'Original synthesized audio; included with this project','targetActiveRmsDb':-16.5,'clips':clips},ensure_ascii=False,indent=2)+'\n')
(root/'scripts/quiz-audio-v29-questions.json').write_text(json.dumps(questions,ensure_ascii=False,indent=2)+'\n')
print(f'{len(clips)} original clips generated, no clipping')
