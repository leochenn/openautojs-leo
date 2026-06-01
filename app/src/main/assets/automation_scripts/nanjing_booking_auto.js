/*
 * OpenAutoJS 微信小程序自动预约脚本
 *
 * 运行环境：Android OpenAutoJS / Auto.js，需开启无障碍服务和截图权限。
 * 缓存策略：优先实时采集，其次复用同尺寸缓存，异常时才使用 1440x3040 截图比例降级。
 */

// ==================== 配置区 ====================
var CONFIG = {
    appShortcutName: "侵华日军南京大屠杀遇难同胞纪念馆参观预约", // 桌面快捷方式名称；第一轮启动小程序时用于无障碍查找图标
    exhibitMode: "nanjing", // 可选："nanjing"、"justice"；旧配置缺失时默认南京展馆
    bookingType: "normal", // 可选："normal"、"parent"；parent 表示亲子预约
    visitDate: "0521", // MMDD，例如 0505；日期网格按当前周周日到下周六两行显示
    period: "上午", // 可选："上午"、"下午"
    visitorCount: 2, // 普通预约为总人数 1-5；亲子预约为成年人人数 1-4
    minorVisitorCount: 1, // 亲子预约未成年人个数，至少 1，成人+未成年人最多 5
    startTime: "8:00:00.5", // 第二轮正式抢票触发时间；支持 HH:mm:ss 或 HH:mm:ss.SSS，已过该时间时会在第一轮后立即执行第二轮
    prepareOnly: false, // true 时只执行第一轮，不等待 startTime，也不执行第二轮
    useCache: true, // 是否读取已有坐标缓存；第一轮关键采集项仍会由 preferRealtimeInPrepare 控制而优先实时刷新
    preferRealtimeInPrepare: true, // 第一轮对关键采集项优先实时识别，避免低可信缓存污染
    outputDir: "/sdcard/OpenAutoJS_NanjingBooking", // 主输出目录；保存日志、缓存、诊断截图
    cachePath: "/sdcard/OpenAutoJS_NanjingBooking/nanjing_booking_cache.json", // 主缓存路径；第一轮采集后写入，第二轮和 Mock 测试读取
    backupCachePath: "/sdcard/nanjing_booking_cache.json", // 备用缓存路径；主缓存读取/写入失败时兜底
    logPath: "/sdcard/OpenAutoJS_NanjingBooking/nanjing_booking_run_latest.log", // latest 日志路径；每次启动会清理后重新写入
    backupLogPath: "/sdcard/nanjing_booking_run.log", // 备用日志路径；主日志写入失败时兜底
    version: "2026-04-29.v1", // 缓存版本标记；写入缓存用于复盘，不直接控制流程
    baseScreen: { width: 1440, height: 3040 }, // 坐标缩放基准屏幕；截图比例兜底和 scaleX/scaleY 都按它换算
    pressDuration: 20, // 常规点击按压时长；用于第一轮采集、登录、弹窗等非极速链路
    fastPressDuration: 10, // 第二轮普通预约、日期、时段、确认按钮的快速点击按压时长；越小越快但过低可能丢点击
    visitorPressDuration: 50, // 第二轮勾选游客的专用按压时长；游客列表在滚动容器内，单独加长以提高点击生效率
    parentAdultPressDuration: 120, // 亲子成年人区独立按压时长，不影响普通预约
    parentAdultAfterScrollMs: 1000, // 亲子成年人区拖顶后的稳定等待，不影响普通预约
    parentMinorPressDuration: 120, // 亲子未成年人区在第二次大幅滚动后更容易吞短点击，单独加长按压时长
    parentMinorAfterScrollMs: 1000, // 亲子未成年人区滚动后的稳定等待；只影响需要第二次拖动的场景
    afterAudienceScrollMs: 700, // 第二轮滑动到观众信息后的等待时间；等 WebView/小程序滚动停稳后再点游客，这个值会影响滑动后的点击
    visitorIntervalMs: 80, // 第二轮连续勾选多个游客之间的间隔；避免游客卡片状态更新时吞掉后续点击
    afterConfirmCaptchaWaitMs: 800, // 第二轮点击确认预约后等待验证码弹窗渲染的时间；与 Mock 测试脚本保持一致
    noticePressDuration: 20, // 预约须知、登录协议等提示弹窗按钮的点击按压时长
    pageWaitInterval: 250, // OCR 等待循环的轮询间隔；页面识别未命中时每隔该时间重试
    finalToastHoldMs: 2200, // 脚本结束最后 toast 的保留等待时间；仅影响结束提示，不影响抢票链路
    preRushLoginProbeLeadMs: 20000, // 第一轮结束后若时间充足，在抢票前 20 秒探测并提前处理可能出现的登录
    diagnostics: {
        saveScreenshots: true,       // 只在抢票结束后或异常时截图，不插入抢票点击链路
        ocrAfterRush: true,          // 点击确认预约后做一次全局 OCR 摘要，便于复盘结果
        ocrOnError: true             // 异常退出时做一次全局 OCR 摘要，便于定位现场
    },
    captcha: {
        enabled: true,
        moduleFileName: "nanjing_booking_captcha_solver.js",
        preloadMinLeadMs: 3000,
        saveSceneBeforeSolve: false, // true 时在验证码识别/处理前保存一张现场全屏截图；默认关闭，避免影响正式抢票链路
        expressionRegion: { x: 455, y: 1160, w: 570, h: 200 },
        expressionRegions: [
            { name: "mockLargeText", x: 455, y: 1160, w: 570, h: 200, templateEnabled: true },
            { name: "wechatImageWide", x: 250, y: 820, w: 940, h: 300, templateEnabled: false },
            { name: "wechatImageStrip", x: 295, y: 860, w: 850, h: 150, templateEnabled: false }
        ],
        emptyOcrRetryWaitMs: 700,
        prefocusInputBeforeMathOcr: true,
        inputPoint: { x: 720, y: 1908 },
        // 自定义数字输入法通道：抢票前需要启用并切换到 OpenAutoJS 内置的验证码数字输入法。
        // 流程：点击验证码输入框 -> 等待 focusWaitMs -> 广播答案给 IME -> 等待 IME commit 回执；无回执时用 commitWaitMs 兜底。
        inputMethod: {
            enabled: true, // true 使用自定义 IME；false 则跳过 IME，进入人工兜底
            packageName: "", // 留空时使用当前 OpenAutoJS 包名；不要填 Mock App 或微信包名
            action: "org.openautojs.autojs.action.CAPTCHA_IME_SET_ANSWER", // OpenAutoJS 验证码输入法接收答案的广播 action
            extraAnswer: "answer", // 广播中携带验证码答案的 extra key
            extraRequestId: "requestId", // 广播中携带本次验证码输入请求 id，用于等待 IME commit 回执
            focusWaitMs: 200, // 点击验证码输入框后等待焦点/输入连接建立；偶发不输入可调到 400-600
            afterBroadcastMs: 50, // 发送广播后给 receiver 一个极短处理窗口，一般无需调整
            commitAckTimeoutMs: 500, // 等待 IME commitText 回执的最长时间；收到回执会立即继续
            commitAckPollMs: 20, // 轮询 IME commit 回执的间隔
            commitWaitMs: 50, // 等待 IME commitText 完成；已验证 350ms 可完成，正式偶发不输入可调到 800-1200
        },
        submitPoint: { x: 720, y: 2216 },
        autoSubmitAfterInput: true,
        skipFinalSubmit: true, // true 时只完成验证码输入/滑块拖动，不点击弹窗最后的“确定”，用于正式前观察验证
        autoSolveSliderCaptcha: true, // false 时数学验证码仍自动处理；一旦判定为滑块验证码则保留现场并震动提醒人工拖动
        afterInputMs: 300, // IME 输入完成后、收起键盘前的缓冲；正式抢票建议 150-300，肉眼观察可临时调大
        afterKeyboardBackMs: 50, // back 收起键盘后的缓冲；若确定按钮被键盘遮挡或点击过早，可调到 400-600
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
            dragDuration: 350,
            afterDragMs: 150,
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

var EXHIBIT_PROFILES = {
    nanjing: {
        id: "nanjing",
        shortName: "南京",
        fullTitle: "南京大屠杀史实展",
        homeCardIndex: 0,
        homeCardRegion: { y: 760, h: 760 },
        homeButtonFallback: { x: 310, y: 1320 },
        homeTitleKeywords: ["南京大屠杀"],
        homeTitleButtonOffsetY: 260,
        dateGridYs: [980, 1210],
        fallbackPeriodTitleY: 1850,
        fallbackPeriodMorning: { x: 400, y: 2095 },
        fallbackPeriodAfternoon: { x: 1045, y: 2095 },
        fallbackVisitorStartY: 2050,
        fallbackEstimatedAudienceTitleY: 2350,
        cachePath: "/sdcard/OpenAutoJS_NanjingBooking/nanjing_booking_cache.json",
        backupCachePath: "/sdcard/nanjing_booking_cache.json",
        parentCachePath: "/sdcard/OpenAutoJS_NanjingBooking/nanjing_booking_parent_cache.json",
        parentBackupCachePath: "/sdcard/nanjing_booking_parent_cache.json"
    },
    justice: {
        id: "justice",
        shortName: "正义必胜",
        fullTitle: "正义必胜 和平必胜 人民必胜--中国战区反法西斯战争胜利暨审判日本战犯史实展",
        homeCardIndex: 1,
        homeCardRegion: { y: 1510, h: 700 },
        homeButtonFallback: { x: 1150, y: 1935 },
        homeTitleKeywords: ["正义必胜", "和平必胜", "人民必胜", "反法西斯", "审判日本战犯"],
        homeTitleButtonOffsetY: 120,
        dateGridYs: [1080, 1310],
        fallbackPeriodTitleY: 1950,
        fallbackPeriodMorning: { x: 400, y: 2195 },
        fallbackPeriodAfternoon: { x: 1045, y: 2195 },
        fallbackVisitorStartY: 2150,
        fallbackEstimatedAudienceTitleY: 2450,
        cachePath: "/sdcard/OpenAutoJS_NanjingBooking/nanjing_booking_justice_cache.json",
        backupCachePath: "/sdcard/nanjing_booking_justice_cache.json",
        parentCachePath: "/sdcard/OpenAutoJS_NanjingBooking/nanjing_booking_justice_parent_cache.json",
        parentBackupCachePath: "/sdcard/nanjing_booking_justice_parent_cache.json"
    }
};

function isParentBookingMode() {
    return CONFIG.bookingType === "parent";
}

function currentBookingTypeName() {
    return isParentBookingMode() ? "亲子预约" : "普通预约";
}

function currentBookingCacheType() {
    return isParentBookingMode() ? "parent" : "normal";
}

function currentExhibitProfile() {
    return EXHIBIT_PROFILES[CONFIG.exhibitMode] || EXHIBIT_PROFILES.nanjing;
}

function applyCurrentExhibitProfile() {
    var profile = currentExhibitProfile();
    CONFIG.currentExhibit = {
        id: profile.id,
        shortName: profile.shortName,
        fullTitle: profile.fullTitle,
        homeCardIndex: profile.homeCardIndex
    };
    if (isParentBookingMode()) {
        CONFIG.cachePath = profile.parentCachePath;
        CONFIG.backupCachePath = profile.parentBackupCachePath;
    } else {
        CONFIG.cachePath = profile.cachePath;
        CONFIG.backupCachePath = profile.backupCachePath;
    }
}

function bookingConfigScriptDir() {
    try {
        var source = engines.myEngine().source;
        var path = String(source || "");
        if (path.indexOf("file://") === 0) path = path.substring(7);
        var sep = path.lastIndexOf("/");
        if (sep >= 0) return path.substring(0, sep);
    } catch (e) {}
    try {
        return files.cwd();
    } catch (ignored) {}
    return "";
}

function bookingConfigPath() {
    var dir = bookingConfigScriptDir();
    if (!dir) return "nanjing_booking_config.json";
    return dir + (dir.charAt(dir.length - 1) === "/" ? "" : "/") + "nanjing_booking_config.json";
}

function parseExternalBoolean(value, fallback) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
        var normalized = value.toLowerCase().trim();
        if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
        if (normalized === "false" || normalized === "0" || normalized === "no") return false;
    }
    return fallback;
}

function applyExternalBookingConfig() {
    try {
        var path = bookingConfigPath();
        if (!files.exists(path)) return;
        var external = JSON.parse(files.read(path));
        if (!external) return;
        if (external.exhibitMode !== undefined) CONFIG.exhibitMode = String(external.exhibitMode);
        if (external.bookingType !== undefined) CONFIG.bookingType = String(external.bookingType);
        if (external.visitDate !== undefined) CONFIG.visitDate = String(external.visitDate);
        if (external.period !== undefined) CONFIG.period = String(external.period);
        if (external.visitorCount !== undefined) {
            var count = parseInt(external.visitorCount, 10);
            if (!isNaN(count)) CONFIG.visitorCount = count;
        }
        if (external.minorVisitorCount !== undefined) {
            var minorCount = parseInt(external.minorVisitorCount, 10);
            if (!isNaN(minorCount)) CONFIG.minorVisitorCount = minorCount;
        }
        if (external.startTime !== undefined) CONFIG.startTime = String(external.startTime);
        if (external.skipFinalSubmit !== undefined && CONFIG.captcha) {
            CONFIG.captcha.skipFinalSubmit = parseExternalBoolean(external.skipFinalSubmit, CONFIG.captcha.skipFinalSubmit);
        }
        if (external.autoSolveSliderCaptcha !== undefined && CONFIG.captcha) {
            CONFIG.captcha.autoSolveSliderCaptcha = parseExternalBoolean(external.autoSolveSliderCaptcha, CONFIG.captcha.autoSolveSliderCaptcha);
        }
    } catch (ignored) {}
}

applyExternalBookingConfig();
applyCurrentExhibitProfile();

var STAGE = "INIT";
var runtime = {
    cache: {},
    cachePath: CONFIG.cachePath,
    logPath: CONFIG.logPath,
    latestLogPath: CONFIG.logPath,
    lastPage: "",
    screen: { width: 0, height: 0 },
    ocrEnabled: true,
    freshPoints: {},
    freshVisitorPoints: false,
    captchaTemplates: null,
    captchaStats: null,
    captchaSolver: null,
    logBuffer: [],
    useBufferedLog: false
};

// ==================== 日志模块 ====================
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

function writeLogLine(line) {
    if (runtime.useBufferedLog) {
        runtime.logBuffer.push(line);
        return;
    }
    writeLogLineToFile(line);
}

