# Repository Guidelines

## 项目结构与模块组织
本仓库是 Android Gradle 多模块项目。`app` 是主应用模块，`common` 放通用能力，`autojs` 和 `automator` 负责自动化运行时与无障碍操作，`inrt` 与 `apkbuilder` 负责运行时模板和 APK 打包，`paddleocr` 提供 OCR 支持。`LocalRepo` 保存本地依赖库。各模块遵循 Android 目录约定：生产代码在 `src/main`，JVM 单元测试在 `src/test`，设备测试在 `src/androidTest`。应用资源在 `res`、`res-i18n`，内置脚本和示例在 `app/src/main/assets`。

## 构建、测试与本地开发命令
本仓库优先沿用 `run_app_rtn.bat` 的构建流程和本机环境配置。该脚本会设置 `JAVA_HOME`、`GRADLE_USER_HOME`、`ADB_PATH`、`ANDROID_SDK_ROOT`，并按 `ANDROID_SDK_ROOT` 自动生成 `local.properties`。只做构建验证时使用构建模式，不执行 ADB 安装和启动逻辑。

```bat
.\run_app_rtn.bat build
```

该命令会执行 `:app:assembleDebug` 并校验调试 APK，通常产物位于 `app/build/outputs/apk/common/debug`。`test` 可运行 JVM 测试；`connectedAndroidTest` 需要连接真机或模拟器。直接运行 `.\run_app_rtn.bat` 会进入完整本机调试流程，默认安装并启动应用。

## 编码风格与命名规范
代码以 Java、Kotlin、XML 和少量内置 JavaScript 为主。Java/Kotlin 使用 4 空格缩进，并保持现有包结构。类名使用 `PascalCase`，方法、字段和属性使用 `camelCase`，Android 资源使用小写下划线命名，例如 `activity_main.xml`、`ic_launcher.png`。新增实现优先沿用现有 AndroidX、Compose、ButterKnife 与项目工具类模式，避免引入不必要的新框架。

## 测试指南
JVM 测试放在 `src/test/java` 或 `src/test/kotlin`，设备测试放在 `src/androidTest`。测试类以 `*Test` 结尾，参考 `XmlConverterTest.java`、`DepthFirstSearchTargetActionTest.kt`。涉及解析器、脚本运行时、自动化动作或 APK 打包行为的修改，应补充聚焦测试，并在提交说明中写明执行过的测试命令。

## 提交与 Pull Request 规范
现有提交多为简短中文摘要，并直接描述变更内容。建议保持单次提交聚焦，必要时使用 `模块: 变更摘要` 格式。Pull Request 应说明影响模块、用户可见变化、已执行测试、APK 或签名影响；涉及界面变化时附截图或录屏。

## 安全与配置提示
不要提交个人签名密钥、密码、本机 SDK 路径或生成产物。`local.properties`、`sign/`、`apks/`、`build/` 等内容默认不应进入评审。作为本仓库协作规则，代理回复应使用中文，除非用户明确要求其他语言。
