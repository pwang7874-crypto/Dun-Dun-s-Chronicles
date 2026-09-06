import ai.onnxruntime.*;
import com.drinkdiary.mobile.CutoutMask;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.File;
import java.nio.FloatBuffer;
import java.util.Map;
import java.util.Set;
import javax.imageio.ImageIO;

/** Desktop smoke test of the exact shipped model and Android mask math. No network. */
public class CutoutSmokeTest {
  public static void main(String[] args) throws Exception {
    BufferedImage photo = ImageIO.read(new File(args[1]));
    BufferedImage small = new BufferedImage(320, 320, BufferedImage.TYPE_INT_RGB);
    var graphics = small.createGraphics();
    graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
    graphics.drawImage(photo, 0, 0, 320, 320, null);
    graphics.dispose();
    int[] rgb = small.getRGB(0, 0, 320, 320, null, 0, 320);
    var env = OrtEnvironment.getEnvironment();
    try (var options = new OrtSession.SessionOptions()) {
      options.setIntraOpNumThreads(2);
      try (var session = env.createSession(args[0], options);
           var input = OnnxTensor.createTensor(env, FloatBuffer.wrap(CutoutMask.input(rgb)), new long[] {1, 3, 320, 320});
           var result = session.run(Map.of(session.getInputNames().iterator().next(), input), Set.of(session.getOutputNames().iterator().next()))) {
        var buffer = ((OnnxTensor) result.get(0)).getFloatBuffer();
        float[] confidence = new float[buffer.remaining()];
        buffer.get(confidence);
        int[] alpha = CutoutMask.alpha(confidence, 320, 320);
        BufferedImage mask = new BufferedImage(320, 320, BufferedImage.TYPE_INT_ARGB);
        mask.setRGB(0, 0, 320, 320, alpha, 0, 320);
        int width = photo.getWidth(), height = photo.getHeight();
        BufferedImage scaled = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        var paint = scaled.createGraphics();
        paint.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        paint.drawImage(mask, 0, 0, width, height, null);
        paint.dispose();
        int[] pixels = photo.getRGB(0, 0, width, height, null, 0, width);
        int[] masks = scaled.getRGB(0, 0, width, height, null, 0, width);
        int solid = 0, transparent = 0;
        for (int i = 0; i < pixels.length; i++) {
          int original = pixels[i];
          pixels[i] = CutoutMask.withAlpha(original, masks[i]);
          if ((pixels[i] & 0xffffff) != (original & 0xffffff)) throw new AssertionError("Photo RGB was altered");
          if ((pixels[i] >>> 24) == 255) solid++;
          if ((pixels[i] >>> 24) == 0) transparent++;
        }
        scaled.setRGB(0, 0, width, height, pixels, 0, width);
        ImageIO.write(scaled, "png", new File(args[2]));
        // Opaque contact-sheet preview for image viewers that ignore PNG alpha.
        BufferedImage preview = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        var canvas = preview.createGraphics();
        canvas.setColor(new java.awt.Color(250, 244, 232));
        canvas.fillRect(0, 0, width, height);
        canvas.drawImage(scaled, 0, 0, null);
        canvas.dispose();
        ImageIO.write(preview, "png", new File(args[2] + ".preview.png"));
        System.out.printf("PASS: model ran, RGB unchanged; opaque=%d transparent=%d total=%d%n", solid, transparent, pixels.length);
      }
    }
  }
}