function writeLogLineToFile(line) {
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

function flushLogBuffer() {
    if (runtime.logBuffer.length === 0) return;
    var lines = runtime.logBuffer.slice();
    var content = lines.join("\n") + "\n";
    var written = false;
    try {
        files.append(runtime.logPath, content);
        if (runtime.latestLogPath && runtime.latestLogPath !== runtime.logPath) {
            files.append(runtime.latestLogPath, content);
        }
        written = true;
    } catch (e) {
        if (runtime.logPath !== CONFIG.backupLogPath) {
            runtime.logPath = CONFIG.backupLogPath;
            try {
                files.append(runtime.logPath, content);
                written = true;
            } catch (ignored) {}
        }
    }
    if (written) {
        runtime.logBuffer = [];
        runtime.useBufferedLog = false;
    }
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

function logx(type, msg) {
    var line = "[" + nowText() + "][" + STAGE + "][" + type + "] " + msg;
    log(line);
    writeLogLine(line);
}

function notifyUser(msg, holdMs) {
    logx("TOAST", msg);
    try {
        toast(msg);
    } catch (e) {
        logx("TOAST", "toast 失败 err=" + e);
    }
    if (holdMs && holdMs > 0) {
        sleep(holdMs);
    }
}

function finalNotifyUser(msg) {
    logx("TOAST", msg);
    try {
        toastLog(msg);
    } catch (e) {
        try {
            toast(msg);
        } catch (ignoredToast) {}
        logx("TOAST", "toastLog 失败 err=" + e);
    }
    sleep(CONFIG.finalToastHoldMs);
}

function vibrateManualFallback(reason) {
    logx("ALERT", "人工兜底震动提醒 reason=" + (reason || ""));
    try { device.vibrate(500); } catch (ignored) {}
}

function diagnosticPath(name, ext) {
    return CONFIG.outputDir + "/" + name + "_" + fileTimeText() + "." + ext;
}

function captureDiagnostics(name, includeOcr) {
    var img = null;
    var start = Date.now();
    try {
        img = captureScreen();
        if (CONFIG.diagnostics && CONFIG.diagnostics.saveScreenshots) {
            var imagePath = diagnosticPath(name, "png");
            images.save(img, imagePath);
            logx("DIAG", name + " 截图已保存 path=" + imagePath);
        }
        if (includeOcr) {
            var ocrStart = Date.now();
            var result = gmlkit.ocr(img, "zh");
            var arr = result.toArray(3);
            var texts = [];
            for (var i = 0; i < arr.length; i++) {
                if (arr[i] && arr[i].text) texts.push(String(arr[i].text));
            }
            var summary = texts.slice(0, 30).join("|");
            if (summary.length > 500) summary = summary.substring(0, 500) + "...";
            logx("DIAG", name + " OCR cost=" + (Date.now() - ocrStart) + "ms count=" + texts.length + " result=" + summary);
        }
        logx("DIAG", name + " 完成 cost=" + (Date.now() - start) + "ms");
    } catch (e) {
        logx("DIAG", name + " 失败 err=" + e + " cost=" + (Date.now() - start) + "ms");
    } finally {
        if (img) {
            try { img.recycle(); } catch (ignored) {}
        }
    }
}

function fail(msg) {
    notifyUser("脚本异常：" + msg + "，请查看日志");
    logx("ERROR", msg);
    throw new Error(msg);
}

function pointText(p) {
    if (!p) return "null";
    return "x=" + Math.round(p.x) + " y=" + Math.round(p.y) + (p.source ? " source=" + p.source : "");
}

function regionText(r) {
    if (!r) return "full";
    return "{x:" + Math.round(r[0]) + ",y:" + Math.round(r[1]) + ",w:" + Math.round(r[2]) + ",h:" + Math.round(r[3]) + "}";
}

// ==================== 基础工具 ====================
function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function scaleX(x) {
    return Math.round(x * device.width / CONFIG.baseScreen.width);
}

function scaleY(y) {
    return Math.round(y * device.height / CONFIG.baseScreen.height);
}

function scaledPoint(name, x, y) {
    var p = { x: scaleX(x), y: scaleY(y), source: "screenshot-ratio:" + name };
    logx("COORD", name + " 使用截图比例降级 " + pointText(p));
    return p;
}

function makePoint(x, y, source) {
    return {
        x: Math.round(clamp(x, 1, device.width - 1)),
        y: Math.round(clamp(y, 1, device.height - 1)),
        source: source || "unknown"
    };
}

function centerOfBounds(bounds, source) {
    return makePoint(bounds.centerX(), bounds.centerY(), source);
}

function itemRect(item) {
    return {
        left: item.bounds.left,
        top: item.bounds.top,
        right: item.bounds.right,
        bottom: item.bounds.bottom,
        cx: item.bounds.centerX(),
        cy: item.bounds.centerY(),
        width: item.bounds.width ? item.bounds.width() : (item.bounds.right - item.bounds.left),
        height: item.bounds.height ? item.bounds.height() : (item.bounds.bottom - item.bounds.top)
    };
}

function simpleRectFromItem(item) {
    var r = itemRect(item);
    return {
        left: Math.round(r.left),
        top: Math.round(r.top),
        right: Math.round(r.right),
        bottom: Math.round(r.bottom),
        width: Math.round(r.width),
        height: Math.round(r.height),
        cx: Math.round(r.cx),
        cy: Math.round(r.cy)
    };
}

function safeSleep(ms) {
    if (ms > 0) sleep(ms);
}

function pressPoint(name, p, duration) {
    if (!p) fail("缺少点击坐标：" + name);
    var start = Date.now();
    logx("CLICK", name + " " + pointText(p));
    press(Math.round(p.x), Math.round(p.y), duration || CONFIG.pressDuration);
    logx("CLICK", name + " 完成 cost=" + (Date.now() - start) + "ms");
}

function swipeLogged(name, x1, y1, x2, y2, duration) {
    var start = Date.now();
    logx("SWIPE", name + " from=(" + Math.round(x1) + "," + Math.round(y1) + ") to=(" + Math.round(x2) + "," + Math.round(y2) + ") duration=" + duration);
    swipe(Math.round(x1), Math.round(y1), Math.round(x2), Math.round(y2), duration);
    logx("SWIPE", name + " 完成 cost=" + (Date.now() - start) + "ms");
}

function gestureLogged(name, x1, y1, x2, y2, duration) {
    var start = Date.now();
    logx("GESTURE", name + " from=(" + Math.round(x1) + "," + Math.round(y1) + ") to=(" + Math.round(x2) + "," + Math.round(y2) + ") duration=" + duration);
    try {
        gesture(duration, [Math.round(x1), Math.round(y1)], [Math.round(x2), Math.round(y2)]);
    } catch (e) {
        logx("GESTURE", name + " gesture失败，降级swipe err=" + e);
        swipe(Math.round(x1), Math.round(y1), Math.round(x2), Math.round(y2), duration);
    }
    logx("GESTURE", name + " 完成 cost=" + (Date.now() - start) + "ms");
}

function joinLocalPath(dir, name) {
    if (!dir) return name;
    var last = dir.charAt(dir.length - 1);
    if (last === "/" || last === "\\") return dir + name;
    return dir + "/" + name;
}

function addUniquePath(list, path) {
    if (!path) return;
    for (var i = 0; i < list.length; i++) {
        if (list[i] === path) return;
    }
    list.push(path);
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
    return "";
}

function resolveCaptchaModulePath() {
    var name = CONFIG.captcha && CONFIG.captcha.moduleFileName ? CONFIG.captcha.moduleFileName : "nanjing_booking_captcha_solver.js";
    var candidates = [];
    addUniquePath(candidates, joinLocalPath(currentScriptDir(), name));
    try {
        addUniquePath(candidates, joinLocalPath(files.cwd(), name));
    } catch (ignoredCwd) {}
    addUniquePath(candidates, name);
    addUniquePath(candidates, "project/" + name);

    for (var i = 0; i < candidates.length; i++) {
        try {
            if (files.exists(candidates[i])) return candidates[i];
        } catch (ignoredExists) {}
    }
    logx("CAPTCHA", "验证码模块未找到 candidates=" + candidates.join("|"));
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
        return name + " 未完成或宽高无效";
    }
    if (region.x + region.w > profile.deviceWidth || region.y + region.h > profile.deviceHeight) {
        return name + " 超出校准屏幕范围";
    }
    return "";
}

function validateCaptchaProfile(profile) {
    if (!profile) return "profile 为空";
    if (profile.schemaVersion !== 1) return "profile 版本不支持";
    if (profile.deviceWidth !== device.width || profile.deviceHeight !== device.height) {
        return "profile 屏幕尺寸 " + profile.deviceWidth + "x" + profile.deviceHeight +
            " 与当前设备 " + device.width + "x" + device.height + " 不一致";
    }
    var math = profile.mathProfile;
    if (!math || math.completed !== true) return "数学验证码未完成校准";
    var mathErr = validateCaptchaRegion(math.expressionRegion, "数学表达式区域", profile) ||
        validateCaptchaRegion(math.inputRegion, "数学输入框区域", profile) ||
        validateCaptchaRegion(math.submitRegion, "数学确定按钮区域", profile);
    if (mathErr) return mathErr;

    var slider = profile.sliderProfile;
    if (!slider || slider.completed !== true) return "滑块验证码未完成校准";
    var sliderErr = validateCaptchaRegion(slider.imageSearchRegion, "滑块灰块搜索区域", profile) ||
        validateCaptchaRegion(slider.handleRegion, "滑块拖动起点区域", profile) ||
        validateCaptchaRegion(slider.trackRegion, "滑块轨道区域", profile) ||
        validateCaptchaRegion(slider.submitRegion, "滑块确定按钮区域", profile);
    if (sliderErr) return sliderErr;
    return "";
}

function loadCaptchaProfile() {
    var path = captchaProfilePath();
    if (!files.exists(path)) {
        return { ok: false, reason: "未找到验证码校准配置：" + path };
    }
    try {
        var profile = JSON.parse(files.read(path));
        var error = validateCaptchaProfile(profile);
        if (error) {
            return { ok: false, reason: error, path: path };
        }
        return { ok: true, profile: profile, path: path };
    } catch (e) {
        return { ok: false, reason: "读取验证码校准配置失败：" + e, path: path };
    }
}

function applyCaptchaProfileToConfig() {
    if (CONFIG.captcha && CONFIG.captcha.profileValidated === true) {
        return { ok: true, profile: CONFIG.captcha.profile };
    }
    var loaded = loadCaptchaProfile();
    if (!loaded.ok) {
        return loaded;
    }
    CONFIG.captcha.profile = loaded.profile;
    CONFIG.captcha.profilePath = loaded.path;
    CONFIG.captcha.profileValidated = true;
    logx("CAPTCHA", "验证码校准配置已加载 path=" + loaded.path +
        " screen=" + loaded.profile.deviceWidth + "x" + loaded.profile.deviceHeight);
    return loaded;
}

function requireCaptchaProfileForRun() {
    var loaded = applyCaptchaProfileToConfig();
    if (!loaded.ok) {
        fail("验证码坐标校准不可用：" + loaded.reason + "，请先在 App 首页进入验证码校准并重新保存");
    }
}

function loadCaptchaSolver() {
    if (runtime.captchaSolver) return runtime.captchaSolver;
    if (!CONFIG.captcha || !CONFIG.captcha.enabled) return null;

    var modulePath = resolveCaptchaModulePath();
    if (!modulePath) return null;

    try {
        var code = files.read(modulePath);
        var factory = eval("(function(){ var module = { exports: null }; var exports = {}; " +
            code + "\n; return module.exports || createNanjingBookingCaptchaSolver; })()");
        if (typeof factory !== "function") {
            logx("CAPTCHA", "验证码模块未导出 createNanjingBookingCaptchaSolver path=" + modulePath);
            return null;
        }
        runtime.captchaSolver = factory({
            config: CONFIG,
            runtime: runtime,
            log: function (msg) { logx("CAPTCHA", msg); },
            notifyUser: notifyUser,
            fileTimeText: fileTimeText,
            scaleX: scaleX,
            scaleY: scaleY,
            clamp: clamp,
            pressPoint: pressPoint,
            makePoint: makePoint
        });
        logx("CAPTCHA", "验证码模块已加载 path=" + modulePath);
        return runtime.captchaSolver;
    } catch (e) {
        logx("CAPTCHA", "验证码模块加载失败 path=" + modulePath + " err=" + e + " stack=" + (e && e.stack ? e.stack : ""));
        return null;
    }
}

function preloadCaptchaSolverForRush(reason, leadMs) {
    if (!CONFIG.captcha || !CONFIG.captcha.enabled) {
        return { ok: true, skipped: true, reason: "captcha_disabled" };
    }
    if (runtime.captchaSolver) {
        return { ok: true, cached: true };
    }
    var minLeadMs = CONFIG.captcha.preloadMinLeadMs || 3000;
    if (typeof leadMs === "number" && leadMs >= 0 && leadMs < minLeadMs) {
        logx("CAPTCHA", "验证码模块预加载跳过 reason=" + reason + " lead=" + leadMs + "ms minLead=" + minLeadMs + "ms");
        return { ok: true, skipped: true, reason: "lead_too_short" };
    }
    var start = Date.now();
    try {
        var profileResult = applyCaptchaProfileToConfig();
        if (!profileResult.ok) {
            logx("CAPTCHA", "验证码模块预加载跳过 reason=" + reason + " profile=" + profileResult.reason);
            return { ok: false, skipped: true, reason: profileResult.reason };
        }
        var solver = loadCaptchaSolver();
        var cost = Date.now() - start;
        if (solver) {
            logx("CAPTCHA", "验证码模块预加载完成 reason=" + reason + " lead=" + leadMs + "ms cost=" + cost + "ms");
            return { ok: true, cost: cost };
        }
        logx("CAPTCHA", "验证码模块预加载未完成 reason=" + reason + " lead=" + leadMs + "ms cost=" + cost + "ms");
        return { ok: false, skipped: true, reason: "captcha_module_unavailable" };
    } catch (e) {
        logx("CAPTCHA", "验证码模块预加载异常 reason=" + reason + " err=" + e);
        return { ok: false, skipped: true, reason: "exception" };
    }
}

function solveCaptchaAfterConfirmForRush() {
    if (!CONFIG.captcha || !CONFIG.captcha.enabled) {
        logx("CAPTCHA", "验证码流程已关闭，跳过自动处理");
        return { ok: true, skipped: true, reason: "captcha_disabled" };
    }
    var profileResult = applyCaptchaProfileToConfig();
    if (!profileResult.ok) {
        var profileReason = "验证码校准配置不可用：" + profileResult.reason + "，请回到 App 重新校准";
        logx("CAPTCHA", profileReason);
        notifyUser(profileReason);
        vibrateManualFallback(profileResult.reason);
        return { ok: false, manualFallback: true, reason: profileResult.reason };
    }

    var solver = loadCaptchaSolver();
    if (!solver || typeof solver.solveAfterConfirm !== "function") {
        var missingReason = "验证码模块不可用，进入人工兜底";
        logx("CAPTCHA", missingReason);
        notifyUser(missingReason);
        captureDiagnostics("captcha_module_unavailable", CONFIG.diagnostics && CONFIG.diagnostics.ocrOnError);
        vibrateManualFallback("captcha_module_unavailable");
        return { ok: false, manualFallback: true, reason: "captcha_module_unavailable" };
    }

    var result = solver.solveAfterConfirm();
    if (!result || !result.ok) {
        var reason = result && result.reason ? result.reason : "unknown";
        logx("CAPTCHA", "验证码自动处理未完成，保留页面给人工兜底 reason=" + reason);
        notifyUser("验证码需人工兜底，请查看页面和日志");
        vibrateManualFallback(reason);
        return result || { ok: false, manualFallback: true, reason: reason };
    }
    logx("CAPTCHA", "验证码自动处理完成 type=" + (result.type || "") + " detail=" + (result.detail || ""));
    return result;
}

function goBackLogged(reason) {
    logx("NAV", "back: " + reason);
    back();
    sleep(700);
}

function requireCachedPoint(key, label) {
    var p = getCachedPoint(key);
    if (!p) fail("缺少缓存坐标：" + label + "(" + key + ")");
    return p;
}

// ==================== 缓存模块 ====================
function readJson(path) {
    try {
        if (!files.exists(path)) return null;
        var txt = files.read(path);
        if (!txt) return null;
        return JSON.parse(txt);
    } catch (e) {
        logx("CACHE", "读取失败 path=" + path + " err=" + e);
        return null;
    }
}

function writeJson(path, obj) {
    try {
        files.write(path, JSON.stringify(obj, null, 2));
        return true;
    } catch (e) {
        logx("CACHE", "写入失败 path=" + path + " err=" + e);
        return false;
    }
}

function loadCache() {
    runtime.cachePath = CONFIG.cachePath;
    var cache = null;
    if (CONFIG.useCache) {
        cache = readJson(CONFIG.cachePath);
        if (!cache) {
            cache = readJson(CONFIG.backupCachePath);
            if (cache) {
                logx("CACHE", "主缓存不存在，读取备用缓存作为种子，但后续仍写回主缓存 path=" + CONFIG.backupCachePath);
            }
        }
    }
    if (!cache) {
        logx("CACHE", "未命中缓存，将实时采集 path=" + CONFIG.cachePath + " backup=" + CONFIG.backupCachePath);
        notifyUser("未命中缓存，开始实时采集");
        cache = {};
    } else {
        logx("CACHE", "读取缓存 path=" + runtime.cachePath + " version=" + cache.version + " collectedAt=" + cache.collectedAt);
        if (cache.exhibitMode && cache.exhibitMode !== CONFIG.exhibitMode) {
            logx("CACHE", "缓存展馆模式不一致，跳过旧缓存 cache=" + cache.exhibitMode + " current=" + CONFIG.exhibitMode);
            cache = {};
        } else {
            var cacheBookingType = cache.bookingType || "normal";
            if (cacheBookingType !== currentBookingCacheType()) {
                logx("CACHE", "缓存预约类型不一致，跳过旧缓存 cache=" + cacheBookingType + " current=" + currentBookingCacheType());
                cache = {};
            }
        }
    }

    if (!cache.screen || cache.screen.width !== device.width || cache.screen.height !== device.height) {
        if (cache.screen) {
            logx("CACHE", "屏幕尺寸不一致，缓存坐标仅作低优先级参考 cache=" + cache.screen.width + "x" + cache.screen.height + " current=" + device.width + "x" + device.height);
            notifyUser("缓存屏幕尺寸不一致，将重新实时采集");
        }
        cache.__screenMatched = false;
    } else {
        cache.__screenMatched = true;
        logx("CACHE", "屏幕尺寸一致，可复用缓存坐标");
        notifyUser("缓存命中，屏幕尺寸一致");
    }
    runtime.cache = cache;
}

function saveCache() {
    runtime.cache.version = CONFIG.version;
    runtime.cache.exhibitMode = CONFIG.exhibitMode;
    runtime.cache.exhibitName = currentExhibitProfile().shortName;
    runtime.cache.bookingType = currentBookingCacheType();
    runtime.cache.bookingTypeName = currentBookingTypeName();
    runtime.cache.visitorCount = CONFIG.visitorCount;
    runtime.cache.minorVisitorCount = CONFIG.minorVisitorCount;
    runtime.cache.screen = { width: device.width, height: device.height };
    runtime.cache.collectedAt = nowText();
    var ok = writeJson(runtime.cachePath, runtime.cache);
    if (!ok && runtime.cachePath !== CONFIG.backupCachePath) {
        runtime.cachePath = CONFIG.backupCachePath;
        ok = writeJson(runtime.cachePath, runtime.cache);
    }
    logx("CACHE", "保存缓存 " + (ok ? "成功" : "失败") + " path=" + runtime.cachePath);
}

function getCachedPoint(key) {
    if (!runtime.cache.points) return null;
    if (shouldSkipCacheInPrepare(key)) return null;
    var p = runtime.cache.points[key];
    if (!p || typeof p.x !== "number" || typeof p.y !== "number") {
        logx("CACHE", key + " 缓存缺失");
        return null;
    }
    if (!CONFIG.useCache && !runtime.freshPoints[key]) {
        logx("CACHE", key + " 存在旧缓存但 useCache=false，跳过");
        return null;
    }
    if (!runtime.cache.__screenMatched && !runtime.freshPoints[key]) {
        logx("CACHE", key + " 存在但屏幕尺寸不一致，跳过旧缓存");
        return null;
    }
    logx("CACHE", key + " 命中 " + pointText(p));
    return makePoint(p.x, p.y, runtime.freshPoints[key] ? "fresh:" + key : "cache:" + key);
}

function shouldSkipCacheInPrepare(key) {
    if (!CONFIG.preferRealtimeInPrepare || STAGE !== "PREP") return false;
    if (runtime.freshPoints[key]) return false;
    var keys = {
        targetDate: true,
        homeExhibit: true,
        normalBooking: true,
        parentBooking: true,
        visitDateTitle: true,
        audienceTitle: true,
        adultTitle: true,
        minorTitle: true,
        periodTitle: true,
        periodMorning: true,
        periodAfternoon: true,
        confirmBooking: true,
        bookingListSentinel: true
    };
    if (keys[key]) {
        logx("CACHE", key + " 第一轮优先实时采集，跳过旧缓存");
        return true;
    }
    return false;
}

function setCachedPoint(key, p) {
    if (!runtime.cache.points) runtime.cache.points = {};
    runtime.cache.points[key] = { x: Math.round(p.x), y: Math.round(p.y), source: p.source || "unknown" };
    runtime.freshPoints[key] = true;
    logx("CACHE", key + " 写入 " + pointText(runtime.cache.points[key]));
}

function setCacheValue(key, value) {
    runtime.cache[key] = value;
    logx("CACHE", key + " 写入 " + JSON.stringify(value));
}

function cachePointForPlan(key) {
    if (!runtime.cache.points || !runtime.cache.points[key]) return null;
    return runtime.cache.points[key];
}

function logRushPlan(reason) {
    var periodKey = CONFIG.period === "下午" ? "periodAfternoon" : "periodMorning";
    var plan = {
        reason: reason,
        config: {
            visitDate: CONFIG.visitDate,
            period: CONFIG.period,
            visitorCount: CONFIG.visitorCount,
            minorVisitorCount: CONFIG.minorVisitorCount,
            startTime: CONFIG.startTime,
            exhibitMode: CONFIG.exhibitMode,
            exhibitName: currentExhibitProfile().shortName,
            bookingType: currentBookingCacheType(),
            bookingTypeName: currentBookingTypeName()
        },
        screen: { width: device.width, height: device.height },
        points: {
            normalBooking: cachePointForPlan("normalBooking"),
            parentBooking: cachePointForPlan("parentBooking"),
            targetDate: cachePointForPlan("targetDate"),
            period: cachePointForPlan(periodKey),
            confirmBooking: cachePointForPlan("confirmBooking")
        },
        visitorRushPoints: runtime.cache.visitorRushPoints || null,
        adultRushPoints: runtime.cache.adultRushPoints || null,
        minorRushPoints: runtime.cache.minorRushPoints || null,
        scrollStrategy: runtime.cache.scrollStrategy || null,
        adultScrollStrategy: runtime.cache.adultScrollStrategy || null,
        minorScrollStrategy: runtime.cache.minorScrollStrategy || null,
        cachePath: runtime.cachePath,
        collectedAt: runtime.cache.collectedAt || null
    };
    logx("PLAN", "二轮执行计划 " + JSON.stringify(plan));
    warnRiskyPoint("targetDate", plan.points.targetDate);
    warnRiskyPoint("period", plan.points.period);
    warnRiskyPoint(isParentBookingMode() ? "parentBooking" : "normalBooking", isParentBookingMode() ? plan.points.parentBooking : plan.points.normalBooking);
    warnRiskyPoint("confirmBooking", plan.points.confirmBooking);
}

function warnRiskyPoint(name, point) {
    if (!point) {
        logx("WARN", name + " 缺失，二轮可能触发降级识别或失败");
        return;
    }
    var source = String(point.source || "");
    if (source.indexOf("screenshot-ratio") >= 0 || source.indexOf("UnknownFallback") >= 0) {
        logx("WARN", name + " 来源为低可信降级坐标 " + pointText(point));
    }
}

// ==================== OCR 模块 ====================
function normalizeText(s) {
    if (!s) return "";
    return String(s)
        .replace(/\s+/g, "")
        .replace(/[“”"']/g, "")
        .replace(/丨/g, "川")
        .replace(/井/g, "并")
        .replace(/預/g, "预")
        .replace(/約/g, "约")
        .replace(/門/g, "门")
        .replace(/館/g, "馆")
        .replace(/：/g, ":")
        .replace(/[－–—]/g, "-");
}

function fuzzyContains(text, keyword) {
    var t = normalizeText(text);
    var k = normalizeText(keyword);
    if (t.indexOf(k) >= 0) return true;
    if (k === "阅读并同意") return t.indexOf("阅读") >= 0 && t.indexOf("同意") >= 0;
    if (k === "我已阅读并同意") return t.indexOf("我已") >= 0 && t.indexOf("同意") >= 0;
    if (k === "确认预约") return t.indexOf("确认") >= 0 && t.indexOf("预约") >= 0;
    if (k === "普通预约") return t.indexOf("普通") >= 0 && t.indexOf("预约") >= 0;
    if (k === "普通预约标题") return t.indexOf("普通") >= 0;
    if (k === "亲子预约") return t.indexOf("亲子") >= 0 && t.indexOf("预约") >= 0;
    if (k === "亲子预约标题") return t.indexOf("亲子") >= 0;
    if (k === "用户确认登录") return t.indexOf("用户") >= 0 && t.indexOf("登录") >= 0;
    if (k === "南京大屠杀") return t.indexOf("南京") >= 0 && t.indexOf("屠杀") >= 0;
    if (k === "正义必胜") return t.indexOf("正义") >= 0 && t.indexOf("必胜") >= 0;
    if (k === "和平必胜") return t.indexOf("和平") >= 0 && t.indexOf("必胜") >= 0;
    if (k === "人民必胜") return t.indexOf("人民") >= 0 && t.indexOf("必胜") >= 0;
    if (k === "反法西斯") return t.indexOf("反法") >= 0 || t.indexOf("法西斯") >= 0;
    if (k === "审判日本战犯") return t.indexOf("审判") >= 0 && (t.indexOf("日本") >= 0 || t.indexOf("战犯") >= 0);
    if (k === "参观日期") return t.indexOf("参观") >= 0 && t.indexOf("日期") >= 0;
    if (k === "观众信息") return t.indexOf("观众") >= 0 && t.indexOf("信息") >= 0;
    if (k === "成人信息") {
        var looksLikeMinor = t.indexOf("未成年") >= 0 || t.indexOf("末成年") >= 0 || t.indexOf("来成年") >= 0 || t.indexOf("米成年") >= 0;
        return !looksLikeMinor && (
            t.indexOf("成年人信息") >= 0 ||
            t.indexOf("年人信息") >= 0 ||
            t.indexOf("人信息") >= 0 ||
            t.indexOf("人信") >= 0 ||
            t === "信息" ||
            t.indexOf("戍年人") >= 0 ||
            t.indexOf("咸年人") >= 0
        );
    }
    if (k === "未成年人信息") {
        return t.indexOf("信息") >= 0 && (
            t.indexOf("未成年") >= 0 ||
            t.indexOf("末成年") >= 0 ||
            t.indexOf("来成年") >= 0 ||
            t.indexOf("米成年") >= 0
        );
    }
    if (k === "证件类型") {
        if (t.indexOf("证件号码") >= 0 || t.indexOf("号码") >= 0) return false;
        if (t.indexOf("计算方式") >= 0 || t.indexOf("出生日期") >= 0) return false;
        return t.indexOf("证件类型") >= 0 || t.indexOf("正件类型") >= 0 || t.indexOf("件类型") >= 0;
    }
    if (k === "选择时段") return t.indexOf("选择") >= 0 && t.indexOf("时段") >= 0;
    if (k === "我已知晓" || k === "已知晓" || k === "知晓") return t.indexOf("知晓") >= 0 || (t.indexOf("知") >= 0 && t.indexOf("晓") >= 0);
    return false;
}

function ocrRegion(stage, label, region) {
    var img = null;
    var ocrImg = null;
    var start = Date.now();
    try {
        img = captureScreen();
        var offsetX = 0;
        var offsetY = 0;
        if (region) {
            offsetX = Math.round(clamp(region[0], 0, device.width - 1));
            offsetY = Math.round(clamp(region[1], 0, device.height - 1));
            var w = Math.round(clamp(region[2], 1, device.width - offsetX));
            var h = Math.round(clamp(region[3], 1, device.height - offsetY));
            // 当前 OpenAutoJS 版本不支持 gmlkit.ocr(img, "zh", {region: ...})。
            // 所以先裁剪局部截图，再对裁剪图做两参数 OCR。
            ocrImg = images.clip(img, offsetX, offsetY, w, h);
        } else {
            ocrImg = img;
        }
        var result = gmlkit.ocr(ocrImg, "zh");
        var arr = result.toArray(3);
        var items = [];
        var texts = [];
        for (var i = 0; i < arr.length; i++) {
            var it = arr[i];
            if (!it || !it.text) continue;
            items.push(wrapOcrItem(it, offsetX, offsetY));
            texts.push(String(it.text));
        }
        var summary = texts.slice(0, 16).join("|");
        if (summary.length > 240) summary = summary.substring(0, 240) + "...";
        logx("OCR", label + " region=" + regionText(region) + " cost=" + (Date.now() - start) + "ms count=" + items.length + " result=" + summary);
        return items;
    } catch (e) {
        logx("OCR", label + " 失败 region=" + regionText(region) + " cost=" + (Date.now() - start) + "ms err=" + e);
        return [];
    } finally {
        if (ocrImg && ocrImg !== img) {
            try { ocrImg.recycle(); } catch (ignoredClip) {}
        }
        if (img) {
            try { img.recycle(); } catch (ignored) {}
        }
    }
}

function wrapOcrItem(item, offsetX, offsetY) {
    var b = item.bounds;
    var left = b.left + offsetX;
    var top = b.top + offsetY;
    var right = b.right + offsetX;
    var bottom = b.bottom + offsetY;
    return {
        text: String(item.text),
        bounds: {
            left: left,
            top: top,
            right: right,
            bottom: bottom,
            centerX: function() { return Math.round((left + right) / 2); },
            centerY: function() { return Math.round((top + bottom) / 2); },
            width: function() { return right - left; },
            height: function() { return bottom - top; }
        }
    };
}

function findTextItem(items, keywords, prefer) {
    if (typeof keywords === "string") keywords = [keywords];
    var matched = [];
    for (var i = 0; i < items.length; i++) {
        for (var j = 0; j < keywords.length; j++) {
            if (fuzzyContains(items[i].text, keywords[j])) {
                matched.push(items[i]);
                break;
            }
        }
    }
    if (matched.length === 0) return null;
    matched.sort(function(a, b) {
        var ra = itemRect(a);
        var rb = itemRect(b);
        if (prefer === "bottom") return rb.cy - ra.cy;
        if (prefer === "top") return ra.cy - rb.cy;
        if (prefer === "left") return ra.cx - rb.cx;
        if (prefer === "right") return rb.cx - ra.cx;
        return ra.cy - rb.cy;
    });
    return matched[0];
}

function findPointByText(label, keywords, region, prefer) {
    var items = ocrRegion(STAGE, "查找 " + label, region);
    var item = findTextItem(items, keywords, prefer);
    if (!item) {
        logx("OCR", label + " 未匹配");
        return null;
    }
    var p = centerOfBounds(item.bounds, "ocr:" + label);
    logx("OCR", label + " 匹配 text=" + item.text + " " + pointText(p));
    return p;
}

function waitForText(label, keywords, region, timeoutMs) {
    // 业务约束：预约须知只在小程序冷启动后由 handleStartupNoticeDialog()
    // 处理一次。后续页面按业务前提不会再弹出预约须知，因此这里不做
    // 通用弹窗处理，避免在采集/抢票链路中引入额外 OCR 和点击。
    var start = Date.now();
    var p = null;
    while (Date.now() - start < timeoutMs) {
        p = findPointByText(label, keywords, region, "top");
        if (p) {
            logx("WAIT", label + " 已出现 cost=" + (Date.now() - start) + "ms");
            return p;
        }
        sleep(CONFIG.pageWaitInterval);
    }
    logx("WAIT", label + " 超时 cost=" + (Date.now() - start) + "ms");
    return null;
}

function detectTextInRegion(region, keyword) {
    var img = null;
    var ocrImg = null;
    try {
        img = captureScreen();
        var offsetX = Math.round(clamp(region[0], 0, device.width - 1));
        var offsetY = Math.round(clamp(region[1], 0, device.height - 1));
        var w = Math.round(clamp(region[2], 1, device.width - offsetX));
        var h = Math.round(clamp(region[3], 1, device.height - offsetY));
        ocrImg = images.clip(img, offsetX, offsetY, w, h);
        var result = gmlkit.ocr(ocrImg, "zh");
        var arr = result.toArray(3);
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] && arr[i].text && fuzzyContains(arr[i].text, keyword)) {
                return true;
            }
        }
        return false;
    } catch (e) {
        return false;
    } finally {
        if (ocrImg && ocrImg !== img) { try { ocrImg.recycle(); } catch (e) {} }
        if (img) { try { img.recycle(); } catch (e) {} }
    }
}

