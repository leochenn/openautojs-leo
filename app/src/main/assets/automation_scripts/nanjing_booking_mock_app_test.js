/*
 * 南京预约本地 Mock App 第二轮流程验证脚本
 *
 * 运行环境：OpenAutoJS / Auto.js。
 * 用途：读取正式脚本第一轮写入的坐标缓存，打开 app/template-project 打包出的 Mock App。
 *      在本地 HTML 页面上模拟第二轮抢票点击链路，便于正式抢票前做可视化核验。
 */

var CONFIG = {
    packageCandidates: ["com.leo.myapplication", "com.ch.sss"],
    cachePaths: [
        "/sdcard/OpenAutoJS_NanjingBooking/nanjing_booking_cache.json",
        "/sdcard/nanjing_booking_cache.json"
    ],
    outputDir: "/sdcard/OpenAutoJS_NanjingBooking",
    latestLogPath: "/sdcard/OpenAutoJS_NanjingBooking/nanjing_booking_mock_app_test_latest.log",
    backupLogPath: "/sdcard/nanjing_booking_mock_app_test.log",
    period: "上午", // "上午" 或 "下午"，应与正式脚本 CONFIG.period 保持一致
    visitorCount: 2,
    pressDuration: 10,
    visitorPressDuration: 50,
    startButtonWaitMs: 3500,
    pageWaitMs: 700,
    afterNormalBookingMs: 650,
    afterPressMs: 120,
    afterSwipeMs: 700,
    visitorIntervalMs: 80,
    afterConfirmCaptchaWaitMs: 500,
    captcha: {
        expressionRegion: { x: 455, y: 1160, w: 570, h: 200 },
        prefocusInputBeforeMathOcr: true,
        inputPoint: { x: 720, y: 1908 },
        // 与正式脚本第二轮验证码输入法参数保持一致。
        inputMethod: {
            enabled: true, // true 使用自定义 IME；false 则跳过 IME，进入人工兜底
            packageName: "", // 留空时使用当前 OpenAutoJS 包名；不要填 Mock App 包名
            action: "org.openautojs.autojs.action.CAPTCHA_IME_SET_ANSWER", // OpenAutoJS 验证码输入法接收答案的广播 action
            extraAnswer: "answer", // 广播中携带验证码答案的 extra key
            focusWaitMs: 250, // 点击验证码输入框后等待焦点/输入连接建立；偶发不输入可调到 400-600
            afterBroadcastMs: 80, // 发送广播后给 receiver 一个极短处理窗口，一般无需调整
            commitWaitMs: 350, // 等待 IME commitText 完成；已验证 350ms 可完成，正式偶发不输入可调到 800-1200
        },
        submitPoint: { x: 720, y: 2216 },
        autoSubmitAfterInput: true,
        skipFinalSubmit: false, // true 时只完成验证码输入/滑块拖动，不点击弹窗最后的“确定”，用于正式前观察验证
        afterInputMs: 300, // 与正式脚本第二轮保持一致：IME 输入完成后、收起键盘前的缓冲
        afterKeyboardBackMs: 250, // 与正式脚本第二轮保持一致：back 收起键盘后的缓冲
        preferOcr: true,
        rawOcrEnabled: false, // false 时数学验证码不跑原图 OCR，直接走预处理 OCR；true 时恢复原图 OCR 优先机制
        usePreprocessedOcr: true,
        whiteThreshold: 245,
        templateGrid: { w: 24, h: 32 },
        minGlyphScore: 0.22,
        slider: {
            imageRegion: { x: 188, y: 883, w: 1064, h: 858 },
            trackProbeRegion: { x: 188, y: 1741, w: 1064, h: 24 },
            arrowProbeRegion: { x: 210, y: 1765, w: 150, h: 110 },
            handleStartPoint: { x: 263, y: 1818 },
            submitPoint: { x: 720, y: 2148 },
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
    cache: null,
    cachePath: "",
    logPath: CONFIG.latestLogPath,
    latestLogPath: CONFIG.latestLogPath,
    captchaTemplates: null,
    captchaStats: null,
    captchaProfile: null,
    captchaMathInputPrefocused: false,
    captchaMathInputFocusedAt: 0
};

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

function runDirText() {
    var d = new Date();
    function pad(n, len) {
        n = String(n);
        while (n.length < len) n = "0" + n;
        return n;
    }
    return pad(d.getMonth() + 1, 2) + pad(d.getDate(), 2) + "-" +
        pad(d.getHours(), 2) + pad(d.getMinutes(), 2) + pad(d.getSeconds(), 2);
}

function writeLogLine(line) {
    try {
        files.append(runtime.logPath, line + "\n");
        if (runtime.latestLogPath && runtime.latestLogPath !== runtime.logPath) {
            files.append(runtime.latestLogPath, line + "\n");
        }
    } catch (e) {
        if (runtime.logPath !== CONFIG.backupLogPath) {
            runtime.logPath = CONFIG.backupLogPath;
            try {
                files.append(runtime.logPath, line + "\n");
            } catch (ignored) {}
        }
    }
}

function logx(msg) {
    var line = "[MOCK_TEST][" + new Date().toISOString() + "] " + msg;
    log(line);
    writeLogLine(line);
    try {
        toastLog(msg);
    } catch (e) {
        try {
            toast(msg);
        } catch (ignored) {}
    }
}

function fail(msg) {
    logx("失败：" + msg);
    throw new Error(msg);
}

function initLog() {
    runtime.runDir = CONFIG.outputDir + "/" + runDirText();
    files.ensureDir(runtime.runDir + "/");
    CONFIG.outputDir = runtime.runDir;
    runtime.logPath = runtime.runDir + "/nanjing_booking_mock_app_test_" + fileTimeText() + ".log";
    runtime.latestLogPath = CONFIG.latestLogPath;
    try {
        files.remove(runtime.latestLogPath);
    } catch (ignored) {}
    logx("运行目录=" + runtime.runDir);
    logx("日志路径=" + runtime.logPath + " latest=" + runtime.latestLogPath);
}

function initScreenCapture() {
    logx("正在提前请求截图权限");
    if (!requestScreenCapture()) {
        fail("请求截图权限失败");
    }
    logx("截图权限已获取");
}

function readJson(path) {
    try {
        if (!files.exists(path)) return null;
        return JSON.parse(files.read(path));
    } catch (e) {
        log("[MOCK_TEST] 读取缓存失败 path=" + path + " err=" + e);
        return null;
    }
}

function loadCache() {
    for (var i = 0; i < CONFIG.cachePaths.length; i++) {
        var path = CONFIG.cachePaths[i];
        var cache = readJson(path);
        if (cache) {
            runtime.cache = cache;
            runtime.cachePath = path;
            logx("已读取正式缓存：" + path);
            return;
        }
    }
    fail("未找到正式脚本第一轮缓存");
}

function cacheScreen() {
    if (runtime.cache && runtime.cache.screen && runtime.cache.screen.width && runtime.cache.screen.height) {
        return runtime.cache.screen;
    }
    return { width: device.width, height: device.height };
}

function adaptPoint(p, source) {
    if (!p) return null;
    var s = cacheScreen();
    return {
        x: Math.round(p.x * device.width / s.width),
        y: Math.round(p.y * device.height / s.height),
        source: source || p.source || "cache"
    };
}

function basePoint(name, x, y) {
    return {
        x: Math.round(x * device.width / 1440),
        y: Math.round(y * device.height / 3040),
        source: "fallback:" + name
    };
}

function scaleX(x) {
    return Math.round(x * device.width / 1440);
}

function scaleY(y) {
    return Math.round(y * device.height / 3040);
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function scaledRegion(region) {
    var x = scaleX(region.x);
    var y = scaleY(region.y);
    return {
        x: clamp(x, 0, device.width - 1),
        y: clamp(y, 0, device.height - 1),
        w: clamp(scaleX(region.w), 1, device.width - x),
        h: clamp(scaleY(region.h), 1, device.height - y)
    };
}

function joinLocalPath(dir, name) {
    if (!dir) return name;
    var last = dir.charAt(dir.length - 1);
    if (last === "/" || last === "\\") return dir + name;
    return dir + "/" + name;
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

function captchaProfilePath() {
    return joinLocalPath(currentScriptDir(), "captcha_layout_profile.json");
}

function isValidCaptchaRegion(region) {
    return !!(region &&
        typeof region.x === "number" &&
        typeof region.y === "number" &&
        typeof region.w === "number" &&
        typeof region.h === "number" &&
        region.x >= 0 &&
        region.y >= 0 &&
        region.w > 0 &&
        region.h > 0);
}

function validateCaptchaRegion(region, name, profile) {
    if (!isValidCaptchaRegion(region)) {
        return name + " invalid_or_missing";
    }
    if (region.x + region.w > profile.deviceWidth || region.y + region.h > profile.deviceHeight) {
        return name + " out_of_profile_screen";
    }
    return "";
}

function validateCaptchaProfile(profile) {
    if (!profile) return "profile_empty";
    if (profile.schemaVersion !== 1) return "unsupported_schema_version";
    if (profile.deviceWidth !== device.width || profile.deviceHeight !== device.height) {
        return "screen_mismatch profile=" + profile.deviceWidth + "x" + profile.deviceHeight +
            " current=" + device.width + "x" + device.height;
    }
    var math = profile.mathProfile;
    if (!math || math.completed !== true) return "math_profile_incomplete";
    var mathErr = validateCaptchaRegion(math.expressionRegion, "math.expressionRegion", profile) ||
        validateCaptchaRegion(math.inputRegion, "math.inputRegion", profile) ||
        validateCaptchaRegion(math.submitRegion, "math.submitRegion", profile);
    if (mathErr) return mathErr;

    var slider = profile.sliderProfile;
    if (!slider || slider.completed !== true) return "slider_profile_incomplete";
    var sliderErr = validateCaptchaRegion(slider.imageSearchRegion, "slider.imageSearchRegion", profile) ||
        validateCaptchaRegion(slider.handleRegion, "slider.handleRegion", profile) ||
        validateCaptchaRegion(slider.trackRegion, "slider.trackRegion", profile) ||
        validateCaptchaRegion(slider.submitRegion, "slider.submitRegion", profile);
    if (sliderErr) return sliderErr;
    return "";
}

function loadCaptchaProfile() {
    var path = captchaProfilePath();
    if (!files.exists(path)) {
        fail("captcha calibration profile missing: " + path);
    }
    var profile = null;
    try {
        profile = JSON.parse(files.read(path));
    } catch (e) {
        fail("captcha calibration profile read failed: " + e + " path=" + path);
    }
    var error = validateCaptchaProfile(profile);
    if (error) {
        fail("captcha calibration profile invalid: " + error + " path=" + path);
    }
    runtime.captchaProfile = profile;
    logx("captcha calibration profile loaded path=" + path +
        " screen=" + profile.deviceWidth + "x" + profile.deviceHeight);
    return profile;
}

function activeMathProfile() {
    var profile = runtime.captchaProfile;
    if (!profile || !profile.mathProfile || profile.mathProfile.completed !== true) return null;
    return profile.mathProfile;
}

function activeSliderProfile() {
    var profile = runtime.captchaProfile;
    if (!profile || !profile.sliderProfile || profile.sliderProfile.completed !== true) return null;
    return profile.sliderProfile;
}

function normalizeProfileRegion(region, name, templateEnabled) {
    region = region || {};
    return {
        x: Math.round(region.x || 0),
        y: Math.round(region.y || 0),
        w: Math.round(region.w || 0),
        h: Math.round(region.h || 0),
        name: name || region.name || "",
        templateEnabled: templateEnabled !== false
    };
}

function pointFromRegionCenter(name, region) {
    region = normalizeProfileRegion(region, name, true);
    return {
        x: Math.round(region.x + region.w / 2),
        y: Math.round(region.y + region.h / 2),
        source: "captcha-profile:" + name
    };
}

function mathExpressionRegion() {
    var math = activeMathProfile();
    if (math) return normalizeProfileRegion(math.expressionRegion, "profileMathExpression", true);
    return scaledRegion(CONFIG.captcha.expressionRegion);
}

function cachedPoint(key, fallback) {
    if (runtime.cache && runtime.cache.points && runtime.cache.points[key]) {
        return adaptPoint(runtime.cache.points[key], "cache:" + key);
    }
    if (fallback) return fallback;
    fail("缓存中缺少坐标：" + key);
}

function getPeriodCacheKey() {
    if (CONFIG.period === "上午") return "periodMorning";
    if (CONFIG.period === "下午") return "periodAfternoon";
    fail("period 只能配置为 上午 或 下午");
}

function pressPoint(name, p, duration) {
    if (!p) fail("缺少点击点：" + name);
    log("[MOCK_TEST] 点击 " + name + " x=" + Math.round(p.x) + " y=" + Math.round(p.y) + " source=" + p.source);
    press(Math.round(p.x), Math.round(p.y), duration || CONFIG.pressDuration);
}

function timedStep(stats, name, fn) {
    var start = Date.now();
    fn();
    var cost = Date.now() - start;
    stats.push({ name: name, cost: cost });
    logx("阶段耗时 " + name + "=" + cost + "ms");
    return cost;
}

function newCaptchaStats() {
    return {
        wait: 0,
        capture: 0,
        recognize: 0,
        ocrRaw: -1,
        preprocess: -1,
        ocrPreprocessed: -1,
        templateBuild: -1,
        glyphScan: -1,
        templateClassify: -1,
        prefocus: -1,
        input: 0,
        saveFailure: -1,
        raw: "",
        expression: "",
        answer: "",
        detail: "",
        captchaType: "",
        outcome: "unknown",
        reason: ""
    };
}

function captchaStatsText(stats, total) {
    if (!stats) return "stats=null";
    return "outcome=" + stats.outcome +
        " wait=" + stats.wait + "ms" +
        " capture=" + stats.capture + "ms" +
        " recognize=" + stats.recognize + "ms" +
        " ocrRaw=" + stats.ocrRaw + "ms" +
        " preprocess=" + stats.preprocess + "ms" +
        " ocrPreprocessed=" + stats.ocrPreprocessed + "ms" +
        " templateBuild=" + stats.templateBuild + "ms" +
        " glyphScan=" + stats.glyphScan + "ms" +
        " templateClassify=" + stats.templateClassify + "ms" +
        " prefocus=" + stats.prefocus + "ms" +
        " input=" + stats.input + "ms" +
        " saveFailure=" + stats.saveFailure + "ms" +
        " total=" + total + "ms" +
        " raw=" + stats.raw +
        " expression=" + stats.expression +
        " answer=" + stats.answer +
        " type=" + stats.captchaType +
        " detail=" + stats.detail +
        " reason=" + stats.reason;
}

function launchMockApp() {
    var launched = false;
    for (var i = 0; i < CONFIG.packageCandidates.length; i++) {
        var pkg = CONFIG.packageCandidates[i];
        try {
            if (app.launchPackage(pkg)) {
                logx("已启动 Mock App：" + pkg);
                launched = true;
                break;
            }
        } catch (e) {
            log("[MOCK_TEST] 启动失败 pkg=" + pkg + " err=" + e);
        }
    }
    if (!launched) fail("无法启动 Mock App，请确认已安装 app/template-project");
    sleep(CONFIG.pageWaitMs);
}

function clickStartButton() {
    var button = textMatches(/打开模拟预约页面|模拟预约/).findOne(CONFIG.startButtonWaitMs);
    if (button) {
        var b = button.bounds();
        pressPoint("App首页-打开模拟预约页面", {
            x: b.centerX(),
            y: b.centerY(),
            source: "accessibility:startButton"
        });
    } else {
        pressPoint("App首页-打开模拟预约页面兜底", {
            x: Math.round(device.width * 0.5),
            y: Math.round(device.height * 0.5),
            source: "fallback:center"
        });
    }
    sleep(CONFIG.pageWaitMs);
}

function getVisitorPoints() {
    if (runtime.cache && runtime.cache.audienceAlignTargetY) {
        var s = cacheScreen();
        var targetY = Math.round(runtime.cache.audienceAlignTargetY * device.height / s.height);
        var firstY = targetY + Math.round(390 * device.height / 3040);
        var gapY = Math.round(365 * device.height / 3040);
        var x = Math.round(700 * device.width / 1440);
        var anchored = [];
        for (var k = 0; k < 5; k++) {
            anchored.push({
                x: x,
                y: firstY + k * gapY,
                source: "anchor:audienceAlignTarget:" + (k + 1)
            });
        }
        return anchored;
    }

    var points = runtime.cache && runtime.cache.visitorRushPoints;
    if (points && points.length >= CONFIG.visitorCount) {
        var adapted = [];
        for (var i = 0; i < points.length; i++) {
            adapted.push(adaptPoint(points[i], "cache:visitorRushPoints:" + (i + 1)));
        }
        return adapted;
    }

    log("[MOCK_TEST] 缓存缺少 visitorRushPoints，使用截图比例兜底");
    var fallback = [];
    var firstY = 830;
    var gap = 365;
    for (var j = 0; j < 5; j++) {
        fallback.push(basePoint("visitor:" + (j + 1), 700, firstY + j * gap));
    }
    return fallback;
}

function gestureToVisitors() {
    var s = cacheScreen();
    var strategy = runtime.cache && runtime.cache.scrollStrategy;
    var startX;
    var startY;
    var endX;
    var endY;
    var duration;

    if (strategy) {
        startX = Math.round(strategy.startX * device.width / s.width);
        startY = Math.round(strategy.startY * device.height / s.height);
        endX = Math.round(strategy.endX * device.width / s.width);
        endY = Math.round(strategy.endY * device.height / s.height);
        duration = strategy.duration || 240;
    } else {
        startX = Math.round(device.width * 0.5);
        startY = Math.round(device.height * 0.78);
        endX = Math.round(device.width * 0.5);
        endY = Math.round(device.height * 0.18);
        duration = 240;
    }

    log("[MOCK_TEST] gesture到观众信息 from=(" + startX + "," + startY + ") to=(" + endX + "," + endY + ") duration=" + duration);
    try {
        gesture(duration, [startX, startY], [endX, endY]);
    } catch (e) {
        log("[MOCK_TEST] gesture失败，降级swipe err=" + e);
        swipe(startX, startY, endX, endY, duration);
    }
    sleep(CONFIG.afterSwipeMs);
}

function isWhiteCaptchaPixel(color) {
    var r = colorRed(color);
    var g = colorGreen(color);
    var b = colorBlue(color);
    var min = Math.min(r, g, b);
    var max = Math.max(r, g, b);
    return min >= CONFIG.captcha.whiteThreshold && (max - min) <= 28;
}

function imagePixel(img, x, y) {
    if (img && typeof img.pixel === "function") {
        return img.pixel(x, y);
    }
    return images.pixel(img, x, y);
}

function makePixelReader(img) {
    var bitmap = null;
    try {
        if (img && typeof img.getBitmap === "function") {
            bitmap = img.getBitmap();
        }
    } catch (ignoredBitmap) {}
    if (bitmap && typeof bitmap.getPixel === "function") {
        return function (x, y) {
            return bitmap.getPixel(Math.round(x), Math.round(y));
        };
    }
    return function (x, y) {
        return imagePixel(img, Math.round(x), Math.round(y));
    };
}

function colorNumber(color) {
    if (typeof color === "number") return color;
    try {
        return Number(color);
    } catch (ignored) {
        return 0;
    }
}

function colorRed(color) {
    return (colorNumber(color) >> 16) & 0xff;
}

function colorGreen(color) {
    return (colorNumber(color) >> 8) & 0xff;
}

function colorBlue(color) {
    return colorNumber(color) & 0xff;
}

function saveCaptchaFailure(img, region, reason) {
    var saveStart = Date.now();
    var stamp = fileTimeText();
    var fullPath = CONFIG.outputDir + "/captcha_fail_full_" + stamp + ".png";
    var cropPath = CONFIG.outputDir + "/captcha_fail_expr_" + stamp + ".png";
    var preprocessPath = CONFIG.outputDir + "/captcha_fail_preprocessed_" + stamp + ".png";
    var clip = null;
    var processed = null;
    try {
        images.save(img, fullPath);
        clip = images.clip(img, region.x, region.y, region.w, region.h);
        images.save(clip, cropPath);
        processed = preprocessCaptchaClipForOcr(clip);
        if (processed) {
            images.save(processed, preprocessPath);
        }
        logx("验证码识别失败截图已保存 reason=" + reason + " full=" + fullPath + " crop=" + cropPath +
            (processed ? " preprocessed=" + preprocessPath : ""));
    } catch (e) {
        logx("验证码识别失败截图保存异常 reason=" + reason + " err=" + e);
    } finally {
        if (runtime.captchaStats) {
            runtime.captchaStats.saveFailure = Date.now() - saveStart;
        }
        if (processed) {
            try { processed.recycle(); } catch (ignoredProcessed) {}
        }
        if (clip) {
            try { clip.recycle(); } catch (ignored) {}
        }
    }
}

function preprocessCaptchaClipForOcr(clip) {
    var gray = null;
    var processed = null;
    var start = Date.now();
    try {
        gray = images.grayscale(clip);
        processed = images.threshold(gray, CONFIG.captcha.whiteThreshold, 255, "BINARY_INV");
        if (runtime.captchaStats) {
            runtime.captchaStats.preprocess = Date.now() - start;
        }
        return processed;
    } catch (e) {
        if (runtime.captchaStats) {
            runtime.captchaStats.preprocess = Date.now() - start;
        }
        if (processed) {
            try { processed.recycle(); } catch (ignoredProcessed) {}
        }
        logx("验证码预处理失败，将跳过预处理 OCR err=" + e);
        return null;
    } finally {
        if (gray) {
            try { gray.recycle(); } catch (ignoredGray) {}
        }
    }
}

function findCaptchaGlyphs(img, region) {
    var colCount = [];
    var x;
    var y;
    for (x = 0; x < region.w; x++) colCount[x] = 0;

    for (y = 0; y < region.h; y++) {
        for (x = 0; x < region.w; x++) {
            if (isWhiteCaptchaPixel(imagePixel(img, region.x + x, region.y + y))) {
                colCount[x]++;
            }
        }
    }

    var glyphs = [];
    var inRun = false;
    var startX = 0;
    for (x = 0; x <= region.w; x++) {
        var active = x < region.w && colCount[x] >= 3;
        if (active && !inRun) {
            startX = x;
            inRun = true;
        } else if ((!active || x === region.w) && inRun) {
            var endX = x - 1;
            inRun = false;
            var box = refineGlyphBox(img, region, startX, endX);
            if (box && box.area >= 45 && box.w >= 4 && box.h >= 5) {
                glyphs.push(box);
            }
        }
    }

    return mergeNarrowCaptchaGlyphs(glyphs);
}

function refineGlyphBox(img, region, leftX, rightX) {
    var minX = region.w;
    var minY = region.h;
    var maxX = -1;
    var maxY = -1;
    var area = 0;
    for (var y = 0; y < region.h; y++) {
        for (var x = leftX; x <= rightX; x++) {
            if (isWhiteCaptchaPixel(imagePixel(img, region.x + x, region.y + y))) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                area++;
            }
        }
    }
    if (maxX < minX || maxY < minY) return null;
    return {
        x: minX,
        y: minY,
        w: maxX - minX + 1,
        h: maxY - minY + 1,
        area: area
    };
}

function mergeNarrowCaptchaGlyphs(glyphs) {
    if (glyphs.length <= 1) return glyphs;
    glyphs.sort(function (a, b) { return a.x - b.x; });
    var merged = [];
    for (var i = 0; i < glyphs.length; i++) {
        var g = glyphs[i];
        var last = merged.length ? merged[merged.length - 1] : null;
        var gap = last ? g.x - (last.x + last.w) : 999;
        var tiny = g.area < 80 || g.w < 8 || g.h < 12;
        if (last && tiny && gap <= 18) {
            var x1 = Math.min(last.x, g.x);
            var y1 = Math.min(last.y, g.y);
            var x2 = Math.max(last.x + last.w, g.x + g.w);
            var y2 = Math.max(last.y + last.h, g.y + g.h);
            last.x = x1;
            last.y = y1;
            last.w = x2 - x1;
            last.h = y2 - y1;
            last.area += g.area;
        } else if (!tiny) {
            merged.push(g);
        }
    }
    return merged;
}

function buildCaptchaTemplates() {
    if (runtime.captchaTemplates) return runtime.captchaTemplates;
    var start = Date.now();
    var chars = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "-", "\u00d7", "\u00f7", "=", "?"];
    var templates = {};
    for (var i = 0; i < chars.length; i++) {
        var ch = chars[i];
        templates[ch] = renderTemplateGlyph(ch);
    }
    runtime.captchaTemplates = templates;
    if (runtime.captchaStats) {
        runtime.captchaStats.templateBuild = Date.now() - start;
    }
    return templates;
}

function renderTemplateGlyph(ch) {
    var Bitmap = android.graphics.Bitmap;
    var Canvas = android.graphics.Canvas;
    var Paint = android.graphics.Paint;
    var Color = android.graphics.Color;

    var paint = new Paint();
    paint.setAntiAlias(true);
    paint.setColor(Color.WHITE);
    paint.setTextSize(132);

    var width = 190;
    var height = 190;
    var bitmap = createTemplateBitmap(Bitmap, width, height);
    var canvas = new Canvas(bitmap);
    canvas.drawColor(Color.BLACK);
    canvas.drawText(String(ch), 25, 140, paint);

    var box = trimBitmapGlyph(bitmap);
    var grid = sampleBitmapGlyph(bitmap, box);
    try { bitmap.recycle(); } catch (ignored) {}
    return grid;
}

function createTemplateBitmap(Bitmap, width, height) {
    var lastError = null;
    try {
        return Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
    } catch (e1) {
        lastError = e1;
    }
    try {
        return Bitmap.createBitmap(width, height, Bitmap.Config.valueOf("ARGB_8888"));
    } catch (e2) {
        lastError = e2;
    }
    throw lastError;
}

function trimBitmapGlyph(bitmap) {
    var minX = bitmap.getWidth();
    var minY = bitmap.getHeight();
    var maxX = -1;
    var maxY = -1;
    for (var y = 0; y < bitmap.getHeight(); y++) {
        for (var x = 0; x < bitmap.getWidth(); x++) {
            if (isWhiteCaptchaPixel(bitmap.getPixel(x, y))) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    if (maxX < minX || maxY < minY) {
        return { x: 0, y: 0, w: bitmap.getWidth(), h: bitmap.getHeight() };
    }
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function sampleBitmapGlyph(bitmap, box) {
    return sampleGlyphGrid(box, function (x, y) {
        return isWhiteCaptchaPixel(bitmap.getPixel(x, y));
    });
}

function sampleImageGlyph(img, region, box) {
    return sampleGlyphGrid(box, function (x, y) {
        return isWhiteCaptchaPixel(imagePixel(img, region.x + x, region.y + y));
    });
}

function sampleGlyphGrid(box, whiteAt) {
    var gridW = CONFIG.captcha.templateGrid.w;
    var gridH = CONFIG.captcha.templateGrid.h;
    var out = [];
    for (var gy = 0; gy < gridH; gy++) {
        for (var gx = 0; gx < gridW; gx++) {
            var x1 = box.x + Math.floor(gx * box.w / gridW);
            var x2 = box.x + Math.max(x1 - box.x + 1, Math.ceil((gx + 1) * box.w / gridW));
            var y1 = box.y + Math.floor(gy * box.h / gridH);
            var y2 = box.y + Math.max(y1 - box.y + 1, Math.ceil((gy + 1) * box.h / gridH));
            var total = 0;
            var hit = 0;
            for (var y = y1; y < y2; y++) {
                for (var x = x1; x < x2; x++) {
                    total++;
                    if (whiteAt(x, y)) hit++;
                }
            }
            out.push(hit > 0 && hit / total >= 0.04);
        }
    }
    return out;
}

function glyphScore(a, b) {
    var intersection = 0;
    var union = 0;
    for (var i = 0; i < a.length; i++) {
        if (a[i] || b[i]) union++;
        if (a[i] && b[i]) intersection++;
    }
    if (!union) return 0;
    return intersection / union;
}

function classifyCaptchaGlyph(img, region, glyph, templates) {
    var sample = sampleImageGlyph(img, region, glyph);
    var bestChar = "";
    var bestScore = -1;
    for (var ch in templates) {
        var score = glyphScore(sample, templates[ch]);
        if (score > bestScore) {
            bestScore = score;
            bestChar = ch;
        }
    }
    return { text: bestChar, score: bestScore };
}

function evaluateCaptchaExpression(text) {
    var normalizedResult = normalizeCaptchaOcrTextWithRules(text);
    var normalized = normalizedResult.text;
    var m = normalized.match(/(\d{1,2})([+\-\u00d7\u00f7])(\d{1,2})/);
    if (!m && !hasExplicitOperatorHint(normalized)) {
        var inferred = inferOcrMissingMultiply(normalized);
        if (inferred) {
            inferred.normalized = normalized;
            inferred.rules = normalizedResult.rules.concat([inferred.rule]);
            attachInferredCaptchaContext(inferred, normalized);
            appendCaptchaContextRules(inferred.rules, inferred);
            inferred.ruleText = inferred.rules.join("|");
            return inferred;
        }
    }
    if (!m) {
        var inferredTrimmed = inferMissingLeadingOneAndTrimTailOperand(normalized, normalizedResult.rules);
        if (inferredTrimmed) return inferredTrimmed;
        return null;
    }
    var a = parseInt(m[1], 10);
    var op = m[2];
    var b = parseInt(m[3], 10);
    var answer = evaluateCaptchaOperation(a, op, b);
    if (answer === null) return null;
    if (op === "+" && answer > 99) {
        var divideInferred = inferPlusShouldBeDivide(a, b, normalized, normalizedResult.rules);
        if (divideInferred) {
            attachMatchedCaptchaContext(divideInferred, normalized, m);
            appendCaptchaContextRules(divideInferred.rules, divideInferred);
            divideInferred.ruleText = divideInferred.rules.join("|");
            return divideInferred;
        }
    }
    if (!isValidCaptchaAnswer(answer)) {
        var inferredLeadingOne = inferMissingLeadingOneFromInvalidExpression(normalized, normalizedResult.rules);
        if (inferredLeadingOne) return inferredLeadingOne;
        inferredTrimmed = inferMissingLeadingOneAndTrimTailOperand(normalized, normalizedResult.rules);
        if (inferredTrimmed) return inferredTrimmed;
        return null;
    }
    var rules = normalizedResult.rules.length ? normalizedResult.rules.slice() : ["direct_parse"];
    var prefix = normalized.substring(0, m.index);
    var tail = normalized.substring(m.index + m[0].length);
    var prefixCheck = analyzeCaptchaExpressionPrefix(prefix);
    var tailCheck = analyzeCaptchaExpressionTail(tail);
    var parsed = {
        expression: m[1] + op + m[3],
        answer: String(answer),
        normalized: normalized,
        rules: rules,
        prefix: prefix,
        prefixCheck: prefixCheck,
        tail: tail,
        tailCheck: tailCheck,
        prefixNoiseIgnored: prefixCheck.prefixNoiseIgnored === true,
        tailNoiseIgnored: tailCheck.tailNoiseIgnored === true,
        markerTailNoiseIgnored: tailCheck.markerTailNoiseIgnored === true,
        ignoredPrefix: prefixCheck.ignoredPrefix || "",
        ignoredTail: tailCheck.ignoredTail || ""
    };
    appendCaptchaContextRules(rules, parsed);
    parsed.ruleText = rules.join("|");
    return parsed;
}

function evaluateCaptchaOperation(a, op, b) {
    if (op === "+") return a + b;
    if (op === "-") return a - b;
    if (op === "\u00d7") return a * b;
    if (op === "\u00f7") return a / b;
    return null;
}

function isValidCaptchaAnswer(answer) {
    return Math.floor(answer) === answer && answer >= 0 && answer <= 99;
}

function captchaInferencePrefixOk(normalized, matchIndex) {
    var prefix = String(normalized).substring(0, matchIndex);
    return !/[0-9+\-\u00d7\u00f7=?:\uff1a\/xX*]/.test(prefix);
}

function inferenceBaseRules(baseRules, rule) {
    var rules = baseRules && baseRules.length ? baseRules.slice() : ["direct_parse"];
    appendCaptchaRule(rules, rule);
    return rules;
}

function buildInferredCaptchaExpression(normalized, matchIndex, rawCore, a, op, b, baseRules, rule) {
    var answer = evaluateCaptchaOperation(a, op, b);
    if (answer === null || !isValidCaptchaAnswer(answer)) return null;
    var rules = inferenceBaseRules(baseRules, rule);
    var parsed = {
        expression: String(a) + op + String(b),
        answer: String(answer),
        normalized: normalized,
        rules: rules
    };
    attachMatchedCaptchaContext(parsed, normalized, { index: matchIndex, 0: rawCore });
    appendCaptchaContextRules(rules, parsed);
    parsed.ruleText = rules.join("|");
    return parsed;
}

function inferMissingLeadingOneAndTrimTailOperand(normalized, baseRules) {
    var text = String(normalized || "");
    var m = text.match(/(\d)([+\-\u00d7\u00f7])(\d{3})([=?]*)$/);
    if (!m || !captchaInferencePrefixOk(text, m.index)) return null;
    var right = m[3].substring(0, 2);
    return buildInferredCaptchaExpression(
        text,
        m.index,
        m[1] + m[2] + m[3],
        10 + parseInt(m[1], 10),
        m[2],
        parseInt(right, 10),
        baseRules,
        "infer_missing_leading_one_and_trim_tail_operand"
    );
}

function inferMissingLeadingOneFromInvalidExpression(normalized, baseRules) {
    var text = String(normalized || "");
    var m = text.match(/(\d)([+\-\u00d7\u00f7])(\d{1,2})([=?]*)$/);
    if (!m || !captchaInferencePrefixOk(text, m.index)) return null;
    var a = parseInt(m[1], 10);
    var op = m[2];
    var b = parseInt(m[3], 10);
    var originalAnswer = evaluateCaptchaOperation(a, op, b);
    if (originalAnswer !== null && isValidCaptchaAnswer(originalAnswer)) return null;
    return buildInferredCaptchaExpression(
        text,
        m.index,
        m[1] + op + m[3],
        10 + a,
        op,
        b,
        baseRules,
        "infer_missing_leading_one_from_invalid_expression"
    );
}

function appendCaptchaContextRules(rules, parsed) {
    if (!parsed) return;
    if (parsed.prefixCheck && parsed.prefixCheck.rule) {
        appendCaptchaRule(rules, parsed.prefixCheck.rule);
    }
    if (parsed.tailCheck && parsed.tailCheck.rule) {
        appendCaptchaRule(rules, parsed.tailCheck.rule);
    }
}

function appendCaptchaRule(rules, rule) {
    if (!rule) return;
    for (var i = 0; i < rules.length; i++) {
        if (rules[i] === rule) return;
    }
    rules.push(rule);
}

function attachMatchedCaptchaContext(parsed, normalized, match) {
    var prefix = normalized.substring(0, match.index);
    var tail = normalized.substring(match.index + match[0].length);
    parsed.prefix = prefix;
    parsed.prefixCheck = analyzeCaptchaExpressionPrefix(prefix);
    parsed.tail = tail;
    parsed.tailCheck = analyzeCaptchaExpressionTail(tail);
    parsed.prefixNoiseIgnored = parsed.prefixCheck.prefixNoiseIgnored === true;
    parsed.tailNoiseIgnored = parsed.tailCheck.tailNoiseIgnored === true;
    parsed.markerTailNoiseIgnored = parsed.tailCheck.markerTailNoiseIgnored === true;
    parsed.ignoredPrefix = parsed.prefixCheck.ignoredPrefix || "";
    parsed.ignoredTail = parsed.tailCheck.ignoredTail || "";
}

function analyzeCaptchaExpressionPrefix(prefix) {
    var text = String(prefix || "");
    if (text.length === 0) {
        return {};
    }
    // \u57fa\u4e8e"\u64cd\u4f5c\u6570<100"\u7ea6\u675f\uff0c\d{1,2} \u5339\u914d\u5230\u7684 x op y \u5df2\u662f\u5408\u6cd5\u8868\u8fbe\u5f0f\uff0c
    // prefix \u4e2d\u7684\u4efb\u4f55\u5b57\u7b26\u90fd\u4e0d\u53ef\u80fd\u662f\u5408\u6cd5\u64cd\u4f5c\u6570\u7684\u4e00\u90e8\u5206\uff0c\u5b89\u5168\u5ffd\u7565\u3002
    return {
        rule: "ignore_prefix_as_noise",
        prefixNoiseIgnored: true,
        ignoredPrefix: text
    };
}

function attachInferredCaptchaContext(parsed, normalized) {
    var markerIndex = String(normalized).search(/[=?]/);
    var core = markerIndex >= 0 ? normalized.substring(0, markerIndex) : normalized;
    var tail = markerIndex >= 0 ? normalized.substring(markerIndex) : "";
    parsed.inferredCore = core;
    parsed.prefix = "";
    parsed.prefixCheck = {};
    parsed.tail = tail;
    parsed.tailCheck = analyzeCaptchaExpressionTail(tail);
    parsed.prefixNoiseIgnored = false;
    parsed.tailNoiseIgnored = parsed.tailCheck.tailNoiseIgnored === true;
    parsed.markerTailNoiseIgnored = parsed.tailCheck.markerTailNoiseIgnored === true;
    parsed.ignoredPrefix = "";
    parsed.ignoredTail = parsed.tailCheck.ignoredTail || "";
}

function analyzeCaptchaExpressionTail(tail) {
    var text = String(tail || "");
    if (text.length === 0) {
        return { hasMarker: false, suspicious: "ocr_missing_tail_marker" };
    }

    var markerMatch = text.match(/^[=?]+/);
    if (markerMatch) {
        var marker = markerMatch[0];
        var afterMarker = text.substring(marker.length);
        if (afterMarker.length === 0) {
            return { hasMarker: true, marker: marker };
        }
        if (hasCaptchaExpressionCore(afterMarker)) {
            return {
                hasMarker: true,
                marker: marker,
                afterMarker: afterMarker,
                suspicious: "ocr_tail_contains_expression_after_marker"
            };
        }
        if (afterMarker.length > 4) {
            return {
                hasMarker: true,
                marker: marker,
                afterMarker: afterMarker,
                suspicious: "ocr_tail_noise_too_long_after_marker"
            };
        }
        return {
            hasMarker: true,
            marker: marker,
            afterMarker: afterMarker,
            rule: "ignore_tail_noise_after_marker",
            markerTailNoiseIgnored: true,
            ignoredTail: afterMarker
        };
    }

    if (/^[+\-\u00d7\u00f7]\d{1,2}$/.test(text)) {
        return {
            hasMarker: false,
            rule: "ignore_tail_operator_digits_as_marker_noise",
            tailNoiseIgnored: true,
            ignoredTail: text
        };
    }

    return {
        hasMarker: false,
        suspicious: "ocr_untrusted_tail_before_marker",
        ignoredTail: text
    };
}

function hasCaptchaExpressionCore(text) {
    return /(\d{1,2})([+\-\u00d7\u00f7])(\d{1,2})/.test(String(text || ""));
}

function inferPlusShouldBeDivide(a, b, normalized, baseRules) {
    if (!b || a % b !== 0) return null;
    var answer = a / b;
    if (Math.floor(answer) !== answer || answer < 0 || answer > 99) return null;
    var rules = (baseRules || []).concat(["infer_plus_to_divide_when_sum_over_99"]);
    return {
        expression: String(a) + "\u00f7" + String(b),
        answer: String(answer),
        normalized: normalized,
        rules: rules,
        ruleText: rules.join("|")
    };
}

function getSuspiciousCaptchaOcrReason(raw, parsed) {
    if (!parsed) return "";
    var normalized = parsed.normalized || normalizeCaptchaOcrText(raw);
    var prefixCheck = parsed.prefixCheck || analyzeCaptchaExpressionPrefix(parsed.prefix || "");
    if (prefixCheck.suspicious) {
        return prefixCheck.suspicious + " prefix=" + (parsed.prefix || "") + " normalized=" + normalized;
    }
    if (parsed.inferredCore !== undefined && /[^0-9]/.test(parsed.inferredCore)) {
        return "ocr_inferred_core_residue core=" + parsed.inferredCore + " normalized=" + normalized;
    }
    var tailCheck = parsed.tailCheck || analyzeCaptchaExpressionTail(parsed.tail || "");
    if (tailCheck.suspicious) {
        return tailCheck.suspicious + " tail=" + (parsed.tail || "") + " normalized=" + normalized;
    }
    return "";
}

function shouldAcceptSuspiciousCaptchaOcr(suspicious, parsed) {
    if (!suspicious) {
        return false;
    }
    if (!parsed || !parsed.expression || parsed.answer === undefined || parsed.answer === null) {
        return false;
    }
    if (!/^\d{1,2}[+\-\u00d7\u00f7]\d{1,2}$/.test(String(parsed.expression))) {
        return false;
    }
    var answerText = String(parsed.answer);
    if (!/^\d{1,2}$/.test(answerText)) {
        return false;
    }
    var answer = parseInt(answerText, 10);
    if (answer < 0 || answer > 99) {
        return false;
    }
    if (!parsed.rules) parsed.rules = [];
    appendCaptchaRule(parsed.rules, "accept_parsed_answer_despite_suspicious");
    parsed.ruleText = parsed.rules.join("|");
    return true;
}

function normalizeCaptchaOcrText(text) {
    return normalizeCaptchaOcrTextWithRules(text).text;
}

function normalizeCaptchaOcrTextWithRules(text) {
    var value = String(text);
    var rules = [];
    var next = value.replace(/\s+/g, "");
    if (next !== value) {
        rules.push("strip_space");
        value = next;
    }
    next = value.replace(/[xX*\uff0a]/g, "\u00d7");
    if (next !== value) {
        rules.push("operator_alias_to_multiply");
        value = next;
    }
    next = value.replace(/[\uff0b]/g, "+");
    if (next !== value) {
        rules.push("operator_alias_to_plus");
        value = next;
    }
    next = value.replace(/[\/\uff0f]/g, "\u00f7");
    if (next !== value) {
        rules.push("operator_alias_to_divide");
        value = next;
    }
    next = value.replace(/\uff1d/g, "=").replace(/\uff1f/g, "?");
    if (next !== value) {
        rules.push("fullwidth_marker_to_ascii");
        value = next;
    }
    next = value.replace(/(\d{1,2})[:\uff1a](\d{1,2})/g, "$1\u00f7$2");
    if (next !== value) {
        rules.push("colon_between_numbers_to_divide");
        value = next;
    }
    next = value.replace(/[\uff0d\u2212\u2010\u2011\u2012\u2013\u2014]/g, "-");
    if (next !== value) {
        rules.push("dash_alias_to_minus");
        value = next;
    }
    next = value.replace(/([=?])[\.\u3002\uff0e,\uff0c]+$/g, "$1");
    if (next !== value) {
        rules.push("strip_tail_punctuation_after_marker");
        value = next;
    }
    return {
        text: value,
        rules: rules
    };
}

function hasExplicitOperatorHint(text) {
    return /[+\-\u00d7\u00f7:\uff1a\/xX*]/.test(String(text));
}

function inferOcrMissingMultiply(text) {
    var beforeEqual = String(text).split("=")[0].replace(/\D/g, "");
    if (beforeEqual.length < 3 || beforeEqual.length > 5) return null;

    var candidates = [];
    function addCandidate(aText, bText) {
        if (!aText || !bText || aText.length > 2 || bText.length > 2) return;
        var a = parseInt(aText, 10);
        var b = parseInt(bText, 10);
        if (!a || !b) return;
        var answer = a * b;
        if (answer <= 99) {
            candidates.push({
                expression: String(a) + "\u00d7" + String(b),
                answer: String(answer),
                rule: "infer_missing_multiply_from_zero"
            });
        }
    }

    if (beforeEqual.charAt(0) === "0") {
        var rest = beforeEqual.substring(1);
        for (var i = 1; i < rest.length; i++) {
            addCandidate(rest.substring(0, i), rest.substring(i));
        }
    }

    for (var z = 1; z < beforeEqual.length - 1; z++) {
        if (beforeEqual.charAt(z) === "0") {
            addCandidate(beforeEqual.substring(0, z), beforeEqual.substring(z + 1));
        }
    }

    if (candidates.length === 1) return candidates[0];
    return null;
}

function recognizeCaptchaExpression(img, region) {
    var rawOcrEnabled = CONFIG.captcha.rawOcrEnabled === true;
    var ocrFirst = null;
    var preprocessedFirst = null;
    if (CONFIG.captcha.preferOcr) {
        if (rawOcrEnabled) {
            ocrFirst = recognizeCaptchaByOcr(img, region, "prefer_ocr");
            if (ocrFirst.ok) return ocrFirst;
            if (CONFIG.captcha.usePreprocessedOcr) {
                preprocessedFirst = recognizeCaptchaByPreprocessedOcr(img, region, "prefer_ocr_failed raw=" + ocrFirst.raw);
                if (preprocessedFirst.ok) return preprocessedFirst;
                logx("验证码预处理 OCR 失败，切换模板识别 reason=" + preprocessedFirst.reason);
            }
            logx("验证码 OCR 主路径失败，切换模板识别 reason=" + ocrFirst.reason);
        } else if (CONFIG.captcha.usePreprocessedOcr) {
            preprocessedFirst = recognizeCaptchaByPreprocessedOcr(img, region, "preprocessed_first");
            if (preprocessedFirst.ok) return preprocessedFirst;
            logx("验证码预处理 OCR 失败，切换模板识别 reason=" + preprocessedFirst.reason);
        } else {
            logx("验证码原图 OCR 已关闭且预处理 OCR 未开启，切换模板识别");
        }
    }

    var templates;
    var templateStart = Date.now();
    try {
        templates = buildCaptchaTemplates();
    } catch (e) {
        if (runtime.captchaStats) {
            runtime.captchaStats.templateBuild = Date.now() - templateStart;
        }
        if (rawOcrEnabled) {
            logx("验证码模板构建异常，尝试 OCR 兜底 err=" + e);
            return recognizeCaptchaByOcr(img, region, "template_exception=" + e);
        }
        var priorRaw = (preprocessedFirst && preprocessedFirst.raw) || (ocrFirst && ocrFirst.raw) || "";
        logx("验证码模板构建异常，原图 OCR 已关闭，保留前序 OCR 结果 err=" + e + " raw=" + priorRaw);
        return { ok: false, reason: "template_exception raw_ocr_disabled err=" + e, raw: priorRaw };
    }

    var glyphStart = Date.now();
    var glyphs = findCaptchaGlyphs(img, region);
    if (runtime.captchaStats) {
        runtime.captchaStats.glyphScan = Date.now() - glyphStart;
    }
    logx("验证码候选字符数量=" + glyphs.length + " region=" + JSON.stringify(region));
    if (glyphs.length < 3) {
        if (rawOcrEnabled) {
            var ocrByCount = recognizeCaptchaByOcr(img, region, "glyph_count=" + glyphs.length);
            if (ocrByCount.ok) return ocrByCount;
            return { ok: false, reason: "glyph_count=" + glyphs.length + " ocr=" + ocrByCount.reason, raw: ocrByCount.raw || "" };
        }
        return { ok: false, reason: "glyph_count=" + glyphs.length + " raw_ocr_disabled", raw: "" };
    }

    var chars = [];
    var detail = [];
    var scores = [];
    var classifyStart = Date.now();
    for (var i = 0; i < glyphs.length; i++) {
        var item = classifyCaptchaGlyph(img, region, glyphs[i], templates);
        chars.push(item.text);
        scores.push(item.score);
        detail.push(item.text + ":" + item.score.toFixed(2));
    }
    if (runtime.captchaStats) {
        runtime.captchaStats.templateClassify = Date.now() - classifyStart;
    }

    var raw = chars.join("");
    var parsed = evaluateCaptchaExpression(raw);
    if (!parsed) {
        if (rawOcrEnabled) {
            var ocrByParse = recognizeCaptchaByOcr(img, region, "parse_failed raw=" + raw);
            if (ocrByParse.ok) return ocrByParse;
            return { ok: false, reason: "parse_failed detail=" + detail.join(",") + " ocr=" + ocrByParse.reason, raw: raw };
        }
        return { ok: false, reason: "parse_failed detail=" + detail.join(",") + " raw_ocr_disabled", raw: raw };
    }
    for (var j = 0; j < parsed.expression.length; j++) {
        if (scores[j] < CONFIG.captcha.minGlyphScore) {
            if (rawOcrEnabled) {
                var ocrByScore = recognizeCaptchaByOcr(img, region, "low_score raw=" + raw);
                if (ocrByScore.ok) return ocrByScore;
                return { ok: false, reason: "low_score detail=" + detail.join(",") + " ocr=" + ocrByScore.reason, raw: raw };
            }
            return { ok: false, reason: "low_score detail=" + detail.join(",") + " raw_ocr_disabled", raw: raw };
        }
    }
    return {
        ok: true,
        raw: raw,
        expression: parsed.expression,
        answer: parsed.answer,
        detail: detail.join(",")
    };
}

function recognizeCaptchaByOcr(img, region, reason) {
    var clip = null;
    var start = Date.now();
    try {
        clip = images.clip(img, region.x, region.y, region.w, region.h);
        var result = gmlkit.ocr(clip, "zh");
        var arr = result.toArray(3);
        var texts = [];
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] && arr[i].text) texts.push(String(arr[i].text));
        }
        var raw = texts.join("");
        var parsed = evaluateCaptchaExpression(raw);
        var cost = Date.now() - start;
        if (runtime.captchaStats) {
            runtime.captchaStats.ocrRaw = cost;
            runtime.captchaStats.raw = raw;
        }
        logx("验证码 OCR 兜底 reason=" + reason + " cost=" + cost + "ms raw=" + raw +
            " normalized=" + normalizeCaptchaOcrText(raw) +
            " rules=" + (parsed ? parsed.ruleText : "parse_failed"));
        if (!parsed) {
            return { ok: false, reason: "ocr_parse_failed reason=" + reason + " raw=" + raw, raw: raw };
        }
        if (parsed.ruleText !== "direct_parse") {
            logx("验证码 OCR 规则处理 source=raw_ocr rules=" + parsed.ruleText + " raw=" + raw +
                " normalized=" + parsed.normalized + " expression=" + parsed.expression + " answer=" + parsed.answer);
        }
        var suspicious = getSuspiciousCaptchaOcrReason(raw, parsed);
        if (suspicious) {
            if (shouldAcceptSuspiciousCaptchaOcr(suspicious, parsed)) {
                logx("OCR suspicious accepted reason=" + reason + " suspicious=" + suspicious +
                    " expression=" + parsed.expression + " answer=" + parsed.answer +
                    " rules=" + parsed.ruleText);
            } else {
                logx("验证码 OCR 结果可疑，拒绝直接提交 reason=" + reason + " suspicious=" + suspicious +
                    " expression=" + parsed.expression + " answer=" + parsed.answer);
                return { ok: false, reason: "ocr_suspicious reason=" + reason + " suspicious=" + suspicious + " raw=" + raw, raw: raw };
            }
        }
        return {
            ok: true,
            raw: raw,
            expression: parsed.expression,
            answer: parsed.answer,
            detail: "ocr_fallback rules=" + parsed.ruleText
        };
    } catch (e) {
        logx("验证码 OCR 兜底异常 reason=" + reason + " err=" + e);
        return { ok: false, reason: "ocr_exception reason=" + reason + " err=" + e, raw: "" };
    } finally {
        if (clip) {
            try { clip.recycle(); } catch (ignored) {}
        }
    }
}

function recognizeCaptchaByPreprocessedOcr(img, region, reason) {
    var clip = null;
    var processed = null;
    var start = Date.now();
    try {
        clip = images.clip(img, region.x, region.y, region.w, region.h);
        processed = preprocessCaptchaClipForOcr(clip);
        if (!processed) {
            return { ok: false, reason: "preprocess_failed reason=" + reason, raw: "" };
        }
        var result = gmlkit.ocr(processed, "zh");
        var arr = result.toArray(3);
        var texts = [];
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] && arr[i].text) texts.push(String(arr[i].text));
        }
        var raw = texts.join("");
        var parsed = evaluateCaptchaExpression(raw);
        var cost = Date.now() - start;
        if (runtime.captchaStats) {
            runtime.captchaStats.ocrPreprocessed = cost;
            runtime.captchaStats.raw = raw;
        }
        logx("验证码预处理 OCR reason=" + reason + " cost=" + cost + "ms raw=" + raw +
            " normalized=" + normalizeCaptchaOcrText(raw) +
            " rules=" + (parsed ? parsed.ruleText : "parse_failed"));
        if (!parsed) {
            return { ok: false, reason: "preprocessed_ocr_parse_failed reason=" + reason + " raw=" + raw, raw: raw };
        }
        if (parsed.ruleText !== "direct_parse") {
            logx("验证码预处理 OCR 规则处理 source=preprocessed_ocr rules=" + parsed.ruleText + " raw=" + raw +
                " normalized=" + parsed.normalized + " expression=" + parsed.expression + " answer=" + parsed.answer);
        }
        var suspicious = getSuspiciousCaptchaOcrReason(raw, parsed);
        if (suspicious) {
            if (shouldAcceptSuspiciousCaptchaOcr(suspicious, parsed)) {
                logx("Preprocessed OCR suspicious accepted reason=" + reason + " suspicious=" + suspicious +
                    " expression=" + parsed.expression + " answer=" + parsed.answer +
                    " rules=" + parsed.ruleText);
            } else {
                logx("验证码预处理 OCR 结果可疑，拒绝直接提交 reason=" + reason + " suspicious=" + suspicious +
                    " expression=" + parsed.expression + " answer=" + parsed.answer);
                return { ok: false, reason: "preprocessed_ocr_suspicious reason=" + reason + " suspicious=" + suspicious + " raw=" + raw, raw: raw };
            }
        }
        return {
            ok: true,
            raw: raw,
            expression: parsed.expression,
            answer: parsed.answer,
            detail: "preprocessed_ocr rules=" + parsed.ruleText
        };
    } catch (e) {
        logx("验证码预处理 OCR 异常 reason=" + reason + " err=" + e);
        return { ok: false, reason: "preprocessed_ocr_exception reason=" + reason + " err=" + e, raw: "" };
    } finally {
        if (processed) {
            try { processed.recycle(); } catch (ignoredProcessed) {}
        }
        if (clip) {
            try { clip.recycle(); } catch (ignoredClip) {}
        }
    }
}

