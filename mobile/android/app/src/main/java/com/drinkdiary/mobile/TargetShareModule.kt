package com.drinkdiary.mobile

import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

class TargetShareModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "TargetShare"

  @ReactMethod
  fun share(imageUri: String, title: String, copy: String, target: String, promise: Promise) {
    try {
      val packageName = when (target) {
        "redbook" -> "com.xingin.xhs"
        "moments" -> "com.tencent.mm"
        else -> throw IllegalArgumentException("Unsupported share target")
      }
      context.packageManager.getPackageInfo(packageName, 0)
      val path = Uri.parse(imageUri).path ?: throw IllegalArgumentException("Image path is missing")
      val contentUri = FileProvider.getUriForFile(
        context,
        "${context.packageName}.shareprovider",
        File(path),
      )
      val baseIntent = Intent(Intent.ACTION_SEND).apply {
        type = "image/jpeg"
        setPackage(packageName)
        putExtra(Intent.EXTRA_STREAM, contentUri)
        putExtra(Intent.EXTRA_TEXT, copy)
        putExtra(Intent.EXTRA_SUBJECT, title)
        putExtra(Intent.EXTRA_TITLE, title)
        clipData = android.content.ClipData.newUri(context.contentResolver, "吨吨记海报", contentUri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }

      // WeChat exposes a timeline activity on many Android versions. Prefer
      // it when available, while retaining the package-level share entry as a
      // compatibility fallback for builds where that component is hidden.
      val intent = if (target == "moments") {
        val timelineIntent = Intent(baseIntent).setClassName(
          packageName,
          "com.tencent.mm.ui.tools.ShareToTimeLineUI",
        )
        if (timelineIntent.resolveActivity(context.packageManager) != null) timelineIntent else baseIntent
      } else {
        baseIntent
      }
      context.startActivity(intent)
      promise.resolve(true)
    } catch (error: Throwable) {
      promise.reject("TARGET_SHARE_FAILED", error.message, error)
    }
  }
}
