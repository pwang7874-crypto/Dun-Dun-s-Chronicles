import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type StyleProp,
  StyleSheet,
  Text,
  type ViewStyle,
  View,
} from 'react-native';

import { useReducedMotion } from '../../design-system/components/useReducedMotion';

export interface TouchTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface TouchTransformLimits {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minScale: number;
  maxScale: number;
}

interface Props {
  children: React.ReactNode;
  transform: TouchTransform;
  canvasWidth: number;
  canvasHeight: number;
  /** Pauses selection motion and touch claiming while the owning screen is inactive. */
  active?: boolean;
  selected?: boolean;
  syncToken?: string | number;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
  minScale?: number;
  maxScale?: number;
  onSelect?: () => void;
  onDelete?: () => void;
  onCommit: (next: TouchTransform) => void;
}

interface Point { pageX: number; pageY: number }

export interface GestureMetrics {
  center: Point;
  distance: number;
  angle: number;
}

interface GestureSession {
  fingers: 1 | 2;
  base: TouchTransform;
  metrics: GestureMetrics;
}

const DEFAULT_LIMITS: TouchTransformLimits = {
  minX: -0.85,
  maxX: 0.85,
  minY: -0.85,
  maxY: 0.85,
  minScale: 0.35,
  maxScale: 4,
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

export const normalizeTouchRotation = (degrees: number) => {
  const normalized = (degrees + 180) % 360;
  return (normalized < 0 ? normalized + 360 : normalized) - 180;
};

const shortestAngleDelta = (current: number, initial: number) =>
  normalizeTouchRotation(current - initial);

const distance = (a: Point, b: Point) => Math.hypot(b.pageX - a.pageX, b.pageY - a.pageY);
const angle = (a: Point, b: Point) => Math.atan2(b.pageY - a.pageY, b.pageX - a.pageX) * 180 / Math.PI;
const centerOf = (touches: readonly Point[]): Point => touches.length >= 2
  ? {
      pageX: (touches[0]!.pageX + touches[1]!.pageX) / 2,
      pageY: (touches[0]!.pageY + touches[1]!.pageY) / 2,
    }
  : { pageX: touches[0]?.pageX ?? 0, pageY: touches[0]?.pageY ?? 0 };

const metricsFor = (touches: readonly Point[]): GestureMetrics => ({
  center: centerOf(touches),
  distance: touches.length >= 2 ? distance(touches[0]!, touches[1]!) : 1,
  angle: touches.length >= 2 ? angle(touches[0]!, touches[1]!) : 0,
});

const sessionFor = (touches: readonly Point[], base: TouchTransform): GestureSession => ({
  fingers: touches.length >= 2 ? 2 : 1,
  base: { ...base },
  metrics: metricsFor(touches),
});

export const constrainTouchTransform = (
  transform: TouchTransform,
  limits: TouchTransformLimits,
): TouchTransform => ({
  x: clamp(transform.x, limits.minX, limits.maxX),
  y: clamp(transform.y, limits.minY, limits.maxY),
  scale: clamp(transform.scale, limits.minScale, limits.maxScale),
  rotation: normalizeTouchRotation(transform.rotation),
});

export const touchTransformFromNormalizedPosition = (
  positionX: number,
  positionY: number,
  scale: number,
  rotation: number,
  travelX: number,
  travelY: number,
): TouchTransform => ({
  x: positionX * travelX,
  y: positionY * travelY,
  scale,
  rotation,
});

export const normalizedPositionFromTouchTransform = (
  transform: TouchTransform,
  travelX: number,
  travelY: number,
) => ({
  positionX: transform.x / Math.max(travelX, 0.0001),
  positionY: transform.y / Math.max(travelY, 0.0001),
  scale: transform.scale,
  rotation: transform.rotation,
});

/** Pure gesture calculation kept separate so finger-count transitions and angle wrapping are testable. */
export const touchTransformFromGesture = (
  base: TouchTransform,
  start: GestureMetrics,
  current: GestureMetrics,
  fingers: 1 | 2,
  canvasWidth: number,
  canvasHeight: number,
  limits: TouchTransformLimits,
): TouchTransform => constrainTouchTransform({
  x: base.x + (current.center.pageX - start.center.pageX) / Math.max(canvasWidth, 1),
  y: base.y + (current.center.pageY - start.center.pageY) / Math.max(canvasHeight, 1),
  scale: fingers === 2
    ? base.scale * current.distance / Math.max(start.distance, 1)
    : base.scale,
  rotation: fingers === 2
    ? base.rotation + shortestAngleDelta(current.angle, start.angle)
    : base.rotation,
}, limits);

const transformsMatch = (a: TouchTransform, b: TouchTransform) =>
  Math.abs(a.x - b.x) < 0.0001
  && Math.abs(a.y - b.y) < 0.0001
  && Math.abs(a.scale - b.scale) < 0.0001
  && Math.abs(normalizeTouchRotation(a.rotation - b.rotation)) < 0.01;

const pointsFromEvent = (event: GestureResponderEvent): Point[] => {
  const touches = event.nativeEvent.touches as unknown as Point[];
  if (touches.length) return touches.slice(0, 2);
  return [{ pageX: event.nativeEvent.pageX, pageY: event.nativeEvent.pageY }];
};

/** One finger moves; two fingers pinch and rotate; the visible corner handle does both with one finger. */
export const TouchTransformView = ({
  children,
  transform,
  canvasWidth,
  canvasHeight,
  active = true,
  selected = false,
  syncToken,
  testID,
  style,
  minX = DEFAULT_LIMITS.minX,
  maxX = DEFAULT_LIMITS.maxX,
  minY = DEFAULT_LIMITS.minY,
  maxY = DEFAULT_LIMITS.maxY,
  minScale = DEFAULT_LIMITS.minScale,
  maxScale = DEFAULT_LIMITS.maxScale,
  onSelect,
  onDelete,
  onCommit,
}: Props) => {
  const { x, y, scale, rotation } = transform;
  const limits = useMemo<TouchTransformLimits>(() => ({
    minX,
    maxX,
    minY,
    maxY,
    minScale,
    maxScale,
  }), [maxScale, maxX, maxY, minScale, minX, minY]);
  const [preview, setPreview] = useState(() => constrainTouchTransform(transform, limits));
  const [contentSize, setContentSize] = useState({ width: 1, height: 1 });
  const live = useRef(preview);
  const session = useRef<GestureSession | undefined>(undefined);
  const handleStart = useRef<{ base: TouchTransform; center: Point; distance: number; angle: number } | undefined>(undefined);
  const gestureChanged = useRef(false);
  const selectionPop = useRef(new Animated.Value(1)).current;
  const selectionBreath = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    // Selection causes a parent render during a gesture. Do not let that render
    // overwrite the live transform; the committed props sync on the next render.
    if (session.current || handleStart.current) return;
    const synced = constrainTouchTransform({ x, y, scale, rotation }, limits);
    live.current = synced;
    setPreview(synced);
  }, [limits, rotation, scale, syncToken, x, y]);

  useEffect(() => {
    selectionPop.stopAnimation();
    selectionBreath.stopAnimation();
    if (!selected || !active) {
      selectionPop.setValue(1);
      selectionBreath.setValue(0);
      return;
    }
    if (reducedMotion) {
      selectionPop.setValue(1);
      selectionBreath.setValue(0.5);
      return;
    }
    selectionPop.setValue(0.96);
    Animated.spring(selectionPop, {
      toValue: 1,
      damping: 12,
      stiffness: 240,
      mass: 0.45,
      useNativeDriver: true,
      isInteraction: false,
    }).start();
    const breathing = Animated.loop(Animated.sequence([
      Animated.timing(selectionBreath, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
        isInteraction: false,
      }),
      Animated.timing(selectionBreath, {
        toValue: 0,
        duration: 900,
        useNativeDriver: true,
        isInteraction: false,
      }),
    ]));
    breathing.start();
    return () => breathing.stop();
  }, [active, reducedMotion, selected, selectionBreath, selectionPop]);

  const setLive = useCallback((next: TouchTransform) => {
    if (!transformsMatch(live.current, next)) gestureChanged.current = true;
    live.current = next;
    setPreview(next);
  }, []);

  const updateFromTouches = useCallback((event: GestureResponderEvent) => {
    const touches = pointsFromEvent(event);
    const fingers: 1 | 2 = touches.length >= 2 ? 2 : 1;
    // Rebase when a finger is added or removed. Without this, the element jumps
    // from the first finger to the two-finger midpoint.
    if (!session.current || session.current.fingers !== fingers) {
      session.current = sessionFor(touches, live.current);
      return;
    }
    const gestureSession = session.current;
    setLive(touchTransformFromGesture(
      gestureSession.base,
      gestureSession.metrics,
      metricsFor(touches),
      fingers,
      canvasWidth,
      canvasHeight,
      limits,
    ));
  }, [canvasHeight, canvasWidth, limits, setLive]);

  const commit = useCallback(() => {
    session.current = undefined;
    handleStart.current = undefined;
    if (!gestureChanged.current) return;
    gestureChanged.current = false;
    onCommit(live.current);
  }, [onCommit]);

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => active,
    onStartShouldSetPanResponderCapture: event => active && event.nativeEvent.touches.length >= 2,
    onMoveShouldSetPanResponder: () => active,
    onMoveShouldSetPanResponderCapture: event => active && event.nativeEvent.touches.length >= 2,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: event => {
      const touches = pointsFromEvent(event);
      gestureChanged.current = false;
      session.current = sessionFor(touches, live.current);
      onSelect?.();
    },
    onPanResponderMove: updateFromTouches,
    onPanResponderRelease: commit,
    onPanResponderTerminate: commit,
  }), [active, commit, onSelect, updateFromTouches]);

  const handleResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => active,
    onMoveShouldSetPanResponder: () => active,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: event => {
      onSelect?.();
      gestureChanged.current = false;
      const point = event.nativeEvent;
      const radians = live.current.rotation * Math.PI / 180;
      const cornerX = contentSize.width * live.current.scale / 2;
      const cornerY = contentSize.height * live.current.scale / 2;
      const rotatedCorner = {
        pageX: cornerX * Math.cos(radians) - cornerY * Math.sin(radians),
        pageY: cornerX * Math.sin(radians) + cornerY * Math.cos(radians),
      };
      const center = {
        pageX: point.pageX - rotatedCorner.pageX,
        pageY: point.pageY - rotatedCorner.pageY,
      };
      handleStart.current = {
        base: { ...live.current },
        center,
        distance: Math.max(12, distance(center, point)),
        angle: angle(center, point),
      };
    },
    onPanResponderMove: event => {
      const handleSession = handleStart.current;
      if (!handleSession) return;
      const point = event.nativeEvent;
      setLive(constrainTouchTransform({
        ...handleSession.base,
        scale: handleSession.base.scale * distance(handleSession.center, point) / handleSession.distance,
        rotation: handleSession.base.rotation + shortestAngleDelta(angle(handleSession.center, point), handleSession.angle),
      }, limits));
    },
    onPanResponderRelease: commit,
    onPanResponderTerminate: commit,
  }), [active, commit, contentSize.height, contentSize.width, limits, onSelect, setLive]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setContentSize({
      width: event.nativeEvent.layout.width,
      height: event.nativeEvent.layout.height,
    });
  }, []);

  return (
    <View
      collapsable={false}
      onLayout={onLayout}
      testID={testID}
      {...responder.panHandlers}
      style={[
        style,
        { transform: [
          { translateX: preview.x * canvasWidth },
          { translateY: preview.y * canvasHeight },
          { rotate: `${preview.rotation}deg` },
          { scale: preview.scale },
        ] },
      ]}
    >
      <Animated.View style={[styles.content, { transform: [{ scale: selectionPop }] }]}>
        {children}
      </Animated.View>
      {selected ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.selectionGlow,
              { width: contentSize.width, height: contentSize.height },
              {
                opacity: selectionBreath.interpolate({ inputRange: [0, 1], outputRange: [0.16, 0.34] }),
                transform: [{ scale: selectionBreath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.018] }) }],
              },
            ]}
          />
          <View pointerEvents="box-none" style={[styles.selection, { width: contentSize.width, height: contentSize.height }]}>
            {onDelete ? (
              <View pointerEvents="box-none" style={styles.deleteHandleWrap}>
                <View pointerEvents="none" style={styles.deleteHandleShadow} />
                <Pressable
                  accessibilityLabel="从作品中删除这个元素"
                  accessibilityRole="button"
                  hitSlop={12}
                  onPress={event => {
                    event.stopPropagation();
                    onDelete();
                  }}
                  style={styles.deleteHandle}
                >
                  <Text style={styles.deleteHandleText}>×</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View
              {...handleResponder.panHandlers}
              accessibilityLabel="缩放并旋转"
              accessibilityRole="adjustable"
              hitSlop={14}
              style={styles.transformHandle}
            >
              <Text style={styles.transformHandleText}>↻</Text>
            </View>
            <View pointerEvents="none" style={styles.gestureHint}>
              <Text style={styles.gestureHintText}>拖动 · 双指缩放旋转</Text>
            </View>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.selectionSparkle,
                {
                  opacity: selectionBreath.interpolate({ inputRange: [0, 1], outputRange: [0.42, 0.9] }),
                  transform: [
                    { translateY: selectionBreath.interpolate({ inputRange: [0, 1], outputRange: [2, -2] }) },
                    { scale: selectionBreath.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1.08] }) },
                  ],
                },
              ]}
            >
              <Text style={styles.selectionSparkleText}>✦</Text>
            </Animated.View>
          </View>
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  content: { flex: 1 },
  selectionGlow: { position: 'absolute', left: 0, top: 0, borderWidth: 5, borderColor: '#F4C97C', borderRadius: 10 },
  selection: { position: 'absolute', left: 0, top: 0, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D08338' },
  corner: { position: 'absolute', width: 9, height: 9, borderRadius: 5, backgroundColor: '#FFFDF7', borderWidth: 1.5, borderColor: '#D08338' },
  topLeft: { left: -5, top: -5 },
  topRight: { right: -5, top: -5 },
  bottomLeft: { left: -5, bottom: -5 },
  deleteHandleWrap: { position: 'absolute', left: -14, top: -14, width: 29, height: 29, zIndex: 5 },
  deleteHandleShadow: { position: 'absolute', left: 2, top: 3, width: 27, height: 27, borderRadius: 14, backgroundColor: 'rgba(123,84,59,0.16)' },
  deleteHandle: { width: 27, height: 27, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF3E9', borderWidth: 1.5, borderColor: '#D98273' },
  deleteHandleText: { marginTop: -2, color: '#9E493E', fontSize: 22, lineHeight: 24, fontWeight: '700', textAlign: 'center' },
  transformHandle: { position: 'absolute', right: -13, bottom: -13, width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFDF7', borderWidth: 1.5, borderColor: '#D08338', shadowColor: '#7B543B', shadowOpacity: 0.18, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  transformHandleText: { color: '#A95D25', fontSize: 15, fontWeight: '900' },
  gestureHint: { position: 'absolute', left: '50%', top: -26, minWidth: 112, marginLeft: -56, paddingVertical: 3, paddingHorizontal: 7, borderRadius: 8, backgroundColor: 'rgba(255,253,247,0.96)' },
  gestureHintText: { color: '#8A6E5A', fontSize: 8, fontWeight: '800', textAlign: 'center' },
  selectionSparkle: { position: 'absolute', right: -6, top: -19 },
  selectionSparkleText: { color: '#E8A45A', fontSize: 12, textShadowColor: '#FFFDF7', textShadowRadius: 2 },
});