function sendCaptchaAnswerToInputMethod(answer) {
    var cfg = CONFIG.captcha.inputMethod || {};
    if (!cfg.enabled) {
        return { ok: false, skipped: true, reason: "captcha_ime_disabled" };
    }
    try {
        var action = String(cfg.action || "org.openautojs.autojs.action.CAPTCHA_IME_SET_ANSWER");
        var targetPackage = String(cfg.packageName || context.getPackageName());
        var intent = new android.content.Intent(action);
        if (targetPackage) {
            intent.setPackage(targetPackage);
        }
        intent.putExtra(String(cfg.extraAnswer || "answer"), String(answer));
        context.sendBroadcast(intent);
        logx("Captcha IME answer broadcast sent answer=" + answer +
            " package=" + targetPackage + " action=" + action);
        if (cfg.afterBroadcastMs > 0) {
            sleep(cfg.afterBroadcastMs);
        }
        return { ok: true };
    } catch (e) {
        logx("Captcha IME answer broadcast failed err=" + e);
        return { ok: false, reason: "captcha_ime_broadcast_failed err=" + e };
    }
}

function shouldSkipFinalSubmit() {
    return CONFIG.captcha && CONFIG.captcha.skipFinalSubmit === true;
}

function notifyFinalSubmitSkipped(type, detail) {
    logx("验证码流程已完成，按配置跳过最后点击确定 type=" + type +
        (detail ? " detail=" + detail : ""));
    try {
        toastLog("验证码已完成，已跳过最后点击确定");
    } catch (ignored) {}
}

