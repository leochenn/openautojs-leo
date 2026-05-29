@file:OptIn(ExperimentalMaterial3Api::class, ExperimentalComposeUiApi::class)

package org.autojs.autojs.ui.captcha

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Paint
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import com.stardust.autojs.execution.ScriptExecution
import org.autojs.autojs.model.automation.AutomationScripts
import org.autojs.autojs.model.automation.CaptchaCalibrationProfile
import org.autojs.autojs.model.automation.CaptchaCalibrationStore
import org.autojs.autojs.model.automation.CaptchaMathProfile
import org.autojs.autojs.model.automation.CaptchaRegion
import org.autojs.autojs.model.automation.CaptchaScreenSize
import org.autojs.autojs.model.automation.CaptchaSliderProfile
import org.autojs.autojs.model.script.ScriptFile
import org.autojs.autojs.model.script.Scripts
import org.autojs.autojs.ui.compose.theme.AutoXJsTheme
import org.json.JSONObject
import org.openautojs.autojs.R
import java.io.File
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.delay
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sqrt

private val AppPrimary = Color(0xFF009688)
private val AppTextPrimary = Color(0xFF282C2F)
private val AppTextSecondary = Color(0xFF6F767A)
private val AppDivider = Color(0xFFF2F3F5)
private val AppError = Color(0xFFFD7778)
private val CardShape = RoundedCornerShape(8.dp)
private val ButtonShape = RoundedCornerShape(4.dp)
private const val MIN_IMAGE_SCALE = 1f
private const val MAX_IMAGE_SCALE = 6f

private const val TYPE_MATH = "math"
private const val TYPE_SLIDER = "slider"
private const val KEY_MATH_EXPRESSION = "mathExpressionRegion"
private const val KEY_MATH_INPUT = "mathInputRegion"
private const val KEY_MATH_SUBMIT = "mathSubmitRegion"
private const val KEY_SLIDER_IMAGE_SEARCH = "sliderImageSearchRegion"
private const val KEY_SLIDER_HANDLE = "sliderHandleRegion"
private const val KEY_SLIDER_TRACK = "sliderTrackRegion"
private const val KEY_SLIDER_SUBMIT = "sliderSubmitRegion"
private const val STEP_TYPE_SELECTION = 0
private const val STEP_IMAGE_PICK = 1
private const val STEP_ANNOTATE = 2
private const val STEP_SIMULATION_PREVIEW = 3
private const val CAPTCHA_SIMULATION_OVERLAY_ACTION = "org.openautojs.autojs.action.CAPTCHA_SIMULATION_OVERLAY"
private const val CAPTCHA_SIMULATION_OVERLAY_PREFS = "captcha_simulation_overlay"
private const val OVERLAY_TYPE_MATH = "math"
private const val OVERLAY_TYPE_SLIDER = "slider"

private data class AnnotationItem(
    val key: String,
    val title: String,
    val shortTitle: String,
    val color: Color
)

private data class CalibrationType(
    val key: String,
    val title: String,
    val items: List<AnnotationItem>
)

private data class CaptchaSourceImage(
    val bitmap: Bitmap,
    val displayName: String
)

private data class SimulationOverlayState(
    val requestId: String,
    val type: String,
    val region: CaptchaRegion,
    val startPoint: Offset? = null,
    val targetPoint: Offset? = null,
    val detail: String = ""
)

private data class SimulationRunState(
    val requestId: String,
    val resultFile: File,
    val execution: ScriptExecution?
)

private data class ImageViewport(
    val scale: Float,
    val offset: Offset
)

private enum class RegionEditMode {
    None,
    ImagePan,
    Move,
    ResizeLeft,
    ResizeRight,
    ResizeTop,
    ResizeBottom
}

private val MathItems = listOf(
    AnnotationItem(KEY_MATH_EXPRESSION, "表达式区域", "表达式", Color(0xFFE53935)),
    AnnotationItem(KEY_MATH_INPUT, "输入框区域", "输入框", Color(0xFF1E88E5)),
    AnnotationItem(KEY_MATH_SUBMIT, "确定按钮", "确定", Color(0xFF43A047))
)

private val SliderItems = listOf(
    AnnotationItem(KEY_SLIDER_IMAGE_SEARCH, "灰块搜索区", "灰块", Color(0xFFE53935)),
    AnnotationItem(KEY_SLIDER_HANDLE, "拖动箭头", "箭头", Color(0xFF1E88E5)),
    AnnotationItem(KEY_SLIDER_TRACK, "滑动轨道", "轨道", Color(0xFFFF9800)),
    AnnotationItem(KEY_SLIDER_SUBMIT, "确定按钮", "确定", Color(0xFF43A047))
)

private val MathType = CalibrationType(
    key = TYPE_MATH,
    title = "数学验证码",
    items = MathItems
)

private val SliderType = CalibrationType(
    key = TYPE_SLIDER,
    title = "滑块验证码",
    items = SliderItems
)

class CaptchaCalibrationActivity : ComponentActivity() {
    private var refreshTick by mutableStateOf(0)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            AutoXJsTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Color.White
                ) {
                    CaptchaCalibrationScreen(
                        refreshTick = refreshTick,
                        onBack = { finish() },
                        onProfileSaved = { refreshTick++ }
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

// ---------------------------------------------------------------------------
// 主屏幕：三步向导
// ---------------------------------------------------------------------------

@Composable
private fun CaptchaCalibrationScreen(
    refreshTick: Int,
    onBack: () -> Unit,
    onProfileSaved: () -> Unit
) {
    val context = LocalContext.current
    val profile = remember(refreshTick) {
        AutomationScripts.loadCaptchaProfile(context)
    }
    val screenSize = remember(refreshTick) {
        CaptchaCalibrationStore.currentScreenSize(context)
    }

    var step by rememberSaveable { mutableStateOf(STEP_TYPE_SELECTION) }
    var selectedTypeKey by rememberSaveable { mutableStateOf(TYPE_MATH) }
    val selectedType = calibrationTypeOf(selectedTypeKey)
    var mathRegions by remember { mutableStateOf(regionsFromMathProfile(profile?.mathProfile)) }
    var sliderRegions by remember { mutableStateOf(regionsFromSliderProfile(profile?.sliderProfile)) }
    var mathImage by remember { mutableStateOf<CaptchaSourceImage?>(null) }
    var sliderImage by remember { mutableStateOf<CaptchaSourceImage?>(null) }
    var simulationImage by remember { mutableStateOf<CaptchaSourceImage?>(null) }
    var message by remember { mutableStateOf<String?>(null) }
    var messageIsError by remember { mutableStateOf(false) }
    var dimensionError by remember { mutableStateOf<String?>(null) }
    val simulationEnabled = remember(profile, refreshTick) {
        profile != null && AutomationScripts.validateCaptchaProfile(context, profile) == null
    }

    LaunchedEffect(profile) {
        mathRegions = regionsFromMathProfile(profile?.mathProfile)
        sliderRegions = regionsFromSliderProfile(profile?.sliderProfile)
    }

    LaunchedEffect(selectedTypeKey) {
        message = null
        messageIsError = false
    }

    val imagePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri != null) {
            try {
                val bitmap = decodeBitmap(context, uri)
                val sourceImage = CaptchaSourceImage(
                    bitmap = bitmap,
                    displayName = "${bitmap.width} x ${bitmap.height}"
                )
                val imgScreenSize = CaptchaCalibrationStore.currentScreenSize(context)
                if (bitmap.width == imgScreenSize.width && bitmap.height == imgScreenSize.height) {
                    if (selectedType.key == TYPE_MATH) {
                        mathImage = sourceImage
                    } else {
                        sliderImage = sourceImage
                    }
                    message = "${selectedType.title}截图已选择"
                    messageIsError = false
                    step = STEP_ANNOTATE
                } else {
                    dimensionError = "截图尺寸 ${bitmap.width} x ${bitmap.height}，与当前屏幕 ${imgScreenSize.width} x ${imgScreenSize.height} 不一致。请使用本机当前屏幕截图。"
                }
            } catch (e: Exception) {
                message = "读取截图失败：${e.message ?: "未知错误"}"
                messageIsError = true
            }
        }
    }

    val simulationImagePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri != null) {
            try {
                val bitmap = decodeBitmap(context, uri)
                val imgScreenSize = CaptchaCalibrationStore.currentScreenSize(context)
                if (bitmap.width == imgScreenSize.width && bitmap.height == imgScreenSize.height) {
                    simulationImage = CaptchaSourceImage(
                        bitmap = bitmap,
                        displayName = "${bitmap.width} x ${bitmap.height}"
                    )
                    message = "模拟测试截图已选择"
                    messageIsError = false
                    step = STEP_SIMULATION_PREVIEW
                } else {
                    dimensionError = "截图尺寸 ${bitmap.width} x ${bitmap.height}，与当前屏幕 ${imgScreenSize.width} x ${imgScreenSize.height} 不一致。请使用本机当前屏幕截图。"
                }
            } catch (e: Exception) {
                message = "读取模拟截图失败：${e.message ?: "未知错误"}"
                messageIsError = true
            }
        }
    }

    val currentImage = if (selectedType.key == TYPE_MATH) mathImage else sliderImage

    Scaffold(
        containerColor = Color.White,
        topBar = {
            if (step < STEP_ANNOTATE) {
                TopAppBar(
                    title = { Text(text = if (step == STEP_TYPE_SELECTION) "验证码校准" else "选择截图") },
                    navigationIcon = {
                        TextButton(
                            onClick = { if (step > STEP_TYPE_SELECTION) step-- else onBack() },
                            colors = ButtonDefaults.textButtonColors(contentColor = AppPrimary)
                        ) {
                            Text(text = if (step > STEP_TYPE_SELECTION) "返回" else "退出")
                        }
                    },
                    colors = TopAppBarDefaults.smallTopAppBarColors(
                        containerColor = Color.White,
                        titleContentColor = AppTextPrimary,
                        navigationIconContentColor = AppPrimary
                    )
                )
            }
        }
    ) { padding ->
        when (step) {
            STEP_TYPE_SELECTION -> TypeSelectionStep(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                profile = profile,
                onSelectType = { key ->
                    selectedTypeKey = key
                    step = STEP_IMAGE_PICK
                },
                simulationEnabled = simulationEnabled,
                onStartSimulation = {
                    if (simulationEnabled) {
                        simulationImagePickerLauncher.launch("image/*")
                    } else {
                        message = "请先完成数学和滑块验证码校准"
                        messageIsError = true
                    }
                }
            )
            STEP_IMAGE_PICK -> ImagePickStep(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                type = selectedType,
                currentImage = currentImage,
                onPickImage = { imagePickerLauncher.launch("image/*") },
                onUseExisting = { step = STEP_ANNOTATE }
            )
            STEP_ANNOTATE -> {
                val currentRegions = if (selectedType.key == TYPE_MATH) mathRegions else sliderRegions
                FullScreenAnnotateStep(
                    sourceImage = currentImage,
                    type = selectedType,
                    regions = currentRegions,
                    message = message,
                    messageIsError = messageIsError,
                    onBack = { step = STEP_IMAGE_PICK },
                    onRegionChange = { key, region ->
                        if (selectedType.key == TYPE_MATH) {
                            mathRegions = mathRegions + (key to region)
                        } else {
                            sliderRegions = sliderRegions + (key to region)
                        }
                    },
                    onSave = {
                        val saveResult = saveCurrentProfile(
                            context = context,
                            type = selectedType,
                            screenSize = screenSize,
                            sourceImage = currentImage,
                            mathRegions = mathRegions,
                            sliderRegions = sliderRegions
                        )
                        if (saveResult == null) {
                            message = "${selectedType.title}校准已保存"
                            messageIsError = false
                            toast(context, "验证码校准已保存")
                            onProfileSaved()
                            step = STEP_TYPE_SELECTION
                        } else {
                            message = saveResult
                            messageIsError = true
                        }
                    }
                )
            }
            STEP_SIMULATION_PREVIEW -> {
                CaptchaSimulationPreviewStep(
                    sourceImage = simulationImage,
                    profile = profile,
                    message = message,
                    messageIsError = messageIsError,
                    onBack = {
                        step = STEP_TYPE_SELECTION
                    }
                )
            }
        }
    }

    if (dimensionError != null) {
        AlertDialog(
            onDismissRequest = { dimensionError = null },
            title = { Text("截图尺寸不匹配") },
            text = { Text(dimensionError!!) },
            confirmButton = {
                TextButton(onClick = { dimensionError = null }) {
                    Text("知道了")
                }
            }
        )
    }
}

