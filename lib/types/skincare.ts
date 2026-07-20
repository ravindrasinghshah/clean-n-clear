export type SkinType = 'oily' | 'dry' | 'combination' | 'normal' | 'sensitive' | 'unknown';
export type FaceType = 'oval' | 'round' | 'square' | 'heart' | 'oblong' | 'unknown';

export type SkinConcern =
  | 'acne-prone'
  | 'redness'
  | 'dark-spots'
  | 'texture'
  | 'fine-lines'
  | 'dehydration'
  | 'irritation'
  | 'congestion';

export const imageQualityIssueValues = [
  'face-not-visible',
  'face-too-small',
  'face-not-front-facing',
  'too-dark',
  'too-bright',
  'blurry',
  'obstructed',
  'multiple-faces',
  'low-resolution',
  'insufficient-detail'
] as const;

export type ImageQualityIssue = (typeof imageQualityIssueValues)[number];

export interface ImageQualityAssessment {
  /** A model-estimated photo-quality score from 0 (unusable) to 1 (excellent). */
  score: number;
  /** True only when the photo and the resulting skin analysis both meet the quality gate. */
  suitableForAnalysis: boolean;
  issues: ImageQualityIssue[];
  /** Short, user-facing actions for taking a clearer replacement selfie. */
  retakeInstructions: string[];
}

export interface ScanPreferences {
  routineLevel: 'minimal' | 'standard' | 'advanced';
  primaryGoal: 'acne' | 'hydration' | 'glow' | 'dark-spots' | 'anti-aging' | 'redness';
  sensitivities: string;
  currentRoutine: string;
}

export interface SkinAnalysisResult {
  skinType: SkinType;
  faceType: FaceType;
  concerns: SkinConcern[];
  confidence: number;
  imageQuality: ImageQualityAssessment;
  notes: string[];
  safetyFlags: string[];
}

export type AnalysisUnavailableCode =
  | 'GEMINI_API_KEY_MISSING'
  | 'GEMINI_INVALID_REQUEST'
  | 'GEMINI_PERMISSION_DENIED'
  | 'GEMINI_MODEL_NOT_FOUND'
  | 'GEMINI_RATE_LIMITED'
  | 'GEMINI_UNAVAILABLE'
  | 'GEMINI_INVALID_RESPONSE';

export type SkinImageAnalysisOutcome =
  | { status: 'ready'; analysis: SkinAnalysisResult }
  | {
      status: 'retake';
      confidence: number;
      imageQuality: ImageQualityAssessment;
      reasons: ImageQualityIssue[];
      tips: string[];
    }
  | {
      status: 'unavailable';
      message: string;
      code: AnalysisUnavailableCode;
      httpStatus: number;
    };

export interface ProductRecommendation {
  name: string;
  brand?: string;
  url?: string;
  price?: string;
  reason?: string;
}

export interface RoutineStep {
  name: string;
  why: string;
  guidance: string;
  products?: ProductRecommendation[];
}

export interface RoutineRecommendation {
  morning: RoutineStep[];
  evening: RoutineStep[];
  weekly: RoutineStep[];
  avoidOrIntroduceSlowly: string[];
  explanation: string;
  disclaimer: string;
}
