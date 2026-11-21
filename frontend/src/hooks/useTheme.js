import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';

/**
 * Hook para acessar o tema atual
 * @returns {Object} { theme, toggleTheme, setTheme, isDark }
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme deve ser usado dentro de um ThemeProvider');
  }
  return context;
}

export default useTheme;