// ---------------------------------------------------------------------------
// Step 0：类型选择页
// ---------------------------------------------------------------------------

@Composable
private fun TypeSelectionStep(
    modifier: Modifier,
    profile: CaptchaCalibrationProfile?,
    onSelectType: (String) -> Unit,
    simulationEnabled: Boolean,
    onStartSimulation: () -> Unit
) {
    Column(
        modifier = modifier.padding(horizontal = 24.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "选择要校准的验证码类型",
            style = MaterialTheme.typography.bodyLarge,
            color = AppTextSecondary
        )
        Spacer(modifier = Modifier.height(8.dp))

        TypeCard(
            title = "数学验证码",
            regionCount = 3,
            completed = profile?.mathCompleted == true,
            onClick = { onSelectType(TYPE_MATH) }
        )
        TypeCard(
            title = "滑块验证码",
            regionCount = 4,
            completed = profile?.sliderCompleted == true,
            onClick = { onSelectType(TYPE_SLIDER) }
        )

        Button(
            modifier = Modifier.fillMaxWidth(),
            enabled = simulationEnabled,
            onClick = onStartSimulation,
            shape = ButtonShape,
            colors = ButtonDefaults.buttonColors(
                containerColor = AppPrimary,
                contentColor = Color.White,
                disabledContainerColor = AppDivider,
                disabledContentColor = AppTextSecondary
            )
        ) {
            Text(text = "模拟测试")
        }

        Spacer(modifier = Modifier.weight(1f))
        Text(
            modifier = Modifier.fillMaxWidth(),
            text = if (simulationEnabled) "点击卡片开始校准，或运行模拟测试" else "完成两类校准后可运行模拟测试",
            style = MaterialTheme.typography.bodySmall,
            color = AppTextSecondary,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(8.dp))
    }
}

@Composable
private fun TypeCard(
    title: String,
    regionCount: Int,
    completed: Boolean,
    onClick: () -> Unit
) {
    OutlinedCard(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        shape = CardShape,
        border = BorderStroke(
            width = if (completed) 2.dp else 1.dp,
            color = if (completed) AppPrimary else AppDivider
        ),
        colors = CardDefaults.outlinedCardColors(containerColor = Color.White)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "需要框选 ${regionCount} 个区域",
                    style = MaterialTheme.typography.bodySmall,
                    color = AppTextSecondary
                )
            }
            Text(
                text = if (completed) "✓" else "✗",
                color = if (completed) AppPrimary else AppError,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

// ---------------------------------------------------------------------------
// Step 1：截图选择页
// ---------------------------------------------------------------------------

@Composable
private fun ImagePickStep(
    modifier: Modifier,
    type: CalibrationType,
    currentImage: CaptchaSourceImage?,
    onPickImage: () -> Unit,
    onUseExisting: () -> Unit
) {
    Column(
        modifier = modifier.padding(horizontal = 24.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = type.title,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.SemiBold
        )

        OutlinedCard(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .clickable { onPickImage() },
            shape = CardShape,
            border = BorderStroke(1.dp, AppDivider),
            colors = CardDefaults.outlinedCardColors(containerColor = Color(0xFFF8F9FA))
        ) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                if (currentImage != null) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Image(
                            bitmap = currentImage.bitmap.asImageBitmap(),
                            contentDescription = null,
                            modifier = Modifier
                                .fillMaxWidth()
                                .aspectRatio(currentImage.bitmap.width.toFloat() / currentImage.bitmap.height.toFloat())
                                .clip(CardShape),
                            contentScale = ContentScale.Fit
                        )
                        Text(
                            text = "尺寸 ${currentImage.displayName}",
                            style = MaterialTheme.typography.bodySmall,
                            color = AppPrimary
                        )
                    }
                } else {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Icon(
                            painter = painterResource(id = R.drawable.ic_add_white_48dp),
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = AppTextSecondary
                        )
                        Text(
                            text = "点击选择截图",
                            style = MaterialTheme.typography.titleMedium,
                            color = AppTextSecondary
                        )
                    }
                }
            }
        }

        Column(
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                modifier = Modifier.fillMaxWidth(),
                text = "请使用本机当前屏幕截图，尺寸需与屏幕一致",
                style = MaterialTheme.typography.bodySmall,
                color = AppTextSecondary,
                textAlign = TextAlign.Center
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (currentImage != null) {
                    OutlinedButton(
                        modifier = Modifier.weight(1f),
                        onClick = onPickImage,
                        shape = ButtonShape,
                        border = BorderStroke(1.dp, AppPrimary.copy(alpha = 0.55f)),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = AppPrimary)
                    ) {
                        Text(text = "重新选择")
                    }
                    Button(
                        modifier = Modifier.weight(1f),
                        onClick = onUseExisting,
                        shape = ButtonShape,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = AppPrimary,
                            contentColor = Color.White
                        )
                    ) {
                        Text(text = "进入标注")
                    }
                } else {
                    Button(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = onPickImage,
                        shape = ButtonShape,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = AppPrimary,
                            contentColor = Color.White
                        )
                    ) {
                        Text(text = "选择截图")
                    }
                }
            }
        }
        Spacer(modifier = Modifier.height(8.dp))
    }
}

// ---------------------------------------------------------------------------
// Step 2：全屏标注页
// ---------------------------------------------------------------------------