function imagePixelAt(img, x, y) {
    if (img && typeof img.pixel === "function") {
        return img.pixel(Math.round(x), Math.round(y));
    }
    return images.pixel(img, Math.round(x), Math.round(y));
}

function isNearColor(color, r, g, b, threshold) {
    return Math.abs(colors.red(color) - r) <= threshold &&
        Math.abs(colors.green(color) - g) <= threshold &&
        Math.abs(colors.blue(color) - b) <= threshold;
}

function isNearWhite(color, threshold) {
    threshold = threshold || 50;
    return colors.red(color) >= 255 - threshold &&
        colors.green(color) >= 255 - threshold &&
        colors.blue(color) >= 255 - threshold;
}

function countWhiteTextInSelectedDateCell(img, cx, cy) {
    var bands = [
        { name: "dateNumber", x1: -45, x2: 45, y1: -25, y2: 25 },
        { name: "statusText", x1: -62, x2: 62, y1: 35, y2: 82 }
    ];
    var stepX = Math.max(3, Math.round(scaleX(5)));
    var stepY = Math.max(3, Math.round(scaleY(5)));
    var hits = 0;
    var samples = 0;
    var summaries = [];

    for (var i = 0; i < bands.length; i++) {
        var band = bands[i];
        var bandHits = 0;
        var bandSamples = 0;
        var left = Math.round(clamp(cx + scaleX(band.x1), 0, device.width - 1));
        var right = Math.round(clamp(cx + scaleX(band.x2), left + 1, device.width));
        var top = Math.round(clamp(cy + scaleY(band.y1), 0, device.height - 1));
        var bottom = Math.round(clamp(cy + scaleY(band.y2), top + 1, device.height));

        for (var y = top; y <= bottom; y += stepY) {
            for (var x = left; x <= right; x += stepX) {
                samples++;
                bandSamples++;
                if (isNearWhite(imagePixelAt(img, x, y), 75)) {
                    hits++;
                    bandHits++;
                }
            }
        }
        summaries.push({
            name: band.name,
            hits: bandHits,
            samples: bandSamples,
            x: left,
            y: top,
            w: right - left,
            h: bottom - top
        });
    }

    return {
        hits: hits,
        samples: samples,
        bands: summaries
    };
}