function finishCaptchaInput(answer, submitPoint, detail) {
    logx("验证码答案已填充 answer=" + answer +
        " autoSubmit=" + CONFIG.captcha.autoSubmitAfterInput + " detail=" + detail);
    sleep(CONFIG.captcha.afterInputMs);
    if (!CONFIG.captcha.autoSubmitAfterInput) {
        return { ok: true, submitted: false, detail: detail };
    }
    try {
        back();
        sleep(CONFIG.captcha.afterKeyboardBackMs);
    } catch (ignored) {}
    if (shouldSkipFinalSubmit()) {
        notifyFinalSubmitSkipped("math", detail);
        return { ok: true, submitted: false, finalSubmitSkipped: true, detail: detail };
    }
    logx("验证码答案填充后点击确定 x=" + submitPoint.x + " y=" + submitPoint.y);
    pressPoint("验证码确定", submitPoint);
    return { ok: true, submitted: true, detail: detail };
}

function mathInputPoint() {
    var math = activeMathProfile();
    return math
        ? pointFromRegionCenter("mathInput", math.inputRegion)
        : basePoint("captchaInput", CONFIG.captcha.inputPoint.x, CONFIG.captcha.inputPoint.y);
}

function mathSubmitPoint() {
    var math = activeMathProfile();
    return math
        ? pointFromRegionCenter("mathSubmit", math.submitRegion)
        : basePoint("captchaSubmit", CONFIG.captcha.submitPoint.x, CONFIG.captcha.submitPoint.y);
}

