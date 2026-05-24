/*
 * 验证码校准 profile 模拟识别脚本。
 *
 * Android 校准页写入 captcha_calibration/captcha_calibration_request.json 后运行本脚本。
 * 本脚本只读取本地截图和 profile，执行纯识别逻辑，并把结果写入 request.resultPath。
 */

var CONFIG = {
    baseScreen: { width: 1440, height: 3040 },
    outputDir: "/sdcard/OpenAutoJS_NanjingBooking",
    captcha: {
        moduleFileName: "nanjing_booking_captcha_solver.js",
        preferOcr: true,
        rawOcrEnabled: false,
        usePreprocessedOcr: true,
        whiteThreshold: 245,
        templateGrid: { w: 24, h: 32 },
        minGlyphScore: 0.22,
        prefocusInputBeforeMathOcr: false,
        inputMethod: { enabled: false },
        slider: {
            dragDuration: 420,
            afterDragMs: 120,
            trackMinRatio: 0.12,
            arrowMinRatio: 0.08,
            arrowStrongMinRatio: 0.08,
            fastTypeProbeStep: 12,
            fastImageScanStep: 14,
            trackPresenceMinRatio: 0.006,
            trackPresenceMinHits: 3,
            handlePresenceMinRatio: 0.045,
            handlePresenceMinHits: 4,
            handleConfirmMinRatio: 0.065,
            imageProbeMinRatio: 0.004,
            pollutedImageMinRatio: 0.35,
            pollutedFallbackStep: 8,
            pollutedBrightColumnStrongRatio: 0.48,
            pollutedBrightColumnMinRatio: 0.28,
            pollutedBrightMaxCenterRatio: 0.72,
            pollutedComponentStep: 10,
            pollutedComponentBrightnessMin: 185,
            pollutedComponentBrightnessMax: 246,
            pollutedComponentChromaMax: 32,
            pollutedComponentMinScore: 70,
            pollutedComponentMinFillRatio: 0.45,
            pollutedComponentMinGrayRatio: 0.55,
            pollutedComponentMinNeutralRatio: 0.65,
            pollutedComponentMaxDarkRatio: 0.18,
            pollutedEdgeMinNeutralRatio: 0.62,
            pollutedEdgeMaxDarkRatio: 0.25,
            pollutedEdgeStep: 12,
            pollutedFallbackMinScore: 70,
            pollutedFallbackMinNeutralRatio: 0.68,
            pollutedFallbackMaxDarkRatio: 0.22,
            pollutedFallbackMinCenterRatio: 0.25,
            fastImageMinColumnHits: 3,
            grayMin: 165,
            grayMax: 245,
            grayChromaMax: 24,
            scanStep: 6,
            minSide: 90,
            maxSide: 215,
            minColumnHits: 10,
            minArea: 3000
        }
    }
};

var runtime = {
    captchaTemplates: null,
    captchaStats: null
};

function nowText() {
    var d = new Date();
    function pad(n, len) {
        n = String(n);
        while (n.length < len) n = "0" + n;
        return n;
    }
    return d.getFullYear() + "-" + pad(d.getMonth() + 1, 2) + "-" + pad(d.getDate(), 2) +
        " " + pad(d.getHours(), 2) + ":" + pad(d.getMinutes(), 2) + ":" +
        pad(d.getSeconds(), 2) + "." + pad(d.getMilliseconds(), 3);
}

function fileTimeText() {
    var d = new Date();
    function pad(n, len) {
        n = String(n);
        while (n.length < len) n = "0" + n;
        return n;
    }
    return d.getFullYear() + pad(d.getMonth() + 1, 2) + pad(d.getDate(), 2) + "_" +
        pad(d.getHours(), 2) + pad(d.getMinutes(), 2) + pad(d.getSeconds(), 2) + "_" +
        pad(d.getMilliseconds(), 3);
}

function logx(msg) {
    var line = "[" + nowText() + "][CAPTCHA_PROFILE_SIM] " + msg;
    log(line);
}

function joinPath(dir, name) {
    if (!dir) return name;
    return dir + (dir.charAt(dir.length - 1) === "/" ? "" : "/") + name;
}

function currentScriptDir() {
    try {
        var source = engines.myEngine().source;
        var path = String(source || "");
        if (path.indexOf("file://") === 0) path = path.substring(7);
        var q = path.indexOf("?");
        if (q >= 0) path = path.substring(0, q);
        var idx = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
        if (idx > 0) return path.substring(0, idx);
    } catch (ignored) {}
    try {
        return files.cwd();
    } catch (ignoredCwd) {}
    return "";
}

function requestPath() {
    return joinPath(joinPath(currentScriptDir(), "captcha_calibration"), "captcha_calibration_request.json");
}

function defaultResultPath() {
    return joinPath(joinPath(currentScriptDir(), "captcha_calibration"), "captcha_calibration_result.json");
}

function readJson(path) {
    return JSON.parse(files.read(path));
}

function writeJson(path, obj) {
    files.ensureDir(path);
    files.write(path, JSON.stringify(obj, null, 2));
}

function clamp(v, min, max) {
    v = Math.round(v);
    if (v < min) return min;
    if (v > max) return max;
    return v;
}

function scaleX(x) {
    return Math.round(x * device.width / CONFIG.baseScreen.width);
}

