/*
 * 南京预约验证码离线回放测试脚本。
 *
 * 手机目录示例：
 * /sdcard/OpenAutoJS_NanjingBooking/captcha_replay/
 *   manifest.json
 *   slider/xxx.png
 *   math/xxx.png
 *
 * manifest.json 可以是数组，也可以是 { baseDir, outputDir, profile, cases }。
 */

var CONFIG = {
    baseScreen: { width: 1440, height: 3040 },
    outputDir: "/sdcard/OpenAutoJS_NanjingBooking/captcha_replay",
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

var DEFAULT_PROFILE = {
    mathProfile: {
        completed: true,
        expressionRegion: { x: 505, y: 1162, w: 463, h: 206 },
        inputRegion: { x: 322, y: 1826, w: 696, h: 117 },
        submitRegion: { x: 405, y: 2161, w: 554, h: 113 }
    },
    sliderProfile: {
        completed: true,
        imageSearchRegion: { x: 183, y: 940, w: 1079, h: 693 },
        handleRegion: { x: 196, y: 1702, w: 143, h: 131 },
        trackRegion: { x: 384, y: 1691, w: 757, h: 140 },
        submitRegion: { x: 322, y: 2036, w: 776, h: 138 }
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
    var line = "[" + nowText() + "][CAPTCHA_REPLAY] " + msg;
    log(line);
}

function joinPath(dir, name) {
    if (!dir) return name;
    if (!name) return dir;
    if (String(name).charAt(0) === "/") return String(name);
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

function readJson(path) {
    return JSON.parse(files.read(path));
}

function writeText(path, text) {
    files.ensureDir(path);
    files.write(path, text);
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
        throw new Error("验证码模块缺少回放测试接口");
    }
    return solver;
}

function loadProfile(manifest) {
    if (manifest && manifest.profile) {
        return manifest.profile;
    }
    var profilePath = joinPath(currentScriptDir(), "captcha_layout_profile.json");
    if (files.exists(profilePath)) {
        try {
            var profile = readJson(profilePath);
            if (profile && profile.mathProfile && profile.sliderProfile) return profile;
        } catch (e) {
            logx("读取验证码 profile 失败，使用内置默认 profile err=" + e);
        }
    }
    return DEFAULT_PROFILE;
}

function normalizeManifest(raw) {
    if (raw instanceof Array) {
        return {
            baseDir: CONFIG.outputDir,
            outputDir: CONFIG.outputDir,
            cases: raw
        };
    }
    raw = raw || {};
    return {
        baseDir: raw.baseDir || CONFIG.outputDir,
        outputDir: raw.outputDir || CONFIG.outputDir,
        profile: raw.profile,
        cases: raw.cases || []
    };
}

function csvCell(value) {
    value = value === undefined || value === null ? "" : String(value);
    if (value.indexOf("\"") >= 0 || value.indexOf(",") >= 0 || value.indexOf("\n") >= 0) {
        return "\"" + value.replace(/"/g, "\"\"") + "\"";
    }
    return value;
}

function summaryCsv(rows) {
    var fields = [
        "file", "case", "expectedType", "actualType", "pass",
        "trackRatio", "arrowRatio", "imageRatio", "imageBoxes",
        "uiSliderOk", "imagePolluted", "targetX", "targetError",
        "targetFallback", "reason", "elapsedMs"
    ];
    var lines = [fields.join(",")];
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var values = [];
        for (var j = 0; j < fields.length; j++) {
            values.push(csvCell(row[fields[j]]));
        }
        lines.push(values.join(","));
    }
    return lines.join("\n");
}

function analyzeCase(solver, profile, baseDir, item) {
    var file = String(item.file || item.path || "");
    var path = joinPath(baseDir, file);
    var start = Date.now();
    var img = null;
    var row = {
        file: file,
        case: item.case || "",
        expectedType: item.type || "",
        actualType: "",
        pass: "",
        reason: ""
    };
    try {
        img = images.read(path);
        if (!img) throw new Error("images.read returned null path=" + path);
        row.imageWidth = imageWidth(img);
        row.imageHeight = imageHeight(img);

        var sliderProbe = solver.probeSliderFromImage(img, profile);
        var track = sliderProbe && sliderProbe.trackProbe ? sliderProbe.trackProbe : {};
        row.trackRatio = track.ratio || 0;
        row.arrowRatio = track.arrowRatio || 0;
        row.imageRatio = track.imageRatio || 0;
        row.imageBoxes = track.imageBoxes || 0;
        row.uiSliderOk = track.uiSliderOk === true;
        row.imagePolluted = track.imagePolluted === true;
        row.actualType = sliderProbe && sliderProbe.typeOk ? "slider" : "math";

        if (row.actualType === "slider") {
            row.reason = sliderProbe.reason || "";
            row.targetX = sliderProbe.targetPoint ? sliderProbe.targetPoint.x : "";
            row.targetY = sliderProbe.targetPoint ? sliderProbe.targetPoint.y : "";
            row.targetFallback = sliderProbe.slider && sliderProbe.slider.fallback ? sliderProbe.slider.fallback : "";
            row.detail = sliderProbe.detail || "";
        } else if (item.type === "math") {
            var mathRegion = profile.mathProfile && profile.mathProfile.expressionRegion;
            var mathResult = mathRegion ? solver.recognizeMathFromImage(img, mathRegion) : null;
            row.mathOk = !!(mathResult && mathResult.ok);
            row.raw = mathResult && mathResult.raw ? mathResult.raw : "";
            row.expression = mathResult && mathResult.expression ? mathResult.expression : "";
            row.answer = mathResult && mathResult.answer !== undefined ? mathResult.answer : "";
            row.reason = mathResult && mathResult.reason ? mathResult.reason : "";
        } else {
            row.reason = sliderProbe && sliderProbe.reason ? sliderProbe.reason : "";
        }

        if (item.type === "slider") {
            row.pass = row.actualType === "slider";
            if (row.pass && item.targetX !== undefined && item.targetX !== null && row.targetX !== "") {
                var tolerance = item.targetTolerance || 45;
                row.targetError = Math.abs(Number(row.targetX) - Number(item.targetX));
                row.pass = row.targetError <= tolerance;
            }
        } else if (item.type === "math") {
            row.pass = row.actualType === "math";
            if (row.pass && item.answer !== undefined && item.answer !== null && row.answer !== "") {
                row.pass = String(row.answer) === String(item.answer);
            }
        }
    } catch (e) {
        row.actualType = "error";
        row.pass = false;
        row.reason = String(e);
        row.stack = e && e.stack ? String(e.stack) : "";
    } finally {
        row.elapsedMs = Date.now() - start;
        if (img) {
            try { img.recycle(); } catch (ignoredRecycle) {}
        }
    }
    return row;
}

function main() {
    var manifestPath = joinPath(CONFIG.outputDir, "manifest.json");
    if (!files.exists(manifestPath)) {
        throw new Error("未找到回放 manifest: " + manifestPath);
    }
    var manifest = normalizeManifest(readJson(manifestPath));
    var profile = loadProfile(manifest);
    CONFIG.captcha.profile = profile;
    CONFIG.captcha.profileValidated = true;

    var solver = loadCaptchaSolver();
    var rows = [];
    var cases = manifest.cases || [];
    logx("开始验证码回放 cases=" + cases.length + " baseDir=" + manifest.baseDir);
    for (var i = 0; i < cases.length; i++) {
        var row = analyzeCase(solver, profile, manifest.baseDir, cases[i]);
        rows.push(row);
        logx("case " + (i + 1) + "/" + cases.length +
            " expected=" + row.expectedType +
            " actual=" + row.actualType +
            " pass=" + row.pass +
            " targetX=" + (row.targetX || "") +
            " fallback=" + (row.targetFallback || "") +
            " ms=" + row.elapsedMs +
            " file=" + row.file +
            " reason=" + row.reason);
    }

    var stamp = fileTimeText();
    var jsonPath = joinPath(manifest.outputDir, "summary_" + stamp + ".json");
    var csvPath = joinPath(manifest.outputDir, "summary_" + stamp + ".csv");
    writeText(jsonPath, JSON.stringify(rows, null, 2));
    writeText(csvPath, summaryCsv(rows));

    var checked = 0;
    var passed = 0;
    for (var j = 0; j < rows.length; j++) {
        if (rows[j].pass !== "") {
            checked++;
            if (rows[j].pass === true) passed++;
        }
    }
    logx("验证码回放完成 checked=" + checked + " passed=" + passed +
        " json=" + jsonPath + " csv=" + csvPath);
}

main();
