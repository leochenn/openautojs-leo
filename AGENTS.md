# Repository Guidelines

## 协作语言
请使用中文回复，除非用户明确要求使用其他语言。

## 项目背景
本仓库是从官方 OpenAutoJS 项目拷贝后进行定制化改造的 Android Gradle 多模块项目，当前核心目标是服务于自动化预约/抢票场景。后续需求通常应优先理解为围绕该定制版 OpenAutoJS 的运行时、无障碍自动化、OCR/截图识别、微信小程序输入、脚本调试和本机打包流程展开，而不是通用 OpenAutoJS 上游开发。

本项目已经做过面向抢票的定制，包括新的主页界面，以及用于微信小程序输入框的定制输入法。该输入法主要服务于验证码答案等数字输入场景，脚本通过广播把识别结果提交给 OpenAutoJS 内置 IME，再由 IME 写入微信小程序输入框。

## 自动化脚本目录
`app/src/main/assets/automation_scripts` 是当前抢票脚本和验证脚本的主要目录。

- `nanjing_booking_auto.js`：微信小程序上的正式南京预约/抢票主脚本，负责启动预约小程序、第一轮采集和缓存坐标、等待正式开抢时间、执行第二轮快速点击、处理登录/弹窗、输出日志和诊断信息。
- `nanjing_booking_captcha_solver.js`：正式脚本加载的验证码处理模块，复用主脚本的截图权限、日志、坐标缩放和点击能力；当前重点支持随机出现的两类验证码弹窗：数学题验证码和滑块验证码。
- `nanjing_booking_mock_app_test.js`：面向用户另行开发的 Mock App 的本地流程测试脚本，用于读取正式脚本第一轮写入的坐标缓存，并在模拟抢票页面中验证第二轮点击链路、验证码识别和输入法联动。
- `nanjing_booking_captcha_image_batch_test.js`：数学验证码离线图片批量测试脚本，用于用本地截图样本验证验证码识别逻辑。
- `wechat_miniapp_ime_input_test.js`：微信小程序自定义 IME 输入冒烟测试脚本，用于验证广播到 OpenAutoJS 验证码数字输入法后能否正常写入目标输入框。

修改这些脚本时，应特别注意正式脚本、Mock 测试脚本和验证码模块之间的配置同步，例如缓存路径、验证码区域、输入法 action/extra、点击坐标、等待时间和是否自动提交。涉及验证码能力的改动，应同时考虑数学题和滑块两类弹窗，不要只验证其中一种。

## 项目结构与模块组织
本仓库是 Android Gradle 多模块项目。`app` 是主应用模块，`common` 放通用能力，`autojs` 和 `automator` 负责自动化运行时与无障碍操作，`inrt` 与 `apkbuilder` 负责运行时模板和 APK 打包，`paddleocr` 提供 OCR 支持。`LocalRepo` 保存本地依赖库。各模块遵循 Android 目录约定：生产代码在 `src/main`，JVM 单元测试在 `src/test`，设备测试在 `src/androidTest`。应用资源在 `res`、`res-i18n`，内置脚本和示例在 `app/src/main/assets`。

## 构建、测试与本地开发命令
协作约定：Codex 不主动执行 Gradle/App 编译验证命令（包括 `run_app_rtn.bat build`、`gradlew`、`:app:assembleDebug` 等），也不使用或读取 `GRADLE_USER_HOME`、Gradle wrapper 分发目录、Gradle 缓存目录（例如 `F:\software\Android-New-Gradle-Cache\.gradle\caches`）或其他 Gradle 相关配置来做验证。涉及需要编译或 Gradle 环境验证的改动时，由 Codex 在回复中提示用户执行相应命令，由用户本机运行并反馈结果。

脚本运行和调试通常依赖真机环境、无障碍服务、截图权限、微信小程序页面状态，以及 `/sdcard/OpenAutoJS_NanjingBooking` 下的日志、缓存和诊断截图。只改 JS 脚本时不一定需要重新打包 APK，但涉及内置资产发布、主页 UI、输入法、权限或 Android 运行时改动时，应执行构建验证。

## 编码风格与命名规范
代码以 Java、Kotlin、XML 和少量内置 JavaScript 为主。Java/Kotlin 使用 4 空格缩进，并保持现有包结构。类名使用 `PascalCase`，方法、字段和属性使用 `camelCase`，Android 资源使用小写下划线命名，例如 `activity_main.xml`、`ic_launcher.png`。新增实现优先沿用现有 AndroidX、Compose、ButterKnife 与项目工具类模式，避免引入不必要的新框架。

自动化脚本应延续现有配置区、日志函数、运行时状态对象和诊断输出风格。涉及正式抢票链路时，优先做小范围、可复盘的改动，并保留关键日志，避免引入会明显拖慢第二轮点击链路的额外等待、OCR 或截图操作。

## 测试指南
JVM 测试放在 `src/test/java` 或 `src/test/kotlin`，设备测试放在 `src/androidTest`。测试类以 `*Test` 结尾，参考 `XmlConverterTest.java`、`DepthFirstSearchTargetActionTest.kt`。涉及解析器、脚本运行时、自动化动作或 APK 打包行为的修改，应补充聚焦测试，并在提交说明中写明执行过的测试命令。

抢票脚本相关改动应按风险选择验证方式：验证码识别算法可优先使用 `nanjing_booking_captcha_image_batch_test.js` 做离线图片批量验证；输入法改动应使用 `wechat_miniapp_ime_input_test.js` 或正式/Mock 流程验证广播输入；第二轮点击链路、缓存读取和验证码联动应使用 `nanjing_booking_mock_app_test.js` 在 Mock App 中复盘。正式微信小程序验证受页面状态、账号、时间窗口和外部服务影响，提交说明中应明确验证环境与限制。

## 提交与 Pull Request 规范
现有提交多为简短中文摘要，并直接描述变更内容。建议保持单次提交聚焦，必要时使用 `模块: 变更摘要` 格式。Pull Request 应说明影响模块、用户可见变化、已执行测试、APK 或签名影响；涉及界面变化时附截图或录屏。

涉及抢票脚本的变更说明应额外写清楚影响的是正式脚本、验证码模块、Mock 测试脚本、离线测试脚本还是输入法通道，并说明是否改变了正式抢票链路的时序、坐标缓存格式、验证码提交策略或日志路径。

## 安全与配置提示
不要提交个人签名密钥、密码、本机 SDK 路径或生成产物。`local.properties`、`sign/`、`apks/`、`build/` 等内容默认不应进入评审。

不要把个人预约信息、账号信息、设备标识、真实日志中的敏感内容写入仓库。脚本中的日期、人数、时间、坐标和包名等配置需要结合实际环境使用，修改默认值时应确认不会破坏正式脚本与 Mock 测试脚本之间的复用关系。
