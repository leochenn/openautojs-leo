package org.autojs.autojs.model.automation

import android.content.Context
import android.util.DisplayMetrics
import android.view.WindowManager
import org.json.JSONObject
import java.io.File

data class CaptchaScreenSize(
    val width: Int,
    val height: Int
)

object CaptchaCalibrationStore {
    const val PROFILE_FILE_NAME = "captcha_layout_profile.json"

    fun profileFile(context: Context): File {
        return File(AutomationScripts.scriptsDir(context), PROFILE_FILE_NAME)
    }

    fun emptyProfile(context: Context): CaptchaCalibrationProfile {
        val screenSize = currentScreenSize(context)
        return CaptchaCalibrationProfile(
            deviceWidth = screenSize.width,
            deviceHeight = screenSize.height
        )
    }

    fun load(context: Context): CaptchaCalibrationProfile? {
        AutomationScripts.ensureReady(context)
        val file = profileFile(context)
        if (!file.exists()) {
            return null
        }
        return try {
            CaptchaCalibrationProfile.fromJson(JSONObject(file.readText()))
        } catch (e: Exception) {
            null
        }
    }

    fun save(context: Context, profile: CaptchaCalibrationProfile) {
        validateForSave(context, profile)?.let { throw IllegalArgumentException(it) }
        AutomationScripts.ensureReady(context)
        val file = profileFile(context)
        file.parentFile?.mkdirs()
        val normalized = profile.copy(
            schemaVersion = CaptchaCalibrationProfile.SCHEMA_VERSION,
            createdAt = CaptchaCalibrationProfile.nowIsoString()
        )
        file.writeText(normalized.toJson().toString(2))
    }

    fun validateForSave(context: Context, profile: CaptchaCalibrationProfile): String? {
        validateBasics(context, profile)?.let { return it }
        if (!profile.mathCompleted && !profile.sliderCompleted) {
            return "请至少完成一种验证码校准"
        }
        if (profile.mathProfile.completed) {
            validateMathProfile(profile)?.let { return it }
        }
        if (profile.sliderProfile.completed) {
            validateSliderProfile(profile)?.let { return it }
        }
        return null
    }

    fun validateForBooking(context: Context, profile: CaptchaCalibrationProfile): String? {
        validateBasics(context, profile)?.let { return it }
        validateMathProfile(profile)?.let { return it }
        validateSliderProfile(profile)?.let { return it }
        return null
    }

    @Suppress("DEPRECATION")
    fun currentScreenSize(context: Context): CaptchaScreenSize {
        val metrics = DisplayMetrics()
        val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        windowManager.defaultDisplay.getRealMetrics(metrics)
        return CaptchaScreenSize(metrics.widthPixels, metrics.heightPixels)
    }

    private fun validateBasics(context: Context, profile: CaptchaCalibrationProfile): String? {
        if (profile.schemaVersion != CaptchaCalibrationProfile.SCHEMA_VERSION) {
            return "验证码校准配置版本不支持，请重新校准"
        }
        if (profile.deviceWidth <= 0 || profile.deviceHeight <= 0) {
            return "验证码校准配置缺少屏幕尺寸，请重新校准"
        }
        val screenSize = currentScreenSize(context)
        if (profile.deviceWidth != screenSize.width || profile.deviceHeight != screenSize.height) {
            return "验证码校准配置与当前设备屏幕尺寸不一致，请重新校准"
        }
        return null
    }

    private fun validateMathProfile(profile: CaptchaCalibrationProfile): String? {
        val mathProfile = profile.mathProfile
        if (!mathProfile.completed) {
            return "数学验证码尚未完成校准"
        }
        return validateRegion(
            name = "数学表达式区域",
            region = mathProfile.expressionRegion,
            profile = profile
        ) ?: validateRegion(
            name = "数学输入框区域",
            region = mathProfile.inputRegion,
            profile = profile
        ) ?: validateRegion(
            name = "数学确定按钮区域",
            region = mathProfile.submitRegion,
            profile = profile
        ) ?: validateOptionalRegion(
            name = "数学弹窗区域",
            region = mathProfile.popupRegion,
            profile = profile
        )
    }

    private fun validateSliderProfile(profile: CaptchaCalibrationProfile): String? {
        val sliderProfile = profile.sliderProfile
        if (!sliderProfile.completed) {
            return "滑块验证码尚未完成校准"
        }
        return validateRegion(
            name = "滑块灰块搜索区域",
            region = sliderProfile.imageSearchRegion,
            profile = profile
        ) ?: validateRegion(
            name = "滑块拖动起点区域",
            region = sliderProfile.handleRegion,
            profile = profile
        ) ?: validateRegion(
            name = "滑块轨道区域",
            region = sliderProfile.trackRegion,
            profile = profile
        ) ?: validateRegion(
            name = "滑块确定按钮区域",
            region = sliderProfile.submitRegion,
            profile = profile
        ) ?: validateOptionalRegion(
            name = "滑块弹窗区域",
            region = sliderProfile.popupRegion,
            profile = profile
        )
    }

    private fun validateOptionalRegion(
        name: String,
        region: CaptchaRegion?,
        profile: CaptchaCalibrationProfile
    ): String? {
        if (region == null) {
            return null
        }
        return validateRegion(name, region, profile)
    }

    private fun validateRegion(
        name: String,
        region: CaptchaRegion?,
        profile: CaptchaCalibrationProfile
    ): String? {
        if (region == null) {
            return "${name}未标注"
        }
        if (!region.isValid) {
            return "${name}宽高无效"
        }
        if (region.x < 0 || region.y < 0) {
            return "${name}不能超出屏幕"
        }
        if (region.x + region.w > profile.deviceWidth || region.y + region.h > profile.deviceHeight) {
            return "${name}不能超出屏幕"
        }
        return null
    }
}
