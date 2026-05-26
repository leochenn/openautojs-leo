/*
 * 南京预约验证码处理模块。
 * 该文件由正式脚本在同一 OpenAutoJS 引擎内加载，复用已获取的截图权限、日志、坐标缩放和点击函数。当前支持两类弹窗：数学题验证码、滑块验证码。
 */

function createNanjingBookingCaptchaSolver(deps) {
    var CONFIG = deps.config;
    var runtime = deps.runtime;

    function logx(msg) {
        deps.log(msg);
    }

    function scaleX(x) {
        return deps.scaleX(x);
    }

    function scaleY(y) {
        return deps.scaleY(y);
    }

    function clamp(v, min, max) {
        return deps.clamp(v, min, max);
    }

    function basePoint(name, x, y) {
        return deps.makePoint(scaleX(x), scaleY(y), "captcha-ratio:" + name);
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

    function activeMathProfile() {
        var profile = CONFIG.captcha && CONFIG.captcha.profile;
        if (!profile || !profile.mathProfile || profile.mathProfile.completed !== true) return null;
        return profile.mathProfile;
    }

    function activeSliderProfile() {
        var profile = CONFIG.captcha && CONFIG.captcha.profile;
        if (!profile || !profile.sliderProfile || profile.sliderProfile.completed !== true) return null;
        return profile.sliderProfile;
    }

    function pointFromRegionCenter(name, region) {
        region = normalizeProfileRegion(region, name, true);
        return deps.makePoint(region.x + region.w / 2, region.y + region.h / 2, "captcha-profile:" + name);
    }

    function buildExpressionRegions() {
        var mathProfile = activeMathProfile();
        if (mathProfile) {
            return [normalizeProfileRegion(mathProfile.expressionRegion, "profileMathExpression", true)];
        }
        var source = CONFIG.captcha.expressionRegions;
        if (!source || !source.length) {
            source = [CONFIG.captcha.expressionRegion];
        }
        var regions = [];
        for (var i = 0; i < source.length; i++) {
            var cfg = source[i];
            var region = scaledRegion(cfg);
            region.name = cfg.name || ("region" + (i + 1));
            region.templateEnabled = cfg.templateEnabled !== false;
            regions.push(region);
        }
        return regions;
    }

    function recognitionHasRaw(result) {
        return !!(result && result.raw && String(result.raw).length > 0);
    }

    function isEmptyRecognitionResult(result) {
        if (!result) return true;
        if (recognitionHasRaw(result)) return false;
        return String(result.reason || "").indexOf("raw=") >= 0 ||
            String(result.reason || "").indexOf("ocr_parse_failed") >= 0 ||
            String(result.reason || "").indexOf("glyph_count=0") >= 0;
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

    function imagePixel(img, x, y) {
        if (img && typeof img.pixel === "function") {
            return img.pixel(x, y);
        }
        return images.pixel(img, x, y);
    }

    function makePixelReader(img) {
        return function (x, y) {
            return imagePixel(img, Math.round(x), Math.round(y));
        };
    }

    function isWhiteCaptchaPixel(color) {
        var r = colors.red(color);
        var g = colors.green(color);
        var b = colors.blue(color);
        var min = Math.min(r, g, b);
        var max = Math.max(r, g, b);
        return min >= CONFIG.captcha.whiteThreshold && (max - min) <= 28;
    }

    function saveCaptchaFailure(img, region, reason) {
        var saveStart = Date.now();
        var stamp = deps.fileTimeText();
        var fullPath = CONFIG.outputDir + "/captcha_fail_full_" + stamp + ".png";
        var cropPath = CONFIG.outputDir + "/captcha_fail_expr_" + stamp + ".png";
        var preprocessPath = CONFIG.outputDir + "/captcha_fail_preprocessed_" + stamp + ".png";
        var clip = null;
        var processed = null;
        try {
            images.save(img, fullPath);
            if (region) {
                clip = images.clip(img, region.x, region.y, region.w, region.h);
                images.save(clip, cropPath);
                processed = preprocessCaptchaClipForOcr(clip);
                if (processed) {
                    images.save(processed, preprocessPath);
                }
            }
            logx("验证码识别失败截图已保存 reason=" + reason + " full=" + fullPath +
                (region ? " crop=" + cropPath : "") +
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
                try { clip.recycle(); } catch (ignoredClip) {}
            }
        }
    }

    function saveCaptchaSceneBeforeSolve(img) {
        if (!CONFIG.captcha || CONFIG.captcha.saveSceneBeforeSolve !== true) return;

        var saveStart = Date.now();
        try {
            if (!img) {
                throw new Error("screen_image_empty");
            }
            var path = CONFIG.outputDir + "/captcha_scene_before_solve_" + deps.fileTimeText() + ".png";
            var saved = images.save(img, path);
            if (saved === false) {
                throw new Error("images.save returned false");
            }
            logx("验证码处理前现场截图已保存 path=" + path + " cost=" + (Date.now() - saveStart) + "ms");
        } catch (e) {
            logx("验证码处理前现场截图保存失败 err=" + e + " cost=" + (Date.now() - saveStart) + "ms");
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
                ocrFirst = recognizeCaptchaByOcr(img, region, "prefer_ocr region=" + (region.name || ""));
                if (ocrFirst.ok) return ocrFirst;
                if (CONFIG.captcha.usePreprocessedOcr) {
                    preprocessedFirst = recognizeCaptchaByPreprocessedOcr(img, region, "prefer_ocr_failed region=" + (region.name || "") + " raw=" + ocrFirst.raw);
                    if (preprocessedFirst.ok) return preprocessedFirst;
                    logx("验证码预处理 OCR 失败，切换模板识别 reason=" + preprocessedFirst.reason);
                }
                logx("验证码 OCR 主路径失败，切换模板识别 reason=" + ocrFirst.reason);
            } else if (CONFIG.captcha.usePreprocessedOcr) {
                preprocessedFirst = recognizeCaptchaByPreprocessedOcr(img, region, "preprocessed_first region=" + (region.name || ""));
                if (preprocessedFirst.ok) return preprocessedFirst;
                logx("验证码预处理 OCR 失败，切换模板识别 reason=" + preprocessedFirst.reason);
            } else {
                logx("验证码原图 OCR 已关闭且预处理 OCR 未开启，切换模板识别 region=" + (region.name || ""));
            }
        }

        if (region.templateEnabled === false) {
            return {
                ok: false,
                reason: "template_disabled region=" + (region.name || "") +
                    " raw=" + ((preprocessedFirst && preprocessedFirst.raw) || (ocrFirst && ocrFirst.raw) || ""),
                raw: (preprocessedFirst && preprocessedFirst.raw) || (ocrFirst && ocrFirst.raw) || ""
            };
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
                return recognizeCaptchaByOcr(img, region, "template_exception region=" + (region.name || "") + " err=" + e);
            }
            var priorRaw = (preprocessedFirst && preprocessedFirst.raw) || (ocrFirst && ocrFirst.raw) || "";
            logx("验证码模板构建异常，原图 OCR 已关闭，保留前序 OCR 结果 err=" + e + " raw=" + priorRaw);
            return {
                ok: false,
                reason: "template_exception region=" + (region.name || "") + " raw_ocr_disabled err=" + e,
                raw: priorRaw
            };
        }

        var glyphStart = Date.now();
        var glyphs = findCaptchaGlyphs(img, region);
        if (runtime.captchaStats) {
            runtime.captchaStats.glyphScan = Date.now() - glyphStart;
        }
        logx("验证码候选字符数量=" + glyphs.length + " regionName=" + (region.name || "") + " region=" + JSON.stringify(region));
        if (glyphs.length < 3) {
            if (rawOcrEnabled) {
                var ocrByCount = recognizeCaptchaByOcr(img, region, "glyph_count=" + glyphs.length + " region=" + (region.name || ""));
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
                var ocrByParse = recognizeCaptchaByOcr(img, region, "parse_failed region=" + (region.name || "") + " raw=" + raw);
                if (ocrByParse.ok) return ocrByParse;
                return { ok: false, reason: "parse_failed detail=" + detail.join(",") + " ocr=" + ocrByParse.reason, raw: raw };
            }
            return { ok: false, reason: "parse_failed detail=" + detail.join(",") + " raw_ocr_disabled", raw: raw };
        }
        for (var j = 0; j < parsed.expression.length; j++) {
            if (scores[j] < CONFIG.captcha.minGlyphScore) {
                if (rawOcrEnabled) {
                    var ocrByScore = recognizeCaptchaByOcr(img, region, "low_score region=" + (region.name || "") + " raw=" + raw);
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
            detail: "region=" + (region.name || "") + " " + detail.join(",")
        };
    }

    function recognizeCaptchaAcrossRegions(img, regions) {
        var reasons = [];
        var sawRaw = false;
        var best = null;
        for (var i = 0; i < regions.length; i++) {
            var region = regions[i];
            logx("数学题验证码尝试区域 name=" + region.name + " templateEnabled=" + region.templateEnabled +
                " region=" + JSON.stringify(region));
            var result = recognizeCaptchaExpression(img, region);
            result.region = region;
            if (result.ok) {
                result.detail = "region=" + region.name + " " + (result.detail || "");
                return result;
            }
            if (recognitionHasRaw(result)) {
                sawRaw = true;
                if (!best) best = result;
            }
            reasons.push(region.name + ":" + result.reason);
        }
        if (!best) {
            best = {
                ok: false,
                reason: reasons.join(" | "),
                raw: "",
                region: regions.length ? regions[0] : null
            };
        } else {
            best.reason = "all_regions_failed " + reasons.join(" | ");
        }
        best.emptyOcr = !sawRaw || isEmptyRecognitionResult(best);
        return best;
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

    function makeCaptchaImeRequestId() {
        return "captcha_" + Date.now() + "_" + Math.floor(Math.random() * 1000000);
    }

    function readCaptchaImeCommitAck(requestId) {
        try {
            var prefs = context.getSharedPreferences(
                "captcha_number_input_method",
                android.content.Context.MODE_PRIVATE
            );
            var committedId = String(prefs.getString("committed_request_id", "") || "");
            if (committedId !== requestId) {
                return { ok: false };
            }
            return {
                ok: true,
                committedAt: Number(prefs.getLong("committed_timestamp", 0)),
                reason: String(prefs.getString("committed_reason", "") || "")
            };
        } catch (e) {
            return { ok: false, error: String(e) };
        }
    }

    function waitCaptchaImeCommitAck(requestId, cfg) {
        var timeoutMs = Math.max(0, Number(cfg.commitAckTimeoutMs || 0));
        if (!requestId || timeoutMs <= 0) {
            return { ok: false, skipped: true, reason: "commit_ack_disabled" };
        }
        var pollMs = Math.max(10, Number(cfg.commitAckPollMs || 20));
        var start = Date.now();
        var deadline = start + timeoutMs;
        var last = null;
        while (Date.now() <= deadline) {
            last = readCaptchaImeCommitAck(requestId);
            if (last.ok) {
                var cost = Date.now() - start;
                logx("Captcha IME commit ack received requestId=" + requestId +
                    " reason=" + last.reason + " wait=" + cost + "ms");
                last.waitMs = cost;
                return last;
            }
            sleep(pollMs);
        }
        var total = Date.now() - start;
        logx("Captcha IME commit ack timeout requestId=" + requestId +
            " timeout=" + timeoutMs + "ms wait=" + total + "ms" +
            (last && last.error ? " error=" + last.error : ""));
        return { ok: false, timeout: true, waitMs: total };
    }

    function sendCaptchaAnswerToInputMethod(answer) {
        var cfg = CONFIG.captcha.inputMethod || {};
        if (!cfg.enabled) {
            return { ok: false, skipped: true, reason: "captcha_ime_disabled" };
        }
        try {
            var action = String(cfg.action || "org.openautojs.autojs.action.CAPTCHA_IME_SET_ANSWER");
            var targetPackage = String(cfg.packageName || context.getPackageName());
            var requestId = makeCaptchaImeRequestId();
            var intent = new android.content.Intent(action);
            if (targetPackage) {
                intent.setPackage(targetPackage);
            }
            intent.putExtra(String(cfg.extraAnswer || "answer"), String(answer));
            intent.putExtra(String(cfg.extraRequestId || "requestId"), requestId);
            context.sendBroadcast(intent);
            logx("Captcha IME answer broadcast sent answer=" + answer +
                " package=" + targetPackage + " action=" + action +
                " requestId=" + requestId);
            if (cfg.commitAckTimeoutMs > 0) {
                var ack = waitCaptchaImeCommitAck(requestId, cfg);
                if (ack.ok) {
                    return { ok: true, requestId: requestId, ack: ack };
                }
                if (cfg.afterBroadcastMs > 0) {
                    sleep(cfg.afterBroadcastMs);
                }
                return {
                    ok: true,
                    requestId: requestId,
                    ackTimeout: true,
                    reason: "captcha_ime_commit_ack_timeout"
                };
            }
            if (cfg.afterBroadcastMs > 0) {
                sleep(cfg.afterBroadcastMs);
            }
            return { ok: true, requestId: requestId };
        } catch (e) {
            logx("Captcha IME answer broadcast failed err=" + e);
            return { ok: false, reason: "captcha_ime_broadcast_failed err=" + e };
        }
    }

    function shouldSkipFinalSubmit() {
        return CONFIG.captcha && CONFIG.captcha.skipFinalSubmit === true;
    }

    function notifyFinalSubmitSkipped(type, detail) {
        var msg = "验证码流程已完成，按配置跳过最后点击确定 type=" + type +
            (detail ? " detail=" + detail : "");
        logx(msg);
        try {
            deps.notifyUser("验证码已完成，已跳过最后点击确定");
        } catch (ignored) {}
    }

    function finishCaptchaInput(answer, submitPoint, detail) {
        logx("验证码答案已填充 answer=" + answer +
            " autoSubmit=" + CONFIG.captcha.autoSubmitAfterInput + " detail=" + detail);
        sleep(CONFIG.captcha.afterInputMs);
        if (!CONFIG.captcha.autoSubmitAfterInput) {
            return { ok: true, submitted: false, detail: detail };
        }
        if (shouldSkipFinalSubmit()) {
            notifyFinalSubmitSkipped("math", detail);
            return { ok: true, submitted: false, finalSubmitSkipped: true, detail: detail };
        }
        logx("验证码答案填充后点击确定 x=" + submitPoint.x + " y=" + submitPoint.y);
        deps.pressPoint("验证码确定", submitPoint);
        return { ok: true, submitted: true, detail: detail };
    }

    function mathInputPoint() {
        var mathProfile = activeMathProfile();
        return mathProfile
            ? pointFromRegionCenter("captchaInput", mathProfile.inputRegion)
            : basePoint("captchaInput", CONFIG.captcha.inputPoint.x, CONFIG.captcha.inputPoint.y);
    }

    function mathSubmitPoint() {
        var mathProfile = activeMathProfile();
        return mathProfile
            ? pointFromRegionCenter("captchaSubmit", mathProfile.submitRegion)
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
            deps.pressPoint("验证码输入框预聚焦", inputPoint);
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
            deps.pressPoint("验证码输入框", inputPoint);
            if (imeCfg.focusWaitMs > 0) {
                sleep(imeCfg.focusWaitMs);
            }
        }
        if (!imeCfg.enabled) {
            clearMathCaptchaInputPrefocus();
            return { ok: false, manualFallback: true, reason: "captcha_ime_disabled" };
        }
        var imeResult = sendCaptchaAnswerToInputMethod(answer);
        if (!imeResult.ok) {
            clearMathCaptchaInputPrefocus();
            return {
                ok: false,
                manualFallback: true,
                reason: imeResult.reason || "captcha_ime_unavailable"
            };
        }
        if (!imeResult.ack || !imeResult.ack.ok) {
            sleep(imeCfg.commitWaitMs || CONFIG.captcha.afterInputMs);
        }
        var result = finishCaptchaInput(answer, submitPoint, "captcha_ime");
        clearMathCaptchaInputPrefocus();
        return result;
    }

    function isSliderGrayPixel(color) {
        var r = colors.red(color);
        var g = colors.green(color);
        var b = colors.blue(color);
        var min = Math.min(r, g, b);
        var max = Math.max(r, g, b);
        var cfg = CONFIG.captcha.slider;
        return min >= cfg.grayMin && max <= cfg.grayMax && (max - min) <= cfg.grayChromaMax;
    }

    function isSliderTrackPixel(color) {
        var r = colors.red(color);
        var g = colors.green(color);
        var b = colors.blue(color);
        var min = Math.min(r, g, b);
        var max = Math.max(r, g, b);
        return min >= 205 && max <= 235 && (max - min) <= 12;
    }

    function isSliderArrowPixel(color) {
        return colors.red(color) <= 55 && colors.green(color) <= 55 && colors.blue(color) <= 60;
    }

    function sliderBrightness(color) {
        return (colors.red(color) + colors.green(color) + colors.blue(color)) / 3;
    }

    function sliderChroma(color) {
        var r = colors.red(color);
        var g = colors.green(color);
        var b = colors.blue(color);
        return Math.max(r, g, b) - Math.min(r, g, b);
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

    function buildSliderResult(region, boxes, source, extraDetail) {
        if (!boxes || boxes.length < 1) {
            return { ok: false, reason: "slider_boxes_empty", boxes: [] };
        }
        if (boxes.length === 1) {
            var only = boxes[0];
            var onlyDetail = "target=(" + Math.round(only.centerX) + "," + Math.round(only.centerY) + "," +
                Math.round(only.w) + "x" + Math.round(only.h) + ")";
            if (source) onlyDetail = "source=" + source + " " + onlyDetail;
            if (extraDetail) onlyDetail += " " + extraDetail;
            return {
                ok: true,
                region: region,
                target: only,
                boxes: [only],
                fallback: source || "",
                detail: onlyDetail
            };
        }
        boxes.sort(function (a, b) { return b.w - a.w; });
        var pair = boxes.slice(0, 2);
        pair.sort(function (a, b) {
            if (a.w !== b.w) return a.w - b.w;
            return a.centerX - b.centerX;
        });
        var target = pair[0];
        var detail = "small=(" + Math.round(target.centerX) + "," + Math.round(target.centerY) + "," +
            Math.round(target.w) + "x" + Math.round(target.h) + ") large=(" +
            Math.round(pair[1].centerX) + "," + Math.round(pair[1].centerY) + "," +
            Math.round(pair[1].w) + "x" + Math.round(pair[1].h) + ")";
        if (source) detail = "source=" + source + " " + detail;
        if (extraDetail) detail += " " + extraDetail;
        return {
            ok: true,
            region: region,
            target: target,
            boxes: pair,
            fallback: source || "",
            detail: detail
        };
    }

    function shouldUsePollutedSliderFallback(typeProbe) {
        return !!(typeProbe && typeProbe.uiSliderOk && typeProbe.imagePolluted);
    }

    function recognizeSliderByBrightColumns(img, region, pixelAt) {
        var cfg = CONFIG.captcha.slider;
        var step = cfg.pollutedFallbackStep || 8;
        var yStart = Math.round(region.h * 0.34);
        var yEnd = Math.round(region.h * 0.9);
        var columnSamples = Math.max(1, Math.floor((yEnd - yStart) / step));
        var strongColumnRatio = cfg.pollutedBrightColumnStrongRatio || 0.48;
        var minColumnRatio = cfg.pollutedBrightColumnMinRatio || 0.28;
        var preferredMaxCenterX = region.x + region.w * (cfg.pollutedBrightMaxCenterRatio || 0.72);
        var minSide = scaleX((cfg.minSide || 90) * 0.85);
        var maxSide = scaleX((cfg.maxSide || 215) * 1.10);
        var minCenterX = region.x + region.w * (cfg.pollutedFallbackMinCenterRatio || 0.30);
        var colCount = [];
        var x;
        var y;
        for (x = 0; x <= region.w; x += step) {
            colCount[Math.floor(x / step)] = 0;
        }
        for (y = yStart; y < yEnd; y += step) {
            for (x = 0; x < region.w; x += step) {
                var color = pixelAt(region.x + x, region.y + y);
                var br = sliderBrightness(color);
                var ch = sliderChroma(color);
                if (br >= 205 && br <= 245 && ch <= 16) {
                    colCount[Math.floor(x / step)]++;
                }
            }
        }

        var boxes = [];
        var runDetails = [];
        function appendBoxesForRatio(ratio) {
            var minColumnHits = Math.max(8, Math.round(columnSamples * ratio));
            var runs = [];
            var inRun = false;
            var startSlot = 0;
            var quietSlots = 0;
            for (var slot = 0; slot <= colCount.length; slot++) {
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
            runDetails.push(ratio + ":" + runs.length + "/" + minColumnHits);
            for (var i = 0; i < runs.length; i++) {
                var run = runs[i];
                var runW = run.x2 - run.x1 + 1;
                var centerX = region.x + run.x1 + runW / 2;
                if (runW < minSide || runW > maxSide || centerX < minCenterX) continue;
                boxes.push({
                    x: region.x + run.x1,
                    y: region.y + yStart,
                    w: runW,
                    h: runW,
                    area: runW * runW,
                    centerX: centerX,
                    centerY: region.y + yStart + runW / 2,
                    columnRatio: ratio,
                    minColumnHits: minColumnHits
                });
            }
        }
        appendBoxesForRatio(strongColumnRatio);
        if (minColumnRatio !== strongColumnRatio) appendBoxesForRatio(minColumnRatio);
        if (boxes.length < 1) {
            return { ok: false, reason: "bright_columns_boxes=0 runs=" + runDetails.join(","), boxes: [] };
        }
        var preferred = [];
        for (var bi = 0; bi < boxes.length; bi++) {
            if (boxes[bi].centerX <= preferredMaxCenterX) preferred.push(boxes[bi]);
        }
        var pool = preferred.length ? preferred : boxes;
        pool.sort(function (a, b) {
            if (a.columnRatio !== b.columnRatio) return b.columnRatio - a.columnRatio;
            return a.centerX - b.centerX;
        });
        var best = pool[0];
        return buildSliderResult(region, [best], "polluted_bright_columns",
            "runs=" + runDetails.join(",") + " step=" + step +
            " minColumnHits=" + best.minColumnHits +
            " columnRatio=" + best.columnRatio);
    }

    function isPollutedComponentPixel(color) {
        var cfg = CONFIG.captcha.slider;
        var br = sliderBrightness(color);
        var ch = sliderChroma(color);
        return br >= (cfg.pollutedComponentBrightnessMin || 185) &&
            br <= (cfg.pollutedComponentBrightnessMax || 246) &&
            ch <= (cfg.pollutedComponentChromaMax || 32);
    }

    function recognizeSliderByPollutedComponents(img, region, pixelAt) {
        var cfg = CONFIG.captcha.slider;
        var step = cfg.pollutedComponentStep || 10;
        var yStart = Math.round(region.h * (cfg.pollutedComponentYStartRatio || 0.30));
        var yEnd = Math.round(region.h * (cfg.pollutedComponentYEndRatio || 0.86));
        var gridW = Math.ceil(region.w / step);
        var gridH = Math.ceil((yEnd - yStart) / step);
        var minCells = cfg.pollutedComponentMinCells || 12;
        var minSide = scaleX((cfg.minSide || 90) * (cfg.pollutedComponentMinSideRatio || 0.75));
        var maxSide = scaleX((cfg.maxSide || 215) * (cfg.pollutedComponentMaxSideRatio || 1.12));
        var minCenterX = region.x + region.w * (cfg.pollutedFallbackMinCenterRatio || 0.30);
        var minFillRatio = cfg.pollutedComponentMinFillRatio || 0.45;
        var minGrayRatio = cfg.pollutedComponentMinGrayRatio || 0.55;
        var minNeutralRatio = cfg.pollutedComponentMinNeutralRatio || 0.65;
        var maxDarkRatio = cfg.pollutedComponentMaxDarkRatio || 0.18;
        var minScore = cfg.pollutedComponentMinScore || 70;
        var mask = [];
        var seen = [];
        var gx;
        var gy;
        for (gy = 0; gy < gridH; gy++) {
            mask[gy] = [];
            seen[gy] = [];
            for (gx = 0; gx < gridW; gx++) {
                var px = region.x + gx * step;
                var py = region.y + yStart + gy * step;
                mask[gy][gx] = px < region.x + region.w && py < region.y + yEnd &&
                    isPollutedComponentPixel(pixelAt(px, py));
                seen[gy][gx] = false;
            }
        }

        var candidates = [];
        var rejected = 0;
        var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (gy = 0; gy < gridH; gy++) {
            for (gx = 0; gx < gridW; gx++) {
                if (!mask[gy][gx] || seen[gy][gx]) continue;
                var qx = [gx];
                var qy = [gy];
                var head = 0;
                seen[gy][gx] = true;
                var cells = 0;
                var minGx = gx;
                var maxGx = gx;
                var minGy = gy;
                var maxGy = gy;
                while (head < qx.length) {
                    var cx = qx[head];
                    var cy = qy[head];
                    head++;
                    cells++;
                    if (cx < minGx) minGx = cx;
                    if (cx > maxGx) maxGx = cx;
                    if (cy < minGy) minGy = cy;
                    if (cy > maxGy) maxGy = cy;
                    for (var di = 0; di < dirs.length; di++) {
                        var nx = cx + dirs[di][0];
                        var ny = cy + dirs[di][1];
                        if (nx < 0 || ny < 0 || nx >= gridW || ny >= gridH) continue;
                        if (!mask[ny][nx] || seen[ny][nx]) continue;
                        seen[ny][nx] = true;
                        qx.push(nx);
                        qy.push(ny);
                    }
                }
                if (cells < minCells) continue;
                var boxX = region.x + minGx * step;
                var boxY = region.y + yStart + minGy * step;
                var boxW = (maxGx - minGx + 1) * step;
                var boxH = (maxGy - minGy + 1) * step;
                var centerX = boxX + boxW / 2;
                var centerY = boxY + boxH / 2;
                var shapeRatio = boxH ? boxW / boxH : 99;
                var fillRatio = cells / ((maxGx - minGx + 1) * (maxGy - minGy + 1));
                if (boxW < minSide || boxW > maxSide || boxH < minSide || boxH > maxSide ||
                    shapeRatio < 0.45 || shapeRatio > 2.0 || centerX < minCenterX || fillRatio < minFillRatio) {
                    rejected++;
                    continue;
                }

                var total = 0;
                var neutral = 0;
                var gray = 0;
                var dark = 0;
                for (var yy = boxY; yy < Math.min(boxY + boxH, region.y + yEnd); yy += step) {
                    for (var xx = boxX; xx < Math.min(boxX + boxW, region.x + region.w); xx += step) {
                        var color = pixelAt(xx, yy);
                        var br = sliderBrightness(color);
                        var ch = sliderChroma(color);
                        total++;
                        if (br >= 150 && br <= 252 && ch <= 65) neutral++;
                        if (isPollutedComponentPixel(color)) gray++;
                        if (br < 70) dark++;
                    }
                }
                var neutralRatio = total ? neutral / total : 0;
                var grayRatio = total ? gray / total : 0;
                var darkRatio = total ? dark / total : 1;
                var score = fillRatio * 45 + grayRatio * 45 + neutralRatio * 20 - darkRatio * 50 -
                    Math.abs(boxW - boxH) * 0.08;
                if (score < minScore || grayRatio < minGrayRatio || neutralRatio < minNeutralRatio || darkRatio > maxDarkRatio) {
                    rejected++;
                    continue;
                }
                candidates.push({
                    x: boxX,
                    y: boxY,
                    w: boxW,
                    h: boxH,
                    area: boxW * boxH,
                    centerX: centerX,
                    centerY: centerY,
                    score: score,
                    fillRatio: fillRatio,
                    grayRatio: grayRatio,
                    neutralRatio: neutralRatio,
                    darkRatio: darkRatio
                });
            }
        }

        if (candidates.length < 1) {
            return { ok: false, reason: "polluted_component_candidates=0 rejected=" + rejected, boxes: [] };
        }
        candidates.sort(function (a, b) {
            if (a.score !== b.score) return b.score - a.score;
            return a.centerX - b.centerX;
        });
        var best = candidates[0];
        return buildSliderResult(region, [best], "polluted_component",
            "score=" + best.score.toFixed(1) +
            " fill=" + best.fillRatio.toFixed(2) +
            " gray=" + best.grayRatio.toFixed(2) +
            " neutral=" + best.neutralRatio.toFixed(2) +
            " dark=" + best.darkRatio.toFixed(2) +
            " candidates=" + candidates.length +
            " rejected=" + rejected +
            " step=" + step);
    }

    function pollutedEdgeScore(img, region, relX, yStart, yEnd, step, pixelAt) {
        relX = Math.round(relX);
        if (relX < step * 2) relX = step * 2;
        if (relX > region.w - step * 2) relX = region.w - step * 2;
        var total = 0;
        var score = 0;
        for (var y = yStart; y < yEnd; y += step) {
            var left = sliderBrightness(pixelAt(region.x + relX - step, region.y + y));
            var right = sliderBrightness(pixelAt(region.x + relX + step, region.y + y));
            score += Math.abs(right - left);
            total++;
        }
        return total ? score / total : 0;
    }

    function recognizeSliderByPollutedEdges(img, region, pixelAt) {
        var cfg = CONFIG.captcha.slider;
        var step = cfg.pollutedEdgeStep || Math.max(12, cfg.pollutedFallbackStep || 8);
        var yStart = Math.round(region.h * 0.34);
        var yEnd = Math.round(region.h * 0.9);
        var minSide = scaleX((cfg.minSide || 90) * 0.85);
        var maxSide = scaleX((cfg.maxSide || 215) * 0.90);
        var minCenterX = region.x + region.w * (cfg.pollutedFallbackMinCenterRatio || 0.30);
        var minScore = cfg.pollutedFallbackMinScore || 70;
        var minNeutralRatio = cfg.pollutedEdgeMinNeutralRatio || 0.62;
        var maxDarkRatio = cfg.pollutedEdgeMaxDarkRatio || 0.25;
        var candidates = [];
        var rejectedConfidence = 0;
        var edgeCache = {};
        function edgeAt(relX) {
            var key = Math.round(relX / step) * step;
            if (key < step * 2) key = step * 2;
            if (key > region.w - step * 2) key = region.w - step * 2;
            if (edgeCache[key] === undefined) {
                edgeCache[key] = pollutedEdgeScore(img, region, key, yStart, yEnd, step, pixelAt);
            }
            return edgeCache[key];
        }
        for (var x1 = 0; x1 < region.w - minSide; x1 += step) {
            for (var side = minSide; side <= maxSide; side += step) {
                var x2 = x1 + side;
                if (x2 >= region.w) continue;
                var centerX = region.x + x1 + side / 2;
                if (centerX < minCenterX) continue;
                var leftEdge = edgeAt(x1);
                var rightEdge = edgeAt(x2);
                if (leftEdge <= 15 || rightEdge <= 15) continue;
                var neutral = 0;
                var dark = 0;
                var total = 0;
                var sampleBottom = Math.min(yStart + side, yEnd);
                for (var xx = x1 + step; xx < x2 - step; xx += step * 2) {
                    for (var yy = yStart + step; yy < sampleBottom - step; yy += step * 2) {
                        var color = pixelAt(region.x + xx, region.y + yy);
                        var br = sliderBrightness(color);
                        var ch = sliderChroma(color);
                        total++;
                        if (br >= 150 && br <= 252 && ch <= 65) neutral++;
                        if (br < 70) dark++;
                    }
                }
                var neutralRatio = total ? neutral / total : 0;
                var darkRatio = total ? dark / total : 1;
                var score = leftEdge + rightEdge + neutralRatio * 20 - darkRatio * 25;
                if (score < minScore) continue;
                if (neutralRatio < minNeutralRatio || darkRatio > maxDarkRatio) {
                    rejectedConfidence++;
                    continue;
                }
                candidates.push({
                    x: region.x + x1,
                    y: region.y + yStart,
                    w: side,
                    h: side,
                    area: side * side,
                    centerX: centerX,
                    centerY: region.y + yStart + side / 2,
                    score: score,
                    neutralRatio: neutralRatio,
                    darkRatio: darkRatio
                });
            }
        }
        if (candidates.length < 1) {
            return { ok: false, reason: "polluted_edge_candidates=0 rejectedConfidence=" + rejectedConfidence, boxes: [] };
        }
        var preferredMaxCenterX = region.x + region.w * 0.70;
        var preferred = [];
        for (var ci = 0; ci < candidates.length; ci++) {
            if (candidates[ci].centerX <= preferredMaxCenterX) preferred.push(candidates[ci]);
        }
        var pool = preferred.length ? preferred : candidates;
        pool.sort(function (a, b) {
            if (a.score !== b.score) return b.score - a.score;
            return a.centerX - b.centerX;
        });
        var best = pool[0];
        return buildSliderResult(region, [best], "polluted_edge",
            "score=" + best.score.toFixed(1) +
            " neutral=" + best.neutralRatio.toFixed(2) +
            " dark=" + best.darkRatio.toFixed(2) +
            " candidates=" + candidates.length +
            " rejectedConfidence=" + rejectedConfidence);
    }

    function recognizeSliderByPollutedFallback(img, region, pixelAt) {
        var cfg = CONFIG.captcha.slider;
        var bright = recognizeSliderByBrightColumns(img, region, pixelAt);
        var brightMaxCenterX = region.x + region.w * (cfg.pollutedBrightMaxCenterRatio || 0.72);
        if (bright.ok && bright.target && bright.target.centerX <= brightMaxCenterX) return bright;
        var component = recognizeSliderByPollutedComponents(img, region, pixelAt);
        if (component.ok) return component;
        var edge = recognizeSliderByPollutedEdges(img, region, pixelAt);
        if (edge.ok) return edge;
        var brightReason = bright.ok ? "bright_too_far_right targetX=" + Math.round(bright.target.centerX) : bright.reason;
        return { ok: false, reason: brightReason + " " + component.reason + " " + edge.reason, boxes: [] };
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
        var sliderProfile = activeSliderProfile();
        if (sliderProfile) {
            return detectSliderCaptchaByRegions(
                img,
                normalizeProfileRegion(sliderProfile.trackRegion, "profileSliderTrack", true),
                normalizeProfileRegion(sliderProfile.handleRegion, "profileSliderHandle", true),
                normalizeProfileRegion(sliderProfile.imageSearchRegion, "profileSliderImageSearch", true)
            );
        }
        return detectSliderCaptchaByRegions(
            img,
            scaledRegion(cfg.trackProbeRegion),
            scaledRegion(cfg.arrowProbeRegion),
            scaledRegion(cfg.imageRegion)
        );
    }

    function recognizeSliderCaptcha(img, typeProbe) {
        var cfg = CONFIG.captcha.slider;
        var sliderProfile = activeSliderProfile();
        if (sliderProfile) {
            return recognizeSliderCaptchaInRegion(
                img,
                normalizeProfileRegion(sliderProfile.imageSearchRegion, "profileSliderImageSearch", true),
                typeProbe
            );
        }
        return recognizeSliderCaptchaInRegion(img, scaledRegion(cfg.imageRegion), typeProbe);
    }

    function recognizeSliderCaptchaInRegion(img, region, typeProbe) {
        var cfg = CONFIG.captcha.slider;
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
            if (shouldUsePollutedSliderFallback(typeProbe)) {
                var fallback = recognizeSliderByPollutedFallback(img, region, pixelAt);
                if (fallback.ok) return fallback;
                return {
                    ok: false,
                    reason: "slider_target_not_found gray_boxes=" + boxes.length +
                        " runs=" + runs.length + " fallback=" + fallback.reason,
                    region: region,
                    boxes: boxes
                };
            }
            return { ok: false, reason: "slider_gray_boxes=" + boxes.length + " runs=" + runs.length, region: region, boxes: boxes };
        }
        return buildSliderResult(region, boxes, "", "runs=" + runs.length);
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

    function centerOfRegion(region) {
        return {
            x: Math.round(region.x + region.w / 2),
            y: Math.round(region.y + region.h / 2)
        };
    }

    function recognizeMathFromImage(img, region) {
        var normalized = normalizeProfileRegion(region, "profileMathExpression", true);
        return recognizeCaptchaAcrossRegions(img, [normalized]);
    }

    function probeSliderFromImage(img, profile) {
        var slider = profile && profile.sliderProfile ? profile.sliderProfile : profile;
        if (!slider) {
            return { ok: false, reason: "missing_slider_profile" };
        }
        var searchRegion = normalizeProfileRegion(slider.imageSearchRegion, "profileSliderImageSearch", true);
        var handleRegion = normalizeProfileRegion(slider.handleRegion, "profileSliderHandle", true);
        var trackRegion = normalizeProfileRegion(slider.trackRegion, "profileSliderTrack", true);
        var trackProbe = detectSliderCaptchaByRegions(img, trackRegion, handleRegion, searchRegion);
        var sliderResult = recognizeSliderCaptchaInRegion(img, searchRegion, trackProbe);
        var start = centerOfRegion(handleRegion);
        var targetPoint = null;
        if (sliderResult && sliderResult.ok) {
            targetPoint = {
                x: Math.round(sliderResult.target.centerX),
                y: start.y
            };
        }
        return {
            ok: !!(trackProbe.ok && sliderResult && sliderResult.ok),
            typeOk: !!trackProbe.ok,
            actualType: trackProbe.ok ? "slider" : "math",
            type: "slider",
            reason: trackProbe.ok
                ? (sliderResult.ok ? "" : sliderResult.reason)
                : "slider_track_probe_failed trackRatio=" + trackProbe.ratio + " arrowRatio=" + trackProbe.arrowRatio,
            trackProbe: trackProbe,
            slider: sliderResult,
            startPoint: start,
            targetPoint: targetPoint,
            detail: sliderResult && sliderResult.detail ? sliderResult.detail : ""
        };
    }

    function dragSliderCaptcha(sliderResult) {
        var cfg = CONFIG.captcha.slider;
        var sliderProfile = activeSliderProfile();
        var start = sliderProfile
            ? pointFromRegionCenter("sliderHandleStart", sliderProfile.handleRegion)
            : basePoint("sliderHandleStart", cfg.handleStartPoint.x, cfg.handleStartPoint.y);
        var submitPoint = sliderProfile
            ? pointFromRegionCenter("sliderCaptchaSubmit", sliderProfile.submitRegion)
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
        deps.pressPoint("滑块验证码确定", submitPoint);
        return { ok: true, submitted: true, detail: sliderResult.detail };
    }

    function solveAfterConfirm() {
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
        var regions = buildExpressionRegions();
        var failureRegion = regions.length ? regions[0] : scaledRegion(CONFIG.captcha.expressionRegion);
        try {
            logx("验证码开始截图 regions=" + JSON.stringify(regions));
            img = captureScreen();
            captureCost = Date.now() - captureStart;
            stats.capture = captureCost;
            logx("验证码截图完成 capture=" + captureCost + "ms");
            saveCaptchaSceneBeforeSolve(img);

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
                var sliderResult = recognizeSliderCaptcha(img, trackProbe);
                if (sliderResult.ok) {
                    recognizeCost = Date.now() - recognizeStart;
                    stats.recognize = recognizeCost;
                    stats.captchaType = "slider";
                    failureRegion = sliderResult.region;

                    inputStart = Date.now();
                    var dragResult = dragSliderCaptcha(sliderResult);
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
                    return {
                        ok: true,
                        type: "slider",
                        detail: sliderResult.detail,
                        finalSubmitSkipped: dragResult && dragResult.finalSubmitSkipped === true,
                        stats: stats
                    };
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
                return {
                    ok: false,
                    manualFallback: true,
                    type: "slider",
                    reason: stats.reason,
                    detail: sliderResult.detail || "",
                    stats: stats
                };
            } else {
                logx("未识别为滑块验证码，进入数学题 OCR");
                prefocusMathCaptchaInput("before_math_ocr");
            }

            var result = recognizeCaptchaAcrossRegions(img, regions);
            if (!result.ok && result.emptyOcr && CONFIG.captcha.emptyOcrRetryWaitMs > 0) {
                var retryWait = CONFIG.captcha.emptyOcrRetryWaitMs;
                logx("数学题验证码 OCR 为空，等待 " + retryWait + "ms 后重新截图识别");
                sleep(retryWait);
                stats.wait += retryWait;
                if (img) {
                    try { img.recycle(); } catch (ignoredRetryRecycle) {}
                    img = null;
                }
                var retryCaptureStart = Date.now();
                img = captureScreen();
                var retryCaptureCost = Date.now() - retryCaptureStart;
                stats.capture += retryCaptureCost;
                logx("验证码重试截图完成 capture=" + retryCaptureCost + "ms totalCapture=" + stats.capture + "ms");
                result = recognizeCaptchaAcrossRegions(img, regions);
            }
            recognizeCost = Date.now() - recognizeStart;
            stats.recognize = recognizeCost;
            stats.captchaType = "math";
            if (!result.ok) {
                failureRegion = result.region || failureRegion;
                saveCaptchaFailure(img, failureRegion, result.reason + " raw=" + result.raw);
                stats.outcome = "fail";
                stats.raw = result.raw || stats.raw;
                stats.reason = result.reason;
                logx("验证码耗时汇总 " + captchaStatsText(stats, Date.now() - allStart));
                return {
                    ok: false,
                    manualFallback: true,
                    type: "math",
                    reason: "验证码识别失败：" + result.reason + " raw=" + result.raw,
                    stats: stats
                };
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
                stats.detail = result.detail;
                stats.reason = inputResult.reason;
                logx("验证码输入未完成，保留页面给人工兜底 reason=" + inputResult.reason);
                logx("验证码耗时汇总 " + captchaStatsText(stats, Date.now() - allStart));
                return {
                    ok: false,
                    manualFallback: true,
                    type: "math",
                    reason: "验证码输入未完成：" + inputResult.reason,
                    stats: stats
                };
            }
            stats.outcome = "success";
            stats.raw = result.raw;
            stats.expression = result.expression;
            stats.answer = result.answer;
            stats.detail = result.detail;

            logx("验证码识别成功 raw=" + result.raw + " expression=" + result.expression + " answer=" + result.answer +
                " detail=" + result.detail + " wait=" + stats.wait + "ms capture=" + stats.capture +
                "ms recognize=" + recognizeCost + "ms input=" + inputCost + "ms total=" + (Date.now() - allStart) + "ms");
            logx("验证码耗时汇总 " + captchaStatsText(stats, Date.now() - allStart));
            return {
                ok: true,
                type: "math",
                raw: result.raw,
                expression: result.expression,
                answer: result.answer,
                detail: result.detail,
                finalSubmitSkipped: inputResult && inputResult.finalSubmitSkipped === true,
                stats: stats
            };
        } catch (e) {
            stats.outcome = stats.outcome === "fail" ? stats.outcome : "exception";
            stats.reason = stats.reason || String(e);
            logx("验证码阶段异常 err=" + e + " stack=" + (e && e.stack ? e.stack : ""));
            if (img) {
                saveCaptchaFailure(img, failureRegion, "exception=" + e);
            }
            logx("验证码耗时汇总 " + captchaStatsText(stats, Date.now() - allStart));
            return {
                ok: false,
                manualFallback: true,
                type: stats.captchaType || "",
                reason: "验证码阶段异常：" + e,
                stats: stats
            };
        } finally {
            clearMathCaptchaInputPrefocus();
            runtime.captchaStats = null;
            if (img) {
                try { img.recycle(); } catch (ignoredRecycle) {}
            }
        }
    }

    return {
        solveAfterConfirm: solveAfterConfirm,
        recognizeMathFromImage: recognizeMathFromImage,
        probeSliderFromImage: probeSliderFromImage,
        recognizeSliderFromImage: function (img, region) {
            return recognizeSliderCaptchaInRegion(img, normalizeProfileRegion(region, "profileSliderImageSearch", true));
        },
        __testRecognizeMath: function (img, regions) {
            return recognizeCaptchaAcrossRegions(img, regions);
        }
    };
}

if (typeof module !== "undefined") {
    module.exports = createNanjingBookingCaptchaSolver;
}
