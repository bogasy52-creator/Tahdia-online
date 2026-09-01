import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGeneratedPack } from '../src/ai-questions.js';

test('AI question guard accepts clear easy questions',()=>{
  const out=validateGeneratedPack({questions:[{q:'ما الكوكب المعروف بالكوكب الأحمر؟',a:'المريخ',distractors:['الزهرة','عطارد','زحل'],level:'سهل'}]});
  assert.equal(out.length,1); assert.equal(out[0].v,100);
});

test('AI question guard rejects ambiguity, duplicates and long answers',()=>{
  const out=validateGeneratedPack({questions:[
    {q:'ما الإجابة الصحيحة في هذا السؤال العام؟',a:'جميع ما سبق',distractors:['أ','ب','ج'],level:'سهل'},
    {q:'ما عاصمة المملكة العربية السعودية؟',a:'الرياض',distractors:['الرياض','جدة','أبها'],level:'سهل'}
  ]});
  assert.equal(out.length,0);
});
