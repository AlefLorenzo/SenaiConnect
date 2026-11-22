import { useState, useEffect, useCallback, createContext } from 'react';
import { getStoredTheme, persistTheme, bootstrapTheme } from '../utils/theme.js';

export const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => bootstrapTheme() || 'light');

  useEffect(() => {
    const stored = getStoredTheme();
    if (stored && stored !== theme) setThemeState(stored);
  }, [theme]);

  const setTheme = useCallback((nextTheme) => {
    if (persistTheme(nextTheme)) setThemeState(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}
