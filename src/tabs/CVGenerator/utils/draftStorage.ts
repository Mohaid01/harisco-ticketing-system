const STORAGE_KEY = 'cv-generator-draft';

export const saveDraft = (data: Record<string, unknown>): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save draft to localStorage:', e);
  }
};

export const loadDraft = (): Record<string, unknown> | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load draft from localStorage:', e);
    return null;
  }
};

export const clearDraft = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear draft from localStorage:', e);
  }
};
