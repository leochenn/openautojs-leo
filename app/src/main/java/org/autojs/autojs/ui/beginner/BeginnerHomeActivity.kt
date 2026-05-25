@file:OptIn(ExperimentalMaterial3Api::class, ExperimentalPermissionsApi::class)

package org.autojs.autojs.ui.beginner

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.window.Dialog
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import org.autojs.autojs.external.inputmethod.CaptchaInputMethodStatus
import org.autojs.autojs.model.automation.AutomationScripts
import org.autojs.autojs.model.automation.BookingConfig
import org.autojs.autojs.model.script.ScriptFile
import org.autojs.autojs.model.script.Scripts
import org.autojs.autojs.tool.AccessibilityServiceTool
import org.autojs.autojs.ui.captcha.CaptchaCalibrationActivity
import org.autojs.autojs.ui.compose.theme.AutoXJsTheme
import org.autojs.autojs.ui.main.MainActivity
import org.autojs.autojs.ui.main.rememberExternalStoragePermissionsState
import org.autojs.autojs.ui.logupload.LogUploadActivity
import org.autojs.autojs.ui.settings.InputMethodGuideActivity
import org.openautojs.autojs.R

private val AppPrimary = Color(0xFF009688)
private val AppAccent = Color(0xFF03A9F4)
private val AppTextPrimary = Color(0xFF282C2F)
private val AppTextSecondary = Color(0xFF9DA0A2)
private val AppDivider = Color(0xFFF2F3F5)
private val AppError = Color(0xFFFD999A)
private val CardShape = RoundedCornerShape(8.dp)
private val ButtonShape = RoundedCornerShape(4.dp)

class BeginnerHomeActivity : ComponentActivity() {
    private var refreshTick by mutableStateOf(0)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val initialConfig = try {
            AutomationScripts.loadConfig(this)
        } catch (e: Exception) {
            AutomationScripts.defaultConfig
        }
        setContent {
            AutoXJsTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Color.White
                ) {
                    BeginnerHomeScreen(
                        refreshTick = refreshTick,
                        initialConfig = initialConfig,
                        openAdvancedMode = {
                            startActivity(Intent(this, MainActivity::class.java))
                        },
                        openLogUpload = {
                            startActivity(Intent(this, LogUploadActivity::class.java))
                        }
                    )
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        refreshTick++
    }
}

