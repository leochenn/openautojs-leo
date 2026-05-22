package org.autojs.autojs.model.automation

import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class CaptchaRegion(
    val x: Int,
    val y: Int,
    val w: Int,
    val h: Int
) {
    val isValid: Boolean
        get() = w > 0 && h > 0

    fun toJson(): JSONObject {
        return JSONObject()
            .put("x", x)
            .put("y", y)
            .put("w", w)
            .put("h", h)
    }

    companion object {
        fun fromJson(json: JSONObject?): CaptchaRegion? {
            if (json == null) {
                return null
            }
            return CaptchaRegion(
                x = json.optInt("x", 0),
                y = json.optInt("y", 0),
                w = json.optInt("w", 0),
                h = json.optInt("h", 0)
            )
        }
    }
}

data class CaptchaMathProfile(
    val completed: Boolean = false,
    val expressionRegion: CaptchaRegion? = null,
    val inputRegion: CaptchaRegion? = null,
    val submitRegion: CaptchaRegion? = null,
    val popupRegion: CaptchaRegion? = null
) {
    val hasRequiredRegions: Boolean
        get() = expressionRegion?.isValid == true &&
            inputRegion?.isValid == true &&
            submitRegion?.isValid == true

    fun toJson(): JSONObject {
        return JSONObject()
            .put("completed", completed)
            .putRegion("expressionRegion", expressionRegion)
            .putRegion("inputRegion", inputRegion)
            .putRegion("submitRegion", submitRegion)
            .putRegion("popupRegion", popupRegion)
    }

    companion object {
        fun fromJson(json: JSONObject?): CaptchaMathProfile {
            if (json == null) {
                return CaptchaMathProfile()
            }
            return CaptchaMathProfile(
                completed = json.optBoolean("completed", false),
                expressionRegion = CaptchaRegion.fromJson(json.optJSONObject("expressionRegion")),
                inputRegion = CaptchaRegion.fromJson(json.optJSONObject("inputRegion")),
                submitRegion = CaptchaRegion.fromJson(json.optJSONObject("submitRegion")),
                popupRegion = CaptchaRegion.fromJson(json.optJSONObject("popupRegion"))
            )
        }
    }
}

data class CaptchaSliderProfile(
    val completed: Boolean = false,
    val imageSearchRegion: CaptchaRegion? = null,
    val handleRegion: CaptchaRegion? = null,
    val trackRegion: CaptchaRegion? = null,
    val submitRegion: CaptchaRegion? = null,
    val popupRegion: CaptchaRegion? = null
) {
    val hasRequiredRegions: Boolean
        get() = imageSearchRegion?.isValid == true &&
            handleRegion?.isValid == true &&
            trackRegion?.isValid == true &&
            submitRegion?.isValid == true

    fun toJson(): JSONObject {
        return JSONObject()
            .put("completed", completed)
            .putRegion("imageSearchRegion", imageSearchRegion)
            .putRegion("handleRegion", handleRegion)
            .putRegion("trackRegion", trackRegion)
            .putRegion("submitRegion", submitRegion)
            .putRegion("popupRegion", popupRegion)
    }

    companion object {
        fun fromJson(json: JSONObject?): CaptchaSliderProfile {
            if (json == null) {
                return CaptchaSliderProfile()
            }
            return CaptchaSliderProfile(
                completed = json.optBoolean("completed", false),
                imageSearchRegion = CaptchaRegion.fromJson(json.optJSONObject("imageSearchRegion")),
                handleRegion = CaptchaRegion.fromJson(json.optJSONObject("handleRegion")),
                trackRegion = CaptchaRegion.fromJson(json.optJSONObject("trackRegion")),
                submitRegion = CaptchaRegion.fromJson(json.optJSONObject("submitRegion")),
                popupRegion = CaptchaRegion.fromJson(json.optJSONObject("popupRegion"))
            )
        }
    }
}

data class CaptchaCalibrationProfile(
    val schemaVersion: Int = SCHEMA_VERSION,
    val createdAt: String = nowIsoString(),
    val deviceWidth: Int,
    val deviceHeight: Int,
    val mathProfile: CaptchaMathProfile = CaptchaMathProfile(),
    val sliderProfile: CaptchaSliderProfile = CaptchaSliderProfile()
) {
    val mathCompleted: Boolean
        get() = mathProfile.completed && mathProfile.hasRequiredRegions

    val sliderCompleted: Boolean
        get() = sliderProfile.completed && sliderProfile.hasRequiredRegions

    fun toJson(): JSONObject {
        return JSONObject()
            .put("schemaVersion", schemaVersion)
            .put("createdAt", createdAt)
            .put("deviceWidth", deviceWidth)
            .put("deviceHeight", deviceHeight)
            .put("mathProfile", mathProfile.toJson())
            .put("sliderProfile", sliderProfile.toJson())
    }

    companion object {
        const val SCHEMA_VERSION = 1

        fun fromJson(json: JSONObject): CaptchaCalibrationProfile {
            return CaptchaCalibrationProfile(
                schemaVersion = json.optInt("schemaVersion", SCHEMA_VERSION),
                createdAt = json.optString("createdAt", nowIsoString()),
                deviceWidth = json.optInt("deviceWidth", 0),
                deviceHeight = json.optInt("deviceHeight", 0),
                mathProfile = CaptchaMathProfile.fromJson(json.optJSONObject("mathProfile")),
                sliderProfile = CaptchaSliderProfile.fromJson(json.optJSONObject("sliderProfile"))
            )
        }

        fun nowIsoString(): String {
            return SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssZ", Locale.US).format(Date())
        }
    }
}

private fun JSONObject.putRegion(name: String, region: CaptchaRegion?): JSONObject {
    if (region != null) {
        put(name, region.toJson())
    }
    return this
}
