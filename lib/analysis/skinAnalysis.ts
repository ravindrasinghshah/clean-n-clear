import OpenAI from 'openai';
import type { SkinAnalysisResult } from '@/lib/types/skincare';

const fallback: SkinAnalysisResult = {
  skinType: 'unknown',
  faceType: 'unknown',
  concerns: ['dehydration'],
  confidence: 0.35,
  notes: ['Image analysis is unavailable, so this routine uses conservative barrier-support guidance.'],
  safetyFlags: ['No diagnosis is provided.']
};

export async function analyzeSkinImage(imageDataUrl: string): Promise<SkinAnalysisResult> {
  if (!process.env.OPENAI_API_KEY) return fallback;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_VISION_MODEL ?? 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You are a cosmetic skincare assistant for a US MVP. Analyze visible cosmetic skin attributes only. Do not diagnose medical conditions. Use unknown for low confidence. Return strict JSON.'
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Return JSON with skinType, faceType, concerns array, confidence 0-1, notes array, safetyFlags array. Allowed skinType: oily,dry,combination,normal,sensitive,unknown. Allowed faceType: oval,round,square,heart,oblong,unknown. Allowed concerns: acne-prone,redness,dark-spots,texture,fine-lines,dehydration,irritation,congestion.' },
          { type: 'image_url', image_url: { url: imageDataUrl } }
        ]
      }
    ]
  });

  const content = response.choices[0]?.message.content;
  if (!content) return fallback;

  try {
    const parsed = JSON.parse(content) as SkinAnalysisResult;
    return {
      skinType: parsed.skinType ?? 'unknown',
      faceType: parsed.faceType ?? 'unknown',
      concerns: Array.isArray(parsed.concerns) ? parsed.concerns : [],
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      safetyFlags: Array.isArray(parsed.safetyFlags) ? parsed.safetyFlags : []
    };
  } catch {
    return fallback;
  }
}
