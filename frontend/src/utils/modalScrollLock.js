let activeLocks = 0;
let restorePageStyles = null;

/**
 * Reference-counted scroll lock for stacked/transitioning portals.
 * A sheet closing while a composer opens must not unlock the page underneath.
 */
export const acquireModalScrollLock = () => {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return () => {};
  }

  if (activeLocks === 0) {
    const body = document.body;
    const html = document.documentElement;
    const appMain = document.querySelector('.app-main');
    const scrollY = window.scrollY;
    const mainScrollTop = appMain?.scrollTop ?? 0;

    const previousStyles = {
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      bodyOverflow: body.style.overflow,
      htmlOverflow: html.style.overflow,
      htmlOverscrollBehavior: html.style.overscrollBehavior,
      mainOverflow: appMain?.style.overflow ?? '',
      mainOverflowY: appMain?.style.overflowY ?? '',
      mainOverscrollBehavior: appMain?.style.overscrollBehavior ?? '',
    };

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';

    if (appMain) {
      appMain.style.overflow = 'hidden';
      appMain.style.overflowY = 'hidden';
      appMain.style.overscrollBehavior = 'none';
    }

    restorePageStyles = () => {
      body.style.position = previousStyles.bodyPosition;
      body.style.top = previousStyles.bodyTop;
      body.style.left = previousStyles.bodyLeft;
      body.style.right = previousStyles.bodyRight;
      body.style.width = previousStyles.bodyWidth;
      body.style.overflow = previousStyles.bodyOverflow;
      html.style.overflow = previousStyles.htmlOverflow;
      html.style.overscrollBehavior = previousStyles.htmlOverscrollBehavior;

      if (appMain) {
        appMain.style.overflow = previousStyles.mainOverflow;
        appMain.style.overflowY = previousStyles.mainOverflowY;
        appMain.style.overscrollBehavior = previousStyles.mainOverscrollBehavior;
        appMain.scrollTop = mainScrollTop;
      }

      if (scrollY !== 0) window.scrollTo(0, scrollY);
    };
  }

  activeLocks += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    activeLocks = Math.max(0, activeLocks - 1);

    if (activeLocks === 0) {
      const restore = restorePageStyles;
      restorePageStyles = null;
      restore?.();
    }
  };
};
