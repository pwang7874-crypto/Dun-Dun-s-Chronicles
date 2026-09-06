import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useReducedMotion } from './useReducedMotion';

/** Decorative animations must not keep running behind another screen or in background. */
export const useMotionEnabled = (active = true) => {
  const reduced = useReducedMotion();
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => listener.remove();
  }, []);
  return active && foreground && !reduced;
};
