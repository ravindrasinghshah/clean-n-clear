import type { SkinAnalysisResult } from '@/lib/types/skincare';

const fallback: SkinAnalysisResult = {
  skinType: 'unknown',
  faceType: 'unknown',
  concerns: ['dehydration'],
  confidence: 0.35,
  notes: ['Image analysis is unavailable, so this routine uses conservative barrier-support guidance.'],
  safetyFlags: ['No diagnosis is provided.']
};

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

function parseImageDataUrl(imageDataUrl: string) {
  const match = imageDataUrl.match(/^data:(image\/[\w.+-]+);base64,([\s\S]+)$/);
  if (!match) return null;

  return { mimeType: match[1], data: match[2] };
}

function normalizeResult(parsed: Partial<SkinAnalysisResult>): SkinAnalysisResult {
  return {
    skinType: parsed.skinType ?? 'unknown',
    faceType: parsed.faceType ?? 'unknown',
    concerns: Array.isArray(parsed.concerns) ? parsed.concerns : [],
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    notes: Array.isArray(parsed.notes) ? parsed.notes : [],
    safetyFlags: Array.isArray(parsed.safetyFlags) ? parsed.safetyFlags : []
  };
}

export async function analyzeSkinImage(imageDataUrl: string): Promise<SkinAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  const image = parseImageDataUrl(imageDataUrl);
  if (!apiKey || !image) return fallback;

  const model = process.env.GEMINI_VISION_MODEL ?? 'gemini-2.0-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: 'You are a cosmetic skincare assistant for a US MVP. Analyze visible cosmetic skin attributes only. Do not diagnose medical conditions. Use unknown for low confidence.' }]
      },
      contents: [{
        role: 'user',
        parts: [
          { text: 'Return JSON with skinType, faceType, concerns array, confidence 0-1, notes array, safetyFlags array. Allowed skinType: oily,dry,combination,normal,sensitive,unknown. Allowed faceType: oval,round,square,heart,oblong,unknown. Allowed concerns: acne-prone,redness,dark-spots,texture,fine-lines,dehydration,irritation,congestion.' },
          { inline_data: { mime_type: image.mimeType, data: image.data } }
        ]
      }],
      generationConfig: { response_mime_type: 'application/json' }
    })
  });

  if (!response.ok) return fallback;

  const result = (await response.json()) as GeminiResponse;
  const content = result.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('');
  if (!content) return fallback;

  try {
    return normalizeResult(JSON.parse(content) as Partial<SkinAnalysisResult>);
  } catch {
    return fallback;
  }
}
