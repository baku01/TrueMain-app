package lol.truemain.mobile.update

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import java.io.File
import java.security.MessageDigest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import lol.truemain.mobile.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.Request

data class UpdateInfo(
    val versionCode: Int,
    val versionName: String,
    val url: String,
    val sha256: String?,
    val notes: String?,
)

sealed interface UpdateState {
    data object Idle : UpdateState
    data object Checking : UpdateState
    data class Available(val info: UpdateInfo) : UpdateState
    data class Downloading(val info: UpdateInfo, val progress: Float?) : UpdateState
    data class ReadyToInstall(val info: UpdateInfo, val apk: File) : UpdateState
    data object UpToDate : UpdateState
    data class Error(val detail: String?) : UpdateState
}

/**
 * Checks GitHub Releases (`android-latest.json`) for newer Android builds,
 * downloads and SHA-256-verifies the APK into internal cache, and hands it
 * to Android's native package installer via FileProvider.
 */
class AppUpdater(
    private val context: Context,
    private val http: OkHttpClient,
    private val scope: CoroutineScope,
    private val feedUrl: String = BuildConfig.UPDATE_FEED_URL,
    private val currentVersionCode: Int = BuildConfig.VERSION_CODE,
) {
    private val appContext = context.applicationContext
    private val _state = MutableStateFlow<UpdateState>(UpdateState.Idle)
    val state: StateFlow<UpdateState> = _state.asStateFlow()

    private var dismissedCode: Int? = null

    /** Checks the feed; when [silent] is true, errors and UpToDate stay hidden. */
    fun check(silent: Boolean = true) {
        val current = _state.value
        if (current is UpdateState.Checking || current is UpdateState.Downloading) return
        if (feedUrl.isBlank()) return
        if (!silent) {
            dismissedCode = null
            _state.value = UpdateState.Checking
        }
        scope.launch {
            val info = fetchManifest()
            if (info == null) {
                if (!silent) _state.value = UpdateState.Error(null)
                return@launch
            }
            if (isNewer(info.versionCode, currentVersionCode)) {
                if (silent && dismissedCode == info.versionCode) return@launch
                val cached = apkFile(info.versionCode)
                if (cached.isFile && matchesSha256(cached, info.sha256)) {
                    _state.value = UpdateState.ReadyToInstall(info, cached)
                } else {
                    _state.value = UpdateState.Available(info)
                }
            } else {
                if (!silent) _state.value = UpdateState.UpToDate
            }
        }
    }

    fun dismiss() {
        val current = _state.value
        if (current is UpdateState.Available) dismissedCode = current.info.versionCode
        if (current is UpdateState.ReadyToInstall) dismissedCode = current.info.versionCode
        _state.value = UpdateState.Idle
    }

    /** Downloads the APK (if not already verified in cache) and opens the system installer. */
    fun downloadAndInstall(activityContext: Context) {
        when (val current = _state.value) {
            is UpdateState.ReadyToInstall -> {
                launchInstaller(activityContext, current.apk)
            }
            is UpdateState.Available -> {
                val info = current.info
                _state.value = UpdateState.Downloading(info, null)
                scope.launch {
                    val result = downloadApk(info)
                    if (result != null) {
                        _state.value = UpdateState.ReadyToInstall(info, result)
                        withContext(Dispatchers.Main) {
                            launchInstaller(activityContext, result)
                        }
                    } else {
                        _state.value = UpdateState.Error(null)
                    }
                }
            }
            else -> Unit
        }
    }

    private fun apkFile(versionCode: Int): File {
        val dir = File(appContext.cacheDir, "updates").apply { mkdirs() }
        return File(dir, "truemain-$versionCode.apk")
    }

    private suspend fun fetchManifest(): UpdateInfo? = withContext(Dispatchers.IO) {
        runCatching {
            val req = Request.Builder()
                .url(feedUrl)
                .header("Accept", "application/json")
                .build()
            http.newCall(req).execute().use { res ->
                if (!res.isSuccessful) return@use null
                parseManifest(res.body.string())
            }
        }.getOrNull()
    }

    private suspend fun downloadApk(info: UpdateInfo): File? = withContext(Dispatchers.IO) {
        val target = apkFile(info.versionCode)
        val tmp = File(target.parentFile, "${target.name}.part")
        runCatching {
            // Clean older cached APKs before downloading the new one.
            target.parentFile?.listFiles()?.forEach { file ->
                if (file != target && file != tmp) file.delete()
            }
            val req = Request.Builder().url(info.url).build()
            http.newCall(req).execute().use { res ->
                if (!res.isSuccessful) return@use null
                val body = res.body
                val total = body.contentLength()
                val digest = MessageDigest.getInstance("SHA-256")
                var readTotal = 0L
                val buf = ByteArray(16 * 1024)
                body.byteStream().use { input ->
                    tmp.outputStream().use { output ->
                        while (true) {
                            val n = input.read(buf)
                            if (n < 0) break
                            output.write(buf, 0, n)
                            digest.update(buf, 0, n)
                            readTotal += n
                            if (total > 0) {
                                _state.value = UpdateState.Downloading(
                                    info,
                                    (readTotal.toFloat() / total.toFloat()).coerceIn(0f, 1f),
                                )
                            }
                        }
                    }
                }
                val expected = info.sha256?.trim()?.lowercase()
                if (!expected.isNullOrEmpty()) {
                    val actual = digest.digest().joinToString("") { "%02x".format(it) }
                    if (actual != expected) {
                        tmp.delete()
                        return@use null
                    }
                }
                if (target.exists()) target.delete()
                if (!tmp.renameTo(target)) {
                    tmp.copyTo(target, overwrite = true)
                    tmp.delete()
                }
                target
            }
        }.onFailure { tmp.delete() }.getOrNull()
    }

    private fun launchInstaller(context: Context, apk: File) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !context.packageManager.canRequestPackageInstalls()
        ) {
            val settings = Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:${context.packageName}"),
            ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            runCatching { context.startActivity(settings) }
            return
        }
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", apk)
        val install = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        runCatching { context.startActivity(install) }
    }

    private fun matchesSha256(file: File, expected: String?): Boolean {
        val clean = expected?.trim()?.lowercase() ?: return true
        if (clean.isEmpty()) return true
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buf = ByteArray(16 * 1024)
            while (true) {
                val n = input.read(buf)
                if (n < 0) break
                digest.update(buf, 0, n)
            }
        }
        val actual = digest.digest().joinToString("") { "%02x".format(it) }
        return actual == clean
    }

    companion object {
        fun isNewer(remoteCode: Int, currentCode: Int): Boolean = remoteCode > currentCode

        fun parseManifest(raw: String): UpdateInfo? = runCatching {
            val obj = Json.parseToJsonElement(raw).jsonObject
            val code = obj["versionCode"]?.jsonPrimitive?.intOrNull ?: return null
            val name = obj["versionName"]?.jsonPrimitive?.content?.takeIf { it.isNotBlank() } ?: return null
            val url = obj["url"]?.jsonPrimitive?.content?.takeIf { it.startsWith("https://") } ?: return null
            val sha256 = obj["sha256"]?.jsonPrimitive?.content?.takeIf { it.isNotBlank() }
            val notes = obj["notes"]?.jsonPrimitive?.content?.takeIf { it.isNotBlank() }
            UpdateInfo(code, name, url, sha256, notes)
        }.getOrNull()
    }
}
