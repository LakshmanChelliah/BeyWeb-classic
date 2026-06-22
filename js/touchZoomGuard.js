/**
 * Block iOS Safari pinch / double-tap zoom during mobile play.
 * viewport user-scalable=no is not always honored on ability taps.
 */
export function installTouchZoomGuard() {
  if (!document.body.classList.contains('mobile')) return;

  const block = (e) => e.preventDefault();
  document.addEventListener('gesturestart', block, { passive: false });
  document.addEventListener('gesturechange', block, { passive: false });
  document.addEventListener('gestureend', block, { passive: false });

  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1 && e.cancelable) e.preventDefault();
    },
    { passive: false }
  );

  let lastTouchEnd = 0;
  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 320 && e.cancelable) e.preventDefault();
      lastTouchEnd = now;
    },
    { passive: false }
  );
}

/** Wire a tap target so iOS does not zoom and we still get one clean activation. */
export function bindTapWithoutZoom(el, handler) {
  el.addEventListener(
    'touchend',
    (e) => {
      e.preventDefault();
      handler(e);
    },
    { passive: false }
  );
  el.addEventListener('click', (e) => {
    if (e.pointerType === 'touch' || e.sourceCapabilities?.firesTouchEvents) {
      e.preventDefault();
      return;
    }
    handler(e);
  });
}