@Composable
private fun BeginnerHomeScreen(
    refreshTick: Int,
    initialConfig: BookingConfig,
    openAdvancedMode: () -> Unit,
    openLogUpload: () -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val storagePermissions = rememberExternalStoragePermissionsState {}
    val storageReady = storagePermissions.allPermissionsGranted
    val accessibilityReady = remember(refreshTick) {
        AccessibilityServiceTool.isAccessibilityServiceEnabled(context)
    }
    val imeEnabled = remember(refreshTick) {
        CaptchaInputMethodStatus.isEnabled(context)
    }
    val imeSelected = remember(refreshTick) {
        CaptchaInputMethodStatus.isSelected(context)
    }
    val captchaProfile = remember(refreshTick) {
        AutomationScripts.loadCaptchaProfile(context)
    }
    val captchaMathReady = captchaProfile?.mathCompleted == true
    val captchaSliderReady = captchaProfile?.sliderCompleted == true
    val captchaReady = captchaMathReady && captchaSliderReady
    val captchaDescription = when {
        captchaReady -> "数学验证码和滑块验证码已完成"
        captchaMathReady -> "数学验证码已完成，滑块验证码未完成"
        captchaSliderReady -> "滑块验证码已完成，数学验证码未完成"
        else -> "正式抢票前需要完成数学和滑块区域校准"
    }

    var visitDate by rememberSaveable { mutableStateOf(initialConfig.visitDate) }
    var period by rememberSaveable { mutableStateOf(initialConfig.period) }
    var visitorCount by rememberSaveable { mutableStateOf(initialConfig.visitorCount) }
    var startTime by rememberSaveable { mutableStateOf(initialConfig.startTime) }
    val config = BookingConfig(
        visitDate = visitDate.trim(),
        period = period,
        visitorCount = visitorCount,
        startTime = startTime.trim()
    )
    val configError = AutomationScripts.validateConfig(config)

    var showSettingsDialog by rememberSaveable { mutableStateOf(false) }

    Scaffold(
        containerColor = Color.White,
        topBar = {
            TopAppBar(
                title = { Text(text = "预约自动化") },
                colors = TopAppBarDefaults.smallTopAppBarColors(
                    containerColor = Color.White,
                    titleContentColor = AppTextPrimary,
                    actionIconContentColor = AppPrimary
                ),
                actions = {
                    TextButton(
                        onClick = { showSettingsDialog = true },
                        colors = ButtonDefaults.textButtonColors(contentColor = AppPrimary)
                    ) {
                        Text(text = "设置")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = "基础准备",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold
            )
            SetupCard(
                storageReady = storageReady,
                accessibilityReady = accessibilityReady,
                imeEnabled = imeEnabled,
                imeSelected = imeSelected,
                requestStoragePermission = {
                    storagePermissions.launchMultiplePermissionRequest()
                },
                openAccessibilitySettings = {
                    context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                },
                openInputMethodGuide = {
                    context.startActivity(Intent(context, InputMethodGuideActivity::class.java))
                },
                captchaReady = captchaReady,
                captchaDescription = captchaDescription,
                openCaptchaCalibration = {
                    context.startActivity(Intent(context, CaptchaCalibrationActivity::class.java))
                }
            )

            Text(
                text = "修改脚本配置",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold
            )
            ConfigCard(
                visitDate = visitDate,
                onVisitDateChange = { value ->
                    if (value.length <= 4 && value.all { it.isDigit() }) {
                        visitDate = value
                    }
                },
                period = period,
                onPeriodChange = { period = it },
                visitorCount = visitorCount,
                onVisitorCountChange = { visitorCount = it },
                startTime = startTime,
                onStartTimeChange = { startTime = it },
                error = configError
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    modifier = Modifier.weight(1f),
                    shape = ButtonShape,
                    border = BorderStroke(1.dp, AppPrimary.copy(alpha = 0.55f)),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = AppPrimary),
                    onClick = {
                        saveConfigOrToast(context, config)
                    }
                ) {
                    Icon(
                        painter = painterResource(id = R.drawable.ic_save),
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(text = "保存配置")
                }
                Button(
                    modifier = Modifier.weight(1f),
                    shape = ButtonShape,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AppPrimary,
                        contentColor = Color.White
                    ),
                    onClick = {
                        runBookingScript(
                            context = context,
                            config = config,
                            storageReady = storageReady,
                            accessibilityReady = accessibilityReady,
                            imeReady = imeEnabled && imeSelected,
                            requestStoragePermission = {
                                storagePermissions.launchMultiplePermissionRequest()
                            },
                            openAccessibilitySettings = {
                                context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                            },
                            openInputMethodGuide = {
                                context.startActivity(Intent(context, InputMethodGuideActivity::class.java))
                            }
                        )
                    }
                ) {
                    Icon(
                        painter = painterResource(id = R.drawable.ic_run),
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(text = "运行脚本")
                }
            }
        }
    }

    if (showSettingsDialog) {
        SettingsDialog(
            onDismissRequest = { showSettingsDialog = false },
            onAdvancedMode = {
                showSettingsDialog = false
                openAdvancedMode()
            },
            onLogUpload = {
                showSettingsDialog = false
                openLogUpload()
            }
        )
    }
}

@Composable
private fun SettingsDialog(
    onDismissRequest: () -> Unit,
    onAdvancedMode: () -> Unit,
    onLogUpload: () -> Unit
) {
    Dialog(onDismissRequest = onDismissRequest) {
        Surface(
            shape = RoundedCornerShape(12.dp),
            color = Color.White
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp)
            ) {
                Text(
                    text = "设置",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.SemiBold,
                    color = AppTextPrimary
                )
                Spacer(modifier = Modifier.height(20.dp))

                OutlinedButton(
                    onClick = onAdvancedMode,
                    modifier = Modifier.fillMaxWidth(),
                    shape = ButtonShape,
                    border = BorderStroke(1.dp, AppPrimary.copy(alpha = 0.55f)),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = AppPrimary)
                ) {
                    Text(text = "高级模式")
                }

                Spacer(modifier = Modifier.height(12.dp))

                OutlinedButton(
                    onClick = onLogUpload,
                    modifier = Modifier.fillMaxWidth(),
                    shape = ButtonShape,
                    border = BorderStroke(1.dp, AppPrimary.copy(alpha = 0.55f)),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = AppPrimary)
                ) {
                    Text(text = "上传日志")
                }

                Spacer(modifier = Modifier.height(16.dp))

                TextButton(
                    onClick = onDismissRequest,
                    modifier = Modifier.align(Alignment.End)
                ) {
                    Text(text = "关闭")
                }
            }
        }
    }
}