function probeSelectedDateCellAt(img, cx, cy, threshold) {
    var hits = 0;
    var samples = 0;
    var anchors = [
        [-58, 20],
        [58, 20],
        [-58, 70],
        [58, 70],
        [-58, 120],
        [58, 120],
        [0, 135]
    ];

    for (var i = 0; i < anchors.length; i++) {
        var x = Math.round(clamp(cx + scaleX(anchors[i][0]), 0, device.width - 1));
        var y = Math.round(clamp(cy + scaleY(anchors[i][1]), 0, device.height - 1));
        var hit = isNearColor(imagePixelAt(img, x, y), 168, 125, 108, threshold || 18);
        samples++;
        if (hit) hits++;
    }

    // 选中日期是一个大面积实心矩形；说明文案/圆形图标不会同时覆盖这些分散背景锚点。
    if (hits < 5) {
        return {
            visible: false,
            hits: hits,
            whiteHits: 0,
            backgroundSamples: samples,
            samples: samples
        };
    }

    var whiteProbe = countWhiteTextInSelectedDateCell(img, cx, cy);
    samples += whiteProbe.samples;

    return {
        visible: hits >= 5 && whiteProbe.hits >= 4,
        hits: hits,
        whiteHits: whiteProbe.hits,
        whiteSamples: whiteProbe.samples,
        whiteProbe: whiteProbe,
        backgroundSamples: anchors.length,
        samples: samples
    };
}

function detectSelectedDateCellInGrid(threshold) {
    var start = Date.now();
    var img = null;
    var captureCost = 0;
    try {
        var captureStart = Date.now();
        img = captureScreen();
        captureCost = Date.now() - captureStart;
        var profile = currentExhibitProfile();
        var xs = [scaleX(190), scaleX(365), scaleX(545), scaleX(720), scaleX(900), scaleX(1080), scaleX(1255)];
        var ys = [scaleY(profile.dateGridYs[0]), scaleY(profile.dateGridYs[1])];
        var best = null;

        for (var row = 0; row < ys.length; row++) {
            for (var col = 0; col < xs.length; col++) {
                var probe = probeSelectedDateCellAt(img, xs[col], ys[row], threshold);
                probe.row = row;
                probe.col = col;
                if (!best || probe.hits + (probe.whiteHits || 0) > best.hits + (best.whiteHits || 0)) best = probe;
                if (probe.visible) {
                    return { found: true, row: row, col: col, costMs: Date.now() - start, captureCostMs: captureCost, probe: probe };
                }
            }
        }
        return { found: false, costMs: Date.now() - start, captureCostMs: captureCost, best: best };
    } catch (e) {
        logx("COLOR", "日期网格选中色块检测异常 err=" + e);
        return { found: false, costMs: Date.now() - start, captureCostMs: captureCost, error: String(e) };
    } finally {
        if (img) { try { img.recycle(); } catch (e) {} }
    }
}

function probeBookingListSentinel(point) {
    var img = null;
    try {
        img = captureScreen();
        var halfW = Math.max(24, Math.round(scaleX(48)));
        var halfH = Math.max(18, Math.round(scaleY(32)));
        var step = Math.max(5, Math.round(Math.min(scaleX(8), scaleY(8))));
        var left = Math.round(clamp(point.x - halfW, 0, device.width - 1));
        var top = Math.round(clamp(point.y - halfH, 0, device.height - 1));
        var right = Math.round(clamp(point.x + halfW, left + 1, device.width));
        var bottom = Math.round(clamp(point.y + halfH, top + 1, device.height));
        var hits = 0;
        var total = 0;
        for (var y = top; y < bottom; y += step) {
            for (var x = left; x < right; x += step) {
                total++;
                if (isNearColor(imagePixelAt(img, x, y), 168, 125, 108, 22)) {
                    hits++;
                }
            }
        }
        var density = total > 0 ? hits / total : 0;
        return {
            visible: density >= 0.55,
            density: Math.round(density * 1000) / 1000,
            hits: hits,
            total: total,
            x: left,
            y: top,
            w: right - left,
            h: bottom - top
        };
    } catch (e) {
        logx("COLOR", "预约列表哨兵检测异常 err=" + e);
        return { visible: true, density: 1, error: String(e) };
    } finally {
        if (img) { try { img.recycle(); } catch (e) {} }
    }
}

function inferBookingListSentinelPoint() {
    var normal = runtime.cache.points && runtime.cache.points.normalBooking;
    if (normal && typeof normal.y === "number") {
        return makePoint(scaleX(180), normal.y + scaleY(900), "infer:bookingListSentinelFromNormal");
    }
    return scaledPoint("bookingListSentinelFallback", 180, 2060);
}

function collectBookingListSentinelPoint(region) {
    var cached = getCachedPoint("bookingListSentinel");
    if (cached) return cached;

    if (STAGE === "RUSH") {
        return inferBookingListSentinelPoint();
    }

    var items = ocrRegion(STAGE, "查找 优待预约哨兵", region || [0, scaleY(700), device.width, scaleY(1700)]);
    var item = findTextItem(items, "优待预约", "bottom");
    if (item) {
        var r = itemRect(item);
        var p = makePoint(scaleX(180), r.cy, "ocr:bookingListSentinelPreferential");
        logx("COORD", "优待预约哨兵定位 text=" + item.text + " " + pointText(p) + " rect=" + JSON.stringify(r));
        setCachedPoint("bookingListSentinel", p);
        return p;
    }

    var fallback = inferBookingListSentinelPoint();
    logx("COORD", "优待预约哨兵未识别，使用推算点 " + pointText(fallback));
    setCachedPoint("bookingListSentinel", fallback);
    return fallback;
}

function waitBookingListSentinelGone(point) {
    var firstDelayMs = 50;
    var afterGoneWaitMs = 150;
    var timeoutMs = 1600;
    var intervalMs = 25;
    if (!point) {
        point = inferBookingListSentinelPoint();
    }
    sleep(firstDelayMs);
    var start = Date.now();
    var probes = 0;
    var last = null;
    var details = [];
    while (Date.now() - start < timeoutMs) {
        probes++;
        var probeStart = Date.now();
        last = probeBookingListSentinel(point);
        details.push({
            i: probes,
            cost: Date.now() - probeStart,
            visible: last.visible,
            density: last.density,
            hits: last.hits,
            total: last.total
        });
        if (!last.visible) {
            logx("RUSH", "参观预约列表哨兵已消失 elapsed=" + (Date.now() - start) + "ms probes=" + probes + " probe=" + JSON.stringify(last) + " details=" + JSON.stringify(details));
            sleep(afterGoneWaitMs);
            return true;
        }
        sleep(intervalMs);
    }
    logx("RUSH", "参观预约列表哨兵仍存在，疑似未离开上一页 elapsed=" + (Date.now() - start) + "ms probes=" + probes + " probe=" + JSON.stringify(last) + " details=" + JSON.stringify(details));
    return false;
}

// ==================== 页面坐标采集与推算 ====================
function getHomeExhibitPoint() {
    var cached = getCachedPoint("homeExhibit");
    if (cached) return cached;

    var profile = currentExhibitProfile();
    var cardRegion = [0, scaleY(profile.homeCardRegion.y), device.width, scaleY(profile.homeCardRegion.h)];
    var cardLabel = "第" + (profile.homeCardIndex + 1) + "卡片";
    var items = ocrRegion(STAGE, "首页查找" + profile.shortName + "入口-" + cardLabel, cardRegion);
    if (findTextItem(items, "预约须知", "top")) {
        logx("PAGE", "首页" + cardLabel + "区域仍被预约须知覆盖，暂不推算首页入口");
        return null;
    }
    var bookingItems = [];
    for (var i = 0; i < items.length; i++) {
        if (fuzzyContains(items[i].text, "点击预约")) bookingItems.push(items[i]);
    }
    if (bookingItems.length > 0) {
        bookingItems.sort(function(a, b) { return itemRect(a).cy - itemRect(b).cy; });
        var p = centerOfBounds(bookingItems[0].bounds, "ocr:homeClickBooking");
        logx("COORD", "首页" + cardLabel + profile.shortName + "按钮匹配 text=" + bookingItems[0].text + " " + pointText(p));
        setCachedPoint("homeExhibit", p);
        return p;
    }

    var titleItem = findTextItem(items, profile.homeTitleKeywords, "top");
    if (titleItem) {
        var r = itemRect(titleItem);
        var inferred = makePoint(scaleX(profile.homeButtonFallback.x), r.cy + scaleY(profile.homeTitleButtonOffsetY), "infer:homeCardTitleBelowButton:" + profile.id);
        logx("COORD", "首页" + cardLabel + profile.shortName + "标题匹配 text=" + titleItem.text + " 推算按钮 " + pointText(inferred));
        setCachedPoint("homeExhibit", inferred);
        return inferred;
    }

    var fallback = scaledPoint("homeExhibitCardButton:" + profile.id, profile.homeButtonFallback.x, profile.homeButtonFallback.y);
    setCachedPoint("homeExhibit", fallback);
    return fallback;
}

function findHomeExhibitPointOnCurrentPage(label) {
    var profile = currentExhibitProfile();
    var cardRegion = [0, scaleY(profile.homeCardRegion.y), device.width, scaleY(profile.homeCardRegion.h)];
    var items = ocrRegion(STAGE, label + "-" + profile.shortName, cardRegion);
    if (findTextItem(items, "预约须知", "top")) return null;

    var bookingItems = [];
    for (var i = 0; i < items.length; i++) {
        if (fuzzyContains(items[i].text, "点击预约")) bookingItems.push(items[i]);
    }
    if (bookingItems.length > 0) {
        bookingItems.sort(function(a, b) { return itemRect(a).cy - itemRect(b).cy; });
        var p = centerOfBounds(bookingItems[0].bounds, "ocr:homeClickBookingAfterLogin");
        logx("COORD", label + " 匹配 text=" + bookingItems[0].text + " " + pointText(p));
        setCachedPoint("homeExhibit", p);
        return p;
    }

    var titleItem = findTextItem(items, profile.homeTitleKeywords, "top");
    if (titleItem) {
        var r = itemRect(titleItem);
        var inferred = makePoint(scaleX(profile.homeButtonFallback.x), r.cy + scaleY(profile.homeTitleButtonOffsetY), "infer:homeCardTitleBelowButtonAfterLogin:" + profile.id);
        logx("COORD", label + " 标题匹配 text=" + titleItem.text + " 推算按钮 " + pointText(inferred));
        setCachedPoint("homeExhibit", inferred);
        return inferred;
    }
    return null;
}

function getNormalBookingPoint() {
    var cached = getCachedPoint("normalBooking");
    if (cached) return cached;

    var region = [0, scaleY(700), device.width, scaleY(1700)];
    var p = findPointByText("普通预约", "普通预约", region, "top");
    if (p) {
        setCachedPoint("normalBooking", p);
        collectBookingListSentinelPoint(region);
        return p;
    }

    var fallback = scaledPoint("normalBookingCard", 720, 1180);
    setCachedPoint("normalBooking", fallback);
    collectBookingListSentinelPoint(region);
    return fallback;
}

function getParentBookingPoint() {
    var cached = getCachedPoint("parentBooking");
    if (cached) return cached;

    var region = [0, scaleY(700), device.width, scaleY(1700)];
    var p = findPointByText("亲子预约", "亲子预约", region, "top");
    if (p) {
        setCachedPoint("parentBooking", p);
        collectBookingListSentinelPoint(region);
        return p;
    }

    var fallback = scaledPoint("parentBookingCard", 720, 1660);
    setCachedPoint("parentBooking", fallback);
    collectBookingListSentinelPoint(region);
    return fallback;
}

function getBookingEntryPoint() {
    if (isParentBookingMode()) {
        // 登录探测仍使用普通预约入口，亲子模式第一轮也缓存普通入口供探测复用。
        getNormalBookingPoint();
        return getParentBookingPoint();
    }
    return getNormalBookingPoint();
}

function getConfirmButtonPoint() {
    var cached = getCachedPoint("confirmBooking");
    if (cached) return cached;

    var region = [0, Math.floor(device.height * 0.78), device.width, Math.floor(device.height * 0.2)];
    var p = findPointByText("确认预约", "确认预约", region, "bottom");
    if (p) {
        setCachedPoint("confirmBooking", p);
        return p;
    }

    var fallback = scaledPoint("confirmBookingBottomButton", 720, 2800);
    setCachedPoint("confirmBooking", fallback);
    return fallback;
}

function collectDatePoint() {
    var cached = getCachedPoint("targetDate");
    if (cached) return cached;

    var grid = buildVisibleDateGridFromToday();
    if (!grid.points[CONFIG.visitDate]) {
        fail("visitDate=" + CONFIG.visitDate + " 不在当前可见两周日期网格内：" + grid.rangeText);
    }
    setCacheValue("dateGridPoints", grid.points);
    var target = grid.points[CONFIG.visitDate];
    var point = makePoint(target.x, target.y, "dateGridByVisitDate:" + CONFIG.visitDate);
    logx("COORD", "目标日期按配置和星期网格推算 visitDate=" + CONFIG.visitDate + " row=" + target.row + " col=" + target.col + " " + pointText(point) + " visibleRange=" + grid.rangeText);
    setCachedPoint("targetDate", point);
    return point;
}

function buildVisibleDateGridFromToday() {
    var profile = currentExhibitProfile();
    var today = new Date();
    var start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    start.setDate(start.getDate() - start.getDay());
    var xs = [scaleX(190), scaleX(365), scaleX(545), scaleX(720), scaleX(900), scaleX(1080), scaleX(1255)];
    var ys = [scaleY(profile.dateGridYs[0]), scaleY(profile.dateGridYs[1])];
    logx("COORD", "日期网格使用展馆基准 exhibit=" + profile.id + " baseY=" + profile.dateGridYs.join(","));
    var points = {};
    var labels = [];
    for (var i = 0; i < 14; i++) {
        var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        var key = mmddText(d);
        var row = Math.floor(i / 7);
        var col = i % 7;
        points[key] = { x: xs[col], y: ys[row], row: row, col: col, source: "week-grid" };
        labels.push(key);
    }
    return { points: points, rangeText: labels[0] + "-" + labels[labels.length - 1] };
}

function mmddText(d) {
    return twoDigit(d.getMonth() + 1) + twoDigit(d.getDate());
}

function twoDigit(n) {
    var v = parseInt(n, 10);
    return v < 10 ? "0" + v : String(v);
}

function collectAudienceAndPeriodPoints() {
    collectBookingTitleAnchor();

    var detailItems = ocrRegion(STAGE, "查找 选择时段与观众信息标题", [0, scaleY(1000), device.width, scaleY(1700)]);
    var periodItem = findTextItem(detailItems, "选择时段", "top");
    var morningTimeItem = findTextItem(detailItems, "08:30-12:30", "left");
    var afternoonTimeItem = findTextItem(detailItems, "12:30-16:30", "right");
    var audienceItem = findTextItem(detailItems, "观众信息", "top");
    var periodTitle = null;
    var periodRect = null;
    var morningTimeRect = null;
    var afternoonTimeRect = null;
    var audienceTitle = null;
    var audienceRect = null;
    if (periodItem) {
        periodTitle = centerOfBounds(periodItem.bounds, "ocr:选择时段标题");
        periodRect = simpleRectFromItem(periodItem);
        logx("OCR", "选择时段标题 匹配 text=" + periodItem.text + " " + pointText(periodTitle) + " rect=" + JSON.stringify(periodRect));
        setCachedPoint("periodTitle", periodTitle);
        setCacheValue("periodTitleRect", periodRect);
    } else {
        logx("OCR", "选择时段标题 未匹配");
    }
    if (morningTimeItem) {
        morningTimeRect = simpleRectFromItem(morningTimeItem);
        logx("OCR", "上午时段文本 匹配 text=" + morningTimeItem.text + " rect=" + JSON.stringify(morningTimeRect));
    } else {
        logx("OCR", "上午时段文本 未匹配");
    }
    if (afternoonTimeItem) {
        afternoonTimeRect = simpleRectFromItem(afternoonTimeItem);
        logx("OCR", "下午时段文本 匹配 text=" + afternoonTimeItem.text + " rect=" + JSON.stringify(afternoonTimeRect));
    } else {
        logx("OCR", "下午时段文本 未匹配");
    }
    if (audienceItem) {
        audienceTitle = centerOfBounds(audienceItem.bounds, "ocr:观众信息标题");
        audienceRect = simpleRectFromItem(audienceItem);
        logx("OCR", "观众信息标题 匹配 text=" + audienceItem.text + " " + pointText(audienceTitle) + " rect=" + JSON.stringify(audienceRect));
        setCachedPoint("audienceTitle", audienceTitle);
        setCacheValue("audienceTitleRect", audienceRect);
    } else {
        logx("OCR", "观众信息标题 未匹配");
    }

    if (periodTitle || morningTimeRect || afternoonTimeRect) {
        setCacheValue("prepareDetailLayoutMode", "period-visible");
        if (periodTitle) {
            setPeriodPointsFromTitle(periodTitle, "ocr-prep-period-visible");
        } else {
            setPeriodPointsFromTimeRects(morningTimeRect, afternoonTimeRect, "ocr-prep-period-time-visible");
        }
        logx("COORD", "第一轮已显示选择时段，直接按已识别时段布局推算上午/下午；观众信息位置按当前实测布局复用");
    } else if (audienceRect) {
        setCacheValue("prepareDetailLayoutMode", "period-hidden");
        setPeriodPointsFromAudienceRect(audienceRect, "infer-from-audience-title");
        logx("COORD", "第一轮未显示选择时段，已按观众信息标题位置推算第二轮时段区域");
    } else {
        setCacheValue("prepareDetailLayoutMode", "fallback-period-title");
        var profile = currentExhibitProfile();
        var inferredTitle = makePoint(scaleX(220), scaleY(profile.fallbackPeriodTitleY), "infer:periodTitleFromOpenedLayout:" + profile.id);
        setCachedPoint("periodTitle", inferredTitle);
        setPeriodPointsFromTitle(inferredTitle, "infer-from-screenshot-layout");
        logx("COORD", "第一轮未找到观众信息标题，已按可预约截图布局推算时段区域");
    }

    collectVisitorPoints(audienceTitle);
    getConfirmButtonPoint();
    buildAudienceGestureScrollStrategy(audienceTitle);
}