@Composable
@Suppress("DEPRECATION")
private fun FullScreenAnnotateStep(
    sourceImage: CaptchaSourceImage?,
    type: CalibrationType,
    regions: Map<String, CaptchaRegion>,
    message: String?,
    messageIsError: Boolean,
    onBack: () -> Unit,
    onRegionChange: (String, CaptchaRegion) -> Unit,
    onSave: () -> Unit
) {
    val context = LocalContext.current
    val view = LocalView.current
    FullScreenDialogEffect(context = context, dialogView = view)

    val items = type.items
    var selectedItemKey by rememberSaveable { mutableStateOf<String?>(null) }

    // 进入时自动选中第一个未完成的区域，或第一个区域
    val prefs = remember { context.getSharedPreferences("captcha_calibration", Context.MODE_PRIVATE) }
    var showInstructionDialog by rememberSaveable { mutableStateOf(!prefs.getBoolean("hide_instruction_dialog", false)) }
    var dontShowAgain by remember { mutableStateOf(false) }
    fun dismissInstructionDialog() {
        if (dontShowAgain) prefs.edit().putBoolean("hide_instruction_dialog", true).apply()
        showInstructionDialog = false
    }
    LaunchedEffect(type.key) {
        val firstMissing = items.firstOrNull { regions[it.key]?.isValid != true }
        selectedItemKey = firstMissing?.key ?: items.firstOrNull()?.key
        // 自动放置默认区域
        if (sourceImage != null) {
            items.forEach { item ->
                if (regions[item.key]?.isValid != true) {
                    onRegionChange(item.key, defaultRegionForItem(item.key, sourceImage.bitmap))
                }
            }
        }
    }

    val selectedItem = selectedItemKey?.let { key -> items.firstOrNull { it.key == key } }
    val allCompleted = items.all { regions[it.key]?.isValid == true }

    if (sourceImage == null) {
        Box(
            modifier = Modifier.fillMaxSize().background(Color.Black),
            contentAlignment = Alignment.Center
        ) {
            Text("未选择截图", color = Color.White)
        }
        return
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        FullScreenRegionCanvas(
            modifier = Modifier.fillMaxSize(),
            sourceImage = sourceImage,
            items = items,
            selectedItem = selectedItem,
            regions = regions,
            onRegionChange = onRegionChange,
            onSelectedItemChange = { selectedItemKey = it }
        )

        // 左侧步骤指示器（可拖动）
        StepIndicator(
            modifier = Modifier.align(Alignment.TopStart),
            items = items,
            selectedItemKey = selectedItemKey,
            regions = regions,
            onSelectedItemChange = { selectedItemKey = it }
        )

        // 底部操作栏
        Surface(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth(),
            color = Color.Black.copy(alpha = 0.85f)
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // 状态信息
                if (message != null) {
                    Text(
                        text = message,
                        color = if (messageIsError) AppError else AppPrimary,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        modifier = Modifier.weight(1f),
                        onClick = onBack,
                        shape = ButtonShape,
                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.5f)),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)
                    ) {
                        Text(text = "上一步")
                    }
                    if (allCompleted) {
                        Button(
                            modifier = Modifier.weight(1f),
                            onClick = onSave,
                            shape = ButtonShape,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = AppPrimary,
                                contentColor = Color.White
                            )
                        ) {
                            Text(text = "保存并返回")
                        }
                    } else {
                        Button(
                            modifier = Modifier.weight(1f),
                            onClick = {
                                val currentIdx = items.indexOfFirst { it.key == selectedItemKey }
                                val nextMissing = items.drop(currentIdx + 1)
                                    .firstOrNull { regions[it.key]?.isValid != true }
                                    ?: items.firstOrNull { regions[it.key]?.isValid != true }
                                selectedItemKey = nextMissing?.key
                            },
                            shape = ButtonShape,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = AppPrimary,
                                contentColor = Color.White
                            )
                        ) {
                            Text(text = "完成此区域")
                        }
                    }
                }
            }
        }
        // 使用指南对话框
        if (showInstructionDialog) {
            AlertDialog(
                onDismissRequest = { dismissInstructionDialog() },
                confirmButton = {
                    TextButton(onClick = { dismissInstructionDialog() }) {
                        Text(text = "知道了", color = AppPrimary)
                    }
                },
                title = {
                    Text(text = "标注指南", fontWeight = FontWeight.Bold)
                },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(
                            text = "操作方法",
                            fontWeight = FontWeight.SemiBold,
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Text(
                            text = "① 点击左侧标签或直接点击彩色框选中\n" +
                                "② 拖动框中间区域 → 移动位置\n" +
                                "③ 拖动边缘圆形手柄 → 调整大小\n" +
                                "④ 双指捏合/张开 → 缩放图片",
                            style = MaterialTheme.typography.bodySmall,
                            color = AppTextSecondary
                        )
                        Divider(color = AppDivider)
                        Text(
                            text = "各框应放置的位置",
                            fontWeight = FontWeight.SemiBold,
                            style = MaterialTheme.typography.bodyMedium
                        )
                        val guides = if (type.key == TYPE_MATH) listOf(
                            "表达式" to "覆盖包含数学算式的文字区域（如 3+5=?）",
                            "输入框" to "覆盖用户输入答案的输入框",
                            "确定" to "覆盖「确定」或「提交」按钮"
                        ) else listOf(
                            "灰块" to "覆盖需要识别的灰块拼图区域",
                            "箭头" to "覆盖可拖动的滑块箭头",
                            "轨道" to "覆盖滑块滑动的轨道",
                            "确定" to "覆盖「确定」按钮（如无可忽略）"
                        )
                        guides.forEach { (label, desc) ->
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.Top
                            ) {
                                Text(
                                    text = label,
                                    fontWeight = FontWeight.Bold,
                                    style = MaterialTheme.typography.bodySmall,
                                    modifier = Modifier.width(36.dp)
                                )
                                Text(
                                    text = desc,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = AppTextSecondary
                                )
                            }
                        }
                        Divider(color = AppDivider)
                        Row(
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Checkbox(
                                checked = dontShowAgain,
                                onCheckedChange = { dontShowAgain = it }
                            )
                            Text(
                                text = "下次不再提示",
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                }
            )
        }
    }
}

// ---------------------------------------------------------------------------
// 模拟测试全屏预览
// ---------------------------------------------------------------------------

