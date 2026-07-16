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
  notes: string[];
  safetyFlags: string[];
}

export interface RoutineStep {
  name: string;
  why: string;
  guidance: string;
}

export interface RoutineRecommendation {
  morning: RoutineStep[];
  evening: RoutineStep[];
  weekly: RoutineStep[];
  avoidOrIntroduceSlowly: string[];
  explanation: string;
  disclaimer: string;
}
