package com.drinkdiary.mobile

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapRegionDecoder
import android.graphics.Matrix
import android.graphics.Rect
import android.graphics.RectF
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import com.facebook.react.bridge.*
import java.io.File
import java.nio.FloatBuffer
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.max
import kotlin.math.min

/** Generic offline food / outfit / object cutout. The photo itself is never redrawn by AI. */
class OfflineCutoutModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val worker = Executors.newSingleThreadExecutor()
  private val busy = AtomicBoolean(false)
  @Volatile private var invalidated = false
  private var session: OrtSession? = null
  override fun getName() = "DundunOfflineCutout"

  private fun model(): OrtSession {
    session?.let { return it }
    return OrtSession.SessionOptions().use { options ->
      options.setIntraOpNumThreads(2)
      options.setInterOpNumThreads(1)
      val bytes = context.assets.open("models/u2netp.onnx").use { it.readBytes() }
      OrtEnvironment.getEnvironment().createSession(bytes, options).also { session = it }
    }
  }

  private fun predict(photo: Bitmap): IntArray {
    val small = Bitmap.createScaledBitmap(photo, 320, 320, true)
    try {
      val rgb = IntArray(320 * 320)
      small.getPixels(rgb, 0, 320, 0, 0, 320, 320)
      val engine = model()
      val confidence = OnnxTensor.createTensor(OrtEnvironment.getEnvironment(),
        FloatBuffer.wrap(CutoutMask.input(rgb)), longArrayOf(1, 3, 320, 320)).use { tensor ->
        engine.run(mapOf(engine.inputNames.first() to tensor), setOf(engine.outputNames.first())).use { outputs ->
          val buffer = (outputs[0] as OnnxTensor).floatBuffer
          FloatArray(buffer.remaining()).also { buffer.get(it) }
        }
      }
      return CutoutMask.alpha(confidence, 320, 320)
    } finally { if (small !== photo) small.recycle() }
  }

  /** Map the oriented detection back to the original file and decode only that region. */
  @Suppress("DEPRECATION")
  private fun decodeSubject(file: File, bounds: BitmapFactory.Options, transform: Matrix, region: IntArray): Bitmap {
    val mapped = RectF(0f, 0f, bounds.outWidth.toFloat(), bounds.outHeight.toFloat())
    transform.mapRect(mapped)
    val oriented = Matrix(transform).apply { postTranslate(-mapped.left, -mapped.top) }
    val inverse = Matrix()
    check(oriented.invert(inverse))
    val raw = RectF(region[0] * mapped.width() / 320, region[1] * mapped.height() / 320,
      region[2] * mapped.width() / 320, region[3] * mapped.height() / 320)
    inverse.mapRect(raw)
    val rectangle = Rect(max(0, kotlin.math.floor(raw.left).toInt()), max(0, kotlin.math.floor(raw.top).toInt()),
      min(bounds.outWidth, kotlin.math.ceil(raw.right).toInt()), min(bounds.outHeight, kotlin.math.ceil(raw.bottom).toInt()))
    val options = BitmapFactory.Options().apply {
      inPreferredConfig = Bitmap.Config.ARGB_8888
      inSampleSize = 1
      val budget = min(6_000_000L, Runtime.getRuntime().maxMemory() / 48)
      while (rectangle.width().toLong() * rectangle.height() / inSampleSize / inSampleSize > budget ||
        max(rectangle.width(), rectangle.height()) / inSampleSize > 3200) inSampleSize *= 2
    }
    val decoder = requireNotNull(BitmapRegionDecoder.newInstance(file.path, false))
    val decoded = try { requireNotNull(decoder.decodeRegion(rectangle, options)) } finally { decoder.recycle() }
    return try {
      Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, transform, true).also {
        if (it !== decoded) decoded.recycle()
      }
    } catch (error: Exception) { decoded.recycle(); throw error }
  }

  @ReactMethod fun extractSubject(source: String, promise: Promise) {
    if (invalidated || !busy.compareAndSet(false, true)) {
      promise.reject("CUTOUT_BUSY", "Please finish the current sticker first.")
      return
    }
    worker.execute {
      val bitmaps = mutableListOf<Bitmap>()
      var output: File? = null
      try {
        val uri = Uri.parse(source)
        require(uri.scheme == "file") { "Only local saved photos are accepted" }
        val file = File(requireNotNull(uri.path)).canonicalFile
        require(file.isFile && file.length() <= 100L * 1024 * 1024) { "Invalid source photo" }
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.path, bounds)
        require(bounds.outWidth > 0 && bounds.outHeight > 0) { "Cannot decode photo" }
        val options = BitmapFactory.Options().apply {
          inPreferredConfig = Bitmap.Config.ARGB_8888
          inSampleSize = 1
          while (max(bounds.outWidth, bounds.outHeight) / inSampleSize > 1280) inSampleSize *= 2
        }
        val decoded = requireNotNull(BitmapFactory.decodeFile(file.path, options))
        bitmaps.add(decoded)
        val exif = ExifInterface(file.path)
        val transform = Matrix().apply {
          if (exif.isFlipped) postScale(-1f, 1f)
          postRotate(exif.rotationDegrees.toFloat())
        }
        val preview = Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, transform, true)
        bitmaps.add(preview)
        val region = CutoutMask.subjectRegion(predict(preview), 320, 320)
        // Coarse-to-fine: small subjects now occupy the model input, with original-resolution RGB.
        val photo = decodeSubject(file, bounds, transform, region)
        bitmaps.add(photo)
        val mask = Bitmap.createBitmap(predict(photo), 320, 320, Bitmap.Config.ARGB_8888)
        bitmaps.add(mask)
        val scaled = Bitmap.createScaledBitmap(mask, photo.width, photo.height, true)
        bitmaps.add(scaled)
        val width = photo.width
        val height = photo.height
        val pixels = IntArray(width * height)
        val alphas = IntArray(pixels.size)
        photo.getPixels(pixels, 0, width, 0, 0, width, height)
        scaled.getPixels(alphas, 0, width, 0, 0, width, height)
        var left = width; var top = height; var right = -1; var bottom = -1
        for (i in pixels.indices) {
          pixels[i] = CutoutMask.withAlpha(pixels[i], alphas[i])
          if ((pixels[i] ushr 24) > 12) {
            left = min(left, i % width); right = max(right, i % width)
            top = min(top, i / width); bottom = max(bottom, i / width)
          }
        }
        require(right > left && bottom > top) { "No clear subject" }
        // A little transparent breathing room preserves feathered hair / edges.
        left = max(0, left - 3); top = max(0, top - 3)
        right = min(width - 1, right + 3); bottom = min(height - 1, bottom + 3)
        val full = Bitmap.createBitmap(pixels, width, height, Bitmap.Config.ARGB_8888)
        bitmaps.add(full)
        val cutout = Bitmap.createBitmap(full, left, top, right - left + 1, bottom - top + 1)
        bitmaps.add(cutout)
        val directory = File(context.cacheDir, "dundun-cutouts").apply { mkdirs() }
        output = File(directory, "${UUID.randomUUID()}.png")
        output.outputStream().use { check(cutout.compress(Bitmap.CompressFormat.PNG, 100, it)) }
        promise.resolve(Arguments.createMap().apply {
          putString("uri", Uri.fromFile(output).toString())
          putInt("width", cutout.width); putInt("height", cutout.height)
        })
      } catch (error: Exception) {
        output?.delete()
        promise.reject("CUTOUT_FAILED", "No clear subject could be isolated; original photo is unchanged.", error)
      } finally {
        bitmaps.distinct().forEach { if (!it.isRecycled) it.recycle() }
        busy.set(false)
      }
    }
  }

  @ReactMethod fun releaseCutout(source: String, promise: Promise) {
    try {
      val file = File(requireNotNull(Uri.parse(source).path)).canonicalFile
      val directory = File(context.cacheDir, "dundun-cutouts").canonicalFile
      require(file.parentFile == directory && file.extension == "png")
      promise.resolve(!file.exists() || file.delete())
    } catch (error: Exception) { promise.reject("CUTOUT_CACHE", "Invalid temporary cutout", error) }
  }

  override fun invalidate() {
    invalidated = true
    worker.execute { session?.close(); session = null }
    worker.shutdown()
    super.invalidate()
  }
}
