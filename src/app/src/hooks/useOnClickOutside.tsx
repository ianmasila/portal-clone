import { ForwardedRef, RefObject, useEffect } from 'react';

export const useOnClickOutside = <T extends HTMLElement = HTMLElement>(
  ref: RefObject<T> | ForwardedRef<T>,
  eventType: keyof DocumentEventMap,
  callback?: (event?: Event) => void
) => {
  useEffect(() => {
    if (!callback) {
      return;
    }
    // Helper to get the current element from the ref
    const getRefElement = (): T | null => {
      if (ref && typeof ref !== 'function') {
        return ref.current;
      }
      return null;
    };

    const listener = (event: Event) => {
      const el = getRefElement();
      if (!el || el.contains((event?.target as Node) || null)) {
        return;
      }
      callback(event); // Call the handler only if the click is outside of the element passed.
    };

    document.addEventListener(eventType, listener);

    return () => {
      document.removeEventListener(eventType, listener);
    };
  }, [ref, callback]); // Reload only if ref or handler changes
};
