import type { RoutineRecommendation, RoutineStep, SkinAnalysisResult } from '@/lib/types/skincare';

export type ScanResult = { analysis: SkinAnalysisResult; routine: RoutineRecommendation; imageDataUrl: string };
export type SavedRoutine = ScanResult & { savedAt: string };

const currentResultKey = 'clean-n-clear-current-result';
const savedRoutinesKey = 'clean-n-clear-saved-routines';

function readJson<T>(key: string): T | null {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

function normalizeStep(step: RoutineStep): RoutineStep {
  if (!Array.isArray(step.products)) {
    const stepWithoutProducts = { ...step };
    delete stepWithoutProducts.products;
    return stepWithoutProducts;
  }

  return step;
}

function normalizeRoutine(routine: RoutineRecommendation): RoutineRecommendation {
  return {
    ...routine,
    morning: Array.isArray(routine.morning) ? routine.morning.map(normalizeStep) : [],
    evening: Array.isArray(routine.evening) ? routine.evening.map(normalizeStep) : [],
    weekly: Array.isArray(routine.weekly) ? routine.weekly.map(normalizeStep) : [],
    avoidOrIntroduceSlowly: Array.isArray(routine.avoidOrIntroduceSlowly) ? routine.avoidOrIntroduceSlowly : []
  };
}

function normalizeScanResult<T extends ScanResult>(result: T): T {
  return {
    ...result,
    routine: normalizeRoutine(result.routine)
  };
}

export function saveCurrentResult(result: ScanResult) {
  window.localStorage.setItem(currentResultKey, JSON.stringify(result));
}

export function getCurrentResult() {
  const result = readJson<ScanResult>(currentResultKey);
  return result ? normalizeScanResult(result) : null;
}

export function getSavedRoutines() {
  const savedRoutines = readJson<SavedRoutine[]>(savedRoutinesKey);
  return Array.isArray(savedRoutines) ? savedRoutines.map(normalizeScanResult) : [];
}

export function saveRoutine(result: ScanResult) {
  const routines = getSavedRoutines();
  const savedRoutine: SavedRoutine = { ...normalizeScanResult(result), savedAt: new Date().toISOString() };

  window.localStorage.setItem(savedRoutinesKey, JSON.stringify([savedRoutine, ...routines].slice(0, 20)));
  return savedRoutine;
}
