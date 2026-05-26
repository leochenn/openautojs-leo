package org.autojs.autojs.model.automation

import android.content.Context
import android.content.res.AssetManager
import org.json.JSONObject
import java.io.File
import java.io.FileNotFoundException
import java.util.Calendar
import java.util.GregorianCalendar

data class BookingConfig(
    val visitDate: String = "0521",
    val period: String = "上午",
    val visitorCount: Int = 2,
    val startTime: String = "8:00:00.5"
)

object AutomationScripts {
    private const val ASSET_DIR = "automation_scripts"
    private const val CONFIG_FILE_NAME = "nanjing_booking_config.json"
    const val CAPTCHA_PROFILE_FILE_NAME = CaptchaCalibrationStore.PROFILE_FILE_NAME
    const val MAIN_SCRIPT_NAME = "nanjing_booking_auto.js"

    val defaultConfig = BookingConfig()

    fun ensureReady(context: Context): File {
        val dir = scriptsDir(context)
        copyAssetDir(context.assets, ASSET_DIR, dir, overwrite = true)
        val configFile = configFile(context)
        if (!configFile.exists()) {
            writeConfigFile(configFile, defaultConfig)
        }
        return dir
    }

    fun scriptsDir(context: Context): File {
        return File(context.filesDir, ASSET_DIR)
    }

    fun mainScriptFile(context: Context): File {
        ensureReady(context)
        return File(scriptsDir(context), MAIN_SCRIPT_NAME)
    }

    fun configFile(context: Context): File {
        return File(scriptsDir(context), CONFIG_FILE_NAME)
    }

    fun captchaProfileFile(context: Context): File {
        return CaptchaCalibrationStore.profileFile(context)
    }

    fun loadCaptchaProfile(context: Context): CaptchaCalibrationProfile? {
        return CaptchaCalibrationStore.load(context)
    }

    fun saveCaptchaProfile(context: Context, profile: CaptchaCalibrationProfile) {
        CaptchaCalibrationStore.save(context, profile)
    }

    fun validateCaptchaProfile(context: Context, profile: CaptchaCalibrationProfile): String? {
        return CaptchaCalibrationStore.validateForBooking(context, profile)
    }

    fun validateCaptchaProfileForSave(context: Context, profile: CaptchaCalibrationProfile): String? {
        return CaptchaCalibrationStore.validateForSave(context, profile)
    }

    fun loadConfig(context: Context): BookingConfig {
        ensureReady(context)
        val file = configFile(context)
        return try {
            fromJson(JSONObject(file.readText()))
        } catch (e: Exception) {
            defaultConfig
        }
    }

    fun saveConfig(context: Context, config: BookingConfig) {
        validateConfig(config)?.let { throw IllegalArgumentException(it) }
        ensureReady(context)
        writeConfigFile(configFile(context), config)
    }

    fun validateConfig(config: BookingConfig): String? {
        if (!Regex("^\\d{4}$").matches(config.visitDate)) {
            return "参观日期必须是 4 位 MMDD，例如 0521"
        }
        val month = config.visitDate.substring(0, 2).toIntOrNull() ?: return "参观月份无效"
        val day = config.visitDate.substring(2, 4).toIntOrNull() ?: return "参观日期无效"
        if (month !in 1..12) {
            return "参观月份必须在 01 到 12 之间"
        }
        val year = Calendar.getInstance().get(Calendar.YEAR)
        val maxDay = GregorianCalendar(year, month - 1, 1)
            .getActualMaximum(Calendar.DAY_OF_MONTH)
        if (day !in 1..maxDay) {
            return "参观日期不在当月有效范围内"
        }
        if (config.period != "上午" && config.period != "下午") {
            return "参观时段只能选择上午或下午"
        }
        if (config.visitorCount !in 1..5) {
            return "参观人数必须在 1 到 5 之间"
        }
        val match = Regex("^(\\d{1,2}):(\\d{2}):(\\d{2})(?:\\.(\\d{1,3}))?$")
            .matchEntire(config.startTime)
            ?: return "抢票时间格式应为 HH:mm:ss 或 HH:mm:ss.SSS"
        val hour = match.groupValues[1].toInt()
        val minute = match.groupValues[2].toInt()
        val second = match.groupValues[3].toInt()
        if (hour !in 0..23 || minute !in 0..59 || second !in 0..59) {
            return "抢票时间超出有效范围"
        }
        return null
    }

    private fun fromJson(json: JSONObject): BookingConfig {
        return BookingConfig(
            visitDate = json.optString("visitDate", defaultConfig.visitDate).trim(),
            period = json.optString("period", defaultConfig.period).trim(),
            visitorCount = json.optInt("visitorCount", defaultConfig.visitorCount),
            startTime = json.optString("startTime", defaultConfig.startTime).trim()
        )
    }

    private fun writeConfigFile(file: File, config: BookingConfig) {
        file.parentFile?.mkdirs()
        val json = JSONObject()
            .put("visitDate", config.visitDate)
            .put("period", config.period)
            .put("visitorCount", config.visitorCount)
            .put("startTime", config.startTime)
        file.writeText(json.toString(2))
    }

    private fun copyAssetDir(
        assetManager: AssetManager,
        assetDirPath: String,
        targetDir: File,
        overwrite: Boolean
    ) {
        val children = assetManager.list(assetDirPath) ?: return
        if (!targetDir.exists()) {
            targetDir.mkdirs()
        }
        children.forEach { child ->
            copyAssetEntry(
                assetManager,
                "$assetDirPath/$child",
                File(targetDir, child),
                overwrite
            )
        }
    }

    private fun copyAssetEntry(
        assetManager: AssetManager,
        assetPath: String,
        target: File,
        overwrite: Boolean
    ) {
        try {
            assetManager.open(assetPath).use { input ->
                if (target.exists() && !overwrite) {
                    return
                }
                target.parentFile?.mkdirs()
                target.outputStream().use { output ->
                    input.copyTo(output)
                }
            }
        } catch (e: FileNotFoundException) {
            copyAssetDir(assetManager, assetPath, target, overwrite)
        }
    }
}
