/**
 * Resilient Storage Utilities
 * Protects the application against corrupt localStorage/sessionStorage values,
 * quota exceeded errors, and SSR/iframe access restrictions.
 */

export const safeStorage = {
  getItem<T>(key: string, fallback: T): T {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return fallback;
      }
      const raw = window.localStorage.getItem(key);
      if (raw === null || raw === undefined) {
        return fallback;
      }
      try {
        return JSON.parse(raw) as T;
      } catch (parseError) {
        console.warn(`[safeStorage] Corrupted JSON in localStorage key "${key}". Clearing corrupted cache.`, parseError);
        window.localStorage.removeItem(key);
        return fallback;
      }
    } catch (storageError) {
      console.warn(`[safeStorage] Failed to read localStorage key "${key}":`, storageError);
      return fallback;
    }
  },

  setItem<T>(key: string, value: T): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (storageError) {
      console.warn(`[safeStorage] Failed to set localStorage key "${key}":`, storageError);
      return false;
    }
  },

  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignore
    }
  },
};
