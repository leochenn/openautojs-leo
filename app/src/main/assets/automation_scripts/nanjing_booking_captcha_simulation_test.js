/*
 * 南京预约验证码模拟测试脚本。
 * 由验证码校准页启动，读取用户选择的现场截图，并复用正式验证码模块完成类型判定、识别、输入和滑块拖动。
 */

var SIMULATION_REQUEST_FILE = "captcha_simulation_request.json";
var SIMULATION_OUTPUT_DIR = "/sdcard/OpenAutoJS_NanjingBooking/captcha_simulation";
var OVERLAY_ACTION = "org.openautojs.autojs.action.CAPTCHA_SIMULATION_OVERLAY";
var OVERLAY_PREFS = "captcha_simulation_overlay";

var BOOKING_SCRIPT_FILE = "nanjing_booking_auto.js";
var CONFIG = loadSimulationConfig();
var runtimeState = {
    captchaTemplates: null,
    captchaStats: null,
    captchaMathInputPrefocused: false,
    captchaMathInputFocusedAt: 0
};

function scriptDir() {
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

function joinPath(dir, name) {
    if (!dir) return name;
    return dir + (dir.charAt(dir.length - 1) === "/" ? "" : "/") + name;
}

function requestPath() {
    return joinPath(scriptDir(), SIMULATION_REQUEST_FILE);
}

function extractObjectLiteralAfter(code, marker) {
    var markerIndex = code.indexOf(marker);
    if (markerIndex < 0) {
        throw new Error("formal config marker not found: " + marker);
    }
    var braceStart = code.indexOf("{", markerIndex);
    if (braceStart < 0) {
        throw new Error("formal config object start not found");
    }
    var depth = 0;
    var quote = "";
    var escaped = false;
    var lineComment = false;
    var blockComment = false;
    for (var i = braceStart; i < code.length; i++) {
        var ch = code.charAt(i);
        var next = i + 1 < code.length ? code.charAt(i + 1) : "";
        if (lineComment) {
            if (ch === "\n" || ch === "\r") lineComment = false;
            continue;
        }
        if (blockComment) {
            if (ch === "*" && next === "/") {
                blockComment = false;
                i++;
            }
            continue;
        }
        if (quote) {
            if (escaped) {
                escaped = false;
            } else if (ch === "\\") {
                escaped = true;
            } else if (ch === quote) {
                quote = "";
            }
            continue;
        }
        if (ch === "/" && next === "/") {
            lineComment = true;
            i++;
            continue;
        }
        if (ch === "/" && next === "*") {
            blockComment = true;
            i++;
            continue;
        }
        if (ch === "'" || ch === "\"" || ch === String.fromCharCode(96)) {
            quote = ch;
            continue;
        }
        if (ch === "{") {
            depth++;
        } else if (ch === "}") {
            depth--;
            if (depth === 0) {
                return code.substring(braceStart, i + 1);
            }
        }
    }
    throw new Error("formal config object is not closed");
}

function loadSimulationConfig() {
    var bookingPath = joinPath(scriptDir(), BOOKING_SCRIPT_FILE);
    if (!files.exists(bookingPath)) {
        throw new Error("formal script not found: " + bookingPath);
    }
    var code = files.read(bookingPath);
    var objectText = extractObjectLiteralAfter(code, "var CONFIG =");
    var config = eval("(" + objectText + ")");
    config.outputDir = SIMULATION_OUTPUT_DIR;
    config.afterConfirmCaptchaWaitMs = 0;
    config.captcha = config.captcha || {};
    config.captcha.moduleFileName = config.captcha.moduleFileName || "nanjing_booking_captcha_solver.js";
    config.captcha.saveSceneBeforeSolve = false;
    config.captcha.emptyOcrRetryWaitMs = 0;
    config.captcha.skipFinalSubmit = true;
    return config;
}

function readJson(path) {
    return JSON.parse(files.read(path));
}

function writeJson(path, obj) {
    files.ensureDir(parentPath(path));
    files.write(path, JSON.stringify(obj, null, 2));
}

function writeSimulationResultJson(request, obj) {
    writeJson(request.resultPath, obj);
    if (CONFIG.outputDir && request.requestId) {
        var externalPath = joinPath(CONFIG.outputDir, "captcha_simulation_result_" + request.requestId + ".json");
        if (externalPath !== request.resultPath) {
            writeJson(externalPath, obj);
        }
    }
}

function parentPath(path) {
    path = String(path || "");
    var sep = path.lastIndexOf("/");
    if (sep < 0) return "";
    return path.substring(0, sep);
}

function logx(msg) {
    var line = "[" + new Date().toISOString() + "] " + msg;
    console.log(line);
    if (CONFIG.outputDir) {
        try {
            files.ensureDir(CONFIG.outputDir + "/");
            files.append(CONFIG.outputDir + "/captcha_simulation.log", line + "\n");
        } catch (ignored) {}
    }
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function scaleX(x) {
    return Math.round(x * device.width / CONFIG.baseScreen.width);
}

function scaleY(y) {
    return Math.round(y * device.height / CONFIG.baseScreen.height);
}

function makePoint(x, y, source) {
    return {
        x: Math.round(clamp(x, 1, device.width - 1)),
        y: Math.round(clamp(y, 1, device.height - 1)),
        source: source || "unknown"
    };
}

function pressPoint(name, p, duration) {
    if (!p) throw new Error("缺少点击坐标：" + name);
    logx("点击 " + name + " x=" + p.x + " y=" + p.y);
    press(Math.round(p.x), Math.round(p.y), duration || CONFIG.pressDuration);
}

function fileTimeText() {
    var d = new Date();
    function pad(n) { return n < 10 ? "0" + n : String(n); }
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "_" +
        pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
}

function loadSolver() {
    var modulePath = joinPath(scriptDir(), CONFIG.captcha.moduleFileName);
    var code = files.read(modulePath);
    var factory = eval("(function(){ var module = { exports: null }; var exports = {}; " +
        code + "\n; return module.exports || createNanjingBookingCaptchaSolver; })()");
    if (typeof factory !== "function") {
        throw new Error("验证码模块未导出 createNanjingBookingCaptchaSolver");
    }
    return factory({
        config: CONFIG,
        runtime: runtimeState,
        log: logx,
        notifyUser: function (msg) { toast(msg); },
        fileTimeText: fileTimeText,
        scaleX: scaleX,
        scaleY: scaleY,
        clamp: clamp,
        pressPoint: pressPoint,
        makePoint: makePoint
    });
}

function overlayPrefs() {
    return context.getSharedPreferences(OVERLAY_PREFS, android.content.Context.MODE_PRIVATE);
}

function sendOverlay(requestId, type, region, extra) {
    var Intent = android.content.Intent;
    var intent = new Intent(OVERLAY_ACTION);
    intent.setPackage(context.getPackageName());
    intent.putExtra("requestId", requestId);
    intent.putExtra("type", type);
    intent.putExtra("action", "show_overlay");
    intent.putExtra("regionJson", JSON.stringify(region || {}));
    intent.putExtra("extraJson", JSON.stringify(extra || {}));
    context.sendBroadcast(intent);
    logx("overlay 广播已发送 requestId=" + requestId + " type=" + type);
}

function waitOverlayReady(requestId, expectedType, timeoutMs) {
    var start = Date.now();
    var prefs = overlayPrefs();
    while (Date.now() - start < timeoutMs) {
        var readyId = String(prefs.getString("overlay_ready_request_id", "") || "");
        var readyType = String(prefs.getString("overlay_ready_type", "") || "");
        if (readyId === requestId && readyType === expectedType) {
            return { ok: true, cost: Date.now() - start };
        }
        sleep(30);
    }
    return { ok: false, reason: "overlay_ready_timeout type=" + expectedType };
}

function centerOfRegion(region) {
    return {
        x: Math.round(region.x + region.w / 2),
        y: Math.round(region.y + region.h / 2)
    };
}

function readSliderDragResult(requestId) {
    var prefs = overlayPrefs();
    var dragId = String(prefs.getString("slider_drag_request_id", "") || "");
    if (dragId !== requestId) {
        return null;
    }
    return {
        requestId: dragId,
        endX: prefs.getInt("slider_drag_end_x", -1),
        endY: prefs.getInt("slider_drag_end_y", -1),
        targetX: prefs.getInt("slider_drag_target_x", -1),
        targetY: prefs.getInt("slider_drag_target_y", -1),
        hit: prefs.getBoolean("slider_drag_hit", false),
        timestamp: prefs.getLong("slider_drag_timestamp", 0)
    };
}

function compactResult(request, solverResult) {
    var out = {
        schemaVersion: 1,
        requestId: request.requestId,
        status: solverResult && solverResult.ok ? "success" : "failed",
        type: solverResult ? (solverResult.type || "") : "",
        stage: "finished",
        reason: solverResult && solverResult.ok ? "" : (solverResult ? solverResult.reason || "solver_failed" : "solver_empty"),
        stats: solverResult ? solverResult.stats || null : null
    };
    if (solverResult && solverResult.type === "math") {
        out.math = {
            raw: solverResult.raw || (solverResult.recognition && solverResult.recognition.raw) || "",
            expression: solverResult.expression || "",
            answer: solverResult.answer || "",
            detail: solverResult.detail || ""
        };
    }
    if (solverResult && solverResult.type === "slider") {
        var profile = request.profile && request.profile.sliderProfile;
        var start = profile && profile.handleRegion ? centerOfRegion(profile.handleRegion) : null;
        var target = solverResult.sliderResult && solverResult.sliderResult.target
            ? {
                x: Math.round(solverResult.sliderResult.target.centerX),
                y: start ? start.y : Math.round(solverResult.sliderResult.target.centerY)
            }
            : null;
        out.slider = {
            startPoint: start,
            targetPoint: target,
            detail: solverResult.detail || "",
            nativeDrag: readSliderDragResult(request.requestId)
        };
    }
    return out;
}

function runSimulation() {
    var reqPath = requestPath();
    if (!files.exists(reqPath)) {
        throw new Error("未找到模拟测试请求文件：" + reqPath);
    }
    var request = readJson(reqPath);
    if (!request || !request.requestId) {
        throw new Error("模拟测试请求缺少 requestId");
    }
    if (!request.imagePath || !files.exists(request.imagePath)) {
        throw new Error("模拟测试截图不存在：" + request.imagePath);
    }
    CONFIG.outputDir = request.outputDir || SIMULATION_OUTPUT_DIR;
    CONFIG.captcha.profile = request.profile;
    CONFIG.captcha.profileValidated = true;
    CONFIG.baseScreen = {
        width: request.profile.deviceWidth,
        height: request.profile.deviceHeight
    };

    logx("验证码模拟测试开始 requestId=" + request.requestId + " image=" + request.imagePath);
    var img = images.read(request.imagePath);
    if (!img) {
        throw new Error("无法读取模拟截图：" + request.imagePath);
    }

    var solver = loadSolver();
    if (!solver || typeof solver.solveWithImageAndHooks !== "function") {
        throw new Error("验证码模块缺少 solveWithImageAndHooks 入口");
    }

    var hooks = {
        beforeMathInput: function (ctx) {
            sendOverlay(request.requestId, "math", ctx.inputRegion, {
                expressionRegion: ctx.expressionRegion,
                submitRegion: ctx.submitRegion
            });
            return waitOverlayReady(request.requestId, "math", request.overlayTimeoutMs || 3000);
        },
        beforeSliderDrag: function (ctx) {
            var handleRegion = ctx.handleRegion || (request.profile.sliderProfile && request.profile.sliderProfile.handleRegion);
            var start = handleRegion ? centerOfRegion(handleRegion) : null;
            var target = ctx.sliderResult && ctx.sliderResult.target && start
                ? { x: Math.round(ctx.sliderResult.target.centerX), y: start.y }
                : null;
            sendOverlay(request.requestId, "slider", handleRegion, {
                startPoint: start,
                targetPoint: target,
                sliderDetail: ctx.sliderResult ? ctx.sliderResult.detail || "" : ""
            });
            return waitOverlayReady(request.requestId, "slider", request.overlayTimeoutMs || 3000);
        }
    };

    var result = solver.solveWithImageAndHooks(img, hooks, {
        skipInitialWait: true,
        recycleImage: true
    });
    writeSimulationResultJson(request, compactResult(request, result));
    logx("验证码模拟测试结束 status=" + (result && result.ok ? "success" : "failed"));
}

try {
    runSimulation();
} catch (e) {
    var fallbackRequest = null;
    try {
        if (files.exists(requestPath())) fallbackRequest = readJson(requestPath());
    } catch (ignored) {}
    var resultPath = fallbackRequest && fallbackRequest.resultPath
        ? fallbackRequest.resultPath
        : joinPath(scriptDir(), "captcha_simulation_result_error.json");
    var errorResult = {
        schemaVersion: 1,
        requestId: fallbackRequest ? fallbackRequest.requestId || "" : "",
        status: "failed",
        type: "",
        stage: "exception",
        reason: String(e),
        stats: null
    };
    writeJson(resultPath, errorResult);
    if (fallbackRequest && fallbackRequest.requestId && CONFIG.outputDir) {
        writeJson(joinPath(CONFIG.outputDir, "captcha_simulation_result_" + fallbackRequest.requestId + ".json"), errorResult);
    }
    logx("验证码模拟测试异常 err=" + e + " stack=" + (e && e.stack ? e.stack : ""));
}