function clearMathCaptchaInputPrefocus() {
    runtime.captchaMathInputPrefocused = false;
    runtime.captchaMathInputFocusedAt = 0;
}

function isMathInputPrefocusEnabled() {
    var imeCfg = CONFIG.captcha.inputMethod || {};
    return CONFIG.captcha.prefocusInputBeforeMathOcr === true && imeCfg.enabled === true;
}

function prefocusMathCaptchaInput(reason) {
    if (!isMathInputPrefocusEnabled()) return false;
    var start = Date.now();
    try {
        var inputPoint = mathInputPoint();
        pressPoint("验证码输入框预聚焦", inputPoint);
        runtime.captchaMathInputPrefocused = true;
        runtime.captchaMathInputFocusedAt = Date.now();
        var cost = runtime.captchaMathInputFocusedAt - start;
        if (runtime.captchaStats) {
            runtime.captchaStats.prefocus = cost;
        }
        logx("数学验证码输入框已预聚焦 reason=" + reason +
            " x=" + inputPoint.x + " y=" + inputPoint.y + " cost=" + cost + "ms");
        return true;
    } catch (e) {
        clearMathCaptchaInputPrefocus();
        logx("数学验证码输入框预聚焦失败 reason=" + reason + " err=" + e);
        return false;
    }
}