@Composable
private fun SetupCard(
    storageReady: Boolean,
    accessibilityReady: Boolean,
    imeEnabled: Boolean,
    imeSelected: Boolean,
    requestStoragePermission: () -> Unit,
    openAccessibilitySettings: () -> Unit,
    openInputMethodGuide: () -> Unit,
    captchaReady: Boolean,
    captchaDescription: String,
    openCaptchaCalibration: () -> Unit
) {
    OutlinedCard(
        modifier = Modifier.fillMaxWidth(),
        shape = CardShape,
        border = BorderStroke(1.dp, AppDivider),
        colors = CardDefaults.outlinedCardColors(containerColor = Color.White)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            SetupStatusRow(
                title = "存储权限",
                description = if (storageReady) "已允许脚本读写日志和缓存" else "用于保存日志、缓存和诊断截图",
                ready = storageReady,
                actionText = if (storageReady) "重新申请" else "去开启",
                onAction = requestStoragePermission
            )
            Divider()
            SetupStatusRow(
                title = "无障碍服务",
                description = if (accessibilityReady) "已允许自动点击和滑动" else "脚本运行前必须开启",
                ready = accessibilityReady,
                actionText = if (accessibilityReady) "查看设置" else "去开启",
                onAction = openAccessibilitySettings
            )
            Divider()
            val imeReady = imeEnabled && imeSelected
            val imeDescription = when {
                imeReady -> "已启用并设为当前输入法"
                imeEnabled -> "已启用，尚未设为当前输入法"
                else -> "用于验证码输入框自动填入数字结果"
            }
            SetupStatusRow(
                title = "数字输入法",
                description = imeDescription,
                ready = imeReady,
                actionText = if (imeReady) "查看设置" else "去设置",
                onAction = openInputMethodGuide
            )
            Divider()
            SetupStatusRow(
                title = "验证码校准",
                description = captchaDescription,
                ready = captchaReady,
                actionText = if (captchaReady) "查看" else "去校准",
                onAction = openCaptchaCalibration
            )
        }
    }
}

@Composable
private fun SetupStatusRow(
    title: String,
    description: String,
    ready: Boolean,
    actionText: String,
    onAction: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (ready) "已完成" else "未完成",
                    color = if (ready) AppPrimary else AppError,
                    style = MaterialTheme.typography.labelMedium
                )
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = description,
                color = AppTextSecondary,
                style = MaterialTheme.typography.bodySmall
            )
        }
        OutlinedButton(
            onClick = onAction,
            shape = ButtonShape,
            border = BorderStroke(1.dp, AppPrimary.copy(alpha = 0.55f)),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = AppPrimary)
        ) {
            Text(text = actionText)
        }
    }
}