@Composable
private fun CaptchaSimulationPreviewStep(
    sourceImage: CaptchaSourceImage?,
    profile: CaptchaCalibrationProfile?,
    message: String?,
    messageIsError: Boolean,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val view = LocalView.current
    FullScreenDialogEffect(context = context, dialogView = view)

    var runState by remember { mutableStateOf<SimulationRunState?>(null) }
    val activeRunRef = remember { AtomicReference<SimulationRunState?>(null) }
    var overlayState by remember { mutableStateOf<SimulationOverlayState?>(null) }
    var previewCanvasSize by remember { mutableStateOf(IntSize.Zero) }
    var statusText by remember { mutableStateOf(message ?: "选择截图后可运行模拟测试") }
    var statusIsError by remember { mutableStateOf(messageIsError) }

    DisposableEffect(Unit) {
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                if (intent.action != CAPTCHA_SIMULATION_OVERLAY_ACTION) return
                val currentRun = activeRunRef.get() ?: return
                val incomingRequestId = intent.getStringExtra("requestId") ?: return
                if (incomingRequestId != currentRun.requestId) return
                val type = intent.getStringExtra("type") ?: return
                val region = CaptchaRegion.fromJson(parseJsonOrNull(intent.getStringExtra("regionJson"))) ?: return
                val extra = parseJsonOrNull(intent.getStringExtra("extraJson"))
                overlayState = SimulationOverlayState(
                    requestId = incomingRequestId,
                    type = type,
                    region = region,
                    startPoint = parsePoint(extra?.optJSONObject("startPoint")),
                    targetPoint = parsePoint(extra?.optJSONObject("targetPoint")),
                    detail = extra?.optString("sliderDetail", "") ?: ""
                )
            }
        }
        val filter = IntentFilter(CAPTCHA_SIMULATION_OVERLAY_ACTION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("DEPRECATION")
            context.registerReceiver(receiver, filter)
        }
        onDispose {
            try {
                context.unregisterReceiver(receiver)
            } catch (ignored: Exception) {
            }
            activeRunRef.get()?.let { stopSimulationRun(context, it, cancelled = true) }
            activeRunRef.set(null)
            clearSimulationOverlayPrefs(context)
        }
    }

    LaunchedEffect(overlayState) {
        overlayState?.let {
            delay(50)
            writeOverlayReady(context, it)
        }
    }

    LaunchedEffect(runState) {
        val state = runState ?: return@LaunchedEffect
        while (true) {
            delay(300)
            if (state.resultFile.exists()) {
                val result = runCatching { JSONObject(state.resultFile.readText()) }.getOrNull()
                if (result?.optString("requestId") == state.requestId) {
                    val status = result.optString("status", "unknown")
                    val type = result.optString("type", "")
                    val reason = result.optString("reason", "")
                    statusText = when (status) {
                        "success" -> "模拟测试完成：${if (type.isNotBlank()) type else "unknown"}"
                        "cancelled" -> "模拟测试已取消"
                        else -> "模拟测试失败：${reason.ifBlank { "未知原因" }}"
                    }
                    statusIsError = status != "success" && status != "cancelled"
                    activeRunRef.set(null)
                    runState = null
                    break
                }
            }
        }
    }

    if (sourceImage == null || profile == null) {
        Box(
            modifier = Modifier.fillMaxSize().background(Color.Black),
            contentAlignment = Alignment.Center
        ) {
            Text("模拟测试缺少截图或校准配置", color = Color.White)
        }
        return
    }
    val previewImage = sourceImage
    val activeProfile = profile

    fun startSimulation() {
        if (previewCanvasSize.width != previewImage.bitmap.width || previewCanvasSize.height != previewImage.bitmap.height) {
            statusText = "预览区域尺寸 ${previewCanvasSize.width} x ${previewCanvasSize.height}，与截图 ${previewImage.bitmap.width} x ${previewImage.bitmap.height} 不一致，无法保证坐标一致"
            statusIsError = true
            return
        }
        val validationError = AutomationScripts.validateCaptchaProfile(context, activeProfile)
        if (validationError != null) {
            statusText = validationError
            statusIsError = true
            return
        }
        try {
            clearSimulationOverlayPrefs(context)
            overlayState = null
            val requestId = "sim_${System.currentTimeMillis()}"
            val imageFile = AutomationScripts.captchaSimulationImageFile(context, requestId)
            imageFile.parentFile?.mkdirs()
            imageFile.outputStream().use { output ->
                previewImage.bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
            }
            val resultFile = AutomationScripts.captchaSimulationResultFile(context, requestId)
            if (resultFile.exists()) {
                resultFile.delete()
            }
            val requestFile = AutomationScripts.captchaSimulationRequestFile(context)
            val requestJson = JSONObject()
                .put("schemaVersion", 1)
                .put("requestId", requestId)
                .put("imagePath", imageFile.absolutePath)
                .put("profile", activeProfile.toJson())
                .put("resultPath", resultFile.absolutePath)
                .put("outputDir", AutomationScripts.CAPTCHA_SIMULATION_OUTPUT_DIR)
                .put("mode", "captcha_simulation")
                .put("createdAt", CaptchaCalibrationProfile.nowIsoString())
                .put("overlayTimeoutMs", 3000)
            requestFile.writeText(requestJson.toString(2))

            val pendingState = SimulationRunState(requestId, resultFile, null)
            activeRunRef.set(pendingState)
            runState = pendingState
            statusText = "模拟测试启动中"
            statusIsError = false

            val script = AutomationScripts.captchaSimulationScriptFile(context)
            val execution = Scripts.run(ScriptFile(script.path))
            if (execution == null) {
                activeRunRef.set(null)
                runState = null
                statusText = "模拟测试脚本启动失败"
                statusIsError = true
            } else {
                val startedState = SimulationRunState(requestId, resultFile, execution)
                activeRunRef.set(startedState)
                runState = startedState
                statusText = "模拟测试运行中"
                statusIsError = false
            }
        } catch (e: Exception) {
            activeRunRef.get()?.let { stopSimulationRun(context, it, cancelled = true) }
            activeRunRef.set(null)
            runState = null
            statusText = "启动模拟测试失败：${e.message ?: "未知错误"}"
            statusIsError = true
        }
    }

    fun cancelSimulation() {
        val state = activeRunRef.get() ?: runState ?: return
        stopSimulationRun(context, state, cancelled = true)
        activeRunRef.set(null)
        runState = null
        overlayState = null
        statusText = "模拟测试已取消"
        statusIsError = false
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        SimulationImageCanvas(
            modifier = Modifier.fillMaxSize(),
            sourceImage = previewImage,
            onCanvasSizeChange = { previewCanvasSize = it }
        )

        overlayState?.let { overlay ->
            when (overlay.type) {
                OVERLAY_TYPE_MATH -> SimulationMathInputOverlay(overlay)
                OVERLAY_TYPE_SLIDER -> SimulationSliderOverlay(
                    overlay = overlay,
                    onDragFinished = { end, hit ->
                        writeSliderDragResult(context, overlay, end, hit)
                    }
                )
            }
        }

        Row(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedButton(
                modifier = Modifier.weight(1f),
                enabled = runState == null,
                onClick = onBack,
                shape = ButtonShape,
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.65f)),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)
            ) {
                Text(text = "返回")
            }
            Button(
                modifier = Modifier.weight(1f),
                onClick = {
                    if (runState == null) {
                        startSimulation()
                    } else {
                        cancelSimulation()
                    }
                },
                shape = ButtonShape,
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (runState == null) AppPrimary else AppError,
                    contentColor = Color.White
                )
            ) {
                Text(text = if (runState == null) "运行" else "取消")
            }
        }

        Surface(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth(),
            color = Color.Black.copy(alpha = 0.72f)
        ) {
            Text(
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                text = statusText,
                color = if (statusIsError) AppError else Color.White,
                style = MaterialTheme.typography.bodySmall
            )
        }
    }
}

@Composable
private fun SimulationImageCanvas(
    modifier: Modifier,
    sourceImage: CaptchaSourceImage,
    onCanvasSizeChange: (IntSize) -> Unit
) {
    val bitmap = sourceImage.bitmap
    val imageBitmap = remember(bitmap) { bitmap.asImageBitmap() }
    Canvas(
        modifier = modifier.onSizeChanged(onCanvasSizeChange)
    ) {
        drawImage(
            image = imageBitmap,
            dstOffset = IntOffset.Zero,
            dstSize = IntSize(size.width.roundToInt(), size.height.roundToInt())
        )
    }
}

@Composable
private fun SimulationMathInputOverlay(
    overlay: SimulationOverlayState
) {
    val density = LocalDensity.current
    var text by remember(overlay.requestId) { mutableStateOf("") }
    BasicTextField(
        modifier = Modifier
            .offset { IntOffset(overlay.region.x, overlay.region.y) }
            .width(with(density) { overlay.region.w.toDp() })
            .height(with(density) { overlay.region.h.toDp() })
            .background(Color.White.copy(alpha = 0.96f))
            .padding(horizontal = 8.dp, vertical = 4.dp),
        value = text,
        onValueChange = { text = it },
        singleLine = true,
        textStyle = MaterialTheme.typography.bodyLarge.copy(color = AppTextPrimary)
    )
}

@Composable
private fun SimulationSliderOverlay(
    overlay: SimulationOverlayState,
    onDragFinished: (Offset, Boolean) -> Unit
) {
    val density = LocalDensity.current
    val target = overlay.targetPoint
    var topLeft by remember(overlay.requestId) {
        mutableStateOf(Offset(overlay.region.x.toFloat(), overlay.region.y.toFloat()))
    }
    val handleWidth = with(density) { overlay.region.w.toDp() }
    val handleHeight = with(density) { overlay.region.h.toDp() }
    val center = Offset(
        x = topLeft.x + overlay.region.w / 2f,
        y = topLeft.y + overlay.region.h / 2f
    )

    Canvas(modifier = Modifier.fillMaxSize()) {
        if (target != null) {
            drawLine(
                color = AppPrimary.copy(alpha = 0.8f),
                start = center,
                end = target,
                strokeWidth = 5f
            )
            drawCircle(
                color = AppPrimary.copy(alpha = 0.28f),
                radius = 34f,
                center = target
            )
        }
    }

    Box(
        modifier = Modifier
            .offset { IntOffset(topLeft.x.roundToInt(), topLeft.y.roundToInt()) }
            .width(handleWidth)
            .height(handleHeight)
            .background(AppPrimary.copy(alpha = 0.92f))
            .pointerInput(overlay.requestId) {
                detectDragGestures(
                    onDragEnd = {
                        val end = Offset(
                            x = topLeft.x + overlay.region.w / 2f,
                            y = topLeft.y + overlay.region.h / 2f
                        )
                        val hit = target?.let {
                            kotlin.math.abs(end.x - it.x) <= max(48f, overlay.region.w * 0.5f) &&
                                kotlin.math.abs(end.y - it.y) <= max(48f, overlay.region.h * 0.75f)
                        } ?: false
                        onDragFinished(end, hit)
                    }
                ) { change, dragAmount ->
                    change.consume()
                    topLeft = Offset(
                        x = topLeft.x + dragAmount.x,
                        y = topLeft.y + dragAmount.y
                    )
                }
            },
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = "滑",
            color = Color.White,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
    }
}

// ---------------------------------------------------------------------------
// 步骤指示器
// ---------------------------------------------------------------------------

