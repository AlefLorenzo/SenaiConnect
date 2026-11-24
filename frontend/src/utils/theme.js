export const THEME_STORAGE_KEY = 'senai_connect_theme';

export const isExplicitTheme = (theme) => theme === 'light' || theme === 'dark';

export const getStoredTheme = () => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isExplicitTheme(stored) ? stored : null;
  } catch {
    return null;
  }
};

export const applyTheme = (theme) => {
  if (!isExplicitTheme(theme) || typeof document === 'undefined') return false;
  document.documentElement.setAttribute('data-theme', theme);
  return true;
};

export const persistTheme = (theme) => {
  if (!isExplicitTheme(theme)) return false;

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The current page should still respond to a manual theme change if
    // browser storage is unavailable; persistence can be recovered from API.
  }

  applyTheme(theme);
  return true;
};

// Run before React mounts to prevent the default light stylesheet from
// flashing over a previously selected dark theme after a page reload.
export const bootstrapTheme = () => {
  const storedTheme = getStoredTheme();
  if (storedTheme) applyTheme(storedTheme);
  return storedTheme;
};
