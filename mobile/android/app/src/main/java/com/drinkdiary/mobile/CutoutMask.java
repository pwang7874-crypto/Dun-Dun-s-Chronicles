package com.drinkdiary.mobile;

/** Pure mask processing, shared by the native renderer and JVM regression tests. */
public final class CutoutMask {
  private CutoutMask() {}

  public static float[] input(int[] pixels) {
    float max = 1;
    for (int rgb : pixels) {
      max = Math.max(max, Math.max((rgb >> 16) & 255, Math.max((rgb >> 8) & 255, rgb & 255)));
    }
    float[] mean = {0.485f, 0.456f, 0.406f};
    float[] std = {0.229f, 0.224f, 0.225f};
    float[] result = new float[pixels.length * 3];
    for (int channel = 0; channel < 3; channel++) {
      for (int i = 0; i < pixels.length; i++) {
        result[channel * pixels.length + i] = (((pixels[i] >> (16 - channel * 8)) & 255) / max - mean[channel]) / std[channel];
      }
    }
    return result;
  }

  public static int[] alpha(float[] prediction, int width, int height) {
    int size = width * height;
    if (prediction.length != size) throw new IllegalArgumentException("Invalid mask dimensions");
    float min = Float.POSITIVE_INFINITY, max = Float.NEGATIVE_INFINITY;
    for (float value : prediction) {
      if (!Float.isFinite(value)) throw new IllegalArgumentException("Invalid mask confidence");
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
    if (max - min < 0.01f) throw new IllegalArgumentException("No clear subject");
    float[] normalized = new float[size];
    for (int i = 0; i < size; i++) normalized[i] = (prediction[i] - min) / (max - min);

    // Remove tiny disconnected islands, keeping multiple real subjects and fine edges.
    int[] labels = new int[size];
    int[] queue = new int[size];
    int[] sizes = new int[size + 1];
    int label = 0, largest = 0;
    for (int start = 0; start < size; start++) {
      if (normalized[start] < 0.30f || labels[start] != 0) continue;
      label++;
      int head = 0, tail = 1;
      queue[0] = start;
      labels[start] = label;
      while (head < tail) {
        int index = queue[head++], x = index % width, y = index / width;
        for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
          int nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          int next = ny * width + nx;
          if (labels[next] == 0 && normalized[next] >= 0.30f) {
            labels[next] = label;
            queue[tail++] = next;
          }
        }
      }
      sizes[label] = tail;
      largest = Math.max(largest, tail);
    }
    int minimum = Math.max(4, (int) (largest * 0.003f));
    int[] result = new int[size];
    int solid = 0;
    for (int i = 0; i < size; i++) {
      float value = sizes[labels[i]] >= minimum ? normalized[i] : 0;
      // Smooth edge transition, opaque subject interior. Never add RGB grain.
      float t = Math.max(0f, Math.min(1f, (value - 0.30f) / 0.35f));
      int alpha = Math.round(t * t * (3f - 2f * t) * 255);
      if (alpha >= 128) solid++;
      result[i] = (alpha << 24) | 0x00ffffff;
    }
    if (solid < Math.max(4, size / 500) || solid > size * 0.98f) {
      throw new IllegalArgumentException("No separable subject");
    }
    return result;
  }

  public static int withAlpha(int source, int mask) {
    int alpha = (source >>> 24) * (mask >>> 24) / 255;
    return (alpha << 24) | (source & 0x00ffffff);
  }

  /** Locate a padded ROI before re-decoding from the original, never upscale the preview's RGB. */
  public static int[] subjectRegion(int[] alpha, int width, int height) {
    int left = width, top = height, right = -1, bottom = -1;
    for (int i = 0; i < alpha.length; i++) if ((alpha[i] >>> 24) >= 32) {
      left = Math.min(left, i % width); right = Math.max(right, i % width);
      top = Math.min(top, i / width); bottom = Math.max(bottom, i / width);
    }
    if (right < left || bottom < top) throw new IllegalArgumentException("No subject region");
    int pad = Math.max(8, Math.round(Math.max(right - left + 1, bottom - top + 1) * 0.24f));
    return new int[]{Math.max(0, left - pad), Math.max(0, top - pad),
      Math.min(width, right + 1 + pad), Math.min(height, bottom + 1 + pad)};
  }
}
