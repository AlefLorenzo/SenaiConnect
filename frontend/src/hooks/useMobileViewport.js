import { useState, useEffect } from 'react';

/**
 * Hook to detect mobile viewport (max-width: 768px)
 * Uses matchMedia for efficient detection and SSR-safe
 */
export function useMobileViewport(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= breakpoint;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint}px)`);

    const handleChange = (e) => {
      setIsMobile(e.matches);
    };

    // Set initial value (deferred to avoid synchronous setState in effect)
    setTimeout(() => setIsMobile(mediaQuery.matches), 0);

    // Listen for changes
    mediaQuery.addEventListener?.('change', handleChange);
    // Fallback for older browsers
    mediaQuery.addListener?.(handleChange);

    return () => {
      mediaQuery.removeEventListener?.('change', handleChange);
      mediaQuery.removeListener?.(handleChange);
    };
  }, [breakpoint]);

  return isMobile;
}

/**
 * Hook to detect if the device supports hover
 */
export function useHoverSupport() {
  const [hasHover, setHasHover] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(hover: hover)').matches;
    }
    return true;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(hover: hover)');

    const handleChange = (e) => {
      setHasHover(e.matches);
    };

    // Set initial value (deferred to avoid synchronous setState in effect)
    setTimeout(() => setHasHover(mediaQuery.matches), 0);
    mediaQuery.addEventListener?.('change', handleChange);
    mediaQuery.addListener?.(handleChange);

    return () => {
      mediaQuery.removeEventListener?.('change', handleChange);
      mediaQuery.removeListener?.(handleChange);
    };
  }, []);

  return hasHover;
}

/**
 * Hook to detect touch support
 */
export function useTouchSupport() {
  const [hasTouch] = useState(() => {
    if (typeof window !== 'undefined') {
      return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }
    return false;
  });

  return hasTouch;
}