function inputCaptchaAnswer(answer) {
    var submitPoint = mathSubmitPoint();
    var imeCfg = CONFIG.captcha.inputMethod || {};
    if (runtime.captchaMathInputPrefocused === true) {
        var elapsed = Date.now() - (runtime.captchaMathInputFocusedAt || 0);
        var remain = Math.max(0, (imeCfg.focusWaitMs || 0) - elapsed);
        logx("复用数学验证码输入框预聚焦 elapsed=" + elapsed + "ms remain=" + remain + "ms");
        if (remain > 0) {
            sleep(remain);
        }
    } else {
        var inputPoint = mathInputPoint();
        pressPoint("验证码输入框", inputPoint);
        if (imeCfg.focusWaitMs > 0) {
            sleep(imeCfg.focusWaitMs);
        }
    }
    if (!imeCfg.enabled) {
        clearMathCaptchaInputPrefocus();
        return { ok: false, manualFallback: true, reason: "captcha_ime_disabled" };
    }
    var imeResult = sendCaptchaAnswerToInputMethod(answer);
    sleep(imeCfg.commitWaitMs || CONFIG.captcha.afterInputMs);
    if (!imeResult.ok) {
        clearMathCaptchaInputPrefocus();
        return {
            ok: false,
            manualFallback: true,
            reason: imeResult.reason || "captcha_ime_unavailable"
        };
    }
    var result = finishCaptchaInput(answer, submitPoint, "captcha_ime");
    clearMathCaptchaInputPrefocus();
    return result;
}

