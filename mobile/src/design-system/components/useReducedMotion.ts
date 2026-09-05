import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Keeps decorative motion in sync with the operating system accessibility setting. */
export const useReducedMotion = () => {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (mounted) {
          setReducedMotion(enabled);
        }
      })
      .catch(() => {
        // A static fallback is not required when the platform cannot report this setting.
      });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion,
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
};