function scaleY(y) {
    return Math.round(y * device.height / CONFIG.baseScreen.height);
}

function makePoint(x, y, source) {
    return {
        x: Math.round(x),
        y: Math.round(y),
        source: source || ""
    };
}

function imageWidth(img) {
    if (img && typeof img.getWidth === "function") return img.getWidth();
    if (img && typeof img.width === "number") return img.width;
    if (img && typeof img.getBitmap === "function") return img.getBitmap().getWidth();
    return 0;
}

function imageHeight(img) {
    if (img && typeof img.getHeight === "function") return img.getHeight();
    if (img && typeof img.height === "number") return img.height;
    if (img && typeof img.getBitmap === "function") return img.getBitmap().getHeight();
    return 0;
}

function loadCaptchaSolver() {
    var modulePath = joinPath(currentScriptDir(), CONFIG.captcha.moduleFileName);
    if (!files.exists(modulePath)) {
        throw new Error("验证码模块未找到 path=" + modulePath);
    }
    var code = files.read(modulePath);
    var factory = eval("(function(){ var module = { exports: null }; var exports = {}; " +
        code + "\n; return module.exports || createNanjingBookingCaptchaSolver; })()");
    if (typeof factory !== "function") {
        throw new Error("验证码模块导出异常 path=" + modulePath);
    }
    var solver = factory({
        config: CONFIG,
        runtime: runtime,
        log: logx,
        notifyUser: function (msg) { logx("notify=" + msg); },
        fileTimeText: fileTimeText,
        scaleX: scaleX,
        scaleY: scaleY,
        clamp: clamp,
        pressPoint: function () { return false; },
        makePoint: makePoint
    });
    if (!solver || typeof solver.recognizeMathFromImage !== "function" ||
        typeof solver.probeSliderFromImage !== "function") {
        throw new Error("验证码模块缺少 profile 模拟识别接口");
    }
    return solver;
}

function safeRegion(region) {
    region = region || {};
    return {
        x: Math.round(region.x || 0),
        y: Math.round(region.y || 0),
        w: Math.round(region.w || 0),
        h: Math.round(region.h || 0)
    };
}

function simulateMath(solver, img, profile) {
    var math = profile.mathProfile || {};
    var region = safeRegion(math.expressionRegion);
    var result = solver.recognizeMathFromImage(img, region);
    return {
        ok: !!(result && result.ok),
        type: "math",
        raw: result && result.raw ? result.raw : "",
        expression: result && result.expression ? result.expression : "",
        answer: result && result.answer ? result.answer : "",
        detail: result && result.detail ? result.detail : "",
        reason: result && result.reason ? result.reason : "",
        region: region
    };
}

function simulateSlider(solver, img, profile) {
    var result = solver.probeSliderFromImage(img, profile);
    var track = result && result.trackProbe ? result.trackProbe : {};
    var slider = result && result.slider ? result.slider : {};
    return {
        ok: !!(result && result.ok),
        type: "slider",
        reason: result && result.reason ? result.reason : "",
        detail: result && result.detail ? result.detail : "",
        trackRatio: track.ratio || 0,
        trackHits: track.hits || 0,
        trackTotal: track.total || 0,
        arrowRatio: track.arrowRatio || 0,
        arrowHits: track.arrowHits || 0,
        arrowTotal: track.arrowTotal || 0,
        startPoint: result ? result.startPoint : null,
        targetPoint: result ? result.targetPoint : null,
        boxes: slider.boxes || [],
        searchRegion: slider.region || null
    };
}

function main() {
    var reqPath = requestPath();
    var request = readJson(reqPath);
    var resultPath = request.resultPath || defaultResultPath();
    var img = null;
    try {
        var type = String(request.type || "");
        var profile = request.profile || {};
        if (!request.imagePath) {
            throw new Error("request.imagePath 为空");
        }
        img = images.read(String(request.imagePath));
        if (!img) {
            throw new Error("images.read returned null path=" + request.imagePath);
        }
        var solver = loadCaptchaSolver();
        var result;
        if (type === "math") {
            result = simulateMath(solver, img, profile);
        } else if (type === "slider") {
            result = simulateSlider(solver, img, profile);
        } else {
            throw new Error("未知模拟类型 type=" + type);
        }
        result.schemaVersion = 1;
        result.createdAt = nowText();
        result.imageWidth = imageWidth(img);
        result.imageHeight = imageHeight(img);
        writeJson(resultPath, result);
        logx("模拟识别完成 resultPath=" + resultPath + " result=" + JSON.stringify(result));
    } catch (e) {
        var failurePath = "";
        try {
            failurePath = (request && request.resultPath) || defaultResultPath();
        } catch (ignoredFailurePath) {
            failurePath = defaultResultPath();
        }
        writeJson(failurePath, {
            schemaVersion: 1,
            createdAt: nowText(),
            ok: false,
            type: request ? String(request.type || "") : "",
            reason: String(e),
            stack: e && e.stack ? String(e.stack) : ""
        });
        logx("模拟识别失败 err=" + e + " stack=" + (e && e.stack ? e.stack : ""));
    } finally {
        if (img) {
            try { img.recycle(); } catch (ignoredRecycle) {}
        }
    }
}

main();
