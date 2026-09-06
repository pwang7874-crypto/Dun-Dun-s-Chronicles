import { render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { PaperCutoutSticker } from '../src/design-system/components/PaperCutoutSticker';

describe('PaperCutoutSticker', () => {
  it('builds the paper treatment from alpha images without a rectangular frame', async () => {
    const uri = 'file:///cutouts/drink.png';
    const screen = await render(
      <PaperCutoutSticker
        uri={uri}
        style={{
          width: 120,
          height: 140,
          backgroundColor: '#FF0000',
          borderWidth: 8,
          overflow: 'hidden',
        }}
      />,
    );

    const root = screen.root;
    expect(root).not.toBeNull();
    if (!root) {
      throw new Error('Paper cutout did not render');
    }
    const rootStyle = StyleSheet.flatten(root.props.style);

    expect(root.props.pointerEvents).toBe('none');
    expect(rootStyle).toMatchObject({
      width: 120,
      height: 140,
      backgroundColor: 'transparent',
      borderBottomWidth: 0,
      borderLeftWidth: 0,
      borderRightWidth: 0,
      borderTopWidth: 0,
      borderWidth: 0,
      elevation: 0,
      overflow: 'visible',
      shadowOpacity: 0,
    });

    const images = root.queryAll(instance => instance.type === 'Image');
    // 12 outline samples, one underprint, two shadows and the untouched photo.
    expect(images.length).toBe(16);
    expect(images.every(image => image.props.source.uri === uri)).toBe(true);
    expect(images.every(image => image.props.accessible === false)).toBe(true);
    expect(images.some(image => image.props.blurRadius === 4)).toBe(true);

    const imageStyles = images.map(image => StyleSheet.flatten(image.props.style));
    expect(imageStyles.some(style => style.tintColor === '#FFFFFF')).toBe(true);
    expect(imageStyles.some(style => style.tintColor === '#5A3E2B')).toBe(true);
    expect(imageStyles.some(style => style.tintColor === undefined)).toBe(true);
    expect(imageStyles.every(style => style.backgroundColor === 'transparent')).toBe(true);
    // Nothing tinted or textured may cover the topmost RGB photo.
    expect(imageStyles.at(-1)?.tintColor).toBeUndefined();
    expect(imageStyles.at(-1)?.opacity).toBeUndefined();
  });
});
