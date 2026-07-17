import { ApiError, GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import type {
  AnalysisUnavailableCode,
  FaceType,
  ImageQualityIssue,
  SkinAnalysisResult,
  SkinConcern,
  SkinImageAnalysisOutcome,
  SkinType
} from '@/lib/types/skincare';
import { imageQualityIssueValues } from '@/lib/types/skincare';

export const MIN_IMAGE_QUALITY_SCORE = 0.7;
export const MIN_ANALYSIS_CONFIDENCE = 0.7;

const defaultModel = 'gemini-3.5-flash';
const defaultFallbackModel = 'gemini-2.5-flash';
const maxInlineImageBytes = 14 * 1024 * 1024;
const maxAttemptsPerModel = 2;
const sdkAttemptsPerRequest = 1;
const providerTimeoutMs = 30_000;

function elapsedSince(startedAt: number) {
  return Date.now() - startedAt;
}

function logAnalysis(requestId: string, event: string, details: Record<string, unknown> = {}) {
  console.info(`[analyze:${requestId}] ${event}`, details);
}

function warnAnalysis(requestId: string, event: string, details: Record<string, unknown> = {}) {
  console.warn(`[analyze:${requestId}] ${event}`, details);
}

const skinTypes = new Set<SkinType>(['oily', 'dry', 'combination', 'normal', 'sensitive', 'unknown']);
const faceTypes = new Set<FaceType>(['oval', 'round', 'square', 'heart', 'oblong', 'unknown']);
const skinConcerns = new Set<SkinConcern>([
  'acne-prone',
  'redness',
  'dark-spots',
  'texture',
  'fine-lines',
  'dehydration',
  'irritation',
  'congestion'
]);
const imageQualityIssues = new Set<ImageQualityIssue>(imageQualityIssueValues);

const retakeTipByIssue: Record<ImageQualityIssue, string> = {
  'face-not-visible': 'Make sure your whole face is clearly visible in the photo.',
  'face-too-small': 'Move closer so your face fills most of the frame.',
  'face-not-front-facing': 'Look straight at the camera and keep your face level.',
  'too-dark': 'Face a window or other soft, even light and avoid backlighting.',
  'too-bright': 'Use soft, even light and avoid direct flash or harsh sunlight.',
  blurry: 'Hold the camera steady and wait for the image to focus before taking it.',
  obstructed: 'Move hair, masks, glasses, or other objects away from your face.',
  'multiple-faces': 'Upload a photo with only one face in the frame.',
  'low-resolution': "Use the camera's regular photo mode instead of a screenshot or heavily compressed image.",
  'insufficient-detail': 'Use a clear, unfiltered close-up with your face centered in even light.'
};

/**
 * This is both the local contract for Gemini output and the source of the
 * API-level JSON Schema passed to the SDK. Strict objects reject invented
 * fields rather than silently accepting them.
 */
export const GeminiSkinAnalysisSchema = z.object({
  skinType: z.enum(['oily', 'dry', 'combination', 'normal', 'sensitive', 'unknown']),
  faceType: z.enum(['oval', 'round', 'square', 'heart', 'oblong', 'unknown']),
  concerns: z.array(z.enum(['acne-prone', 'redness', 'dark-spots', 'texture', 'fine-lines', 'dehydration', 'irritation', 'congestion'])).max(8),
  confidence: z.number().min(0).max(1),
  imageQuality: z.object({
    score: z.number().min(0).max(1),
    suitableForAnalysis: z.boolean(),
    issues: z.array(z.enum(imageQualityIssueValues)).max(4)
  }).strict(),
  notes: z.array(z.string().max(280)).max(5),
  safetyFlags: z.array(z.string().max(280)).max(5)
}).strict();

export type GeminiSkinAnalysisResult = z.infer<typeof GeminiSkinAnalysisSchema>;

const { $schema: _schemaVersion, ...geminiResponseJsonSchema } = z.toJSONSchema(GeminiSkinAnalysisSchema, {
  target: 'draft-07'
});

const systemInstruction = [
  'You are a cosmetic skincare assistant for a US MVP.',
  'Assess photo quality before considering any cosmetic skin attributes.',
  'Only analyze a single, clear, front-facing face that is close enough, in even light, in focus, and unobstructed.',
  'When the image is not suitable, set imageQuality.suitableForAnalysis to false, list applicable imageQuality.issues, set skinType and faceType to unknown, return an empty concerns array, and keep confidence below 0.70.',
  'A ready analysis requires imageQuality.suitableForAnalysis to be true, no imageQuality.issues, imageQuality.score and confidence at least 0.70, and a known skinType. Otherwise use the fallback values for an unsuitable image.',
  'For suitable images, confidence must reflect uncertainty in the visible attributes. Use unknown instead of guessing.',
  'Do not diagnose medical conditions or infer identity, age, ethnicity, or other sensitive traits. Keep notes brief and easy to understand.',
  'Return only the requested JSON object.'
].join(' ');

const imageAssessmentInstruction = 'Assess this selfie for photo quality and, only if it is suitable, visible cosmetic skin attributes.';

export type ParsedImageData = {
  mimeType: string;
  data: string;
  byteLength: number;
};

type GeminiFailure = {
  code: AnalysisUnavailableCode;
  httpStatus: number;
  message: string;
  retryable: boolean;
};

type GeminiRequestResult =
  | { ok: true; analysis: GeminiSkinAnalysisResult }
  | { ok: false; failure: GeminiFailure };

type RawAnalysis = GeminiSkinAnalysisResult;

export function parseImageDataUrl(imageDataUrl: string): ParsedImageData | null {
  const match = imageDataUrl.match(/^data:(image\/[\w.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return null;

  const data = match[2].replace(/\s/g, '');
  if (!data) return null;

  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  return { mimeType: match[1], data, byteLength: Math.floor((data.length * 3) / 4) - padding };
}

function normalizeUnitInterval(value: unknown, fallback = 0) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

function normalizeEnum<T extends string>(value: unknown, allowed: ReadonlySet<T>, fallback: T): T {
  return typeof value === 'string' && allowed.has(value as T) ? (value as T) : fallback;
}

function normalizeEnumList<T extends string>(value: unknown, allowed: ReadonlySet<T>, limit = 8): T[] {
  if (!Array.isArray(value)) return [];

  const values: T[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !allowed.has(item as T)) continue;
    const normalized = item as T;
    if (!values.includes(normalized)) values.push(normalized);
    if (values.length === limit) break;
  }

  return values;
}

function normalizeTextList(value: unknown, limit = 5): string[] {
  if (!Array.isArray(value)) return [];

  const values: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const normalized = item.replace(/\s+/g, ' ').trim().slice(0, 280);
    if (normalized && !values.includes(normalized)) values.push(normalized);
    if (values.length === limit) break;
  }

  return values;
}

function retakeInstructionsFor(issues: ImageQualityIssue[]) {
  const instructions = issues.map((issue) => retakeTipByIssue[issue]);
  return [...new Set(instructions)].slice(0, 3);
}

function normalizeResult(parsed: RawAnalysis): SkinAnalysisResult {
  const reportedSkinType = normalizeEnum(parsed.skinType, skinTypes, 'unknown');
  const reportedFaceType = normalizeEnum(parsed.faceType, faceTypes, 'unknown');
  const confidence = normalizeUnitInterval(parsed.confidence);
  const rawImageQuality = parsed.imageQuality;
  const qualityScore = normalizeUnitInterval(rawImageQuality.score);
  const reportedIssues = normalizeEnumList(rawImageQuality.issues, imageQualityIssues, 4);
  const reportsUsableImage = rawImageQuality.suitableForAnalysis === true;
  const hasInsufficientSkinAssessment = reportedSkinType === 'unknown';
  const needsRetake =
    !reportsUsableImage ||
    qualityScore < MIN_IMAGE_QUALITY_SCORE ||
    confidence < MIN_ANALYSIS_CONFIDENCE ||
    reportedIssues.length > 0 ||
    hasInsufficientSkinAssessment;
  const issues: ImageQualityIssue[] = needsRetake && reportedIssues.length === 0 ? ['insufficient-detail'] : reportedIssues;

  // JSON Schema cannot express the conditional fallback rule. Enforce it here
  // so an unsuitable image can never leak an inferred skin/face attribute.
  const skinType = needsRetake ? 'unknown' : reportedSkinType;
  const faceType = needsRetake ? 'unknown' : reportedFaceType;
  const normalizedConfidence = needsRetake ? Math.min(confidence, MIN_ANALYSIS_CONFIDENCE - 0.01) : confidence;
  const concerns = needsRetake ? [] : normalizeEnumList(parsed.concerns, skinConcerns);

  return {
    skinType,
    faceType,
    concerns,
    confidence: normalizedConfidence,
    imageQuality: {
      score: qualityScore,
      suitableForAnalysis: !needsRetake,
      issues,
      retakeInstructions: needsRetake ? retakeInstructionsFor(issues) : []
    },
    notes: normalizeTextList(parsed.notes),
    safetyFlags: normalizeTextList(parsed.safetyFlags)
  };
}

function unavailable(
  message = 'Image analysis is temporarily unavailable. Please try again in a moment.',
  code: AnalysisUnavailableCode = 'GEMINI_UNAVAILABLE',
  httpStatus = 503
): SkinImageAnalysisOutcome {
  return { status: 'unavailable', message, code, httpStatus };
}

function retake(analysis: SkinAnalysisResult): SkinImageAnalysisOutcome {
  const reasons = analysis.imageQuality.issues;
  return {
    status: 'retake',
    confidence: analysis.confidence,
    imageQuality: analysis.imageQuality,
    reasons,
    tips: analysis.imageQuality.retakeInstructions
  };
}

function createGenerateContentRequest(image: ParsedImageData) {
  return {
    contents: [{
      role: 'user',
      parts: [
        { text: imageAssessmentInstruction },
        { inlineData: { mimeType: image.mimeType, data: image.data } }
      ]
    }],
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseJsonSchema: geminiResponseJsonSchema
    }
  };
}

function isTransientStatus(status: number) {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function retryDelay(attempt: number) {
  return 750 * 2 ** attempt + Math.floor(Math.random() * 250);
}

function sleep(duration: number) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

function failureFromStatus(
  providerStatus: number,
  model: string,
  requestId: string,
  attempt: number,
  attemptStartedAt: number
): GeminiFailure {
  warnAnalysis(requestId, 'provider response failure', {
    model,
    attempt,
    httpStatus: providerStatus,
    elapsedMs: elapsedSince(attemptStartedAt)
  });

  if (providerStatus === 400) {
    return {
      code: 'GEMINI_INVALID_REQUEST',
      httpStatus: 422,
      message: 'Gemini could not process this photo. Try a clear JPG, PNG, WebP, HEIC, or HEIF image under 14 MB.',
      retryable: false
    };
  }

  if (providerStatus === 401 || providerStatus === 403) {
    return {
      code: 'GEMINI_PERMISSION_DENIED',
      httpStatus: 500,
      message: 'Gemini rejected the API key. Check GEMINI_API_KEY in your server environment and create a new key in Google AI Studio if needed.',
      retryable: false
    };
  }

  if (providerStatus === 404) {
    return {
      code: 'GEMINI_MODEL_NOT_FOUND',
      httpStatus: 500,
      message: `The configured Gemini model (${model}) is not available to this API key.`,
      retryable: false
    };
  }

  if (providerStatus === 429) {
    return {
      code: 'GEMINI_RATE_LIMITED',
      httpStatus: 429,
      message: 'Gemini is rate-limiting requests right now. Please wait a moment and try again.',
      retryable: true
    };
  }

  if (!isTransientStatus(providerStatus)) {
    return {
      code: 'GEMINI_INVALID_RESPONSE',
      httpStatus: 502,
      message: 'Gemini returned an unexpected response. Please try again shortly.',
      retryable: false
    };
  }

  return {
    code: 'GEMINI_UNAVAILABLE',
    httpStatus: 503,
    message: 'Gemini is temporarily busy. We retried automatically; please try again in a moment.',
    retryable: isTransientStatus(providerStatus)
  };
}

function failureFromError(error: unknown, model: string, requestId: string, attempt: number, attemptStartedAt: number): GeminiFailure {
  const providerStatus = error instanceof ApiError
    ? error.status
    : typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
      ? error.status
      : undefined;

  if (providerStatus !== undefined) {
    return failureFromStatus(providerStatus, model, requestId, attempt, attemptStartedAt);
  }

  warnAnalysis(requestId, 'provider transport failure', {
    model,
    attempt,
    elapsedMs: elapsedSince(attemptStartedAt),
    errorName: error instanceof Error ? error.name : 'UnknownError'
  });

  return {
    code: 'GEMINI_UNAVAILABLE',
    httpStatus: 503,
    message: 'We could not reach Gemini. Please check your connection and try again in a moment.',
    retryable: true
  };
}

async function requestGemini(client: GoogleGenAI, model: string, image: ParsedImageData, requestId: string): Promise<GeminiRequestResult> {
  let lastFailure: GeminiFailure | undefined;

  for (let attemptIndex = 0; attemptIndex < maxAttemptsPerModel; attemptIndex += 1) {
    const attempt = attemptIndex + 1;
    const attemptStartedAt = Date.now();
    logAnalysis(requestId, 'provider attempt started', {
      model,
      attempt,
      maxAttempts: maxAttemptsPerModel
    });

    try {
      const response = await client.models.generateContent({
        model,
        ...createGenerateContentRequest(image)
      });
      const content = response.text?.trim() ?? '';

      logAnalysis(requestId, 'provider response received', {
        model,
        attempt,
        elapsedMs: elapsedSince(attemptStartedAt),
        responseId: response.responseId ?? 'unavailable',
        modelVersion: response.modelVersion ?? 'unknown',
        finishReason: response.candidates?.[0]?.finishReason ?? 'unknown',
        promptBlockReason: response.promptFeedback?.blockReason ?? 'none',
        totalTokenCount: response.usageMetadata?.totalTokenCount ?? null
      });

      if (!content) {
        warnAnalysis(requestId, 'provider returned no text content', { model, attempt });
        return {
          ok: false,
          failure: {
            code: 'GEMINI_INVALID_RESPONSE',
            httpStatus: 502,
            message: 'Gemini did not return a usable analysis. Please try another clear photo.',
            retryable: false
          }
        };
      }

      const responseParseStartedAt = Date.now();
      let rawResult: unknown;
      try {
        rawResult = JSON.parse(content);
      } catch {
        warnAnalysis(requestId, 'provider returned invalid JSON', {
          model,
          attempt,
          contentCharacters: content.length
        });
        return {
          ok: false,
          failure: {
            code: 'GEMINI_INVALID_RESPONSE',
            httpStatus: 502,
            message: 'Gemini did not return a readable analysis. Please try another clear photo.',
            retryable: false
          }
        };
      }

      const parsedResult = GeminiSkinAnalysisSchema.safeParse(rawResult);
      logAnalysis(requestId, 'provider response validated', {
        model,
        attempt,
        elapsedMs: elapsedSince(responseParseStartedAt),
        contentCharacters: content.length,
        valid: parsedResult.success
      });
      if (parsedResult.success) return { ok: true, analysis: parsedResult.data };

      warnAnalysis(requestId, 'provider structured output rejected', {
        model,
        attempt,
        issueCount: parsedResult.error.issues.length
      });
      return {
        ok: false,
        failure: {
          code: 'GEMINI_INVALID_RESPONSE',
          httpStatus: 502,
          message: 'Gemini returned an incomplete analysis. Please try another clear photo.',
          retryable: false
        }
      };
    } catch (error) {
      lastFailure = failureFromError(error, model, requestId, attempt, attemptStartedAt);
    }

    if (!lastFailure.retryable || attemptIndex === maxAttemptsPerModel - 1) break;

    const delayMs = retryDelay(attemptIndex);
    logAnalysis(requestId, 'provider retry scheduled', {
      model,
      attempt,
      delayMs,
      failureCode: lastFailure.code,
      httpStatus: lastFailure.httpStatus
    });
    await sleep(delayMs);
  }

  warnAnalysis(requestId, 'provider request sequence failed', {
    model,
    failureCode: lastFailure?.code ?? 'GEMINI_UNAVAILABLE',
    httpStatus: lastFailure?.httpStatus ?? 503
  });
  return {
    ok: false,
    failure: lastFailure ?? {
      code: 'GEMINI_UNAVAILABLE',
      httpStatus: 503,
      message: 'Image analysis is temporarily unavailable. Please try again in a moment.',
      retryable: true
    }
  };
}

export async function analyzeSkinImage(image: ParsedImageData, requestId: string): Promise<SkinImageAnalysisOutcome> {
  const analysisStartedAt = Date.now();
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    warnAnalysis(requestId, 'analysis stopped because API key is missing', { elapsedMs: elapsedSince(analysisStartedAt) });
    return unavailable('GEMINI_API_KEY is missing from the server environment.', 'GEMINI_API_KEY_MISSING', 500);
  }
  if (image.byteLength > maxInlineImageBytes) {
    warnAnalysis(requestId, 'analysis stopped because image is too large', {
      imageBytes: image.byteLength,
      maxImageBytes: maxInlineImageBytes,
      elapsedMs: elapsedSince(analysisStartedAt)
    });
    return unavailable('This image is too large to analyze. Choose a photo smaller than 14 MB.', 'GEMINI_INVALID_REQUEST', 413);
  }

  const model = process.env.GEMINI_VISION_MODEL?.trim() || defaultModel;
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL?.trim() || defaultFallbackModel;
  logAnalysis(requestId, 'analysis started', {
    model,
    fallbackModel,
    mimeType: image.mimeType,
    imageBytes: image.byteLength,
    providerTimeoutMs,
    sdkAttemptsPerRequest,
    outerAttemptsPerModel: maxAttemptsPerModel
  });

  let client: GoogleGenAI;
  try {
    client = new GoogleGenAI({
      apiKey,
      httpOptions: {
        timeout: providerTimeoutMs,
        retryOptions: { attempts: sdkAttemptsPerRequest }
      }
    });
  } catch (error) {
    warnAnalysis(requestId, 'Gemini SDK client could not be initialized', {
      elapsedMs: elapsedSince(analysisStartedAt),
      errorName: error instanceof Error ? error.name : 'UnknownError'
    });
    return unavailable('Gemini could not be initialized. Check the server configuration and try again.', 'GEMINI_INVALID_REQUEST', 500);
  }

  logAnalysis(requestId, 'SDK structured request prepared', {
    responseMimeType: 'application/json',
    schema: 'GeminiSkinAnalysisSchema'
  });

  let response = await requestGemini(client, model, image, requestId);

  if (!response.ok && response.failure.code === 'GEMINI_UNAVAILABLE' && response.failure.retryable && fallbackModel !== model) {
    warnAnalysis(requestId, 'fallback model started', {
      fromModel: model,
      toModel: fallbackModel,
      failureCode: response.failure.code,
      httpStatus: response.failure.httpStatus,
      elapsedMs: elapsedSince(analysisStartedAt)
    });
    response = await requestGemini(client, fallbackModel, image, requestId);
  }

  if (!response.ok) {
    warnAnalysis(requestId, 'analysis failed', {
      failureCode: response.failure.code,
      httpStatus: response.failure.httpStatus,
      elapsedMs: elapsedSince(analysisStartedAt)
    });
    return unavailable(response.failure.message, response.failure.code, response.failure.httpStatus);
  }

  try {
    const normalizationStartedAt = Date.now();
    const analysis = normalizeResult(response.analysis);
    const outcome: SkinImageAnalysisOutcome = analysis.imageQuality.suitableForAnalysis ? { status: 'ready', analysis } : retake(analysis);
    logAnalysis(requestId, 'provider result normalized', {
      elapsedMs: elapsedSince(normalizationStartedAt),
      totalElapsedMs: elapsedSince(analysisStartedAt),
      outcome: outcome.status,
      confidence: analysis.confidence,
      qualityScore: analysis.imageQuality.score,
      concernCount: analysis.concerns.length
    });
    return outcome;
  } catch (error) {
    warnAnalysis(requestId, 'provider result could not be normalized', {
      elapsedMs: elapsedSince(analysisStartedAt),
      errorName: error instanceof Error ? error.name : 'UnknownError'
    });
    return unavailable('Gemini returned an unreadable analysis. Please try again.', 'GEMINI_INVALID_RESPONSE', 502);
  }
}