function collectBookingTitleAnchor() {
    var cached = getCachedPoint("bookingTitle");
    if (cached) return cached;

    var title = findPointByText("预约详情页标题", isParentBookingMode() ? "亲子预约标题" : "普通预约标题", [0, scaleY(120), device.width, scaleY(260)], "top");
    if (title) {
        setCachedPoint("bookingTitle", title);
        setCacheValue("bookingTitleAnchorY", Math.round(title.y));
        logx("COORD", "预约详情页标题锚点 " + pointText(title));
        return title;
    }

    var fallback = makePoint(device.width * 0.5, scaleY(235), "fallback:bookingTitle");
    setCachedPoint("bookingTitle", fallback);
    setCacheValue("bookingTitleAnchorY", Math.round(fallback.y));
    logx("COORD", "预约详情页标题未识别，使用兜底锚点 " + pointText(fallback));
    return fallback;
}

function getAudienceAlignTargetY() {
    var titleY = runtime.cache.bookingTitleAnchorY || (runtime.cache.points && runtime.cache.points.bookingTitle && runtime.cache.points.bookingTitle.y);
    if (!titleY) titleY = scaleY(235);
    // 目标不是把“观众信息”压到标题文字上，而是停在标题栏下方的安全可见区。
    return Math.round(clamp(titleY + scaleY(190), scaleY(320), scaleY(520)));
}

function isPreparePeriodVisibleLayout() {
    return runtime.cache.prepareDetailLayoutMode === "period-visible";
}

function estimateRushAudienceTitleY(audienceTitle) {
    var insertedPeriodOffsetY = isPreparePeriodVisibleLayout() ? 0 : scaleY(420);
    if (audienceTitle) {
        return Math.round(audienceTitle.y + insertedPeriodOffsetY);
    }
    if (runtime.cache.audienceTitleRect && runtime.cache.audienceTitleRect.cy) {
        return Math.round(runtime.cache.audienceTitleRect.cy + insertedPeriodOffsetY);
    }
    if (isPreparePeriodVisibleLayout() && runtime.cache.points && runtime.cache.points.periodTitle) {
        return Math.round(runtime.cache.points.periodTitle.y + scaleY(560));
    }
    return scaleY(currentExhibitProfile().fallbackEstimatedAudienceTitleY);
}

function buildAudienceGestureScrollStrategy(audienceTitle) {
    var startX = Math.round(device.width * 0.5);
    var startY = Math.round(device.height * 0.78);

    // 1个观众时，目标改为"选择时段"文字Y，避免列表过短无法滑到顶部
    var targetY;
    var moveYMin;
    if (CONFIG.visitorCount === 1) {
        var periodTitle = runtime.cache.points && runtime.cache.points.periodTitle;
        if (periodTitle) {
            targetY = periodTitle.y;
            moveYMin = scaleY(300);
            logx("COORD", "1个观众模式：目标Y使用选择时段位置 " + targetY);
        }
    }
    if (!targetY) {
        targetY = getAudienceAlignTargetY();
        moveYMin = scaleY(900);
    }

    var estimatedAudienceY = estimateRushAudienceTitleY(audienceTitle);
    var moveY = Math.round(clamp(estimatedAudienceY - targetY, moveYMin, startY - scaleY(260)));
    var endY = Math.round(clamp(startY - moveY, scaleY(260), device.height - 1));

    setCacheValue("audienceAlignTargetY", targetY);
    setCacheValue("scrollStrategy", {
        name: "audienceAnchorGesture",
        type: "gesture",
        startX: startX,
        startY: startY,
        endX: startX,
        endY: endY,
        duration: CONFIG.visitorCount === 1 ? 80 : 100,
        estimatedAudienceY: estimatedAudienceY,
        targetY: targetY,
        moveY: moveY,
        source: audienceTitle ? "audience-title-anchor" : "fallback-anchor"
    });
    logx("COORD", "观众信息手势滚动策略 estimatedAudienceY=" + estimatedAudienceY + " targetY=" + targetY + " moveY=" + moveY + " startY=" + startY + " endY=" + endY + " visitorCount=" + CONFIG.visitorCount);
}

function setPeriodPointsFromTitle(titlePoint, source) {
    var y = titlePoint.y + scaleY(210);
    var morning = makePoint(device.width * 0.28, y, source + ":morning");
    var afternoon = makePoint(device.width * 0.72, y, source + ":afternoon");
    setCachedPoint("periodMorning", morning);
    setCachedPoint("periodAfternoon", afternoon);
    logx("COORD", "时段坐标推算 morning=" + pointText(morning) + " afternoon=" + pointText(afternoon) + "依据：选择时段标题下方左右两块区域中心");
}

function setPeriodPointsFromTimeRects(morningRect, afternoonRect, source) {
    var y;
    if (morningRect && afternoonRect) {
        y = Math.round((morningRect.cy + afternoonRect.cy) / 2);
    } else if (morningRect) {
        y = morningRect.cy;
    } else {
        y = afternoonRect.cy;
    }
    var morningX = morningRect ? morningRect.cx : device.width * 0.28;
    var afternoonX = afternoonRect ? afternoonRect.cx : device.width * 0.72;
    var morning = makePoint(morningX, y, source + ":morning");
    var afternoon = makePoint(afternoonX, y, source + ":afternoon");
    setCachedPoint("periodMorning", morning);
    setCachedPoint("periodAfternoon", afternoon);
    logx("COORD", "时段坐标按时段文本推算 morning=" + pointText(morning) + " afternoon=" + pointText(afternoon) + " morningRect=" + JSON.stringify(morningRect) + " afternoonRect=" + JSON.stringify(afternoonRect));
}

function setPeriodPointsFromAudienceRect(audienceRect, source) {
    // 未放票页没有“选择时段”。实测放票后小程序会在第一轮“观众信息”
    // 所在位置下方插入上午/下午区域，并把第二轮“观众信息”整体下移。
    // 因此这里故意以第一轮 audienceRect.bottom 向下推算时段点击区域。
    var titleHeight = Math.max(audienceRect.height || 0, scaleY(70));
    var areaHeight = Math.max(titleHeight * 2, scaleY(150));
    var top = Math.round(audienceRect.bottom);
    var bottom = Math.round(clamp(top + areaHeight, 1, device.height - 1));
    var y = Math.round((top + bottom) / 2);
    var morning = makePoint(device.width * 0.25, y, source + ":morning");
    var afternoon = makePoint(device.width * 0.75, y, source + ":afternoon");
    setCachedPoint("periodMorning", morning);
    setCachedPoint("periodAfternoon", afternoon);
    logx("COORD", "时段坐标按观众信息标题推算 audienceRect=" + JSON.stringify(audienceRect) + " morning=" + pointText(morning) + " afternoon=" + pointText(afternoon) + " regionTop=" + top + " regionBottom=" + bottom);
}

function collectVisitorPoints(audienceTitle) {
    var existing = runtime.cache.visitorPrepPoints;
    if (!(CONFIG.preferRealtimeInPrepare && STAGE === "PREP") && CONFIG.useCache && runtime.cache.__screenMatched && existing && existing.length >= CONFIG.visitorCount) {
        logx("CACHE", "visitorPrepPoints 命中 count=" + existing.length);
        return existing;
    }

    var startY;
    if (audienceTitle) {
        startY = audienceTitle.y + scaleY(360);
    } else {
        startY = scaleY(currentExhibitProfile().fallbackVisitorStartY);
        logx("COORD", "观众信息标题未识别，游客坐标使用展馆截图比例推算起点 exhibit=" + currentExhibitProfile().id);
    }
    var points = [];
    var gap = scaleY(365);
    for (var i = 0; i < 5; i++) {
        points.push(makePoint(scaleX(190), startY + i * gap, "infer:visitorList:" + (i + 1)));
    }
    runtime.cache.visitorPrepPoints = points;
    runtime.freshVisitorPoints = true;
    logx("CACHE", "visitorPrepPoints 写入 " + JSON.stringify(points));

    // 1观众时使用选择时段位置作为基准，多观众时使用屏幕顶部安全区
    var rushBaseY;
    if (CONFIG.visitorCount === 1) {
        var periodTitle = runtime.cache.points && runtime.cache.points.periodTitle;
        if (periodTitle) {
            rushBaseY = periodTitle.y;
        }
    }
    if (!rushBaseY) {
        rushBaseY = getAudienceAlignTargetY();
    }
    var rushPoints = inferRushVisitorPoints(makePoint(device.width * 0.5, rushBaseY, "target:audienceAfterGesture"));
    runtime.cache.visitorRushPoints = rushPoints;
    logx("CACHE", "visitorRushPoints 写入 " + JSON.stringify(rushPoints));
    return points;
}

function inferRushVisitorPoints(audienceTitle) {
    var firstY;
    if (audienceTitle) {
        firstY = audienceTitle.y + scaleY(390);
    } else {
        firstY = scaleY(830);
    }
    var gap = scaleY(365);
    var points = [];
    for (var i = 0; i < 5; i++) {
        // 点击卡片中部比只点左侧空心圆容错更高，参考脚本已验证 x=700 可用。
        points.push(makePoint(scaleX(700), firstY + i * gap, "infer:rushVisitorPostScroll:" + (i + 1)));
    }
    return points;
}

function getPeriodPoint() {
    var key = CONFIG.period === "下午" ? "periodAfternoon" : "periodMorning";
    var p = getCachedPoint(key);
    if (p) return p;

    var title = findPointByText("选择时段标题", "选择时段", [0, scaleY(1200), device.width, scaleY(1100)], "top");
    if (title) {
        setPeriodPointsFromTitle(title, "ocr");
        return getCachedPoint(key) || runtime.cache.points[key];
    }
    var profile = currentExhibitProfile();
    var periodFallback = CONFIG.period === "下午" ? profile.fallbackPeriodAfternoon : profile.fallbackPeriodMorning;
    var fallback = scaledPoint(CONFIG.period === "下午" ? "periodAfternoon" : "periodMorning", periodFallback.x, periodFallback.y);
    setCachedPoint(key, fallback);
    return fallback;
}

function getVisitorPointsForRush() {
    if (runtime.cache.visitorRushPoints && runtime.cache.visitorRushPoints.length >= CONFIG.visitorCount && (runtime.cache.__screenMatched || runtime.freshVisitorPoints)) {
        logx("CACHE", "visitorRushPoints 命中 count=" + runtime.cache.visitorRushPoints.length);
        return runtime.cache.visitorRushPoints;
    }
    var title = findPointByText("观众信息标题", "观众信息", [0, scaleY(250), device.width, scaleY(900)], "top");
    var points = inferRushVisitorPoints(title);
    runtime.cache.visitorRushPoints = points;
    runtime.freshVisitorPoints = true;
    logx("CACHE", "visitorRushPoints 实时推算写入 " + JSON.stringify(points));
    return points;
}

function scrollToAudienceForRush() {
    var scrollStrategy = runtime.cache.scrollStrategy || {
        name: "audienceAnchorGestureFallback",
        type: "gesture",
        startX: Math.round(device.width * 0.5),
        startY: Math.round(device.height * 0.78),
        endX: Math.round(device.width * 0.5),
        endY: Math.round(device.height * 0.18),
        duration: 240,
        source: "default-screen-ratio"
    };

    if (scrollStrategy.type === "gesture") {
        gestureLogged("滑动到观众信息", scrollStrategy.startX, scrollStrategy.startY, scrollStrategy.endX, scrollStrategy.endY, scrollStrategy.duration);
    } else {
        swipeLogged("滑动到观众信息", scrollStrategy.startX, scrollStrategy.startY, scrollStrategy.endX, scrollStrategy.endY, scrollStrategy.duration);
    }
}

function makeGestureScrollStep(name, startX, startY, endX, endY, duration, source) {
    return {
        name: name,
        type: "gesture",
        startX: Math.round(startX),
        startY: Math.round(startY),
        endX: Math.round(endX),
        endY: Math.round(endY),
        duration: duration,
        source: source || "computed"
    };
}

function runScrollStep(label, step) {
    if (!step) return;
    if (step.type === "swipe") {
        swipeLogged(label + "-" + (step.name || "swipe"), step.startX, step.startY, step.endX, step.endY, step.duration);
    } else {
        gestureLogged(label + "-" + (step.name || "gesture"), step.startX, step.startY, step.endX, step.endY, step.duration);
    }
}

function runScrollStrategy(label, strategy) {
    if (!strategy) return;
    if (strategy.steps && strategy.steps.length) {
        for (var i = 0; i < strategy.steps.length; i++) {
            runScrollStep(label, strategy.steps[i]);
            sleep(80);
        }
        return;
    }
    runScrollStep(label, strategy);
}

function parentTitleAlignMinEndY() {
    return scaleY(180);
}

function buildTitleAlignStep(titlePoint, name, source) {
    if (!titlePoint) return null;
    var targetY = getAudienceAlignTargetY();
    var deltaY = Math.round(titlePoint.y - targetY);
    var startX = Math.round(device.width * 0.5);
    var startY = Math.round(device.height * 0.78);
    if (Math.abs(deltaY) <= scaleY(35)) {
        return makeGestureScrollStep(name + "Noop", startX, startY, startX, startY, 1, source || "already-aligned");
    }
    var endY = Math.round(clamp(startY - deltaY, parentTitleAlignMinEndY(), device.height - scaleY(180)));
    return makeGestureScrollStep(name, startX, startY, startX, endY, 180, source || "title-anchor");
}

function alignTitleToTopForPrepare(titlePoint, name, source) {
    var step = buildTitleAlignStep(titlePoint, name, source);
    if (!step) return null;
    if (step.duration > 1) {
        runScrollStep("第一轮标题拖顶", step);
        sleep(700);
    }
    return step;
}

function findAllTextItems(items, keywords) {
    var matched = [];
    for (var i = 0; i < items.length; i++) {
        if (fuzzyContains(items[i].text, keywords)) matched.push(items[i]);
    }
    matched.sort(function(a, b) {
        return itemRect(a).cy - itemRect(b).cy;
    });
    return matched;
}

function collectPersonCardPointsFromCredentialRows(sectionName, requiredCount) {
    var points = collectVisibleCredentialRowPoints(sectionName);
    if (points.length < requiredCount) {
        logx("WARN", sectionName + "证件类型行数量不足 required=" + requiredCount + " actual=" + points.length + "，将按已识别行距补足");
        var gap = scaleY(365);
        var nextY = points.length > 0 ? points[points.length - 1].y + gap : getAudienceAlignTargetY() + scaleY(520);
        while (points.length < requiredCount && points.length < 5) {
            points.push(makePoint(scaleX(700), nextY, "infer:" + sectionName + "CredentialRowFallback:" + (points.length + 1)));
            nextY += gap;
        }
    }
    return points;
}

function visiblePersonAreaRegion() {
    var top = scaleY(250);
    var bottomReserved = scaleY(260);
    return [0, top, device.width, Math.max(scaleY(900), device.height - top - bottomReserved)];
}

function collectVisibleCredentialRowPoints(sectionName) {
    var items = ocrRegion(STAGE, "采集" + sectionName + "证件类型行", visiblePersonAreaRegion());
    var rows = findAllTextItems(items, "证件类型");
    var points = [];
    for (var i = 0; i < rows.length && points.length < 5; i++) {
        var r = itemRect(rows[i]);
        if (r.cy < scaleY(320) || r.cy > device.height - scaleY(260)) continue;
        points.push(makePoint(scaleX(700), r.cy, "ocr:" + sectionName + "CredentialRow:" + (points.length + 1)));
        logx("COORD", sectionName + "证件类型行 text=" + rows[i].text + " rect=" + JSON.stringify(simpleRectFromItem(rows[i])) + " clickY=" + r.cy);
    }
    return points;
}

