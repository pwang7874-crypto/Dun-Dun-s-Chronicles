package com.drinkdiary.mobile;

import org.junit.Test;
import static org.junit.Assert.*;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

public class CutoutMaskTest {
  @Test public void tinySubjectGetsAnOriginalResolutionRegionWithBreathingRoom() {
    int[] mask = new int[320 * 320];
    for (int y = 140; y < 180; y++) for (int x = 150; x < 170; x++) mask[y * 320 + x] = 0xffffffff;
    int[] bounds = CutoutMask.subjectRegion(mask, 320, 320);
    assertTrue(bounds[0] < 150 && bounds[1] < 140);
    assertTrue(bounds[2] > 170 && bounds[3] > 180);
    assertTrue(bounds[2] - bounds[0] < 100);
    assertTrue(bounds[3] - bounds[1] < 100);
  }
  @Test public void edgeSubjectRegionNeverExtendsOutsideTheOriginal() {
    int[] mask = new int[320 * 320];
    for (int y = 0; y < 80; y++) for (int x = 270; x < 320; x++) mask[y * 320 + x] = 0xffffffff;
    int[] bounds = CutoutMask.subjectRegion(mask, 320, 320);
    assertEquals(0, bounds[1]); assertEquals(320, bounds[2]);
    assertTrue(bounds[0] >= 0 && bounds[3] <= 320);
  }
  @Test public void duplicateMustRetainTheMaskByteOrder() {
    ByteBuffer original = ByteBuffer.allocate(8).order(ByteOrder.LITTLE_ENDIAN);
    original.putFloat(0.93f).putFloat(0.12f).rewind();
    assertNotEquals(0.93f, original.duplicate().asFloatBuffer().get(), 0.001f);
    assertEquals(0.93f, original.duplicate().order(original.order()).asFloatBuffer().get(), 0.001f);
  }

  @Test public void compositingPreservesExactPhotoColorAndSourceTransparency() {
    assertEquals(0xffc98a40, CutoutMask.withAlpha(0xffc98a40, 0xffffffff));
    assertEquals(0x00c98a40, CutoutMask.withAlpha(0xffc98a40, 0x00ffffff));
    assertEquals(0x40c98a40, CutoutMask.withAlpha(0x80c98a40, 0x80ffffff));
  }

  @Test public void photoInputIsPlanarRGBAndNotARGBOrBGR() {
    float[] values = CutoutMask.input(new int[] {0xffff0000, 0xff00ff00});
    assertEquals((1f - .485f) / .229f, values[0], .001f);
    assertEquals((1f - .456f) / .224f, values[3], .001f);
    assertEquals(-.406f / .225f, values[5], .001f);
  }

  @Test public void solidSubjectIsOpaqueAndDetachedSpecklesAreRemoved() {
    float[] values = new float[400];
    for (int y = 5; y < 15; y++) for (int x = 5; x < 15; x++) values[y * 20 + x] = 1;
    values[0] = .95f;
    int[] mask = CutoutMask.alpha(values, 20, 20);
    assertEquals(255, mask[10 * 20 + 10] >>> 24);
    assertEquals(0, mask[0] >>> 24);
    assertEquals(0, mask[399] >>> 24);
  }

  @Test(expected = IllegalArgumentException.class) public void invalidFloatsNeverBecomeRandomAlpha() {
    CutoutMask.alpha(new float[] {Float.NaN, 1, 0, 0}, 2, 2);
  }
  @Test(expected = IllegalArgumentException.class) public void constantMaskIsNotPretendedToBeACutout() {
    CutoutMask.alpha(new float[100], 10, 10);
  }
}
