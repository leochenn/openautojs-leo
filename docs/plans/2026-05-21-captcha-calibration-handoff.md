# 验证码坐标校准模块新会话交接提要

请使用中文回复。项目路径：`E:\leo-github\openautojs-leo`。

## 项目背景
这是从官方 OpenAutoJS 拷贝后定制的抢票专用 Android Gradle 多模块项目。主应用在 `app` 模块。当前已定制新主页、微信小程序验证码数字输入法、南京预约抢票脚本。

核心脚本在 `app/src/main/assets/automation_scripts`：

- `nanjing_booking_auto.js`：微信小程序正式抢票主脚本。
- `nanjing_booking_captcha_solver.js`：验证码处理模块，支持数学题验证码和滑块验证码。
- `nanjing_booking_mock_app_test.js`：Mock App 流程验证脚本。
- `nanjing_booking_captcha_image_batch_test.js`：数学验证码离线图片批量测试。
- `wechat_miniapp_ime_input_test.js`：微信小程序 IME 输入冒烟测试。

## 已完成文档
- `docs/plans/2026-05-21-captcha-calibration-requirements.md`
- `docs/plans/2026-05-21-captcha-calibration-development.md`

## 需求结论
新增 App 内“验证码坐标校准模块”。用户从系统相册或文件选择数学验证码和滑块验证码截图，在截图上手工拖拽框选关键区域，生成当前设备专用 `captcha_layout_profile.json`。正式抢票脚本在验证码阶段读取 profile，不再依赖老版本固定验证码区域。

## 第一版范围
- App 首页增加“验证码校准”入口。
- 新增校准页面，使用 Compose。
- 支持数学和滑块两类校准。
- 支持基础截图展示和拖拽框选，不做缩放画布。
- 支持保存 profile。
- 支持基于当前截图模拟识别。
- 正式脚本读取 profile。
- 保留 `skipFinalSubmit` 配置。

## 数学验证码必填标注项
- `mathExpressionRegion`：数学表达式 OCR 区域。
- `mathInputRegion`：输入框区域，保存时取中心点点击。
- `mathSubmitRegion`：确定按钮区域，保存时取中心点点击。

数学表达式居中，不需要额外框选整张验证码图片。

## 滑块验证码必填标注项
- `sliderImageSearchRegion`：大小灰色滑块可能出现的搜索区域。
- `sliderHandleRegion`：黑色箭头或拖动块区域，中心点作为拖动起点。
- `sliderTrackRegion`：滑动轨道区域，用于正式阶段滑块类型判断。
- `sliderSubmitRegion`：确定按钮区域，中心点作为点击点。

## 重要设计决策
- profile 是当前设备专用，不做跨设备复用。
- 截图尺寸必须匹配当前设备屏幕，否则第一版拒绝保存或强提示。
- 用户手工框选为主，不做自动框选。
- 模拟识别建议新增 `nanjing_booking_captcha_profile_simulator.js`，并尽量复用 `nanjing_booking_captcha_solver.js` 的纯识别逻辑。
- 正式脚本中现有固定 `trackProbeRegion` / `arrowProbeRegion` 对新版本滑块已失效，不能直接复用；应改为使用用户校准的 `sliderTrackRegion` / `sliderHandleRegion` 判断滑块。
- profile 缺失、未完成或屏幕尺寸不匹配时，正式脚本应明确提示重新校准，不建议盲跑旧固定坐标。

## 下一步任务建议
新会话中请先阅读本文件、上述两份 `docs/plans` 文档和 `AGENTS.md`，再基于开发文档开始实现。实现前先给出简短开发计划；如果发现文档和代码实际结构冲突，先说明调整方案。

可从第一阶段开始实现：

```text
请从第一阶段开始实现：profile 模型和存储 + 首页验证码校准入口。
```

也可以一次性推进完整闭环：

```text
请按开发文档分阶段实现完整第一版闭环，期间需要构建验证。
```