@Composable
private fun ConfigCard(
    visitDate: String,
    onVisitDateChange: (String) -> Unit,
    period: String,
    onPeriodChange: (String) -> Unit,
    visitorCount: Int,
    onVisitorCountChange: (Int) -> Unit,
    startTime: String,
    onStartTimeChange: (String) -> Unit,
    error: String?
) {
    OutlinedCard(
        modifier = Modifier.fillMaxWidth(),
        shape = CardShape,
        border = BorderStroke(1.dp, AppDivider),
        colors = CardDefaults.outlinedCardColors(containerColor = Color.White)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            OutlinedTextField(
                modifier = Modifier.fillMaxWidth(),
                value = visitDate,
                onValueChange = onVisitDateChange,
                label = { Text(text = "参观日期") },
                placeholder = { Text(text = "0521") },
                singleLine = true,
                isError = error?.contains("日期") == true || error?.contains("月份") == true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                colors = appTextFieldColors()
            )
            Text(
                text = "格式为 MMDD，例如 0521。",
                color = AppTextSecondary,
                style = MaterialTheme.typography.bodySmall
            )

            Text(text = "参观时段", style = MaterialTheme.typography.titleSmall)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                SelectableButton(
                    modifier = Modifier.weight(1f),
                    text = "上午",
                    selected = period == "上午",
                    onClick = { onPeriodChange("上午") }
                )
                SelectableButton(
                    modifier = Modifier.weight(1f),
                    text = "下午",
                    selected = period == "下午",
                    onClick = { onPeriodChange("下午") }
                )
            }

            Text(text = "参观人数", style = MaterialTheme.typography.titleSmall)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                (1..5).forEach { count ->
                    SelectableButton(
                        modifier = Modifier.weight(1f),
                        text = count.toString(),
                        selected = visitorCount == count,
                        onClick = { onVisitorCountChange(count) }
                    )
                }
            }

            OutlinedTextField(
                modifier = Modifier.fillMaxWidth(),
                value = startTime,
                onValueChange = onStartTimeChange,
                label = { Text(text = "抢票时间") },
                placeholder = { Text(text = "8:00:00.5") },
                singleLine = true,
                isError = error?.contains("时间") == true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
                colors = appTextFieldColors()
            )
            Text(
                text = "支持 HH:mm:ss 或 HH:mm:ss.SSS。",
                color = AppTextSecondary,
                style = MaterialTheme.typography.bodySmall
            )

            if (error != null) {
                Text(
                    text = error,
                    color = AppError,
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}

@Composable
private fun SelectableButton(
    modifier: Modifier,
    text: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    if (selected) {
        Button(
            modifier = modifier,
            onClick = onClick,
            shape = ButtonShape,
            colors = ButtonDefaults.buttonColors(
                containerColor = AppPrimary,
                contentColor = Color.White
            )
        ) {
            Text(text = text)
        }
    } else {
        OutlinedButton(
            modifier = modifier,
            onClick = onClick,
            shape = ButtonShape,
            border = BorderStroke(1.dp, AppPrimary.copy(alpha = 0.55f)),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = AppPrimary)
        ) {
            Text(text = text)
        }
    }
}

@Composable
private fun appTextFieldColors() = TextFieldDefaults.outlinedTextFieldColors(
    textColor = AppTextPrimary,
    focusedBorderColor = AppAccent,
    unfocusedBorderColor = AppDivider,
    focusedLabelColor = AppAccent,
    unfocusedLabelColor = AppTextSecondary,
    cursorColor = AppAccent,
    errorBorderColor = AppError,
    errorLabelColor = AppError,
    errorCursorColor = AppError
)

private fun runBookingScript(
    context: Context,
    config: BookingConfig,
    storageReady: Boolean,
    accessibilityReady: Boolean,
    imeReady: Boolean,
    requestStoragePermission: () -> Unit,
    openAccessibilitySettings: () -> Unit,
    openInputMethodGuide: () -> Unit
) {
    if (!storageReady) {
        toast(context, "请先开启存储权限")
        requestStoragePermission()
        return
    }
    if (!accessibilityReady) {
        toast(context, "请先开启无障碍服务")
        openAccessibilitySettings()
        return
    }
    if (!imeReady) {
        toast(context, "请先启用并选择数字输入法")
        openInputMethodGuide()
        return
    }
    if (!saveConfigOrToast(context, config)) {
        return
    }
    try {
        val mainScript = AutomationScripts.mainScriptFile(context)
        val execution = Scripts.run(ScriptFile(mainScript.path))
        if (execution != null) {
            toast(context, "脚本已启动")
        } else {
            toast(context, "脚本启动失败")
        }
    } catch (e: Exception) {
        toast(context, "启动失败：${e.message ?: "未知错误"}")
    }
}

private fun saveConfigOrToast(context: Context, config: BookingConfig): Boolean {
    return try {
        AutomationScripts.saveConfig(context, config)
        toast(context, "配置已保存")
        true
    } catch (e: Exception) {
        toast(context, e.message ?: "配置保存失败")
        false
    }
}

private fun toast(context: Context, message: String) {
    Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
}
