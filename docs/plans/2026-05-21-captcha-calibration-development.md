# 验证码坐标校准模块开发文档

## 1. 目标与边界
本开发文档基于 `docs/plans/2026-05-21-captcha-calibration-requirements.md`。目标是在 App 内新增本机专用的验证码校准能力，并让正式抢票脚本在验证码阶段消费校准 profile。

第一版只做基础可用闭环：

- App 内入口、截图选择、截图展示、拖拽框选、模拟识别、保存 profile。
- 正式脚本读取 profile，并用 profile 替代旧的验证码固定区域。
- 保留 `skipFinalSubmit` 行为。

第一版不做跨设备复用、自动框选、缩放画布、多步撤销和云端模板。

## 2. 现有项目落点
当前定制首页在 `app/src/main/java/org/autojs/autojs/ui/beginner/BeginnerHomeActivity.kt`，使用 Compose 实现。预约配置和脚本资产管理在 `app/src/main/java/org/autojs/autojs/model/automation/AutomationScripts.kt`，脚本会从 `app/src/main/assets/automation_scripts` 复制到 `context.filesDir/automation_scripts` 后运行。

验证码相关脚本位于：

- `app/src/main/assets/automation_scripts/nanjing_booking_auto.js`
- `app/src/main/assets/automation_scripts/nanjing_booking_captcha_solver.js`
- `app/src/main/assets/automation_scripts/nanjing_booking_mock_app_test.js`
- `app/src/main/assets/automation_scripts/nanjing_booking_captcha_image_batch_test.js`

建议第一版沿用 Compose，新增校准 Activity，并从 `BeginnerHomeActivity` 提供入口。

## 3. 建议新增与修改文件
Android 侧建议新增：

- `app/src/main/java/org/autojs/autojs/model/automation/CaptchaCalibrationProfile.kt`
- `app/src/main/java/org/autojs/autojs/model/automation/CaptchaCalibrationStore.kt`
- `app/src/main/java/org/autojs/autojs/ui/captcha/CaptchaCalibrationActivity.kt`
- `app/src/main/java/org/autojs/autojs/ui/captcha/CaptchaAnnotationCanvas.kt`
- `app/src/main/java/org/autojs/autojs/ui/captcha/CaptchaCalibrationViewModel.kt`

脚本侧建议新增：

- `app/src/main/assets/automation_scripts/nanjing_booking_captcha_profile_simulator.js`

脚本侧建议修改：

- `app/src/main/assets/automation_scripts/nanjing_booking_auto.js`
- `app/src/main/assets/automation_scripts/nanjing_booking_captcha_solver.js`
- `app/src/main/assets/automation_scripts/nanjing_booking_mock_app_test.js`

Android Manifest 需要注册新的 `CaptchaCalibrationActivity`。

## 4. Profile 存储设计
profile 文件名固定为 `captcha_layout_profile.json`。建议保存到 `AutomationScripts.scriptsDir(context)`，即 app 私有目录下的 `automation_scripts` 目录。这样正式脚本可通过当前脚本所在目录读取同级 profile，和现有 `nanjing_booking_config.json` 的读取方式一致。

建议 `AutomationScripts.kt` 增加：

- `CAPTCHA_PROFILE_FILE_NAME`
- `captchaProfileFile(context): File`
- `loadCaptchaProfile(context): CaptchaCalibrationProfile?`
- `saveCaptchaProfile(context, profile: CaptchaCalibrationProfile)`
- `validateCaptchaProfile(context, profile): String?`

profile 使用 `org.json` 读写，避免引入新 JSON 框架。

示例结构以需求文档为准。Android 数据模型建议包含：

- `CaptchaCalibrationProfile`
- `CaptchaMathProfile`
- `CaptchaSliderProfile`
- `CaptchaRegion`

`inputRegion`、`submitRegion`、`handleRegion` 在正式执行时统一取中心点，profile 不需要额外保存冗余中心点。JS 侧可动态计算中心。

## 5. UI 入口与页面
在 `BeginnerHomeActivity` 的“基础准备”或“修改脚本配置”附近增加一个“验证码校准”入口。入口需要展示校准状态，例如：

- 数学验证码：已完成/未完成。
- 滑块验证码：已完成/未完成。

