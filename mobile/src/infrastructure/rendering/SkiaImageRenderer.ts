import { ImageFormat, Skia } from '@shopify/react-native-skia';

import { AppError, toAppError } from '../../domain/errors';
import type {
  EditRecipeV1,
  PhotoAssetV1,
  RenderedImage,
} from '../../domain/models';
import type { ImageRenderer } from '../../domain/ports';
import { editRecipeSchema, photoAssetSchema } from '../../domain/schemas';
import { colorMatrixForRecipe } from './filters';

const cropRatio = (recipe: EditRecipeV1, width: number, height: number): number => {
  if (recipe.cropAspect === '1:1') {
    return 1;
  }
  if (recipe.cropAspect === '4:5') {
    return 4 / 5;
  }
  if (recipe.cropAspect === '9:16') {
    return 9 / 16;
  }
  return width / height;
};

export class SkiaImageRenderer implements ImageRenderer {
  async render(
    sourceUri: string,
    rawSource: PhotoAssetV1,
    rawRecipe: EditRecipeV1,
    maxEdge: number,
  ): Promise<RenderedImage> {
    photoAssetSchema.parse(rawSource);
    const recipe = editRecipeSchema.parse(rawRecipe);

    try {
      const encoded = await Skia.Data.fromURI(sourceUri);
      const image = Skia.Image.MakeImageFromEncoded(encoded);
      if (!image) {
        throw new Error('Skia could not decode the selected image');
      }
      const decodedWidth = image.width();
      const decodedHeight = image.height();
      if (decodedWidth * decodedHeight > 48_000_000) {
        throw new AppError(
          'PHOTO_TOO_LARGE',
          '图片尺寸过大，当前设备无法安全处理，请换一张。',
        );
      }
      const turnsSideways = recipe.rotationDegrees === 90 || recipe.rotationDegrees === 270;
      const rotatedWidth = turnsSideways ? decodedHeight : decodedWidth;
      const rotatedHeight = turnsSideways ? decodedWidth : decodedHeight;
      const desiredRatio = cropRatio(recipe, rotatedWidth, rotatedHeight);
      const availableRatio = rotatedWidth / rotatedHeight;
      const croppedWidth = availableRatio > desiredRatio
        ? rotatedHeight * desiredRatio
        : rotatedWidth;
      const croppedHeight = availableRatio > desiredRatio
        ? rotatedHeight
        : rotatedWidth / desiredRatio;
      const scale = Math.min(
        1,
        maxEdge / Math.max(croppedWidth, croppedHeight),
      );
      const pixelWidth = Math.max(1, Math.round(croppedWidth * scale));
      const pixelHeight = Math.max(1, Math.round(croppedHeight * scale));
      const surface = Skia.Surface.MakeOffscreen(pixelWidth, pixelHeight);
      if (!surface) {
        throw new Error('Skia could not create an output surface');
      }

      const paint = Skia.Paint();
      paint.setColorFilter(
        Skia.ColorFilter.MakeMatrix(
          colorMatrixForRecipe(recipe),
        ),
      );
      paint.setAntiAlias(true);
      const canvas = surface.getCanvas();
      const totalRotation = recipe.rotationDegrees + recipe.straightenDegrees;
      const radians = totalRotation * Math.PI / 180;
      const cosine = Math.abs(Math.cos(radians));
      const sine = Math.abs(Math.sin(radians));
      // Scale until all four output corners fall inside the rotated source,
      // preventing transparent wedges when the user straightens a horizon.
      const coverScale = Math.max(
        (cosine * pixelWidth + sine * pixelHeight) / decodedWidth,
        (sine * pixelWidth + cosine * pixelHeight) / decodedHeight,
      );
      canvas.save();
      canvas.translate(pixelWidth / 2, pixelHeight / 2);
      canvas.scale(
        (recipe.flipHorizontal ? -1 : 1) * coverScale,
        (recipe.flipVertical ? -1 : 1) * coverScale,
      );
      canvas.rotate(totalRotation, 0, 0);
      canvas.drawImageRect(
        image,
        Skia.XYWHRect(0, 0, decodedWidth, decodedHeight),
        Skia.XYWHRect(-decodedWidth / 2, -decodedHeight / 2, decodedWidth, decodedHeight),
        paint,
      );
      canvas.restore();
      surface.flush();
      const snapshot = surface.makeImageSnapshot();
      return {
        base64: snapshot.encodeToBase64(ImageFormat.JPEG, 90),
        contentType: 'image/jpeg',
        pixelWidth,
        pixelHeight,
      };
    } catch (error) {
      throw toAppError(
        error,
        'RENDER_FAILED',
        '滤镜处理没有完成，原图仍然保留。',
      );
    }
  }
}