function isSliderGrayPixel(color) {
    var r = colorRed(color);
    var g = colorGreen(color);
    var b = colorBlue(color);
    var min = Math.min(r, g, b);
    var max = Math.max(r, g, b);
    var cfg = CONFIG.captcha.slider;
    return min >= cfg.grayMin && max <= cfg.grayMax && (max - min) <= cfg.grayChromaMax;
}

function isSliderTrackPixel(color) {
    var r = colorRed(color);
    var g = colorGreen(color);
    var b = colorBlue(color);
    var min = Math.min(r, g, b);
    var max = Math.max(r, g, b);
    return min >= 205 && max <= 235 && (max - min) <= 12;
}

function isSliderArrowPixel(color) {
    return colorRed(color) <= 55 && colorGreen(color) <= 55 && colorBlue(color) <= 60;
}

function pixelRatioInRegion(img, region, step, predicate, pixelAt) {
    var total = 0;
    var hits = 0;
    pixelAt = pixelAt || makePixelReader(img);
    for (var y = 0; y < region.h; y += step) {
        for (var x = 0; x < region.w; x += step) {
            total++;
            if (predicate(pixelAt(region.x + x, region.y + y))) {
                hits++;
            }
        }
    }
    return {
        ratio: total ? hits / total : 0,
        hits: hits,
        total: total,
        region: region
    };
}