点击后打开 `CaptchaCalibrationActivity`。该 Activity 使用 Compose，页面结构建议为：

- 顶部栏：标题“验证码校准”，返回按钮。
- 类型选择：数学验证码、滑块验证码。
- 截图选择按钮：调用系统相册或文件选择。
- 状态摘要：当前类型必填项完成情况、模拟识别结果。
- 标注区：展示截图和标注框。
- 底部操作：模拟识别、保存。

第一版截图展示不做缩放。若截图宽高与当前屏幕比例不一致，按宽度等比适配显示，但标注保存时必须把显示坐标换算回原图像素坐标。

## 6. 截图选择
使用 Activity Result API，优先支持 `GetContent` 或 `OpenDocument`：

- MIME 类型使用 `image/*`。
- 用户可从系统相册或文件管理器选择截图。
- 选择后把图片解码为 `Bitmap`，读取原始宽高。
- 同时把原图复制到 app 私有目录，建议路径为 `automation_scripts/captcha_calibration/math_source.png` 或 `slider_source.png`，供模拟脚本读取。

保存前检查截图宽高是否等于当前设备屏幕宽高。第一版若不匹配，直接提示“截图尺寸与当前设备屏幕不一致，请使用本机截图重新校准”，并禁止保存。

## 7. 标注交互
标注项使用单选按钮或横向 segmented controls。数学验证码：

- 表达式区域
- 输入框
- 确定按钮

滑块验证码：

- 灰块搜索区
- 拖动箭头
- 滑动轨道
- 确定按钮

用户选择标注项后，在截图上拖拽生成矩形。重复拖拽同一标注项时覆盖旧区域。矩形需要显示不同颜色和标签。第一版支持：

- 单指拖拽框选。
- 再次框选覆盖。
- 清除当前标注项。
- 保存前必填项完整性检查。

坐标换算规则：

- UI 里维护 `imageDisplayRect`，表示截图在屏幕中的显示区域。
- 手势坐标先裁剪到 `imageDisplayRect`。
- 保存时换算为原图像素：`imageX = (touchX - displayLeft) / displayWidth * bitmapWidth`，Y 同理。
- 所有区域保存整数像素，并保证 `w > 0`、`h > 0`。

## 8. 模拟识别
模拟识别加入第一版，但不执行真实点击、输入或拖动。

推荐实现方式是新增 `nanjing_booking_captcha_profile_simulator.js`，尽量复用现有 JS 识别逻辑，避免 Android 侧重复实现 OCR 和灰块识别。流程：

1. Android 保存临时 profile 和来源截图到 `automation_scripts/captcha_calibration/`。
2. Android 启动模拟脚本，传入或写入模拟配置文件。
3. 模拟脚本读取图片和 profile。
4. 数学模式调用验证码模块中的表达式识别能力，输出 raw、expression、answer、reason。
5. 滑块模式调用灰块识别和轨道校验能力，输出 trackRatio、arrowRatio、startPoint、targetPoint、boxes、reason。
6. 模拟脚本把结果写入 `captcha_calibration_result.json`。
7. Android 轮询或等待结果文件，展示识别结果。

为支持模拟脚本复用，`nanjing_booking_captcha_solver.js` 建议抽出纯识别入口，例如：

- `recognizeMathFromImage(img, region)`
- `probeSliderFromImage(img, profile)`
- `recognizeSliderFromImage(img, region)`

这些入口不应执行点击、输入或 `captureScreen()`，只消费传入图片和区域。

如果第一阶段接入 JS 模拟回传成本过高，可以先完成 UI 和保存，再实现模拟脚本闭环。但在合入第一版前，模拟按钮必须能给出可读结果。

## 9. 正式脚本改造
`nanjing_booking_auto.js` 增加 profile 读取逻辑，路径跟随脚本目录：

- `captchaProfilePath()`
- `loadCaptchaProfile()`
- `applyCaptchaProfileToConfig()`

profile 校验失败时，正式抢票脚本进入验证码阶段应直接失败并提示重新校准，不建议回退到旧固定坐标盲跑。开发调试阶段可以临时保留旧坐标作为开关，但默认路径应使用 profile。

`nanjing_booking_captcha_solver.js` 改造点：

