import {
  constrainTouchTransform,
  normalizedPositionFromTouchTransform,
  normalizeTouchRotation,
  touchTransformFromGesture,
  touchTransformFromNormalizedPosition,
  type TouchTransformLimits,
} from '../src/features/create-studio/TouchTransformView';

const limits: TouchTransformLimits = {
  minX: -0.6,
  maxX: 0.6,
  minY: -0.5,
  maxY: 0.5,
  minScale: 0.5,
  maxScale: 3,
};

describe('TouchTransformView gesture math', () => {
  it('moves with one finger without changing size or angle', () => {
    const next = touchTransformFromGesture(
      { x: 0.1, y: -0.1, scale: 1.4, rotation: 25 },
      { center: { pageX: 100, pageY: 100 }, distance: 1, angle: 0 },
      { center: { pageX: 150, pageY: 80 }, distance: 1, angle: 0 },
      1,
      200,
      400,
      limits,
    );

    expect(next.x).toBeCloseTo(0.35);
    expect(next.y).toBeCloseTo(-0.15);
    expect(next.scale).toBe(1.4);
    expect(next.rotation).toBe(25);
  });

  it('uses the two-finger midpoint while scaling and rotating', () => {
    const next = touchTransformFromGesture(
      { x: 0, y: 0, scale: 1, rotation: 10 },
      { center: { pageX: 100, pageY: 100 }, distance: 80, angle: 179 },
      { center: { pageX: 120, pageY: 90 }, distance: 160, angle: -179 },
      2,
      200,
      200,
      limits,
    );

    expect(next.x).toBeCloseTo(0.1);
    expect(next.y).toBeCloseTo(-0.05);
    expect(next.scale).toBeCloseTo(2);
    // Crossing the -180/180 boundary is a two-degree turn, not a 358-degree jump.
    expect(next.rotation).toBeCloseTo(12);
  });

  it('keeps every committed value inside its configured limits', () => {
    expect(constrainTouchTransform(
      { x: 9, y: -9, scale: 10, rotation: 725 },
      limits,
    )).toEqual({ x: 0.6, y: -0.5, scale: 3, rotation: 5 });
    expect(normalizeTouchRotation(-725)).toBe(-5);
  });

  it('round-trips persisted sticker positions without a release jump', () => {
    const visible = touchTransformFromNormalizedPosition(0.72, 0.38, 1.65, -24, 0.58, 0.53);
    const persisted = normalizedPositionFromTouchTransform(visible, 0.58, 0.53);
    const restored = touchTransformFromNormalizedPosition(
      persisted.positionX,
      persisted.positionY,
      persisted.scale,
      persisted.rotation,
      0.58,
      0.53,
    );

    expect(persisted.positionX).toBeCloseTo(0.72);
    expect(persisted.positionY).toBeCloseTo(0.38);
    expect(restored).toEqual(visible);
  });

});
