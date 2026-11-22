import {
  THEME_STORAGE_KEY,
  bootstrapTheme,
  getStoredTheme,
  persistTheme,
} from '../utils/theme';

describe('theme preference persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  test('restores the manually selected dark theme before app render', () => {
    persistTheme('dark');

    expect(getStoredTheme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    document.documentElement.removeAttribute('data-theme');
    expect(bootstrapTheme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  test('does not replace an explicit dark preference with the operating system theme', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    window.matchMedia = jest.fn(() => ({ matches: false }));

    bootstrapTheme();

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(window.matchMedia).not.toHaveBeenCalled();
  });

  test('accepts only explicit light and dark choices', () => {
    expect(persistTheme('system')).toBe(false);
    expect(getStoredTheme()).toBeNull();
  });
});