- `buildExpressionRegions()` 优先使用 `profile.mathProfile.expressionRegion`。
- 数学输入点使用 `center(profile.mathProfile.inputRegion)`。
- 数学确定点使用 `center(profile.mathProfile.submitRegion)`。
- 滑块类型判断使用 `profile.sliderProfile.trackRegion` 和 `profile.sliderProfile.handleRegion`。
- 滑块搜索区域使用 `profile.sliderProfile.imageSearchRegion`。
- 滑块起点使用 `center(profile.sliderProfile.handleRegion)`。
- 滑块确定点使用 `center(profile.sliderProfile.submitRegion)`。
- `skipFinalSubmit` 继续沿用现有配置。

注意：新版本样本中现有固定 `trackProbeRegion` 无法识别滑块，因此类型判断必须迁移到用户校准区域。

## 10. Mock 测试脚本改造
`nanjing_booking_mock_app_test.js` 应和正式脚本读取同一份 `captcha_layout_profile.json`。Mock 流程目标是验证：

- profile 是否能正常加载。
- 数学验证码是否使用 profile 的表达式区域、输入框和确定按钮。
- 滑块验证码是否使用 profile 的搜索区、拖动起点、轨道区和确定按钮。
- `skipFinalSubmit` 行为是否保持一致。

Mock 脚本不应维护另一套独立固定坐标，避免正式和测试路径再次分叉。

## 11. 分阶段开发计划
第一阶段：profile 模型和存储

- 增加 Android 数据模型和 `CaptchaCalibrationStore`。
- 增加 profile 读写和校验。
- 在首页展示校准状态入口。

第二阶段：校准 UI

- 新增 `CaptchaCalibrationActivity`。
- 支持系统相册或文件选择截图。
- 支持数学和滑块两类标注。
- 支持拖拽框选、覆盖、清除、保存。

第三阶段：模拟识别

- 新增模拟脚本。
- 抽取验证码 solver 的纯识别入口。
- Android 端保存临时输入并读取模拟结果。
- UI 展示数学或滑块模拟结果。

第四阶段：正式脚本消费 profile

- 正式脚本加载并校验 profile。
- solver 使用 profile 替代固定区域。
- 保留 `skipFinalSubmit`。
- 配置缺失时明确失败提示。

第五阶段：Mock 和回归验证

- Mock 脚本读取 profile。
- 用 `resource/验证码截图` 中的新老样本验证数学和滑块模拟识别。
- 在真机上完成 App 校准、Mock 流程和正式脚本前置校验。

## 12. 验证清单
Android 侧：

- `.\run_app_rtn.bat build`
- App 能打开验证码校准页。
- 能从相册或文件选择截图。
- 截图尺寸不匹配时拒绝保存。
- 三个数学必填项缺失时无法保存。
- 四个滑块必填项缺失时无法保存。
- 保存后首页能显示校准完成状态。

脚本侧：

- 数学 profile 能被正式脚本读取。
- 滑块 profile 能被正式脚本读取。
- 新版本滑块样本不再依赖旧 `trackProbeRegion`。
- `skipFinalSubmit=true` 时不点击确定按钮。
- `skipFinalSubmit=false` 时点击 profile 中的确定按钮。
- profile 缺失或屏幕尺寸不匹配时，脚本给出明确错误。

样本验证：

- `resource/验证码截图/新版本-数学验证码1.png`
- `resource/验证码截图/新版本-数学验证码2.png`
- `resource/验证码截图/新版本-滑块验证码1.png`
- `resource/验证码截图/新版本-滑块验证码2.png`
- 老版本样本用于确认兼容性和避免误判。

## 13. 风险与取舍
最大风险从“自动识别布局不准”转移为“用户框选不准”。第一版通过必填项校验、模拟识别和清晰框选标签降低风险。

模拟识别如果完全复用 JS solver，Android 与脚本之间需要结果文件通信，开发复杂度略高，但可以避免 Android 侧重复实现 OCR 和灰块算法。该取舍更利于后续维护，因为正式抢票路径和模拟识别路径会使用同一套核心识别逻辑。

profile 是当前设备专用配置。即使保存相对坐标，也只作为本机偏移兜底，不作为跨设备分发能力。