function assertCurrentParentSection(sectionName) {
    var items = ocrRegion(STAGE, "确认当前亲子人员区-" + sectionName, [0, scaleY(250), device.width, Math.floor(device.height * 0.48)]);
    var adult = findTextItem(items, "成人信息", "top");
    var minor = findTextItem(items, "未成年人信息", "top");
    if (sectionName === "adult" && minor) {
        logx("WARN", "当前页面已到未成年人信息区，不能采集 adult 点，疑似成年人标题拖顶过量");
        return false;
    }
    if (sectionName === "adult" && !adult) {
        logx("WARN", "当前页面未确认成年人信息标题，adult 点采集风险高");
    }
    if (sectionName === "minor" && !minor) {
        logx("WARN", "当前页面未确认未成年人信息标题，minor 点采集风险高");
        return false;
    }
    return true;
}

function buildParentAdultRushScrollStrategy(adultTitle) {
    var startX = Math.round(device.width * 0.5);
    var startY = Math.round(device.height * 0.78);
    var targetY = getAudienceAlignTargetY();
    var insertedPeriodOffsetY = isPreparePeriodVisibleLayout() ? 0 : scaleY(420);
    var estimatedAdultY;
    var source;
    if (adultTitle) {
        estimatedAdultY = Math.round(adultTitle.y + insertedPeriodOffsetY);
        source = insertedPeriodOffsetY > 0 ? "adult-title-anchor-period-inserted" : "adult-title-anchor";
    } else if (runtime.cache.adultTitleRect && runtime.cache.adultTitleRect.cy) {
        estimatedAdultY = Math.round(runtime.cache.adultTitleRect.cy + insertedPeriodOffsetY);
        source = insertedPeriodOffsetY > 0 ? "adult-title-rect-period-inserted" : "adult-title-rect";
    } else {
        estimatedAdultY = scaleY(currentExhibitProfile().fallbackEstimatedAudienceTitleY);
        source = "fallback-anchor";
    }
    var moveY = Math.max(0, Math.round(estimatedAdultY - targetY));
    var endY = Math.round(clamp(startY - moveY, parentTitleAlignMinEndY(), device.height - scaleY(180)));
    return {
        name: "adultAnchorGesture",
        type: "gesture",
        startX: startX,
        startY: startY,
        endX: startX,
        endY: endY,
        duration: 180,
        estimatedAdultY: estimatedAdultY,
        targetY: targetY,
        moveY: moveY,
        insertedPeriodOffsetY: insertedPeriodOffsetY,
        prepareDetailLayoutMode: runtime.cache.prepareDetailLayoutMode,
        source: source
    };
}

function buildParentMinorRushScrollStrategy(minorTitle, source) {
    var step = buildTitleAlignStep(minorTitle, "minorAnchorGesture", source || (minorTitle && minorTitle.source) || "minor-title-anchor");
    if (!step) return null;
    if (step.duration > 1) step.duration = 260;
    step.estimatedMinorY = minorTitle ? Math.round(minorTitle.y) : null;
    step.targetY = getAudienceAlignTargetY();
    step.moveY = minorTitle ? Math.max(0, Math.round(minorTitle.y - step.targetY)) : null;
    return step;
}

function estimateMinorTitleAfterAdultTop() {
    var adultPoints = runtime.cache.adultRushPoints || runtime.cache.adultPrepPoints || [];
    var lastAdult = adultPoints.length > 0 ? adultPoints[Math.min(CONFIG.visitorCount, adultPoints.length) - 1] : null;
    var estimatedY = lastAdult ? lastAdult.y + scaleY(435) : getAudienceAlignTargetY() + scaleY(1500);
    var title = makePoint(scaleX(300), estimatedY, "infer:minorTitleFromAdultRows:" + CONFIG.visitorCount);
    setCachedPoint("minorTitle", title);
    setCacheValue("minorTitleRect", {
        left: title.x - scaleX(220),
        top: title.y - scaleY(35),
        right: title.x + scaleX(220),
        bottom: title.y + scaleY(35),
        width: scaleX(440),
        height: scaleY(70),
        cx: title.x,
        cy: title.y
    });
    logx("COORD", "成年人拖顶后未成年人信息标题估算 " + pointText(title) + (lastAdult ? " basisLastAdultY=" + lastAdult.y : " basis=fallback"));
    return title;
}

function collectAdultSectionPointsForPrepare(adultTitle) {
    setCacheValue("adultScrollStrategy", buildParentAdultRushScrollStrategy(adultTitle));
    alignTitleToTopForPrepare(adultTitle, "adultTitleAlign", "prep-adult-title");
    if (!assertCurrentParentSection("adult")) {
        fail("成年人信息拖顶后已进入未成年人区，停止写入错误成人缓存");
    }

    var visiblePoints = collectVisibleCredentialRowPoints("parentVisibleAfterAdult");
    var adultPoints = visiblePoints.slice(0, CONFIG.visitorCount);
    if (adultPoints.length < CONFIG.visitorCount) {
        logx("WARN", "成人区可见证件类型行不足，将补足 adult 点 required=" + CONFIG.visitorCount + " actual=" + adultPoints.length);
        adultPoints = collectPersonCardPointsFromCredentialRows("adult", CONFIG.visitorCount).slice(0, CONFIG.visitorCount);
    }
    runtime.cache.adultPrepPoints = adultPoints;
    runtime.cache.adultRushPoints = adultPoints;
    runtime.freshVisitorPoints = true;
    logx("CACHE", "adultPrepPoints 写入 " + JSON.stringify(adultPoints));
    logx("CACHE", "adultRushPoints 写入 " + JSON.stringify(adultPoints));

    var totalNeeded = CONFIG.visitorCount + CONFIG.minorVisitorCount;
    if (visiblePoints.length >= totalNeeded) {
        var minorPoints = visiblePoints.slice(CONFIG.visitorCount, totalNeeded);
        runtime.cache.minorPrepPoints = minorPoints;
        runtime.cache.minorRushPoints = minorPoints;
        setCacheValue("minorScrollStrategy", {
            name: "minorAlreadyVisibleAfterAdult",
            type: "gesture",
            startX: Math.round(device.width * 0.5),
            startY: Math.round(device.height * 0.78),
            endX: Math.round(device.width * 0.5),
            endY: Math.round(device.height * 0.78),
            duration: 1,
            source: "visible-after-adult"
        });
        setCacheValue("minorAlreadyCollectedAfterAdult", true);
        logx("CACHE", "成年人拖顶后已采够成人+未成年人，跳过未成年人第二次拖动 totalVisible=" + visiblePoints.length + " totalNeeded=" + totalNeeded);
        logx("CACHE", "minorPrepPoints 写入 " + JSON.stringify(minorPoints));
        logx("CACHE", "minorRushPoints 写入 " + JSON.stringify(minorPoints));
    } else {
        setCacheValue("minorAlreadyCollectedAfterAdult", false);
        logx("CACHE", "成年人拖顶后未采够全部亲子观众，后续继续拖动未成年人区 totalVisible=" + visiblePoints.length + " totalNeeded=" + totalNeeded);
    }
    return adultPoints;
}

function collectParentAudienceAndPeriodPoints() {
    collectBookingTitleAnchor();

    var detailRegionTop = scaleY(850);
    var detailRegionBottom = Math.floor(device.height * 0.9);
    var detailItems = ocrRegion(STAGE, "查找 选择时段与成人信息标题", [0, detailRegionTop, device.width, detailRegionBottom - detailRegionTop]);
    var periodItem = findTextItem(detailItems, "选择时段", "top");
    var morningTimeItem = findTextItem(detailItems, "08:30-12:30", "left");
    var afternoonTimeItem = findTextItem(detailItems, "12:30-16:30", "right");
    var adultItem = findTextItem(detailItems, "成人信息", "top");
    var periodTitle = null;
    var adultTitle = null;
    var adultRect = null;
    var morningTimeRect = null;
    var afternoonTimeRect = null;

    if (periodItem) {
        periodTitle = centerOfBounds(periodItem.bounds, "ocr:选择时段标题");
        setCachedPoint("periodTitle", periodTitle);
        setCacheValue("periodTitleRect", simpleRectFromItem(periodItem));
        logx("OCR", "亲子选择时段标题 匹配 text=" + periodItem.text + " " + pointText(periodTitle));
    }
    if (morningTimeItem) morningTimeRect = simpleRectFromItem(morningTimeItem);
    if (afternoonTimeItem) afternoonTimeRect = simpleRectFromItem(afternoonTimeItem);
    if (adultItem) {
        adultTitle = centerOfBounds(adultItem.bounds, "ocr:成人信息标题");
        adultRect = simpleRectFromItem(adultItem);
        setCachedPoint("adultTitle", adultTitle);
        setCacheValue("adultTitleRect", adultRect);
        logx("OCR", "成人信息标题 匹配 text=" + adultItem.text + " " + pointText(adultTitle) + " rect=" + JSON.stringify(adultRect));
    } else {
        logx("OCR", "成人信息标题 未匹配");
    }

    if (periodTitle || morningTimeRect || afternoonTimeRect) {
        setCacheValue("prepareDetailLayoutMode", "period-visible");
        if (periodTitle) {
            setPeriodPointsFromTitle(periodTitle, "ocr-prep-parent-period-visible");
        } else {
            setPeriodPointsFromTimeRects(morningTimeRect, afternoonTimeRect, "ocr-prep-parent-period-time-visible");
        }
    } else if (adultRect) {
        setCacheValue("prepareDetailLayoutMode", "period-hidden");
        setPeriodPointsFromAudienceRect(adultRect, "infer-parent-from-adult-title");
    } else {
        setCacheValue("prepareDetailLayoutMode", "fallback-period-title");
        var profile = currentExhibitProfile();
        var inferredTitle = makePoint(scaleX(220), scaleY(profile.fallbackPeriodTitleY), "infer:parentPeriodTitleFromOpenedLayout:" + profile.id);
        setCachedPoint("periodTitle", inferredTitle);
        setPeriodPointsFromTitle(inferredTitle, "infer-parent-from-screenshot-layout");
    }

    collectAdultSectionPointsForPrepare(adultTitle);
    if (runtime.cache.minorAlreadyCollectedAfterAdult === true) {
        logx("FLOW", "未成年人点已在成年人拖顶后采集完成，跳过未成年人区拖动采集");
    } else {
        collectMinorVisitorPointsForPrepare();
    }
    getConfirmButtonPoint();
}

function collectAdultVisitorPoints(adultTitle) {
    var existing = runtime.cache.adultPrepPoints;
    if (!(CONFIG.preferRealtimeInPrepare && STAGE === "PREP") && CONFIG.useCache && runtime.cache.__screenMatched && existing && existing.length >= CONFIG.visitorCount) {
        logx("CACHE", "adultPrepPoints 命中 count=" + existing.length);
        return existing;
    }

    var startY = adultTitle ? adultTitle.y + scaleY(420) : scaleY(currentExhibitProfile().fallbackVisitorStartY);
    var points = [];
    var gap = scaleY(365);
    for (var i = 0; i < 5; i++) {
        points.push(makePoint(scaleX(190), startY + i * gap, "infer:adultList:" + (i + 1)));
    }
    runtime.cache.adultPrepPoints = points;
    runtime.freshVisitorPoints = true;
    logx("CACHE", "adultPrepPoints 写入 " + JSON.stringify(points));

    var targetY = getAudienceAlignTargetY();
    var rushPoints = inferAdultRushPoints(makePoint(device.width * 0.5, targetY, "target:adultAfterGesture"));
    runtime.cache.adultRushPoints = rushPoints;
    logx("CACHE", "adultRushPoints 写入 " + JSON.stringify(rushPoints));
    return points;
}

function inferAdultRushPoints(adultTitle) {
    var firstY = adultTitle ? adultTitle.y + scaleY(420) : scaleY(830);
    var gap = scaleY(365);
    var points = [];
    for (var i = 0; i < 5; i++) {
        points.push(makePoint(scaleX(190), firstY + i * gap, "infer:rushAdultPostScroll:" + (i + 1)));
    }
    return points;
}

function buildAdultGestureScrollStrategy(adultTitle) {
    var startX = Math.round(device.width * 0.5);
    var startY = Math.round(device.height * 0.78);
    var targetY = getAudienceAlignTargetY();
    var estimatedAdultY = adultTitle ? Math.round(adultTitle.y) : scaleY(currentExhibitProfile().fallbackEstimatedAudienceTitleY);
    var moveY = Math.round(clamp(estimatedAdultY - targetY, scaleY(650), startY - scaleY(260)));
    var endY = Math.round(clamp(startY - moveY, scaleY(260), device.height - 1));
    setCacheValue("adultScrollStrategy", {
        name: "adultAnchorGesture",
        type: "gesture",
        startX: startX,
        startY: startY,
        endX: startX,
        endY: endY,
        duration: 100,
        estimatedAdultY: estimatedAdultY,
        targetY: targetY,
        moveY: moveY,
        source: adultTitle ? "adult-title-anchor" : "fallback-anchor"
    });
    buildMinorGestureScrollStrategy(targetY);
}

function buildMinorGestureScrollStrategy(adultTargetY) {
    var startX = Math.round(device.width * 0.5);
    var startY = Math.round(device.height * 0.78);
    var adultExtra = Math.max(0, CONFIG.visitorCount - 1) * scaleY(365);
    var moveY = Math.round(clamp(scaleY(520) + adultExtra, scaleY(420), startY - scaleY(260)));
    var endY = Math.round(clamp(startY - moveY, scaleY(260), device.height - 1));
    setCacheValue("minorScrollStrategy", {
        name: "minorAnchorGesture",
        type: "gesture",
        startX: startX,
        startY: startY,
        endX: startX,
        endY: endY,
        duration: 120,
        adultTargetY: adultTargetY,
        moveY: moveY,
        source: "adult-count-estimate"
    });
}

function findMinorTitleOnCurrentPage(label) {
    var items = ocrRegion(STAGE, label, visiblePersonAreaRegion());
    var item = findTextItem(items, "未成年人信息", "top");
    if (!item) return null;
    var title = centerOfBounds(item.bounds, "ocr:未成年人信息标题");
    setCachedPoint("minorTitle", title);
    setCacheValue("minorTitleRect", simpleRectFromItem(item));
    logx("OCR", "未成年人信息标题 匹配 text=" + item.text + " " + pointText(title));
    return title;
}

function collectMinorVisitorPointsForPrepare() {
    var title = findMinorTitleOnCurrentPage("查找未成年人信息标题-成人拖顶后");
    if (!title) title = estimateMinorTitleAfterAdultTop();

    var strategy = buildParentMinorRushScrollStrategy(title, title.source.indexOf("infer:") === 0 ? "minor-title-estimated-after-adult" : "minor-title-visible-after-adult");
    setCacheValue("minorScrollStrategy", strategy);
    if (strategy && strategy.duration > 1) {
        runScrollStep("第一轮标题拖顶", strategy);
        sleep(700);
    }

    if (!assertCurrentParentSection("minor")) {
        fail("未成年人信息拖顶后未确认进入未成年人区，停止写入错误未成年人缓存");
    }
    var prepPoints = collectPersonCardPointsFromCredentialRows("minor", CONFIG.minorVisitorCount);
    runtime.cache.minorPrepPoints = prepPoints;
    runtime.cache.minorRushPoints = prepPoints;
    runtime.freshVisitorPoints = true;
    logx("CACHE", "minorPrepPoints 写入 " + JSON.stringify(prepPoints));
    logx("CACHE", "minorRushPoints 写入 " + JSON.stringify(runtime.cache.minorRushPoints));
    return prepPoints;
}

function inferMinorRushPoints(minorTitle) {
    var firstY = minorTitle ? minorTitle.y + scaleY(300) : scaleY(760);
    var gap = scaleY(365);
    var points = [];
    for (var i = 0; i < 5; i++) {
        points.push(makePoint(scaleX(190), firstY + i * gap, "infer:rushMinorPostScroll:" + (i + 1)));
    }
    return points;
}

function scrollToAdultForRush() {
    var strategy = runtime.cache.adultScrollStrategy || runtime.cache.scrollStrategy || {
        name: "adultAnchorGestureFallback",
        type: "gesture",
        startX: Math.round(device.width * 0.5),
        startY: Math.round(device.height * 0.78),
        endX: Math.round(device.width * 0.5),
        endY: Math.round(device.height * 0.22),
        duration: 180,
        source: "default-screen-ratio"
    };
    runScrollStrategy("滑动到成年人信息", strategy);
    return strategy;
}

function scrollToMinorForRush() {
    var strategy = runtime.cache.minorScrollStrategy || {
        name: "minorAnchorGestureFallback",
        type: "gesture",
        startX: Math.round(device.width * 0.5),
        startY: Math.round(device.height * 0.78),
        endX: Math.round(device.width * 0.5),
        endY: Math.round(device.height * 0.28),
        duration: 180,
        source: "default-screen-ratio"
    };
    runScrollStrategy("滑动到未成年人信息", strategy);
    return strategy;
}

