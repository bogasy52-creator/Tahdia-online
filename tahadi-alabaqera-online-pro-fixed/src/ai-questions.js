const ALLOWED_LEVELS = new Set(['سهل','متوسط']);
const clean = value => String(value || '').replace(/[<>]/g,'').trim();

export function validateGeneratedQuestion(raw, index = 0) {
  const q = clean(raw?.q), a = clean(raw?.a);
  const distractors = Array.isArray(raw?.distractors) ? raw.distractors.map(clean).filter(Boolean) : [];
  const level = ALLOWED_LEVELS.has(raw?.level) ? raw.level : 'متوسط';
  if (q.length < 12 || q.length > 140) return null;
  if (a.length < 1 || a.length > 45 || /جميع ما سبق|حسب|تقريب/i.test(a)) return null;
  if (distractors.length !== 3 || new Set([a, ...distractors]).size !== 4) return null;
  if (distractors.some(x => x.length > 45)) return null;
  return { id:`ai-${Date.now()}-${index}`, q, a, distractors, level, v:level === 'سهل' ? 100 : 200, kind:'ai_curated' };
}

export function validateGeneratedPack(payload) {
  const rows = Array.isArray(payload) ? payload : payload?.questions;
  return (Array.isArray(rows) ? rows : []).slice(0, 12).map(validateGeneratedQuestion).filter(Boolean);
}

export async function generateSafeQuestions(env, { category='معلومات عامة', count=6 }={}) {
  if (!env.AI_QUESTION_API_KEY) throw new Error('ai_not_configured');
  const endpoint = env.AI_QUESTION_ENDPOINT || 'https://api.openai.com/v1/responses';
  const prompt = `أنشئ ${Math.min(12,Math.max(3,Number(count)||6))} أسئلة مسابقات عربية من فئة ${clean(category)}. المستوى سهل أو متوسط فقط، للجمهور العام، بلا غموض أو خلافات أو معلومات وقتية. لكل سؤال إجابة واحدة قصيرة مؤكدة وثلاث إجابات خاطئة معقولة. أعد JSON فقط بالشكل: {"questions":[{"q":"...","a":"...","distractors":["...","...","..."],"level":"سهل"}]}`;
  const response = await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${env.AI_QUESTION_API_KEY}`},body:JSON.stringify({model:env.AI_QUESTION_MODEL||'gpt-5-mini',input:prompt})});
  if (!response.ok) throw new Error('ai_provider_error');
  const data = await response.json();
  const text = data.output_text || data.output?.flatMap(x=>x.content||[]).find(x=>x.type==='output_text')?.text || '';
  let parsed; try { parsed=JSON.parse(text.replace(/^```json\s*|\s*```$/g,'')); } catch { throw new Error('ai_invalid_json'); }
  const questions = validateGeneratedPack(parsed);
  if (questions.length < 3) throw new Error('ai_quality_rejected');
  return questions;
}