function detectSliderImageSignal(img, region, pixelAt) {
    var cfg = CONFIG.captcha.slider;
    var step = cfg.fastImageScanStep || 14;
    var minColumnHits = cfg.fastImageMinColumnHits || 3;
    var minSide = scaleX((cfg.minSide || 90) * 0.55);
    var maxSide = scaleX((cfg.maxSide || 215) * 1.45);
    var yStart = Math.round(region.h * 0.34);
    var yEnd = Math.round(region.h * 0.9);
    var colCount = [];
    var grayHits = 0;
    var total = 0;
    var x;
    var y;
    var slot;
    for (x = 0; x <= region.w; x += step) {
        colCount[Math.floor(x / step)] = 0;
    }
    for (y = yStart; y < yEnd; y += step) {
        for (x = 0; x < region.w; x += step) {
            total++;
            if (isSliderGrayPixel(pixelAt(region.x + x, region.y + y))) {
                grayHits++;
                colCount[Math.floor(x / step)]++;
            }
        }
    }

    var runs = [];
    var inRun = false;
    var startSlot = 0;
    var quietSlots = 0;
    for (slot = 0; slot <= colCount.length; slot++) {
        var active = slot < colCount.length && colCount[slot] >= minColumnHits;
        if (active && !inRun) {
            inRun = true;
            startSlot = slot;
            quietSlots = 0;
        } else if (!active && inRun) {
            quietSlots++;
            if (quietSlots > 2 || slot === colCount.length) {
                runs.push({ x1: startSlot * step, x2: Math.min(region.w - 1, (slot - quietSlots + 1) * step) });
                inRun = false;
                quietSlots = 0;
            }
        } else if (active) {
            quietSlots = 0;
        }
    }

    var boxes = [];
    for (var i = 0; i < runs.length; i++) {
        var run = runs[i];
        var runW = run.x2 - run.x1 + 1;
        if (runW < minSide || runW > maxSide) continue;
        boxes.push({
            x: region.x + run.x1,
            y: region.y + yStart,
            w: runW,
            h: runW
        });
    }
    var ratio = total ? grayHits / total : 0;
    return {
        ok: boxes.length >= 1 && ratio >= (cfg.imageProbeMinRatio || 0.004),
        ratio: ratio,
        hits: grayHits,
        total: total,
        boxes: boxes,
        runs: runs.length,
        step: step,
        region: region
    };
}

function detectSliderCaptchaByRegions(img, trackRegion, handleRegion, imageSearchRegion) {
    var cfg = CONFIG.captcha.slider;
    var start = Date.now();
    var pixelAt = makePixelReader(img);
    var step = cfg.fastTypeProbeStep || 12;
    var trackStart = Date.now();
    var track = pixelRatioInRegion(img, trackRegion, step, isSliderTrackPixel, pixelAt);
    var trackCost = Date.now() - trackStart;
    var handleStart = Date.now();
    var arrow = pixelRatioInRegion(img, handleRegion, step, isSliderArrowPixel, pixelAt);
    var handleCost = Date.now() - handleStart;
    var trackOk = track.ratio >= cfg.trackMinRatio;
    var arrowOk = arrow.ratio >= cfg.arrowMinRatio;
    var arrowStrongMinRatio = cfg.arrowStrongMinRatio || cfg.arrowMinRatio || 0.08;
    var arrowStrongOk = arrow.ratio >= arrowStrongMinRatio;
    var trackPresenceOk = track.ratio >= (cfg.trackPresenceMinRatio || 0.006) &&
        track.hits >= (cfg.trackPresenceMinHits || 3);
    var handlePresenceOk = arrow.ratio >= (cfg.handlePresenceMinRatio || 0.045) &&
        arrow.hits >= (cfg.handlePresenceMinHits || 4);
    var imageProbe = null;
    var imageCost = 0;
    var shouldScanImage = !!(imageSearchRegion && (trackPresenceOk || handlePresenceOk || arrowStrongOk));
    if (shouldScanImage) {
        var imageStart = Date.now();
        imageProbe = detectSliderImageSignal(img, imageSearchRegion, pixelAt);
        imageCost = Date.now() - imageStart;
    }
    var imageOk = !!(imageProbe && imageProbe.ok);
    var pairedWeakOk = trackPresenceOk && handlePresenceOk &&
        arrow.ratio >= (cfg.handleConfirmMinRatio || 0.065);
    var uiSliderOk = trackPresenceOk && handlePresenceOk;
    var imagePolluted = !!(imageProbe && imageProbe.ratio >= (cfg.pollutedImageMinRatio || 0.35) &&
        imageProbe.boxes.length < 2);
    var typeOk = uiSliderOk || arrowStrongOk || (imageOk && (handlePresenceOk || trackPresenceOk)) || pairedWeakOk;
    return {
        ok: typeOk,
        typeOk: typeOk,
        ratio: track.ratio,
        hits: track.hits,
        total: track.total,
        arrowRatio: arrow.ratio,
        arrowHits: arrow.hits,
        arrowTotal: arrow.total,
        trackOk: trackOk,
        arrowOk: arrowOk,
        arrowStrongOk: arrowStrongOk,
        trackPresenceOk: trackPresenceOk,
        handlePresenceOk: handlePresenceOk,
        uiSliderOk: uiSliderOk,
        imageOk: imageOk,
        imagePolluted: imagePolluted,
        imageRatio: imageProbe ? imageProbe.ratio : 0,
        imageHits: imageProbe ? imageProbe.hits : 0,
        imageTotal: imageProbe ? imageProbe.total : 0,
        imageBoxes: imageProbe ? imageProbe.boxes.length : 0,
        pairedWeakOk: pairedWeakOk,
        step: step,
        imageStep: imageProbe ? imageProbe.step : 0,
        trackCost: trackCost,
        handleCost: handleCost,
        imageCost: imageCost,
        cost: Date.now() - start,
        region: track.region
    };
}

function detectSliderCaptchaByTrack(img) {
    var cfg = CONFIG.captcha.slider;
    var slider = activeSliderProfile();
    if (slider) {
        return detectSliderCaptchaByRegions(
            img,
            normalizeProfileRegion(slider.trackRegion, "profileSliderTrack", true),
            normalizeProfileRegion(slider.handleRegion, "profileSliderHandle", true),
            normalizeProfileRegion(slider.imageSearchRegion, "profileSliderImageSearch", true)
        );
    }
    return detectSliderCaptchaByRegions(
        img,
        scaledRegion(cfg.trackProbeRegion),
        scaledRegion(cfg.arrowProbeRegion),
        scaledRegion(cfg.imageRegion)
    );
}

function recognizeSliderCaptcha(img) {
    var cfg = CONFIG.captcha.slider;
    var slider = activeSliderProfile();
    var region = slider
        ? normalizeProfileRegion(slider.imageSearchRegion, "profileSliderImageSearch", true)
        : scaledRegion(cfg.imageRegion);
    var step = cfg.scanStep || 2;
    var pixelAt = makePixelReader(img);
    var yStart = Math.round(region.h * 0.34);
    var yEnd = Math.round(region.h * 0.9);
    var colCount = [];
    var x;
    var y;
    for (x = 0; x <= region.w; x += step) {
        colCount[Math.floor(x / step)] = 0;
    }

    for (y = yStart; y < yEnd; y += step) {
        for (x = 0; x < region.w; x += step) {
            if (isSliderGrayPixel(pixelAt(region.x + x, region.y + y))) {
                colCount[Math.floor(x / step)]++;
            }
        }
    }

    var runs = [];
    var inRun = false;
    var startSlot = 0;
    var quietSlots = 0;
    for (var slot = 0; slot <= colCount.length; slot++) {
        var active = slot < colCount.length && colCount[slot] >= cfg.minColumnHits;
        if (active && !inRun) {
            inRun = true;
            startSlot = slot;
            quietSlots = 0;
        } else if (!active && inRun) {
            quietSlots++;
            if (quietSlots > 3 || slot === colCount.length) {
                runs.push({ x1: startSlot * step, x2: Math.min(region.w - 1, (slot - quietSlots + 1) * step) });
                inRun = false;
                quietSlots = 0;
            }
        } else if (active) {
            quietSlots = 0;
        }
    }

    var minSide = scaleX(cfg.minSide);
    var maxSide = scaleX(cfg.maxSide);
    var boxes = [];
    for (var i = 0; i < runs.length; i++) {
        var run = runs[i];
        var runW = run.x2 - run.x1 + 1;
        if (runW < minSide || runW > maxSide) continue;
        boxes.push({
            x: region.x + run.x1,
            y: region.y + yStart,
            w: runW,
            h: runW,
            area: runW * runW,
            centerX: region.x + run.x1 + runW / 2,
            centerY: region.y + yStart + runW / 2
        });
    }

    if (boxes.length < 2) {
        return { ok: false, reason: "slider_gray_boxes=" + boxes.length + " runs=" + runs.length, boxes: boxes };
    }
    boxes.sort(function (a, b) { return b.w - a.w; });
    var pair = boxes.slice(0, 2);
    pair.sort(function (a, b) { return a.w - b.w; });
    var target = pair[0];
    return {
        ok: true,
        region: region,
        target: target,
        boxes: pair,
        detail: "small=(" + Math.round(target.centerX) + "," + Math.round(target.centerY) + "," +
            Math.round(target.w) + "x" + Math.round(target.h) + ") large=(" +
            Math.round(pair[1].centerX) + "," + Math.round(pair[1].centerY) + "," +
            Math.round(pair[1].w) + "x" + Math.round(pair[1].h) + ")"
    };
}