@Composable
private fun StepIndicator(
    modifier: Modifier,
    items: List<AnnotationItem>,
    selectedItemKey: String?,
    regions: Map<String, CaptchaRegion>,
    onSelectedItemChange: (String) -> Unit
) {
    var dragOffset by remember { mutableStateOf(Offset(8f, 40f)) }
    Surface(
        modifier = modifier
            .offset { IntOffset(dragOffset.x.roundToInt(), dragOffset.y.roundToInt()) }
            .draggable(
                state = rememberDraggableState { delta ->
                    dragOffset = dragOffset.copy(y = (dragOffset.y + delta).coerceIn(0f, 800f))
                },
                orientation = Orientation.Vertical
            ),
        shape = RoundedCornerShape(8.dp),
        color = Color.Black.copy(alpha = 0.7f)
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            items.forEachIndexed { index, item ->
                val selected = item.key == selectedItemKey
                val completed = regions[item.key]?.isValid == true
                Column(
                    modifier = Modifier
                        .defaultMinSize(minWidth = 44.dp)
                        .clickable { onSelectedItemChange(item.key) }
                        .background(
                            color = when {
                                selected -> item.color
                                completed -> item.color.copy(alpha = 0.3f)
                                else -> Color.Transparent
                            },
                            shape = RoundedCornerShape(4.dp)
                        )
                        .padding(horizontal = 6.dp, vertical = 4.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = if (selected) "✓" else "${index + 1}",
                        color = Color.White,
                        fontSize = MaterialTheme.typography.labelSmall.fontSize,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = item.shortTitle,
                        color = Color.White,
                        fontSize = MaterialTheme.typography.labelSmall.fontSize * 0.85f,
                        maxLines = 1
                    )
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// 全屏画布（复用原有手势逻辑 + 长按拖动）
// ---------------------------------------------------------------------------

@Composable
private fun FullScreenRegionCanvas(
    modifier: Modifier,
    sourceImage: CaptchaSourceImage,
    items: List<AnnotationItem>,
    selectedItem: AnnotationItem?,
    regions: Map<String, CaptchaRegion>,
    onRegionChange: (String, CaptchaRegion) -> Unit,
    onSelectedItemChange: (String) -> Unit
) {
    val bitmap = sourceImage.bitmap
    val imageBitmap = remember(bitmap) { bitmap.asImageBitmap() }
    var canvasSize by remember { mutableStateOf(IntSize.Zero) }
    var imageScale by remember(bitmap) { mutableStateOf(MIN_IMAGE_SCALE) }
    var imageOffset by remember(bitmap) { mutableStateOf(Offset.Zero) }
    var gestureStart by remember { mutableStateOf<Offset?>(null) }
    var gestureBaseRegion by remember { mutableStateOf<CaptchaRegion?>(null) }
    var gestureBaseImageOffset by remember { mutableStateOf<Offset?>(null) }
    var editMode by remember { mutableStateOf(RegionEditMode.None) }
    val latestSelectedItemKey by rememberUpdatedState(selectedItem?.key)
    val latestRegions by rememberUpdatedState(regions)
    val viewport = ImageViewport(scale = imageScale, offset = imageOffset)
    val latestViewport by rememberUpdatedState(viewport)
    val latestImageScale by rememberUpdatedState(imageScale)
    val latestImageOffset by rememberUpdatedState(imageOffset)

    LaunchedEffect(canvasSize, bitmap) {
        if (canvasSize.width > 0 && canvasSize.height > 0) {
            imageScale = imageScale.coerceIn(MIN_IMAGE_SCALE, MAX_IMAGE_SCALE)
            imageOffset = clampImageOffset(
                offset = imageOffset,
                canvasSize = canvasSize,
                bitmap = bitmap,
                scale = imageScale
            )
        }
    }

    Box(
        modifier = modifier
            .clipToBounds()
            .onSizeChanged { canvasSize = it }
            .pointerInput(canvasSize, bitmap) {
                awaitPointerEventScope {
                    var previousCentroid: Offset? = null
                    var previousDistance = 0f
                    while (true) {
                        val event = awaitPointerEvent()
                        val pressed = event.changes.filter { it.pressed }
                        if (pressed.size < 2) {
                            previousCentroid = null
                            previousDistance = 0f
                            continue
                        }
                        val points = pressed.map { it.position }
                        val centroid = centroidOf(points)
                        val distance = averageDistance(points, centroid)
                        val lastCentroid = previousCentroid
                        if (
                            lastCentroid != null &&
                            previousDistance > 0f &&
                            distance > 0f &&
                            canvasSize.width > 0 &&
                            canvasSize.height > 0
                        ) {
                            val oldScale = imageScale
                            val nextScale = (oldScale * (distance / previousDistance))
                                .coerceIn(MIN_IMAGE_SCALE, MAX_IMAGE_SCALE)
                            val zoomRatio = if (oldScale == 0f) 1f else nextScale / oldScale
                            val pan = centroid - lastCentroid
                            val rawOffset = Offset(
                                x = (imageOffset.x + pan.x - centroid.x) * zoomRatio + centroid.x,
                                y = (imageOffset.y + pan.y - centroid.y) * zoomRatio + centroid.y
                            )
                            imageScale = nextScale
                            imageOffset = clampImageOffset(
                                offset = rawOffset,
                                canvasSize = canvasSize,
                                bitmap = bitmap,
                                scale = nextScale
                            )
                            gestureStart = null
                            gestureBaseRegion = null
                            gestureBaseImageOffset = null
                            editMode = RegionEditMode.None
                            pressed.forEach { it.consume() }
                        }
                        previousCentroid = centroid
                        previousDistance = distance
                    }
                }
            }
            .pointerInput(canvasSize, bitmap) {
                val itemByKey = items.associateBy { it.key }
                detectTapGestures(
                    onTap = { rawOffset ->
                        val offset = clampOffset(rawOffset, canvasSize)
                        val hitKey = hitTestAllRegions(offset, latestRegions, itemByKey, latestViewport)
                        if (hitKey != null) {
                            onSelectedItemChange(hitKey)
                        }
                    }
                )
            }
            .pointerInput(canvasSize, bitmap) {
                var activeKeyRef: String? = null
                val itemByKey = items.associateBy { it.key }
                detectDragGestures(
                    onDragStart = { rawOffset ->
                        val offset = clampOffset(rawOffset, canvasSize)
                        // Priority 1: selected box (including handle extensions)
                        val selKey = latestSelectedItemKey
                        if (selKey != null) {
                            val selRegion = latestRegions[selKey]
                            val selRect = selRegion?.let { regionToDisplayRect(it, latestViewport) }
                            if (selRect != null) {
                                val mode = regionEditModeForOffset(selRect, offset)
                                if (mode != RegionEditMode.None) {
                                    editMode = mode
                                    activeKeyRef = selKey
                                    gestureStart = offset
                                    gestureBaseRegion = selRegion
                                    gestureBaseImageOffset = null
                                    return@detectDragGestures
                                }
                            }
                        }
                        // Priority 2: any non-selected box (tap-to-select + drag)
                        val hitKey = hitTestNonSelectedRegions(offset, latestRegions, selKey, latestViewport)
                        if (hitKey != null) {
                            onSelectedItemChange(hitKey)
                            activeKeyRef = hitKey
                            gestureStart = offset
                            gestureBaseRegion = latestRegions[hitKey]
                            gestureBaseImageOffset = null
                            val hitRect = regionToDisplayRect(latestRegions[hitKey]!!, latestViewport)
                            val mode = hitRect?.let { regionEditModeForOffset(it, offset) }
                            editMode = if (mode != null && mode != RegionEditMode.None) mode else RegionEditMode.Move
                        } else if (latestImageScale > MIN_IMAGE_SCALE) {
                            editMode = RegionEditMode.ImagePan
                            activeKeyRef = null
                            gestureStart = offset
                            gestureBaseRegion = null
                            gestureBaseImageOffset = latestImageOffset
                        } else {
                            editMode = RegionEditMode.None
                            activeKeyRef = null
                        }
                    },
                    onDrag = { change, _ ->
                        val mode = editMode
                        if (mode == RegionEditMode.ImagePan) {
                            val start = gestureStart ?: return@detectDragGestures
                            val baseOffset = gestureBaseImageOffset ?: return@detectDragGestures
                            imageOffset = clampImageOffset(
                                offset = baseOffset + (change.position - start),
                                canvasSize = canvasSize,
                                bitmap = bitmap,
                                scale = latestImageScale
                            )
                            change.consume()
                            return@detectDragGestures
                        }
                        val key = activeKeyRef ?: return@detectDragGestures
                        val start = gestureStart ?: return@detectDragGestures
                        val base = gestureBaseRegion ?: return@detectDragGestures
                        val delta = displayDeltaToBitmap(
                            delta = change.position - start,
                            viewport = latestViewport
                        )
                        val next = when (mode) {
                            RegionEditMode.Move -> moveRegion(base, delta.first, delta.second, bitmap)
                            RegionEditMode.ResizeLeft,
                            RegionEditMode.ResizeRight,
                            RegionEditMode.ResizeTop,
                            RegionEditMode.ResizeBottom -> resizeRegionByEdge(base, mode, delta.first, delta.second, bitmap)
                            else -> null
                        }
                        next?.let { onRegionChange(key, it) }
                    },
                    onDragEnd = {
                        editMode = RegionEditMode.None
                        activeKeyRef = null
                        gestureStart = null
                        gestureBaseRegion = null
                        gestureBaseImageOffset = null
                    },
                    onDragCancel = {
                        val restoreKey = activeKeyRef
                        val restoreRegion = gestureBaseRegion
                        editMode = RegionEditMode.None
                        activeKeyRef = null
                        gestureStart = null
                        gestureBaseRegion = null
                        gestureBaseImageOffset = null
                        if (restoreKey != null && restoreRegion != null) {
                            onRegionChange(restoreKey, restoreRegion)
                        }
                    }
                )
            }
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            drawImage(
                image = imageBitmap,
                dstOffset = IntOffset(imageOffset.x.roundToInt(), imageOffset.y.roundToInt()),
                dstSize = IntSize(
                    width = (bitmap.width * imageScale).roundToInt().coerceAtLeast(1),
                    height = (bitmap.height * imageScale).roundToInt().coerceAtLeast(1)
                )
            )
            val itemByKey = items.associateBy { it.key }
            val selectedKey = selectedItem?.key
            // Draw inactive boxes (dashed border, lighter fill)
            regions.forEach { (key, region) ->
                if (key == selectedKey) return@forEach
                val item = itemByKey[key] ?: return@forEach
                val rect = regionToDisplayRect(region, viewport) ?: return@forEach
                drawInactiveAnnotationRect(rect, item)
            }
            // Draw active box (solid border + handles)
            if (selectedItem != null && selectedKey != null) {
                val selectedRegionForDraw = regions[selectedKey]
                val selectedRect = selectedRegionForDraw?.let { regionToDisplayRect(it, viewport) }
                if (selectedRect != null) {
                    drawAnnotationRect(selectedRect, selectedItem)
                    drawSelectionHandles(selectedRect, selectedItem)
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// 全屏沉浸式效果
// ---------------------------------------------------------------------------

@Composable
@Suppress("DEPRECATION")
private fun FullScreenDialogEffect(
    context: Context,
    dialogView: View
) {
    DisposableEffect(dialogView) {
        val activity = context.findActivity()
        val window = activity?.window
        val decorView = window?.decorView
        val previousVisibility = decorView?.systemUiVisibility
        val previousFlags = window?.attributes?.flags ?: 0
        val previousSoftInputMode = window?.attributes?.softInputMode
        val previousStatusBarColor = window?.statusBarColor
        val previousNavigationBarColor = window?.navigationBarColor
        val previousCutoutMode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window?.attributes?.layoutInDisplayCutoutMode
        } else {
            null
        }
        val hadFullscreenFlag = previousFlags and WindowManager.LayoutParams.FLAG_FULLSCREEN != 0
        val fullscreenFlags = immersiveFullscreenFlags()
        val fullscreenWindowFlags = WindowManager.LayoutParams.FLAG_FULLSCREEN or
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
            WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS

        window?.setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        )
        decorView?.systemUiVisibility = fullscreenFlags
        window?.addFlags(fullscreenWindowFlags)
        window?.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING)
        window?.statusBarColor = android.graphics.Color.TRANSPARENT
        window?.navigationBarColor = android.graphics.Color.TRANSPARENT
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && window != null) {
            val attrs = window.attributes
            attrs.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            window.attributes = attrs
        }

        onDispose {
            if (decorView != null && previousVisibility != null) {
                decorView.systemUiVisibility = previousVisibility
            }
            if (previousStatusBarColor != null) {
                window?.statusBarColor = previousStatusBarColor
            }
            if (previousNavigationBarColor != null) {
                window?.navigationBarColor = previousNavigationBarColor
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && window != null && previousCutoutMode != null) {
                val attrs = window.attributes
                attrs.layoutInDisplayCutoutMode = previousCutoutMode
                window.attributes = attrs
            }
            window?.clearFlags(fullscreenWindowFlags)
            if (window != null && previousSoftInputMode != null) {
                window.setSoftInputMode(previousSoftInputMode)
            }
            if (!hadFullscreenFlag) {
                window?.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
            }
        }
    }
}

// ---------------------------------------------------------------------------
// 绘制函数
// ---------------------------------------------------------------------------

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawAnnotationRect(
    rect: Rect,
    item: AnnotationItem
) {
    drawRect(
        color = item.color.copy(alpha = 0.18f),
        topLeft = Offset(rect.left, rect.top),
        size = Size(rect.width, rect.height)
    )
    drawRect(
        color = item.color,
        topLeft = Offset(rect.left, rect.top),
        size = Size(rect.width, rect.height),
        style = Stroke(width = 3f)
    )

    val labelHeight = 32f
    val labelWidth = max(72f, item.shortTitle.length * 32f)
    val labelTop = rect.top.coerceAtLeast(0f)
    val labelLeft = rect.left.coerceIn(0f, (size.width - labelWidth).coerceAtLeast(0f))
    val nativeCanvas = drawContext.canvas.nativeCanvas
    val bgPaint = Paint().apply {
        color = item.color.toArgb()
        style = Paint.Style.FILL
        isAntiAlias = true
    }
    val textPaint = Paint().apply {
        color = Color.White.toArgb()
        textSize = 24f
        isAntiAlias = true
    }
    nativeCanvas.drawRect(labelLeft, labelTop, labelLeft + labelWidth, labelTop + labelHeight, bgPaint)
    nativeCanvas.drawText(item.shortTitle, labelLeft + 6f, labelTop + 23f, textPaint)
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawInactiveAnnotationRect(
    rect: Rect,
    item: AnnotationItem
) {
    drawRect(
        color = item.color.copy(alpha = 0.08f),
        topLeft = Offset(rect.left, rect.top),
        size = Size(rect.width, rect.height)
    )
    drawRect(
        color = item.color.copy(alpha = 0.6f),
        topLeft = Offset(rect.left, rect.top),
        size = Size(rect.width, rect.height),
        style = Stroke(
            width = 2f,
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 10f), 0f)
        )
    )
    val labelHeight = 28f
    val labelWidth = max(60f, item.shortTitle.length * 26f)
    val labelTop = rect.top.coerceAtLeast(0f)
    val labelLeft = rect.left.coerceIn(0f, (size.width - labelWidth).coerceAtLeast(0f))
    val nativeCanvas = drawContext.canvas.nativeCanvas
    val bgPaint = Paint().apply {
        color = item.color.copy(alpha = 0.6f).toArgb()
        style = Paint.Style.FILL
        isAntiAlias = true
    }
    val textPaint = Paint().apply {
        color = Color.White.copy(alpha = 0.8f).toArgb()
        textSize = 20f
        isAntiAlias = true
    }
    nativeCanvas.drawRect(labelLeft, labelTop, labelLeft + labelWidth, labelTop + labelHeight, bgPaint)
    nativeCanvas.drawText(item.shortTitle, labelLeft + 5f, labelTop + 20f, textPaint)
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawSelectionHandles(
    rect: Rect,
    item: AnnotationItem
) {
    val radius = 16f
    val lineLen = 12f
    val lineStroke = 3f
    val edgeColor = item.color.copy(alpha = 0.95f)
    val lineColor = Color.White
    val cx = rect.center.x
    val cy = rect.center.y
    // Left handle
    val lc = Offset(rect.left, cy)
    drawCircle(color = edgeColor, radius = radius, center = lc)
    drawLine(lineColor, Offset(lc.x + lineLen, lc.y), Offset(lc.x - lineLen, lc.y), lineStroke)
    drawLine(lineColor, Offset(lc.x - lineLen, lc.y), Offset(lc.x - lineLen + 5f, lc.y - 5f), lineStroke)
    drawLine(lineColor, Offset(lc.x - lineLen, lc.y), Offset(lc.x - lineLen + 5f, lc.y + 5f), lineStroke)
    // Right handle
    val rc = Offset(rect.right, cy)
    drawCircle(color = edgeColor, radius = radius, center = rc)
    drawLine(lineColor, Offset(rc.x - lineLen, rc.y), Offset(rc.x + lineLen, rc.y), lineStroke)
    drawLine(lineColor, Offset(rc.x + lineLen, rc.y), Offset(rc.x + lineLen - 5f, rc.y - 5f), lineStroke)
    drawLine(lineColor, Offset(rc.x + lineLen, rc.y), Offset(rc.x + lineLen - 5f, rc.y + 5f), lineStroke)
    // Top handle
    val tc = Offset(cx, rect.top)
    drawCircle(color = edgeColor, radius = radius, center = tc)
    drawLine(lineColor, Offset(tc.x, tc.y + lineLen), Offset(tc.x, tc.y - lineLen), lineStroke)
    drawLine(lineColor, Offset(tc.x, tc.y - lineLen), Offset(tc.x - 5f, tc.y - lineLen + 5f), lineStroke)
    drawLine(lineColor, Offset(tc.x, tc.y - lineLen), Offset(tc.x + 5f, tc.y - lineLen + 5f), lineStroke)
    // Bottom handle
    val bc = Offset(cx, rect.bottom)
    drawCircle(color = edgeColor, radius = radius, center = bc)
    drawLine(lineColor, Offset(bc.x, bc.y - lineLen), Offset(bc.x, bc.y + lineLen), lineStroke)
    drawLine(lineColor, Offset(bc.x, bc.y + lineLen), Offset(bc.x - 5f, bc.y + lineLen - 5f), lineStroke)
    drawLine(lineColor, Offset(bc.x, bc.y + lineLen), Offset(bc.x + 5f, bc.y + lineLen - 5f), lineStroke)
}

// ---------------------------------------------------------------------------
// 保存
// ---------------------------------------------------------------------------

private fun saveCurrentProfile(
    context: Context,
    type: CalibrationType,
    screenSize: CaptchaScreenSize,
    sourceImage: CaptchaSourceImage?,
    mathRegions: Map<String, CaptchaRegion>,
    sliderRegions: Map<String, CaptchaRegion>
): String? {
    if (sourceImage == null) {
        return "请先选择${type.title}截图"
    }
    if (sourceImage.bitmap.width != screenSize.width || sourceImage.bitmap.height != screenSize.height) {
        return "截图尺寸与当前设备屏幕不一致，请使用本机截图重新校准"
    }
    val currentRegions = if (type.key == TYPE_MATH) mathRegions else sliderRegions
    val missing = missingItems(type.items, currentRegions)
    if (missing.isNotEmpty()) {
        return "请先完成：${missing.joinToString("、")}"
    }

    return try {
        val currentProfile = AutomationScripts.loadCaptchaProfile(context)
        val baseProfile = if (
            currentProfile != null &&
            currentProfile.deviceWidth == screenSize.width &&
            currentProfile.deviceHeight == screenSize.height
        ) {
            currentProfile
        } else {
            CaptchaCalibrationStore.emptyProfile(context)
        }
        val mergedProfile = if (type.key == TYPE_MATH) {
            baseProfile.copy(
                deviceWidth = screenSize.width,
                deviceHeight = screenSize.height,
                mathProfile = CaptchaMathProfile(
                    completed = true,
                    expressionRegion = mathRegions[KEY_MATH_EXPRESSION],
                    inputRegion = mathRegions[KEY_MATH_INPUT],
                    submitRegion = mathRegions[KEY_MATH_SUBMIT]
                )
            )
        } else {
            baseProfile.copy(
                deviceWidth = screenSize.width,
                deviceHeight = screenSize.height,
                sliderProfile = CaptchaSliderProfile(
                    completed = true,
                    imageSearchRegion = sliderRegions[KEY_SLIDER_IMAGE_SEARCH],
                    handleRegion = sliderRegions[KEY_SLIDER_HANDLE],
                    trackRegion = sliderRegions[KEY_SLIDER_TRACK],
                    submitRegion = sliderRegions[KEY_SLIDER_SUBMIT]
                )
            )
        }
        AutomationScripts.saveCaptchaProfile(context, mergedProfile)
        null
    } catch (e: Exception) {
        e.message ?: "验证码校准保存失败"
    }
}

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

private fun stopSimulationRun(
    context: Context,
    state: SimulationRunState,
    cancelled: Boolean
) {
    try {
        state.execution?.engine?.forceStop()
    } catch (ignored: Exception) {
    }
    if (cancelled && !state.resultFile.exists()) {
        writeSimulationResult(
            file = state.resultFile,
            requestId = state.requestId,
            status = "cancelled",
            reason = "user_cancelled"
        )
    }
    clearSimulationOverlayPrefs(context)
}

private fun writeSimulationResult(
    file: File,
    requestId: String,
    status: String,
    reason: String
) {
    runCatching {
        file.parentFile?.mkdirs()
        val json = JSONObject()
            .put("schemaVersion", 1)
            .put("requestId", requestId)
            .put("status", status)
            .put("type", "")
            .put("stage", status)
            .put("reason", reason)
            .put("stats", JSONObject.NULL)
        file.writeText(json.toString(2))
    }
}

private fun simulationOverlayPrefs(context: Context) =
    context.applicationContext.getSharedPreferences(CAPTCHA_SIMULATION_OVERLAY_PREFS, Context.MODE_PRIVATE)

private fun clearSimulationOverlayPrefs(context: Context) {
    simulationOverlayPrefs(context).edit()
        .remove("overlay_ready_request_id")
        .remove("overlay_ready_timestamp")
        .remove("overlay_ready_type")
        .remove("overlay_ready_reason")
        .remove("slider_drag_request_id")
        .remove("slider_drag_end_x")
        .remove("slider_drag_end_y")
        .remove("slider_drag_target_x")
        .remove("slider_drag_target_y")
        .remove("slider_drag_hit")
        .remove("slider_drag_timestamp")
        .apply()
}

private fun writeOverlayReady(
    context: Context,
    overlay: SimulationOverlayState
) {
    simulationOverlayPrefs(context).edit()
        .putString("overlay_ready_request_id", overlay.requestId)
        .putLong("overlay_ready_timestamp", System.currentTimeMillis())
        .putString("overlay_ready_type", overlay.type)
        .putString("overlay_ready_reason", "layout_ready")
        .apply()
}

private fun writeSliderDragResult(
    context: Context,
    overlay: SimulationOverlayState,
    end: Offset,
    hit: Boolean
) {
    val target = overlay.targetPoint
    simulationOverlayPrefs(context).edit()
        .putString("slider_drag_request_id", overlay.requestId)
        .putInt("slider_drag_end_x", end.x.roundToInt())
        .putInt("slider_drag_end_y", end.y.roundToInt())
        .putInt("slider_drag_target_x", target?.x?.roundToInt() ?: -1)
        .putInt("slider_drag_target_y", target?.y?.roundToInt() ?: -1)
        .putBoolean("slider_drag_hit", hit)
        .putLong("slider_drag_timestamp", System.currentTimeMillis())
        .apply()
}

private fun parseJsonOrNull(value: String?): JSONObject? {
    if (value.isNullOrBlank()) {
        return null
    }
    return runCatching { JSONObject(value) }.getOrNull()
}

private fun parsePoint(json: JSONObject?): Offset? {
    if (json == null) {
        return null
    }
    return Offset(
        x = json.optDouble("x", Double.NaN).toFloat(),
        y = json.optDouble("y", Double.NaN).toFloat()
    ).takeIf { !it.x.isNaN() && !it.y.isNaN() }
}

private fun decodeBitmap(context: Context, uri: Uri): Bitmap {
    val options = BitmapFactory.Options().apply {
        inPreferredConfig = Bitmap.Config.ARGB_8888
    }
    return context.contentResolver.openInputStream(uri).use { input ->
        if (input == null) {
            throw IllegalArgumentException("无法打开图片")
        }
        BitmapFactory.decodeStream(input, null, options)
    } ?: throw IllegalArgumentException("无法解码图片")
}

private fun missingItems(
    items: List<AnnotationItem>,
    regions: Map<String, CaptchaRegion>
): List<String> {
    return items
        .filter { regions[it.key]?.isValid != true }
        .map { it.title }
}

private fun regionToDisplayRect(
    region: CaptchaRegion,
    viewport: ImageViewport
): Rect? {
    if (viewport.scale <= 0f || !region.isValid) {
        return null
    }
    return Rect(
        left = viewport.offset.x + region.x * viewport.scale,
        top = viewport.offset.y + region.y * viewport.scale,
        right = viewport.offset.x + (region.x + region.w) * viewport.scale,
        bottom = viewport.offset.y + (region.y + region.h) * viewport.scale
    )
}

private fun clampImageOffset(
    offset: Offset,
    canvasSize: IntSize,
    bitmap: Bitmap,
    scale: Float
): Offset {
    if (canvasSize.width <= 0 || canvasSize.height <= 0) {
        return Offset.Zero
    }
    val imageWidth = bitmap.width * scale
    val imageHeight = bitmap.height * scale
    val x = if (imageWidth <= canvasSize.width) {
        (canvasSize.width - imageWidth) / 2f
    } else {
        offset.x.coerceIn(canvasSize.width - imageWidth, 0f)
    }
    val y = if (imageHeight <= canvasSize.height) {
        (canvasSize.height - imageHeight) / 2f
    } else {
        offset.y.coerceIn(canvasSize.height - imageHeight, 0f)
    }
    return Offset(x, y)
}

private fun centroidOf(points: List<Offset>): Offset {
    if (points.isEmpty()) {
        return Offset.Zero
    }
    var x = 0f
    var y = 0f
    points.forEach {
        x += it.x
        y += it.y
    }
    return Offset(x / points.size, y / points.size)
}

private fun averageDistance(points: List<Offset>, centroid: Offset): Float {
    if (points.isEmpty()) {
        return 0f
    }
    var total = 0f
    points.forEach {
        val dx = it.x - centroid.x
        val dy = it.y - centroid.y
        total += sqrt(dx * dx + dy * dy)
    }
    return total / points.size
}

private fun defaultRegionForItem(key: String, bitmap: Bitmap): CaptchaRegion {
    return when (key) {
        KEY_MATH_EXPRESSION -> regionFromFractions(bitmap, 0.34f, 0.39f, 0.35f, 0.07f)
        KEY_MATH_INPUT -> regionFromFractions(bitmap, 0.25f, 0.61f, 0.50f, 0.04f)
        KEY_MATH_SUBMIT -> regionFromFractions(bitmap, 0.28f, 0.72f, 0.44f, 0.05f)
        KEY_SLIDER_IMAGE_SEARCH -> regionFromFractions(bitmap, 0.13f, 0.29f, 0.74f, 0.28f)
        KEY_SLIDER_HANDLE -> regionFromFractions(bitmap, 0.13f, 0.57f, 0.13f, 0.06f)
        KEY_SLIDER_TRACK -> regionFromFractions(bitmap, 0.13f, 0.56f, 0.74f, 0.04f)
        KEY_SLIDER_SUBMIT -> regionFromFractions(bitmap, 0.28f, 0.70f, 0.44f, 0.05f)
        else -> regionFromFractions(bitmap, 0.35f, 0.40f, 0.30f, 0.08f)
    }
}

private fun regionFromFractions(
    bitmap: Bitmap,
    left: Float,
    top: Float,
    width: Float,
    height: Float
): CaptchaRegion {
    val x = (bitmap.width * left).roundToInt()
    val y = (bitmap.height * top).roundToInt()
    val w = (bitmap.width * width).roundToInt().coerceAtLeast(2)
    val h = (bitmap.height * height).roundToInt().coerceAtLeast(2)
    return clampRegion(CaptchaRegion(x = x, y = y, w = w, h = h), bitmap)
}

private fun moveRegion(
    region: CaptchaRegion,
    dx: Int,
    dy: Int,
    bitmap: Bitmap
): CaptchaRegion {
    return clampRegion(
        region.copy(
            x = region.x + dx,
            y = region.y + dy
        ),
        bitmap
    )
}

private fun resizeRegionCentered(
    region: CaptchaRegion,
    dw: Int,
    dh: Int,
    bitmap: Bitmap
): CaptchaRegion {
    val nextW = (region.w + dw).coerceIn(2, bitmap.width)
    val nextH = (region.h + dh).coerceIn(2, bitmap.height)
    val centerX = region.x + region.w / 2f
    val centerY = region.y + region.h / 2f
    return clampRegion(
        CaptchaRegion(
            x = (centerX - nextW / 2f).roundToInt(),
            y = (centerY - nextH / 2f).roundToInt(),
            w = nextW,
            h = nextH
        ),
        bitmap
    )
}

private fun clampRegion(region: CaptchaRegion, bitmap: Bitmap): CaptchaRegion {
    val w = region.w.coerceIn(2, bitmap.width.coerceAtLeast(2))
    val h = region.h.coerceIn(2, bitmap.height.coerceAtLeast(2))
    val x = region.x.coerceIn(0, (bitmap.width - w).coerceAtLeast(0))
    val y = region.y.coerceIn(0, (bitmap.height - h).coerceAtLeast(0))
    return CaptchaRegion(x = x, y = y, w = w, h = h)
}

private fun Context.findActivity(): Activity? {
    var currentContext = this
    while (currentContext is ContextWrapper) {
        if (currentContext is Activity) {
            return currentContext
        }
        currentContext = currentContext.baseContext
    }
    return currentContext as? Activity
}

@Suppress("DEPRECATION")
private fun immersiveFullscreenFlags(): Int {
    return View.SYSTEM_UI_FLAG_FULLSCREEN or
        View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
        View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
        View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
        View.SYSTEM_UI_FLAG_LAYOUT_STABLE
}

private fun hitTestNonSelectedRegions(
    offset: Offset,
    regions: Map<String, CaptchaRegion>,
    selectedKey: String?,
    viewport: ImageViewport
): String? {
    val entries = regions.entries.toList()
    for (i in entries.indices.reversed()) {
        val (key, region) = entries[i]
        if (key == selectedKey) continue
        val rect = regionToDisplayRect(region, viewport) ?: continue
        if (rect.contains(offset)) return key
    }
    return null
}

private fun hitTestAllRegions(
    offset: Offset,
    regions: Map<String, CaptchaRegion>,
    itemByKey: Map<String, AnnotationItem>,
    viewport: ImageViewport
): String? {
    val entries = regions.entries.toList()
    for (i in entries.indices.reversed()) {
        val (key, region) = entries[i]
        if (itemByKey[key] == null) continue
        val rect = regionToDisplayRect(region, viewport) ?: continue
        if (rect.contains(offset)) return key
    }
    return null
}

private fun regionEditModeForOffset(
    rect: Rect,
    offset: Offset
): RegionEditMode {
    val handleSize = 27f
    val half = handleSize / 2f
    val outwardExtend = 60f
    val alongPad = 10f
    // Handle hit areas: visual handle + large outward extension
    val cx = rect.center.x
    val cy = rect.center.y
    val leftHandle = Rect(rect.left - half - outwardExtend, cy - half - alongPad, rect.left + half, cy + half + alongPad)
    val rightHandle = Rect(rect.right - half, cy - half - alongPad, rect.right + half + outwardExtend, cy + half + alongPad)
    val topHandle = Rect(cx - half - alongPad, rect.top - half - outwardExtend, cx + half + alongPad, rect.top + half)
    val bottomHandle = Rect(cx - half - alongPad, rect.bottom - half, cx + half + alongPad, rect.bottom + half + outwardExtend)
    // Find closest handle that contains the touch point
    var bestMode = RegionEditMode.None
    var bestDist = Float.MAX_VALUE
    fun checkHandle(handleRect: Rect, mode: RegionEditMode) {
        if (!handleRect.contains(offset)) return
        val center = handleRect.center
        val dist = kotlin.math.abs(offset.x - center.x) + kotlin.math.abs(offset.y - center.y)
        if (dist < bestDist) {
            bestDist = dist
            bestMode = mode
        }
    }
    checkHandle(leftHandle, RegionEditMode.ResizeLeft)
    checkHandle(rightHandle, RegionEditMode.ResizeRight)
    checkHandle(topHandle, RegionEditMode.ResizeTop)
    checkHandle(bottomHandle, RegionEditMode.ResizeBottom)
    if (bestMode != RegionEditMode.None) return bestMode
    // Anywhere else inside the box → move
    if (rect.contains(offset)) return RegionEditMode.Move
    return RegionEditMode.None
}

private fun displayDeltaToBitmap(
    delta: Offset,
    viewport: ImageViewport
): Pair<Int, Int> {
    if (viewport.scale <= 0f) {
        return 0 to 0
    }
    return Pair(
        (delta.x / viewport.scale).roundToInt(),
        (delta.y / viewport.scale).roundToInt()
    )
}

private fun resizeRegionByEdge(
    region: CaptchaRegion,
    mode: RegionEditMode,
    dx: Int,
    dy: Int,
    bitmap: Bitmap
): CaptchaRegion {
    val minSize = 2
    var left = region.x
    var top = region.y
    var right = region.x + region.w
    var bottom = region.y + region.h
    when (mode) {
        RegionEditMode.ResizeLeft -> left = (left + dx).coerceIn(0, right - minSize)
        RegionEditMode.ResizeRight -> right = (right + dx).coerceIn(left + minSize, bitmap.width)
        RegionEditMode.ResizeTop -> top = (top + dy).coerceIn(0, bottom - minSize)
        RegionEditMode.ResizeBottom -> bottom = (bottom + dy).coerceIn(top + minSize, bitmap.height)
        else -> return region
    }
    return CaptchaRegion(
        x = left,
        y = top,
        w = right - left,
        h = bottom - top
    )
}

private fun clampOffset(offset: Offset, size: IntSize): Offset {
    return Offset(
        x = offset.x.coerceIn(0f, size.width.toFloat()),
        y = offset.y.coerceIn(0f, size.height.toFloat())
    )
}

private fun calibrationTypeOf(key: String): CalibrationType {
    return if (key == TYPE_SLIDER) SliderType else MathType
}

private fun regionsFromMathProfile(profile: CaptchaMathProfile?): Map<String, CaptchaRegion> {
    val regions = mutableMapOf<String, CaptchaRegion>()
    profile?.expressionRegion?.let { regions[KEY_MATH_EXPRESSION] = it }
    profile?.inputRegion?.let { regions[KEY_MATH_INPUT] = it }
    profile?.submitRegion?.let { regions[KEY_MATH_SUBMIT] = it }
    return regions
}

private fun regionsFromSliderProfile(profile: CaptchaSliderProfile?): Map<String, CaptchaRegion> {
    val regions = mutableMapOf<String, CaptchaRegion>()
    profile?.imageSearchRegion?.let { regions[KEY_SLIDER_IMAGE_SEARCH] = it }
    profile?.handleRegion?.let { regions[KEY_SLIDER_HANDLE] = it }
    profile?.trackRegion?.let { regions[KEY_SLIDER_TRACK] = it }
    profile?.submitRegion?.let { regions[KEY_SLIDER_SUBMIT] = it }
    return regions
}

private fun toast(context: Context, message: String) {
    Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
}