function getAdultPointsForRush() {
    if (runtime.cache.adultRushPoints && runtime.cache.adultRushPoints.length >= CONFIG.visitorCount && (runtime.cache.__screenMatched || runtime.freshVisitorPoints)) {
        logx("CACHE", "adultRushPoints 命中 count=" + runtime.cache.adultRushPoints.length);
        return runtime.cache.adultRushPoints;
    }
    var points = collectPersonCardPointsFromCredentialRows("adult-rush", CONFIG.visitorCount);
    runtime.cache.adultRushPoints = points;
    runtime.freshVisitorPoints = true;
    logx("CACHE", "adultRushPoints 实时OCR写入 " + JSON.stringify(points));
    return points;
}

function getMinorPointsForRush() {
    if (runtime.cache.minorRushPoints && runtime.cache.minorRushPoints.length >= CONFIG.minorVisitorCount && (runtime.cache.__screenMatched || runtime.freshVisitorPoints)) {
        logx("CACHE", "minorRushPoints 命中 count=" + runtime.cache.minorRushPoints.length);
        return runtime.cache.minorRushPoints;
    }
    var points = collectPersonCardPointsFromCredentialRows("minor-rush", CONFIG.minorVisitorCount);
    runtime.cache.minorRushPoints = points;
    runtime.freshVisitorPoints = true;
    logx("CACHE", "minorRushPoints 实时OCR写入 " + JSON.stringify(points));
    return points;
}

// ==================== 页面识别与流程动作 ====================
function launchMiniProgram() {
    STAGE = "PREP";
    logx("NAV", "回到桌面");
    home();
    sleep(1200);

    var found = false;
    // 提取短名字作为 OCR 备用关键词，防止桌面名字被截断
    var k1 = CONFIG.appShortcutName.substring(0, 3); // "侵华日"
    var k2 = CONFIG.appShortcutName.substring(0, 4); // "侵华日军"
    var searchKeywords = [k2, k1, "侵华", "日军", "南京"];
    
    // 【终极防崩溃核心】：读取设备真实的安卓 API 版本号
    // Android 11 的 API 级别为 30。低于 30 的设备直接禁用无障碍，彻底避开致命崩溃！
    var disableAccessibility = (device.sdkInt < 30);
    
    if (disableAccessibility) {
        logx("NAV", "检测到低版本系统(API " + device.sdkInt + ")，为防底层崩溃，已前置禁用无障碍控件查找，使用纯OCR模式。");
    }

    for (var i = 0; i < 4; i++) {
        var targetPoint = null;
        var matchedMethod = "";
        var matchedText = "";

        // ================= 方案 A：高版本设备优先尝试原生无障碍 =================
        if (!disableAccessibility) {
            try {
                var icon = text(CONFIG.appShortcutName).findOne(600);
                if (icon) {
                    var b = icon.bounds();
                    if (b.centerX() > 0 && b.centerY() > 0 && b.centerX() < device.width && b.centerY() < device.height) {
                        targetPoint = makePoint(b.centerX(), b.centerY(), "accessibility:desktopShortcut");
                        matchedMethod = "无障碍控件";
                        matchedText = CONFIG.appShortcutName;
                    }
                }
            } catch (e) {
                // 以防万一的兜底
                logx("NAV", "无障碍查找发生常规异常，err=" + e);
                disableAccessibility = true; 
            }
        }

        // ================= 方案 B：低版本设备或 A 失败时，执行 OCR 兜底 =================
        if (!targetPoint) {
            var items = ocrRegion(STAGE, "查找桌面快捷方式(OCR兜底)", null);
            var iconItem = findTextItem(items, searchKeywords, "top");
            if (iconItem) {
                var b2 = iconItem.bounds;
                if (b2.centerX() > 0 && b2.centerY() > 0 && b2.centerX() < device.width && b2.centerY() < device.height) {
                    targetPoint = makePoint(b2.centerX(), Math.max(1, b2.centerY() - scaleY(80)), "ocr:desktopShortcut");
                    matchedMethod = "OCR文字识别";
                    matchedText = iconItem.text;
                }
            }
        }

        // ================= 执行点击 =================
        if (targetPoint) {
            logx("NAV", "成功找到桌面快捷方式 [" + matchedMethod + "] text=" + matchedText + " " + pointText(targetPoint));
            pressPoint("桌面快捷方式", targetPoint, CONFIG.pressDuration);
            found = true;
            break;
        }

        // 如果都没找到，向左翻页继续找
        logx("NAV", "本页未找到桌面快捷方式，向左翻页 i=" + i);
        swipeLogged("桌面翻页", device.width * 0.82, device.height * 0.5, device.width * 0.18, device.height * 0.5, 450);
        sleep(800);
    }
    
    if (!found) fail("未找到桌面快捷方式：" + CONFIG.appShortcutName);
    sleep(1500);
}

function detectNoticeDialogOnce(label) {
    var items = ocrRegion(STAGE, label, null);
    var titleItem = findTextItem(items, "预约须知", "top");
    var readItem = findTextItem(items, ["我已阅", "我已阅读并同意", "阅读并同意"], "bottom");
    var knownItem = findTextItem(items, ["我已知晓", "已知晓", "知晓"], "bottom");
    return {
        found: !!(titleItem || readItem || knownItem),
        titleItem: titleItem,
        readItem: readItem,
        knownItem: knownItem
    };
}

function handleStartupNoticeDialog() {
    logx("PAGE", "冷启动后等待10秒再检测预约须知");
    sleep(10000);

    var dialog = detectNoticeDialogOnce("冷启动首次检查预约须知");
    if (!dialog.found) {
        logx("PAGE", "冷启动首次未检测到预约须知，等待3秒后复检");
        sleep(3000);
        dialog = detectNoticeDialogOnce("冷启动第二次检查预约须知");
    }

    if (!dialog.found) {
        // 业务约束：本脚本按“每次冷启动必出现预约须知”设计。
        // 如果启动后两次检测都未发现须知，说明当前冷启动状态不符合
        // 抢票前置条件，故意返回桌面并终止，避免继续采集错误坐标。
        logx("ERROR", "冷启动两次未检测到预约须知，返回桌面并结束流程");
        notifyUser("启动后未检测到预约须知，已返回桌面并结束流程", CONFIG.finalToastHoldMs);
        home();
        throw new Error("启动后两次未检测到预约须知");
    }

    notifyUser("检测到预约须知，正在处理");
    clickNoticeAgree(dialog.readItem);
    logx("PAGE", "预约须知已勾选，等待5秒后点击我已知晓");
    sleep(5000);

    var readyDialog = detectNoticeDialogOnce("冷启动等待5秒后查找我已知晓");
    if (!clickStartupNoticeKnownAndConfirmClosed(readyDialog.knownItem)) {
        logx("ERROR", "冷启动预约须知已勾选，但未能关闭弹窗，返回桌面并结束流程");
        home();
        finalNotifyUser("预约须知未能关闭，已返回桌面并结束流程");
        throw new Error("预约须知未能关闭");
    }
}

function clickStartupNoticeKnownAndConfirmClosed(knownItem) {
    if (knownItem) {
        pressPoint("预约须知-我已知晓-冷启动OCR中心", centerOfBounds(knownItem.bounds, "ocr:startupNoticeKnown"), CONFIG.noticePressDuration);
        if (waitNoticeGone(1800)) return true;
    } else {
        logx("PAGE", "冷启动固定等待后未识别到我已知晓，使用候选坐标重试");
    }

    var points = getNoticeKnownButtonCandidates();
    for (var i = 0; i < points.length; i++) {
        pressPoint("预约须知-我已知晓-冷启动候选" + (i + 1), points[i], CONFIG.noticePressDuration);
        if (waitNoticeGone(1800)) return true;
    }
    return false;
}

function clickNoticeAgree(readItem) {
    var p;
    if (readItem) {
        p = centerOfBounds(readItem.bounds, "ocr:noticeAgreeTextCenter");
        logx("PAGE", "按参考脚本点击“我已阅”OCR文本中心 text=" + readItem.text + " " + pointText(p));
    } else {
        p = getNoticeAgreePoint();
        logx("PAGE", "预约须知已出现，但未识别到勾选文字，使用兜底勾选坐标 " + pointText(p));
    }
    pressPoint("预约须知-我已阅读并同意", p, CONFIG.noticePressDuration);
}

function getNoticeAgreePoint() {
    return makePoint(scaleX(250), scaleY(2090), "fallback:noticeAgreeCheckbox");
}

function getNoticeKnownButtonPoint() {
    return makePoint(scaleX(720), scaleY(2385), "fallback:noticeKnownButton");
}

function getNoticeKnownButtonCandidates() {
    return [
        makePoint(device.width * 0.5, device.height * 0.88, "fallback:noticeKnownButton:lower"),
        makePoint(device.width * 0.5, device.height * 0.92, "fallback:noticeKnownButton:bottom"),
        getNoticeKnownButtonPoint(),
        makePoint(device.width * 0.5, device.height * 0.82, "fallback:noticeKnownButton:midLower")
    ];
}

function waitNoticeGone(timeoutMs) {
    var start = Date.now();
    while (Date.now() - start < timeoutMs) {
        var items = ocrRegion(STAGE, "确认预约须知是否消失", null);
        var titleItem = findTextItem(items, "预约须知", "top");
        var readItem = findTextItem(items, ["我已阅", "我已阅读并同意", "阅读并同意"], "bottom");
        var knownItem = findTextItem(items, ["我已知晓", "已知晓", "知晓"], "bottom");
        if (!titleItem && !readItem && !knownItem) {
            logx("PAGE", "预约须知弹窗已消失 cost=" + (Date.now() - start) + "ms");
            return true;
        }
        sleep(250);
    }
    logx("PAGE", "预约须知弹窗仍存在 cost=" + (Date.now() - start) + "ms");
    return false;
}

function enterHomeExhibitionPage() {
    var profile = currentExhibitProfile();
    for (var attempt = 1; attempt <= 3; attempt++) {
        logx("PAGE", "进入展馆尝试 exhibit=" + profile.shortName + " cardIndex=" + (profile.homeCardIndex + 1) + " attempt=" + attempt);
        var p = getHomeExhibitPoint();
        if (!p) {
            logx("PAGE", "未获得展馆入口坐标 exhibit=" + profile.shortName);
            return false;
        }
        pressPoint("首页-" + profile.shortName + "入口", p, CONFIG.pressDuration);
        var ok = waitForText("参观预约-普通预约", ["普通预约", "亲子预约", "优待预约"], [0, scaleY(600), device.width, scaleY(1700)], 6000);
        if (ok) return true;
        logx("PAGE", "点击首页入口后未确认展馆页 attempt=" + attempt);
    }
    return false;
}

function handleLoginIfNeeded() {
    var items = ocrRegion(STAGE, "检查登录页", [0, scaleY(500), device.width, scaleY(1900)]);
    var loginItem = findTextItem(items, ["用户确认登录", "确认登录"], "top");
    var readItem = findTextItem(items, ["阅读并同意", "阅读"], "bottom");
    if (!loginItem && !readItem) {
        logx("LOGIN", "未发现登录页");
        return false;
    }

    logx("LOGIN", "发现登录页，执行授权登录分支");
    if (readItem) {
        var r = itemRect(readItem);
        var agreePoint = makePoint(Math.max(scaleX(125), r.left + scaleX(20)), r.cy, "ocr:loginReadAgree");
        pressPoint("登录-阅读同意", agreePoint, CONFIG.pressDuration);
        sleep(250);
    }
    if (!loginItem) {
        loginItem = findTextItem(ocrRegion(STAGE, "刷新查找用户确认登录", [0, scaleY(900), device.width, scaleY(900)]), ["用户确认登录", "确认登录"], "top");
    }
    if (loginItem) {
        pressPoint("登录-用户确认登录", centerOfBounds(loginItem.bounds, "ocr:loginConfirm"), CONFIG.pressDuration);
        sleep(1500);
    }
    return true;
}

function waitForBookingPageOnly(timeoutMs) {
    var start = Date.now();
    while (Date.now() - start < timeoutMs) {
        var datePoint = findPointByText("预约页-参观日期", ["参观日期", "叁观日期", "弎观日期", "觀日期", "观日期"], [0, scaleY(500), device.width, scaleY(900)], "top");
        if (datePoint) {
            logx("PAGE", "已确认进入预约页 cost=" + (Date.now() - start) + "ms");
            return true;
        }
        sleep(CONFIG.pageWaitInterval);
    }
    logx("PAGE", "等待" + currentBookingTypeName() + "详情页超时 cost=" + (Date.now() - start) + "ms");
    return false;
}

function reenterBookingPageAfterLogin() {
    logx("LOGIN", "登录后按固定路径重新进入预约页：首页 -> " + currentExhibitProfile().shortName + "展馆 -> " + currentBookingTypeName());
    // 业务前提：授权登录完成后小程序会回到首页。
    // 因此不再用 OCR 检查是否仍在预约详情页，避免登录后首页场景被慢 OCR 拖住。

    if (!enterHomeExhibitionPage()) {
        logx("LOGIN", "登录后未能重新进入参观预约页");
        return false;
    }

    var p = getBookingEntryPoint();
    pressPoint(currentBookingTypeName() + "-登录后重进", p, CONFIG.pressDuration);
    sleep(1500);
    return waitForBookingPageOnly(12000);
}

function enterBookingPageForCollect() {
    var p = getBookingEntryPoint();
    pressPoint(currentBookingTypeName(), p, CONFIG.pressDuration);
    logx("LOGIN", "点击" + currentBookingTypeName() + "后等待2秒，再判断本轮是否需要授权登录");
    sleep(2000);

    var loginHandled = handleLoginIfNeeded();
    if (loginHandled) {
        logx("LOGIN", "本轮已完成授权登录，按登录后固定路径继续");
        sleep(1800);
        if (!reenterBookingPageAfterLogin()) {
            logx("PAGE", "登录后未确认进入预约页");
            return false;
        }
        return true;
    } else {
        logx("LOGIN", "点击" + currentBookingTypeName() + "后未出现授权登录，本轮按无需登录处理");
    }

    if (!waitForBookingPageOnly(25000)) {
        logx("PAGE", "未确认进入预约页");
        return false;
    }
    return true;
}

function returnToExhibitionPage() {
    for (var i = 0; i < 3; i++) {
        goBackLogged("第一轮采集完成，返回参观预约页");
        var p = waitForText("参观预约-普通预约", "普通预约", [0, scaleY(700), device.width, scaleY(1700)], 2500);
        if (p) {
            logx("PAGE", "已停留在参观预约页");
            return true;
        }
    }
    logx("PAGE", "返回参观预约页未确认");
    return false;
}

function prepareFlow() {
    STAGE = "PREP";
    notifyUser("第一轮开始：预热与采集");
    logx("FLOW", "第一轮预热与采集开始");
    launchMiniProgram();
    handleStartupNoticeDialog();
    if (!enterHomeExhibitionPage()) fail("未能进入参观预约页，请查看截图/OCR日志");
    if (!enterBookingPageForCollect()) fail("未能进入" + currentBookingTypeName() + "详情页，请查看截图/OCR日志");
    collectDatePoint();
    if (isParentBookingMode()) {
        collectParentAudienceAndPeriodPoints();
    } else {
        collectAudienceAndPeriodPoints();
    }
    saveCache();
    if (!returnToExhibitionPage()) fail("第一轮采集后未能返回参观预约页");
    logx("FLOW", "第一轮预热与采集结束");
    notifyUser("第一轮完成：已返回参观预约页，开始等待抢票时间");
}

function parseStartTime() {
    var m = String(CONFIG.startTime).match(/^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/);
    if (!m) fail("startTime 格式错误，应为 HH:mm:ss 或 HH:mm:ss.SSS");
    var hour = parseInt(m[1], 10);
    var minute = parseInt(m[2], 10);
    var second = parseInt(m[3], 10);
    var millisecond = m[4] ? parseInt((m[4] + "00").substring(0, 3), 10) : 0;
    if (hour < 0 || hour > 23 || minute > 59 || second > 59) {
        fail("startTime 时间值越界，应为 00:00:00 到 23:59:59.999");
    }
    var d = new Date();
    d.setHours(hour, minute, second, millisecond);
    return d;
}

function waitUntilPreRushProbeTime(target) {
    var probeAt = target.getTime() - CONFIG.preRushLoginProbeLeadMs;
    var diff = probeAt - Date.now();
    while (diff > 0) {
        var sleepMs = Math.min(diff, 30000);
        logx("TIME", "等待抢票前登录探测，剩余 " + Math.round(diff / 1000) + "s sleep=" + sleepMs + "ms");
        sleep(sleepMs);
        diff = probeAt - Date.now();
    }
}

function waitForNormalBookingListQuick(label, timeoutMs) {
    return waitForText(label, "普通预约", [0, scaleY(700), device.width, scaleY(1700)], timeoutMs);
}