function dragSliderCaptcha(sliderResult) {
    var cfg = CONFIG.captcha.slider;
    var slider = activeSliderProfile();
    var start = slider
        ? pointFromRegionCenter("sliderHandleStart", slider.handleRegion)
        : basePoint("sliderHandleStart", cfg.handleStartPoint.x, cfg.handleStartPoint.y);
    var submitPoint = slider
        ? pointFromRegionCenter("sliderCaptchaSubmit", slider.submitRegion)
        : basePoint("sliderCaptchaSubmit", cfg.submitPoint.x, cfg.submitPoint.y);
    var endX = Math.round(sliderResult.target.centerX);
    var endY = start.y;
    logx("滑块验证码拖动 start=(" + start.x + "," + start.y + ") end=(" + endX + "," + endY + ") " + sliderResult.detail);
    try {
        gesture(cfg.dragDuration, [start.x, start.y], [Math.round((start.x + endX) / 2), endY], [endX, endY]);
    } catch (e) {
        logx("滑块验证码 gesture 失败，降级 swipe err=" + e);
        swipe(start.x, start.y, endX, endY, cfg.dragDuration);
    }
    sleep(cfg.afterDragMs);
    if (shouldSkipFinalSubmit()) {
        notifyFinalSubmitSkipped("slider", sliderResult.detail);
        return { ok: true, submitted: false, finalSubmitSkipped: true, detail: sliderResult.detail };
    }
    pressPoint("滑块验证码确定", submitPoint);
    return { ok: true, submitted: true, detail: sliderResult.detail };
}

function solveCaptchaAfterConfirm() {
    var allStart = Date.now();
    var stats = newCaptchaStats();
    runtime.captchaStats = stats;
    clearMathCaptchaInputPrefocus();
    logx("验证码阶段开始，等待弹窗渲染 " + CONFIG.afterConfirmCaptchaWaitMs + "ms");
    sleep(CONFIG.afterConfirmCaptchaWaitMs);
    var waitCost = Date.now() - allStart;
    stats.wait = waitCost;

    var img = null;
    var captureStart = Date.now();
    var captureCost = 0;
    var recognizeStart = 0;
    var recognizeCost = 0;
    var inputStart = 0;
    var inputCost = 0;
    var region = mathExpressionRegion();
    var failureRegion = region;
    try {
        logx("验证码开始截图 region=" + JSON.stringify(region));
        img = captureScreen();
        captureCost = Date.now() - captureStart;
        stats.capture = captureCost;
        logx("验证码截图完成 capture=" + captureCost + "ms");

        recognizeStart = Date.now();
        var trackProbe = detectSliderCaptchaByTrack(img);
        logx("验证码类型探测 sliderTrack ratio=" + trackProbe.ratio.toFixed(3) +
            " hits=" + trackProbe.hits + "/" + trackProbe.total +
            " arrowRatio=" + trackProbe.arrowRatio.toFixed(3) +
            " arrowHits=" + trackProbe.arrowHits + "/" + trackProbe.arrowTotal +
            " trackOk=" + trackProbe.trackOk +
            " arrowOk=" + trackProbe.arrowOk +
            " arrowStrongOk=" + trackProbe.arrowStrongOk +
            " trackPresenceOk=" + trackProbe.trackPresenceOk +
            " handlePresenceOk=" + trackProbe.handlePresenceOk +
            " uiSliderOk=" + trackProbe.uiSliderOk +
            " imageOk=" + trackProbe.imageOk +
            " imagePolluted=" + trackProbe.imagePolluted +
            " imageRatio=" + trackProbe.imageRatio.toFixed(3) +
            " imageBoxes=" + trackProbe.imageBoxes +
            " pairedWeakOk=" + trackProbe.pairedWeakOk +
            " typeOk=" + trackProbe.typeOk +
            " step=" + trackProbe.step +
            " imageStep=" + trackProbe.imageStep +
            " cost=" + trackProbe.cost + "ms" +
            " trackCost=" + trackProbe.trackCost + "ms" +
            " handleCost=" + trackProbe.handleCost + "ms" +
            " imageCost=" + trackProbe.imageCost + "ms" +
            " ok=" + trackProbe.ok);
        if (trackProbe.ok) {
            var sliderResult = recognizeSliderCaptcha(img);
            if (sliderResult.ok) {
                recognizeCost = Date.now() - recognizeStart;
                stats.recognize = recognizeCost;
                stats.captchaType = "slider";
                failureRegion = sliderResult.region;

                inputStart = Date.now();
                dragSliderCaptcha(sliderResult);
                inputCost = Date.now() - inputStart;
                stats.input = inputCost;
                stats.outcome = "success";
                stats.raw = "slider";
                stats.expression = "slider";
                stats.answer = "";
                stats.detail = sliderResult.detail;

                logx("滑块验证码识别成功 " + sliderResult.detail +
                    " wait=" + waitCost + "ms capture=" + captureCost +
                    "ms recognize=" + recognizeCost + "ms input=" + inputCost + "ms total=" + (Date.now() - allStart) + "ms");
                logx("验证码耗时汇总 " + captchaStatsText(stats, Date.now() - allStart));
                return;
            }
            recognizeCost = Date.now() - recognizeStart;
            stats.recognize = recognizeCost;
            stats.captchaType = "slider";
            stats.outcome = "fail";
            stats.raw = "slider";
            stats.expression = "slider";
            stats.reason = "slider_target_not_found: " + sliderResult.reason;
            failureRegion = sliderResult.region || failureRegion;
            saveCaptchaFailure(img, failureRegion, stats.reason);
            logx("滑块验证码类型已命中，但目标定位失败，保留页面给人工兜底 reason=" + sliderResult.reason);
            logx("验证码耗时汇总 " + captchaStatsText(stats, Date.now() - allStart));
            return;
        } else {
            logx("未识别为滑块验证码，进入数学题 OCR");
            prefocusMathCaptchaInput("before_math_ocr");
        }

        var result = recognizeCaptchaExpression(img, region);
        recognizeCost = Date.now() - recognizeStart;
        stats.recognize = recognizeCost;
        stats.captchaType = "math";
        if (!result.ok) {
            saveCaptchaFailure(img, region, result.reason + " raw=" + result.raw);
            stats.outcome = "fail";
            stats.raw = result.raw || stats.raw;
            stats.reason = result.reason;
            logx("验证码耗时汇总 " + captchaStatsText(stats, Date.now() - allStart));
            fail("验证码识别失败：" + result.reason + " raw=" + result.raw);
        }

        inputStart = Date.now();
        var inputResult = inputCaptchaAnswer(result.answer);
        inputCost = Date.now() - inputStart;
        stats.input = inputCost;
        if (inputResult && inputResult.manualFallback) {
            stats.outcome = "fail";
            stats.raw = result.raw;
            stats.expression = result.expression;
            stats.answer = result.answer;
            stats.reason = inputResult.reason;
            logx("验证码输入未完成，保留页面给人工兜底 reason=" + inputResult.reason);
            logx("验证码耗时汇总 " + captchaStatsText(stats, Date.now() - allStart));
            fail("验证码输入未完成：" + inputResult.reason);
        }
        stats.outcome = "success";
        stats.raw = result.raw;
        stats.expression = result.expression;
        stats.answer = result.answer;
        stats.detail = result.detail;

        logx("验证码识别成功 raw=" + result.raw + " expression=" + result.expression + " answer=" + result.answer +
            " detail=" + result.detail + " wait=" + waitCost + "ms capture=" + captureCost +
            "ms recognize=" + recognizeCost + "ms input=" + inputCost + "ms total=" + (Date.now() - allStart) + "ms");
        logx("验证码耗时汇总 " + captchaStatsText(stats, Date.now() - allStart));
    } catch (e) {
        stats.outcome = stats.outcome === "fail" ? stats.outcome : "exception";
        stats.reason = stats.reason || String(e);
        logx("验证码阶段异常 err=" + e + " stack=" + (e && e.stack ? e.stack : ""));
        if (img) {
            saveCaptchaFailure(img, failureRegion, "exception=" + e);
        }
        logx("验证码耗时汇总 " + captchaStatsText(stats, Date.now() - allStart));
        throw e;
    } finally {
        clearMathCaptchaInputPrefocus();
        runtime.captchaStats = null;
        if (img) {
            try { img.recycle(); } catch (ignoredRecycle) {}
        }
    }
}

function runMockRushFlow() {
    var flowStart = Date.now();
    var stats = [];

    timedStep(stats, "点击普通预约入口并等待", function () {
        pressPoint("普通预约入口", cachedPoint("normalBooking", basePoint("normalBooking", 720, 1180)));
        sleep(CONFIG.afterNormalBookingMs);
    });

    timedStep(stats, "点击目标日期并等待", function () {
        pressPoint("目标日期", cachedPoint("targetDate", null));
        sleep(CONFIG.afterPressMs);
    });

    timedStep(stats, "点击选择时段并等待", function () {
        var periodKey = getPeriodCacheKey();
        pressPoint("选择时段", cachedPoint(periodKey, basePoint(periodKey, periodKey === "periodMorning" ? 400 : 1045, 2095)));
        sleep(CONFIG.afterPressMs);
    });

    timedStep(stats, "gesture滑动到观众信息并等待", function () {
        gestureToVisitors();
    });

    timedStep(stats, "勾选观众", function () {
        var visitors = getVisitorPoints();
        for (var i = 0; i < CONFIG.visitorCount; i++) {
            pressPoint("观众 " + (i + 1), visitors[i], CONFIG.visitorPressDuration);
            sleep(CONFIG.visitorIntervalMs);
        }
    });

    timedStep(stats, "点击确认预约", function () {
        pressPoint("确认预约", cachedPoint("confirmBooking", basePoint("confirmBooking", 720, 2800)));
    });

    timedStep(stats, "识别验证码并提交答案", function () {
        solveCaptchaAfterConfirm();
    });

    var totalCost = Date.now() - flowStart;
    var summary = [];
    for (var j = 0; j < stats.length; j++) {
        summary.push(stats[j].name + "=" + stats[j].cost + "ms");
    }
    logx("Mock 第二轮流程已执行完，总耗时=" + totalCost + "ms，分阶段=" + summary.join(" | "));
    logx("请观察 HTML 页面点击反馈");
}

function main() {
    try {
        auto.waitFor();
        initLog();
        initScreenCapture();
        loadCache();
        loadCaptchaProfile();
        launchMockApp();
        clickStartButton();
        runMockRushFlow();
    } catch (e) {
        logx("脚本异常退出：" + e + " stack=" + (e && e.stack ? e.stack : ""));
        throw e;
    }
}

main();
