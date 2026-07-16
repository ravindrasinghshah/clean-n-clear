import type { RoutineRecommendation, SkinAnalysisResult } from '@/lib/types/skincare';

export type ScanResult = { analysis: SkinAnalysisResult; routine: RoutineRecommendation };
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

export function saveCurrentResult(result: ScanResult) {
  window.localStorage.setItem(currentResultKey, JSON.stringify(result));
}

export function getCurrentResult() {
  return readJson<ScanResult>(currentResultKey);
}

export function saveRoutine(result: ScanResult) {
  const existing = readJson<SavedRoutine[]>(savedRoutinesKey);
  const routines = Array.isArray(existing) ? existing : [];
  const savedRoutine: SavedRoutine = { ...result, savedAt: new Date().toISOString() };

  window.localStorage.setItem(savedRoutinesKey, JSON.stringify([savedRoutine, ...routines].slice(0, 20)));
  return savedRoutine;
}