function preRushLoginProbe() {
    STAGE = "PROBE";
    var start = Date.now();
    logx("FLOW", "抢票前登录探测开始");
    notifyUser("抢票前登录探测开始");

    pressPoint("登录探测-普通预约", requireCachedPoint("normalBooking", "普通预约"), CONFIG.fastPressDuration);
    sleep(2000);

    if (handleLoginIfNeeded()) {
        logx("LOGIN", "登录探测发现授权登录，已完成登录，按首页缓存入口返回参观预约页");
        sleep(1000);
        // 业务前提：抢票前探测轮完成授权登录后，小程序会回到首页。
        // 因此这里直接使用第一轮缓存的首页展馆入口坐标，避免额外页面分支和 OCR。
        pressPoint("登录探测-首页" + currentExhibitProfile().shortName + "入口", requireCachedPoint("homeExhibit", "首页" + currentExhibitProfile().shortName + "入口"), CONFIG.fastPressDuration);
        sleep(1100);
        waitForNormalBookingListQuick("登录探测-确认参观预约页", 1500);
    } else {
        logx("LOGIN", "登录探测未发现授权登录，返回参观预约页");
        goBackLogged("登录探测未出现登录，返回参观预约页");
        waitForNormalBookingListQuick("登录探测-确认返回参观预约页", 1200);
    }

    logx("FLOW", "抢票前登录探测结束 totalCost=" + (Date.now() - start) + "ms");
    notifyUser("抢票前登录探测完成，等待抢票时间");
}

function waitUntilStartTime() {
    STAGE = "WAIT";
    var target = parseStartTime();
    var diff = target.getTime() - Date.now();
    logx("TIME", "当前时间=" + nowText() + " 目标时间=" + target.toString() + " 剩余=" + diff + "ms");
    if (diff <= 0) {
        logx("TIME", "目标时间已到或已过，立即执行第二轮");
        logRushPlan("startTime已到或已过");
        notifyUser("目标时间已到，立即开始第二轮");
        return;
    }
    notifyUser("等待抢票时间：" + CONFIG.startTime);
    logRushPlan("进入等待阶段");

    if (diff > CONFIG.preRushLoginProbeLeadMs) {
        logx("TIME", "距离抢票超过登录探测提前量，计划在抢票前 " + Math.round(CONFIG.preRushLoginProbeLeadMs / 1000) + " 秒执行登录探测");
        waitUntilPreRushProbeTime(target);
        preRushLoginProbe();
        STAGE = "WAIT";
        diff = target.getTime() - Date.now();
        preloadCaptchaSolverForRush("after_login_probe", diff);
        diff = target.getTime() - Date.now();
        logRushPlan("登录探测完成，进入最终等待");
    } else {
        logx("TIME", "距离抢票不足或等于登录探测提前量，跳过登录探测 diff=" + diff + "ms lead=" + CONFIG.preRushLoginProbeLeadMs + "ms");
        preloadCaptchaSolverForRush("wait_without_login_probe", diff);
        diff = target.getTime() - Date.now();
    }

    while (diff > 15000) {
        var sleepMs = Math.min(diff - 12000, 30000);
        logx("TIME", "等待中，剩余 " + Math.round(diff / 1000) + "s sleep=" + sleepMs + "ms");
        sleep(sleepMs);
        diff = target.getTime() - Date.now();
    }
    if (diff > 1200) {
        logx("TIME", "临近目标时间，休眠到提前 1.2s diff=" + diff + "ms");
        sleep(diff - 1200);
    }
    logRushPlan("进入最后轮询前");
    logx("TIME", "进入最后轮询");
    while (Date.now() < target.getTime()) {
        // 最后阶段不输出日志，减少耗时。
    }
    logx("TIME", "准点触发 误差=" + (Date.now() - target.getTime()) + "ms");
    notifyUser("抢票时间到，第二轮开始");
}

function rushFlow() {
    STAGE = "RUSH";
    var rushStart = Date.now();
    notifyUser("第二轮开始：正式抢票");
    logx("FLOW", "第二轮正式抢票开始");

    // 启用异步日志缓冲，减少关键路径上的文件 I/O 延迟
    runtime.useBufferedLog = true;
    runtime.logBuffer = [];

    var bookingEntryPoint = isParentBookingMode() ? getParentBookingPoint() : getNormalBookingPoint();
    var bookingListSentinel = collectBookingListSentinelPoint();
    pressPoint(currentBookingTypeName(), bookingEntryPoint, CONFIG.fastPressDuration);

    // 等待"参观日期"被选中的状态背景色出现，最多2秒；未出现则说明加载异常，中断流程
    if (!waitBookingListSentinelGone(bookingListSentinel)) {
        flushLogBuffer();
        return { ok: false, pageLoadTimeout: true, reason: "参观预约列表未离开" };
    }

    var pageLoadDetectStart = Date.now();
    var pageLoadDetected = false;
    var lastDateGridProbe = null;
    var dateGridDetectTotalCost = 0;
    var dateGridDetectMaxCost = 0;
    var dateGridCaptureTotalCost = 0;
    var dateGridCaptureMaxCost = 0;
    
    // 新增：内存循环计数器，完全不消耗性能
    var loopCount = 0; 
    while (Date.now() - pageLoadDetectStart < 2000) {
        loopCount++; // 每次循环计数 +1
        lastDateGridProbe = detectSelectedDateCellInGrid(15);
        var detectCost = lastDateGridProbe && typeof lastDateGridProbe.costMs === "number" ? lastDateGridProbe.costMs : 0;
        var captureCost = lastDateGridProbe && typeof lastDateGridProbe.captureCostMs === "number" ? lastDateGridProbe.captureCostMs : 0;
        dateGridDetectTotalCost += detectCost;
        if (detectCost > dateGridDetectMaxCost) dateGridDetectMaxCost = detectCost;
        dateGridCaptureTotalCost += captureCost;
        if (captureCost > dateGridCaptureMaxCost) dateGridCaptureMaxCost = captureCost;
        if (lastDateGridProbe && lastDateGridProbe.found) {
            pageLoadDetected = true;
            break;
        }
        sleep(10); 
    }

    var elapsed = Date.now() - pageLoadDetectStart;
    
    if (!pageLoadDetected) {
        flushLogBuffer();
        var timeoutAvgCost = loopCount > 0 ? Math.round(dateGridDetectTotalCost / loopCount) : 0;
        var timeoutAvgCaptureCost = loopCount > 0 ? Math.round(dateGridCaptureTotalCost / loopCount) : 0;
        logx("RUSH", "日期网格选中色块未在2秒内出现，中断流程 elapsed=" + elapsed + "ms loopCount=" + loopCount + " algoTotalCost=" + dateGridDetectTotalCost + "ms algoAvgCost=" + timeoutAvgCost + "ms algoMaxCost=" + dateGridDetectMaxCost + "ms captureTotalCost=" + dateGridCaptureTotalCost + "ms captureAvgCost=" + timeoutAvgCaptureCost + "ms captureMaxCost=" + dateGridCaptureMaxCost + "ms lastProbe=" + JSON.stringify(lastDateGridProbe));
        return { ok: false, pageLoadTimeout: true, reason: "日期网格选中色块未出现 elapsed=" + elapsed + "ms" };
    }
    
    // 新增：计算单次循环的平均耗时（刨除最初始的 150ms 纯等待）
    var avgLoopTime = loopCount > 0 ? Math.round(elapsed / loopCount) : 0;
    var avgDetectCost = loopCount > 0 ? Math.round(dateGridDetectTotalCost / loopCount) : 0;
    var avgCaptureCost = loopCount > 0 ? Math.round(dateGridCaptureTotalCost / loopCount) : 0;
    
    // 升级日志：输出 总耗时、总循环次数、单次循环平均耗时
    logx("RUSH", "日期网格选中色块已出现 elapsed=" + elapsed + "ms 探测次数=" + loopCount + "次 单次循环平均耗时=" + avgLoopTime + "ms algoTotalCost=" + dateGridDetectTotalCost + "ms algoAvgCost=" + avgDetectCost + "ms algoMaxCost=" + dateGridDetectMaxCost + "ms captureTotalCost=" + dateGridCaptureTotalCost + "ms captureAvgCost=" + avgCaptureCost + "ms captureMaxCost=" + dateGridCaptureMaxCost + "ms probe=" + JSON.stringify(lastDateGridProbe));

    var datePoint = getCachedPoint("targetDate");
    if (!datePoint) datePoint = collectDatePoint();
    pressPoint("目标日期 " + CONFIG.visitDate, datePoint, CONFIG.fastPressDuration);
    sleep(180);

    var periodPoint = getPeriodPoint();
    pressPoint("选择时段 " + CONFIG.period, periodPoint, CONFIG.fastPressDuration);
    sleep(120);

    if (isParentBookingMode()) {
        scrollToAdultForRush();
        sleep(Math.max(CONFIG.afterAudienceScrollMs, CONFIG.parentAdultAfterScrollMs || 0));

        var adultPoints = getAdultPointsForRush();
        for (var ai = 0; ai < CONFIG.visitorCount; ai++) {
            var ap = adultPoints[ai];
            pressPoint("成人 " + (ai + 1), ap, Math.max(CONFIG.visitorPressDuration, CONFIG.parentAdultPressDuration || 0));
            sleep(CONFIG.visitorIntervalMs);
        }

        var minorScrollStrategy = scrollToMinorForRush();
        if (!(minorScrollStrategy && minorScrollStrategy.duration <= 1)) {
            sleep(Math.max(CONFIG.afterAudienceScrollMs, CONFIG.parentMinorAfterScrollMs || 0));
        }

        var minorPoints = getMinorPointsForRush();
        for (var mi = 0; mi < CONFIG.minorVisitorCount; mi++) {
            var mp = minorPoints[mi];
            pressPoint("未成年人 " + (mi + 1), mp, Math.max(CONFIG.visitorPressDuration, CONFIG.parentMinorPressDuration || 0));
            sleep(CONFIG.visitorIntervalMs);
        }
    } else {
        scrollToAudienceForRush();
        sleep(CONFIG.afterAudienceScrollMs);

        var visitorPoints = getVisitorPointsForRush();
        for (var i = 0; i < CONFIG.visitorCount; i++) {
            var vp = visitorPoints[i];
            pressPoint("游客 " + (i + 1), vp, CONFIG.visitorPressDuration);
            sleep(CONFIG.visitorIntervalMs);
        }
    }

    var confirm = getConfirmButtonPoint();
    pressPoint("确认预约", confirm, CONFIG.fastPressDuration);

    var captchaResult = solveCaptchaAfterConfirmForRush();

    // 验证码处理完成后再刷新日志缓冲，避免 I/O 阻塞抢票链路
    flushLogBuffer();

    if (captchaResult && captchaResult.manualFallback) {
        logx("FLOW", "第二轮已点击确认预约，验证码进入人工兜底 totalCost=" + (Date.now() - rushStart) + "ms reason=" + captchaResult.reason);
        return { ok: false, manualFallback: true, reason: captchaResult.reason };
    }
    logx("FLOW", "第二轮正式抢票结束 totalCost=" + (Date.now() - rushStart) + "ms");
    sleep(1800); // 等滑块动画、弹窗校验和页面跳转停稳；此时抢票主流程已结束
    captureDiagnostics("rush_after_confirm", CONFIG.diagnostics && CONFIG.diagnostics.ocrAfterRush);
    notifyUser("第二轮已完成确认后处理，请查看页面结果和日志");

    return { ok: true, captcha: captchaResult };
}

function validateConfig() {
    if (!EXHIBIT_PROFILES[CONFIG.exhibitMode]) fail("exhibitMode 只能是 nanjing 或 justice，当前：" + CONFIG.exhibitMode);
    if (CONFIG.bookingType !== "normal" && CONFIG.bookingType !== "parent") fail("bookingType 只能是 normal 或 parent，当前：" + CONFIG.bookingType);
    if (!/^\d{4}$/.test(CONFIG.visitDate)) fail("visitDate 必须是四位 MMDD 字符串，例如 0505/0425");
    var m = parseInt(CONFIG.visitDate.substring(0, 2), 10);
    var d = parseInt(CONFIG.visitDate.substring(2, 4), 10);
    if (m < 1 || m > 12) fail("visitDate 月份无效：" + CONFIG.visitDate);
    var days = new Date(new Date().getFullYear(), m, 0).getDate();
    if (d < 1 || d > days) fail("visitDate 日期无效：" + CONFIG.visitDate);
    if (CONFIG.period !== "上午" && CONFIG.period !== "下午") fail("period 只能是 上午 或 下午");
    if (isParentBookingMode()) {
        if (CONFIG.visitorCount < 1 || CONFIG.visitorCount > 4) fail("亲子预约 visitorCount 表示成年人人数，必须在 1 到 4 之间");
        if (CONFIG.minorVisitorCount < 1) fail("亲子预约 minorVisitorCount 必须至少为 1");
        if (CONFIG.visitorCount + CONFIG.minorVisitorCount > 5) fail("亲子预约成人+未成年人总人数最多 5 人");
    } else if (CONFIG.visitorCount < 1 || CONFIG.visitorCount > 5) {
        fail("visitorCount 必须在 1 到 5 之间");
    }
    parseStartTime();
    if (CONFIG.captcha && CONFIG.captcha.enabled && CONFIG.prepareOnly !== true) {
        requireCaptchaProfileForRun();
    }
}

function initRuntime() {
    auto.waitFor();
    applyCurrentExhibitProfile();
    runtime.screen = { width: device.width, height: device.height };
    runtime.runDir = CONFIG.outputDir + "/" + runDirText();
    runtime.latestLogPath = CONFIG.logPath;
    runtime.logPath = runtime.runDir + "/nanjing_booking_run_" + fileTimeText() + ".log";
    try {
        files.ensureDir(runtime.runDir + "/");
        files.ensureDir(CONFIG.logPath);
        files.ensureDir(runtime.logPath);
        files.ensureDir(CONFIG.cachePath);
    } catch (ignoredCreateDir) {}
    try {
        files.remove(runtime.latestLogPath);
    } catch (ignored) {}
    logx("INIT", "脚本启动 version=" + CONFIG.version);
    logx("INIT", "配置=" + JSON.stringify(CONFIG));
    logx("INIT", "屏幕=" + device.width + "x" + device.height);
    logx("INIT", "展馆模式 mode=" + CONFIG.exhibitMode + " name=" + currentExhibitProfile().shortName + " homeCardIndex=" + currentExhibitProfile().homeCardIndex);
    logx("INIT", "预约类型 type=" + currentBookingCacheType() + " name=" + currentBookingTypeName() + " visitorCount=" + CONFIG.visitorCount + " minorVisitorCount=" + CONFIG.minorVisitorCount);
    logx("INIT", "缓存路径 primary=" + CONFIG.cachePath + " backup=" + CONFIG.backupCachePath);
    logx("INIT", "本次运行目录=" + runtime.runDir);
    logx("INIT", "本次日志路径=" + runtime.logPath + " latest日志路径=" + runtime.latestLogPath);
    CONFIG.outputDir = runtime.runDir;
    notifyUser("预约脚本启动，正在请求截图权限");

    if (!requestScreenCapture()) {
        fail("请求截图权限失败");
    }
    logx("INIT", "截图权限已获取");
    notifyUser("截图权限已获取，开始读取缓存");
    loadCache();
}

function main() {
    var failed = false;
    try {
        validateConfig();
        initRuntime();
        prepareFlow();
        if (CONFIG.prepareOnly) {
            STAGE = "END";
            logx("FLOW", "prepareOnly=true，第一轮完成后直接退出，不等待 startTime，不执行第二轮");
            finalNotifyUser("仅第一轮模式：已完成采集并退出，请查看日志");
            return;
        }
        waitUntilStartTime();
        var rushResult = rushFlow();
        if (rushResult && rushResult.pageLoadTimeout) {
            finalNotifyUser("页面加载超时，流程已中断：" + rushResult.reason);
        } else if (rushResult && rushResult.manualFallback) {
            finalNotifyUser("验证码已保留现场，等待人工兜底，请查看日志");
        } else {
            finalNotifyUser("预约脚本正常结束，请查看日志");
        }
    } catch (e) {
        failed = true;
        flushLogBuffer(); // 异常时先刷新缓冲区，确保日志不丢失
        logx("FATAL", "脚本异常：" + e + " stack=" + (e && e.stack ? e.stack : ""));
        finalNotifyUser("预约脚本异常退出，请查看日志：" + e);
        captureDiagnostics("fatal_" + STAGE, CONFIG.diagnostics && CONFIG.diagnostics.ocrOnError);
    } finally {
        flushLogBuffer(); // 确保所有缓冲日志写入
        saveCache();
        logx("END", "日志路径=" + runtime.logPath + " 缓存路径=" + runtime.cachePath);
        finalNotifyUser((failed ? "异常日志已写入：" : "日志已写入：") + runtime.logPath);
    }
}

main();
