@file:OptIn(ExperimentalMaterial3Api::class, ExperimentalComposeUiApi::class)

package org.autojs.autojs.ui.captcha

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Paint
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
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
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
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
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider
import kotlinx.coroutines.delay
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
import java.util.Locale
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

private val AppPrimary = Color(0xFF009688)
private val AppAccent = Color(0xFF03A9F4)
private val AppTextPrimary = Color(0xFF282C2F)
private val AppTextSecondary = Color(0xFF6F767A)
private val AppDivider = Color(0xFFF2F3F5)
private val AppError = Color(0xFFFD7778)
private val AppWarning = Color(0xFFFF9800)
private val CardShape = RoundedCornerShape(8.dp)
private val ButtonShape = RoundedCornerShape(4.dp)

private const val TYPE_MATH = "math"
private const val TYPE_SLIDER = "slider"
private const val KEY_MATH_EXPRESSION = "mathExpressionRegion"
private const val KEY_MATH_INPUT = "mathInputRegion"
private const val KEY_MATH_SUBMIT = "mathSubmitRegion"
private const val KEY_SLIDER_IMAGE_SEARCH = "sliderImageSearchRegion"
private const val KEY_SLIDER_HANDLE = "sliderHandleRegion"
private const val KEY_SLIDER_TRACK = "sliderTrackRegion"
private const val KEY_SLIDER_SUBMIT = "sliderSubmitRegion"

private data class AnnotationItem(
    val key: String,
    val title: String,
    val shortTitle: String,
    val color: Color
)

private data class CalibrationType(
    val key: String,
    val title: String,
    val sourceName: String,
    val items: List<AnnotationItem>
)

private data class CaptchaSourceImage(
    val bitmap: Bitmap,
    val displayName: String
)

private enum class RegionEditMode {
    None,
    Create,
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
    sourceName = "math",
    items = MathItems
)

private val SliderType = CalibrationType(
    key = TYPE_SLIDER,
    title = "滑块验证码",
    sourceName = "slider",
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
    val profileError = remember(refreshTick, profile) {
        profile?.let { AutomationScripts.validateCaptchaProfile(context, it) }
    }
    val profileScreenReady = profile?.let {
        it.deviceWidth == screenSize.width && it.deviceHeight == screenSize.height
    } == true
    val fileExists = remember(refreshTick) {
        AutomationScripts.captchaProfileFile(context).exists()
    }

    var selectedTypeKey by rememberSaveable { mutableStateOf(TYPE_MATH) }
    val selectedType = calibrationTypeOf(selectedTypeKey)
    var selectedItemKey by rememberSaveable { mutableStateOf<String?>(null) }
    var mathRegions by remember { mutableStateOf(regionsFromMathProfile(profile?.mathProfile)) }
    var sliderRegions by remember { mutableStateOf(regionsFromSliderProfile(profile?.sliderProfile)) }
    var mathImage by remember { mutableStateOf<CaptchaSourceImage?>(null) }
    var sliderImage by remember { mutableStateOf<CaptchaSourceImage?>(null) }
    var pendingPickTypeKey by remember { mutableStateOf(selectedTypeKey) }
    var message by remember { mutableStateOf<String?>(null) }
    var messageIsError by remember { mutableStateOf(false) }
    var simulationRunning by remember { mutableStateOf(false) }
    var simulationText by remember { mutableStateOf<String?>(null) }
    var simulationTextIsError by remember { mutableStateOf(false) }
    var simulationRunId by remember { mutableStateOf(0) }

    LaunchedEffect(profile) {
        mathRegions = regionsFromMathProfile(profile?.mathProfile)
        sliderRegions = regionsFromSliderProfile(profile?.sliderProfile)
    }

    LaunchedEffect(selectedTypeKey) {
        selectedItemKey = null
        message = null
        messageIsError = false
        simulationText = null
        simulationTextIsError = false
    }

    LaunchedEffect(simulationRunId) {
        if (!simulationRunning) {
            return@LaunchedEffect
        }
        val resultFile = CaptchaCalibrationStore.simulationResultFile(context)
        repeat(60) {
            delay(250)
            val resultText = readSimulationResult(resultFile)
            if (resultText != null) {
                simulationText = resultText.first
                simulationTextIsError = resultText.second
                simulationRunning = false
                return@LaunchedEffect
            }
        }
        simulationText = "模拟识别超时，请查看脚本日志或稍后重试"
        simulationTextIsError = true
        simulationRunning = false
    }

    val imagePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri != null) {
            val pickedType = calibrationTypeOf(pendingPickTypeKey)
            try {
                val bitmap = decodeBitmap(context, uri)
                saveSourceImage(context, bitmap, pickedType)
                val sourceImage = CaptchaSourceImage(
                    bitmap = bitmap,
                    displayName = "${bitmap.width} x ${bitmap.height}"
                )
                if (pickedType.key == TYPE_MATH) {
                    mathImage = sourceImage
                } else {
                    sliderImage = sourceImage
                }
                message = "${pickedType.title}截图已选择"
                messageIsError = false
            } catch (e: Exception) {
                message = "读取截图失败：${e.message ?: "未知错误"}"
                messageIsError = true
            }
        }
    }

    val currentRegions = if (selectedType.key == TYPE_MATH) mathRegions else sliderRegions
    val currentImage = if (selectedType.key == TYPE_MATH) mathImage else sliderImage

    Scaffold(
        containerColor = Color.White,
        topBar = {
            TopAppBar(
                title = { Text(text = "验证码校准") },
                navigationIcon = {
                    TextButton(
                        onClick = onBack,
                        colors = ButtonDefaults.textButtonColors(contentColor = AppPrimary)
                    ) {
                        Text(text = "返回")
                    }
                },
                colors = TopAppBarDefaults.smallTopAppBarColors(
                    containerColor = Color.White,
                    titleContentColor = AppTextPrimary,
                    navigationIconContentColor = AppPrimary
                )
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
            CaptchaProfileStatusCard(
                profile = profile,
                profileError = profileError,
                fileExists = fileExists,
                screenReady = profileScreenReady,
                screenText = "${screenSize.width} x ${screenSize.height}"
            )
            CaptchaTypeSelector(
                selectedTypeKey = selectedTypeKey,
                onSelectedTypeChange = { selectedTypeKey = it }
            )
            CaptchaAnnotationCard(
                type = selectedType,
                selectedItemKey = selectedItemKey,
                onSelectedItemChange = { selectedItemKey = it },
                sourceImage = currentImage,
                regions = currentRegions,
                screenSize = screenSize,
                message = message,
                messageIsError = messageIsError,
                simulationText = simulationText,
                simulationTextIsError = simulationTextIsError,
                simulationRunning = simulationRunning,
                onPickImage = {
                    pendingPickTypeKey = selectedType.key
                    imagePickerLauncher.launch("image/*")
                },
                onRegionChange = { key, region ->
                    if (selectedType.key == TYPE_MATH) {
                        mathRegions = mathRegions + (key to region)
                    } else {
                        sliderRegions = sliderRegions + (key to region)
                    }
                },
                onClearSelected = {
                    val key = selectedItemKey
                    if (key != null) {
                        if (selectedType.key == TYPE_MATH) {
                            mathRegions = mathRegions - key
                        } else {
                            sliderRegions = sliderRegions - key
                        }
                    }
                },
                onClearRegion = { key ->
                    if (selectedType.key == TYPE_MATH) {
                        mathRegions = mathRegions - key
                    } else {
                        sliderRegions = sliderRegions - key
                    }
                },
                onSimulate = {
                    val startResult = startSimulation(
                        context = context,
                        type = selectedType,
                        screenSize = screenSize,
                        sourceImage = currentImage,
                        mathRegions = mathRegions,
                        sliderRegions = sliderRegions
                    )
                    if (startResult == null) {
                        simulationText = "${selectedType.title}模拟识别已启动"
                        simulationTextIsError = false
                        simulationRunning = true
                        simulationRunId++
                    } else {
                        simulationText = startResult
                        simulationTextIsError = true
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
                    } else {
                        message = saveResult
                        messageIsError = true
                    }
                }
            )
        }
    }
}

@Composable
private fun CaptchaProfileStatusCard(
    profile: CaptchaCalibrationProfile?,
    profileError: String?,
    fileExists: Boolean,
    screenReady: Boolean,
    screenText: String
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
            Text(
                text = "校准状态",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
            CalibrationStatusRow(
                title = "配置文件",
                description = if (fileExists) AutomationScripts.CAPTCHA_PROFILE_FILE_NAME else "未创建",
                ready = fileExists
            )
            Divider()
            CalibrationStatusRow(
                title = "数学验证码",
                description = profileRegionSummary(profile?.mathCompleted == true),
                ready = profile?.mathCompleted == true
            )
            Divider()
            CalibrationStatusRow(
                title = "滑块验证码",
                description = profileRegionSummary(profile?.sliderCompleted == true),
                ready = profile?.sliderCompleted == true
            )
            Divider()
            CalibrationStatusRow(
                title = "屏幕尺寸",
                description = profile?.let { "${it.deviceWidth} x ${it.deviceHeight}" } ?: screenText,
                ready = screenReady
            )
            if (profileError != null) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = profileError,
                    color = AppError,
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}

@Composable
private fun CaptchaTypeSelector(
    selectedTypeKey: String,
    onSelectedTypeChange: (String) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        SelectableButton(
            modifier = Modifier.weight(1f),
            text = MathType.title,
            selected = selectedTypeKey == TYPE_MATH,
            onClick = { onSelectedTypeChange(TYPE_MATH) }
        )
        SelectableButton(
            modifier = Modifier.weight(1f),
            text = SliderType.title,
            selected = selectedTypeKey == TYPE_SLIDER,
            onClick = { onSelectedTypeChange(TYPE_SLIDER) }
        )
    }
}

@Composable
private fun CaptchaAnnotationCard(
    type: CalibrationType,
    selectedItemKey: String?,
    onSelectedItemChange: (String?) -> Unit,
    sourceImage: CaptchaSourceImage?,
    regions: Map<String, CaptchaRegion>,
    screenSize: CaptchaScreenSize,
    message: String?,
    messageIsError: Boolean,
    simulationText: String?,
    simulationTextIsError: Boolean,
    simulationRunning: Boolean,
    onPickImage: () -> Unit,
    onRegionChange: (String, CaptchaRegion) -> Unit,
    onClearSelected: () -> Unit,
    onClearRegion: (String) -> Unit,
    onSimulate: () -> Unit,
    onSave: () -> Unit
) {
    var fullScreenEditorOpen by remember { mutableStateOf(false) }
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
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = type.title,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = sourceImage?.displayName ?: "未选择截图",
                        color = if (sourceImage == null) AppTextSecondary else AppPrimary,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
                OutlinedButton(
                    onClick = onPickImage,
                    shape = ButtonShape,
                    border = BorderStroke(1.dp, AppPrimary.copy(alpha = 0.55f)),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = AppPrimary)
                ) {
                    Icon(
                        painter = painterResource(id = R.drawable.ic_add_white_48dp),
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(text = "选择截图")
                }
            }

            CaptchaImageAnnotationCanvas(
                sourceImage = sourceImage,
                items = type.items,
                selectedItemKey = selectedItemKey,
                regions = regions,
                onSelectedItemChange = onSelectedItemChange,
                onFullScreenClick = { fullScreenEditorOpen = true }
            )

            DimensionsStatus(
                sourceImage = sourceImage,
                screenSize = screenSize
            )

            MissingItemsStatus(
                items = type.items,
                regions = regions
            )

            if (message != null) {
                Text(
                    text = message,
                    color = if (messageIsError) AppError else AppPrimary,
                    style = MaterialTheme.typography.bodySmall
                )
            }
            if (simulationText != null) {
                Text(
                    text = simulationText,
                    color = if (simulationTextIsError) AppError else AppPrimary,
                    style = MaterialTheme.typography.bodySmall
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    modifier = Modifier.weight(1f),
                    onClick = onClearSelected,
                    shape = ButtonShape,
                    border = BorderStroke(1.dp, AppWarning.copy(alpha = 0.7f)),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = AppWarning)
                ) {
                    Icon(
                        painter = painterResource(id = R.drawable.ic_delete),
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(text = "清除")
                }
                OutlinedButton(
                    modifier = Modifier.weight(1f),
                    onClick = onSimulate,
                    enabled = !simulationRunning,
                    shape = ButtonShape,
                    border = BorderStroke(1.dp, AppAccent.copy(alpha = 0.7f)),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = AppAccent)
                ) {
                    Icon(
                        painter = painterResource(id = R.drawable.ic_run),
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(text = if (simulationRunning) "识别中" else "模拟")
                }
                Button(
                    modifier = Modifier.weight(1f),
                    onClick = onSave,
                    shape = ButtonShape,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AppPrimary,
                        contentColor = Color.White
                    )
                ) {
                    Icon(
                        painter = painterResource(id = R.drawable.ic_save),
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(text = "保存当前")
                }
            }
        }
    }

    val editorImage = sourceImage
    if (fullScreenEditorOpen && editorImage != null) {
        FullScreenRegionEditorDialog(
            sourceImage = editorImage,
            items = type.items,
            selectedItemKey = selectedItemKey,
            regions = regions,
            onSelectedItemChange = { onSelectedItemChange(it) },
            onRegionChange = onRegionChange,
            onDeleteSelected = { key ->
                if (regions[key] != null) {
                    onClearRegion(key)
                }
            },
            onDismiss = { fullScreenEditorOpen = false }
        )
    }
}

@Composable
private fun AnnotationItemSelector(
    items: List<AnnotationItem>,
    selectedItemKey: String?,
    regions: Map<String, CaptchaRegion>,
    onSelectedItemChange: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        items.chunked(2).forEach { rowItems ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                rowItems.forEach { item ->
                    val completed = regions[item.key]?.isValid == true
                    AnnotationButton(
                        modifier = Modifier.weight(1f),
                        item = item,
                        selected = item.key == selectedItemKey,
                        completed = completed,
                        onClick = { onSelectedItemChange(item.key) }
                    )
                }
                if (rowItems.size == 1) {
                    Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun AnnotationButton(
    modifier: Modifier,
    item: AnnotationItem,
    selected: Boolean,
    completed: Boolean,
    onClick: () -> Unit
) {
    val color = if (completed) item.color else AppPrimary
    if (selected) {
        Button(
            modifier = modifier,
            onClick = onClick,
            shape = ButtonShape,
            colors = ButtonDefaults.buttonColors(
                containerColor = color,
                contentColor = Color.White
            )
        ) {
            Text(text = item.title)
        }
    } else {
        OutlinedButton(
            modifier = modifier,
            onClick = onClick,
            shape = ButtonShape,
            border = BorderStroke(1.dp, color.copy(alpha = 0.65f)),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = color)
        ) {
            Text(text = item.title)
        }
    }
}

@Composable
private fun AnnotationOverlayControls(
    modifier: Modifier,
    items: List<AnnotationItem>,
    selectedItemKey: String?,
    regions: Map<String, CaptchaRegion>,
    fullScreen: Boolean,
    fullScreenEnabled: Boolean,
    onSelectedItemChange: (String) -> Unit,
    onFullScreenClick: () -> Unit
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(8.dp),
        color = Color.White.copy(alpha = 0.92f),
        border = BorderStroke(1.dp, Color.Black.copy(alpha = 0.08f))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 6.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            items.forEach { item ->
                val completed = regions[item.key]?.isValid == true
                val selected = item.key == selectedItemKey
                val color = if (completed) item.color else AppPrimary
                if (selected) {
                    Button(
                        modifier = Modifier.height(34.dp),
                        onClick = { onSelectedItemChange(item.key) },
                        shape = ButtonShape,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = color,
                            contentColor = Color.White
                        ),
                        contentPadding = ButtonDefaults.TextButtonContentPadding
                    ) {
                        Text(text = item.title, style = MaterialTheme.typography.labelSmall)
                    }
                } else {
                    OutlinedButton(
                        modifier = Modifier.height(34.dp),
                        onClick = { onSelectedItemChange(item.key) },
                        shape = ButtonShape,
                        border = BorderStroke(1.dp, color.copy(alpha = 0.65f)),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = color),
                        contentPadding = ButtonDefaults.TextButtonContentPadding
                    ) {
                        Text(text = item.title, style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
            OutlinedButton(
                modifier = Modifier.height(34.dp),
                onClick = onFullScreenClick,
                enabled = fullScreenEnabled,
                shape = ButtonShape,
                border = BorderStroke(1.dp, AppAccent.copy(alpha = 0.75f)),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = AppAccent),
                contentPadding = ButtonDefaults.TextButtonContentPadding
            ) {
                Text(
                    text = if (fullScreen) "退出全屏" else "全屏",
                    style = MaterialTheme.typography.labelSmall
                )
            }
        }
    }
}

@Composable
private fun CaptchaImageAnnotationCanvas(
    sourceImage: CaptchaSourceImage?,
    items: List<AnnotationItem>,
    selectedItemKey: String?,
    regions: Map<String, CaptchaRegion>,
    onSelectedItemChange: (String) -> Unit,
    onFullScreenClick: () -> Unit
) {
    if (sourceImage == null) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(220.dp)
                .border(BorderStroke(1.dp, AppDivider), CardShape)
                .background(Color(0xFFF8F9FA), CardShape),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "未选择截图",
                color = AppTextSecondary,
                style = MaterialTheme.typography.bodyMedium
            )
        }
        return
    }

    var canvasSize by remember { mutableStateOf(IntSize.Zero) }
    val bitmap = sourceImage.bitmap

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(bitmap.width.toFloat() / bitmap.height.toFloat())
            .border(BorderStroke(1.dp, AppDivider), CardShape)
            .onSizeChanged { canvasSize = it }
    ) {
        Image(
            bitmap = bitmap.asImageBitmap(),
            contentDescription = null,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.FillBounds
        )
        Canvas(modifier = Modifier.fillMaxSize()) {
            val itemByKey = items.associateBy { it.key }
            val selectedKey = selectedItemKey
            regions.forEach { (key, region) ->
                if (key == selectedKey) {
                    return@forEach
                }
                val item = itemByKey[key] ?: return@forEach
                val rect = regionToDisplayRect(region, canvasSize, bitmap) ?: return@forEach
                drawAnnotationRect(rect, item)
            }
            if (selectedKey != null) {
                val selectedItem = itemByKey[selectedKey]
                val selectedRegion = regions[selectedKey]
                val selectedRect = selectedRegion?.let { regionToDisplayRect(it, canvasSize, bitmap) }
                if (selectedItem != null && selectedRect != null) {
                    drawAnnotationRect(selectedRect, selectedItem)
                    drawSelectionHandles(selectedRect, selectedItem)
                }
            }
        }
        AnnotationOverlayControls(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .fillMaxWidth()
                .padding(8.dp),
            items = items,
            selectedItemKey = selectedItemKey,
            regions = regions,
            fullScreen = false,
            fullScreenEnabled = true,
            onSelectedItemChange = onSelectedItemChange,
            onFullScreenClick = onFullScreenClick
        )
    }
}

@Composable
@Suppress("DEPRECATION")
private fun FullScreenRegionEditorDialog(
    sourceImage: CaptchaSourceImage,
    items: List<AnnotationItem>,
    selectedItemKey: String?,
    regions: Map<String, CaptchaRegion>,
    onSelectedItemChange: (String) -> Unit,
    onRegionChange: (String, CaptchaRegion) -> Unit,
    onDeleteSelected: (String) -> Unit,
    onDismiss: () -> Unit
) {
    val selectedItem = selectedItemKey?.let { key -> items.firstOrNull { it.key == key } }
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            decorFitsSystemWindows = false
        )
    ) {
        val context = LocalContext.current
        val dialogView = LocalView.current
        FullScreenDialogEffect(context = context, dialogView = dialogView)
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = Color.Black
        ) {
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
                    onDeleteSelected = onDeleteSelected
                )
                AnnotationOverlayControls(
                    modifier = Modifier
                        .align(Alignment.TopCenter)
                        .fillMaxWidth()
                        .padding(8.dp),
                    items = items,
                    selectedItemKey = selectedItemKey,
                    regions = regions,
                    fullScreen = true,
                    fullScreenEnabled = true,
                    onSelectedItemChange = onSelectedItemChange,
                    onFullScreenClick = onDismiss
                )
            }
        }
    }
}

@Composable
@Suppress("DEPRECATION")
private fun FullScreenDialogEffect(
    context: Context,
    dialogView: View
) {
    DisposableEffect(dialogView) {
        val activity = context.findActivity()
        val activityDecorView = activity?.window?.decorView
        val dialogWindow = (dialogView.parent as? DialogWindowProvider)?.window
        val dialogDecorView = dialogWindow?.decorView
        val previousActivityVisibility = activityDecorView?.systemUiVisibility
        val previousDialogVisibility = dialogDecorView?.systemUiVisibility
        val previousDialogFlags = dialogWindow?.attributes?.flags ?: 0
        val hadFullscreenFlag = activity?.window?.attributes?.flags
            ?.let { it and WindowManager.LayoutParams.FLAG_FULLSCREEN != 0 } == true
        val fullscreenFlags = immersiveFullscreenFlags()
        val fullscreenWindowFlags = WindowManager.LayoutParams.FLAG_FULLSCREEN or
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS

        activity?.window?.setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        )
        activityDecorView?.systemUiVisibility = fullscreenFlags
        dialogWindow?.setLayout(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        )
        dialogWindow?.setFlags(fullscreenWindowFlags, fullscreenWindowFlags)
        dialogDecorView?.systemUiVisibility = fullscreenFlags

        onDispose {
            if (activityDecorView != null && previousActivityVisibility != null) {
                activityDecorView.systemUiVisibility = previousActivityVisibility
            }
            if (dialogDecorView != null && previousDialogVisibility != null) {
                dialogDecorView.systemUiVisibility = previousDialogVisibility
            }
            dialogWindow?.clearFlags(fullscreenWindowFlags)
            dialogWindow?.setFlags(previousDialogFlags and fullscreenWindowFlags, fullscreenWindowFlags)
            if (activity != null && !hadFullscreenFlag) {
                activity.window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
            }
        }
    }
}

@Composable
private fun FullScreenRegionCanvas(
    modifier: Modifier,
    sourceImage: CaptchaSourceImage,
    items: List<AnnotationItem>,
    selectedItem: AnnotationItem?,
    regions: Map<String, CaptchaRegion>,
    onRegionChange: (String, CaptchaRegion) -> Unit,
    onDeleteSelected: (String) -> Unit
) {
    val bitmap = sourceImage.bitmap
    var canvasSize by remember { mutableStateOf(IntSize.Zero) }
    var dragStart by remember { mutableStateOf<Offset?>(null) }
    var dragCurrent by remember { mutableStateOf<Offset?>(null) }
    var gestureStart by remember { mutableStateOf<Offset?>(null) }
    var gestureBaseRegion by remember { mutableStateOf<CaptchaRegion?>(null) }
    var editMode by remember { mutableStateOf(RegionEditMode.None) }
    val selectedRegion = selectedItem?.let { regions[it.key] }
    val latestSelectedRegion by rememberUpdatedState(selectedRegion)

    Box(
        modifier = modifier
            .onSizeChanged { canvasSize = it }
            .pointerInput(selectedItem?.key, canvasSize) {
                val activeItem = selectedItem ?: return@pointerInput
                val deleteVisualSize = 32.dp.toPx()
                val deleteHitSize = 48.dp.toPx()
                val deleteGap = 6.dp.toPx()
                detectTapGestures(
                    onTap = { rawOffset ->
                        val offset = clampOffset(rawOffset, canvasSize)
                        val rect = latestSelectedRegion?.let {
                            regionToDisplayRect(it, canvasSize, bitmap)
                        }
                        if (
                            rect != null &&
                            deleteHandleHitRect(
                                rect = rect,
                                visualSizePx = deleteVisualSize,
                                hitSizePx = deleteHitSize,
                                canvasSize = canvasSize,
                                gapPx = deleteGap
                            ).contains(offset)
                        ) {
                            onDeleteSelected(activeItem.key)
                            editMode = RegionEditMode.None
                            dragStart = null
                            dragCurrent = null
                            gestureStart = null
                            gestureBaseRegion = null
                        }
                    }
                )
            }
            .pointerInput(selectedItem?.key, canvasSize) {
                val activeItem = selectedItem ?: return@pointerInput
                val edgeSlop = 40.dp.toPx()
                val deleteVisualSize = 32.dp.toPx()
                val deleteHitSize = 48.dp.toPx()
                val deleteGap = 6.dp.toPx()
                detectDragGestures(
                    onDragStart = { rawOffset ->
                        val offset = clampOffset(rawOffset, canvasSize)
                        val currentRegion = latestSelectedRegion
                        val rect = currentRegion?.let { regionToDisplayRect(it, canvasSize, bitmap) }
                        if (
                            rect != null &&
                            deleteHandleHitRect(
                                rect = rect,
                                visualSizePx = deleteVisualSize,
                                hitSizePx = deleteHitSize,
                                canvasSize = canvasSize,
                                gapPx = deleteGap
                            ).contains(offset)
                        ) {
                            onDeleteSelected(activeItem.key)
                            editMode = RegionEditMode.None
                            dragStart = null
                            dragCurrent = null
                            gestureStart = null
                            gestureBaseRegion = null
                            return@detectDragGestures
                        }
                        if (rect == null) {
                            editMode = RegionEditMode.Create
                            dragStart = offset
                            dragCurrent = offset
                            gestureStart = null
                            gestureBaseRegion = null
                        } else {
                            editMode = regionEditModeForOffset(rect, offset, edgeSlop)
                            dragStart = null
                            dragCurrent = null
                            gestureStart = if (editMode == RegionEditMode.None) null else offset
                            gestureBaseRegion = if (editMode == RegionEditMode.None) null else currentRegion
                        }
                    },
                    onDrag = { change, _ ->
                        val mode = editMode
                        if (mode == RegionEditMode.Create) {
                            dragCurrent = clampOffset(change.position, canvasSize)
                            return@detectDragGestures
                        }
                        val start = gestureStart ?: return@detectDragGestures
                        val base = gestureBaseRegion ?: return@detectDragGestures
                        val delta = displayDeltaToBitmap(
                            delta = change.position - start,
                            canvasSize = canvasSize,
                            bitmap = bitmap
                        )
                        val next = when (mode) {
                            RegionEditMode.Move -> moveRegion(base, delta.first, delta.second, bitmap)
                            RegionEditMode.ResizeLeft,
                            RegionEditMode.ResizeRight,
                            RegionEditMode.ResizeTop,
                            RegionEditMode.ResizeBottom -> resizeRegionByEdge(base, mode, delta.first, delta.second, bitmap)
                            else -> null
                        }
                        next?.let { onRegionChange(activeItem.key, it) }
                    },
                    onDragEnd = {
                        if (editMode == RegionEditMode.Create) {
                            val start = dragStart
                            val end = dragCurrent
                            if (start != null && end != null) {
                                displayRectToRegion(
                                    start = start,
                                    end = end,
                                    canvasSize = canvasSize,
                                    bitmap = bitmap
                                )?.let { onRegionChange(activeItem.key, it) }
                            }
                        }
                        editMode = RegionEditMode.None
                        dragStart = null
                        dragCurrent = null
                        gestureStart = null
                        gestureBaseRegion = null
                    },
                    onDragCancel = {
                        editMode = RegionEditMode.None
                        dragStart = null
                        dragCurrent = null
                        gestureStart = null
                        gestureBaseRegion = null
                    }
                )
            }
    ) {
        Image(
            bitmap = bitmap.asImageBitmap(),
            contentDescription = null,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.FillBounds
        )
        Canvas(modifier = Modifier.fillMaxSize()) {
            val itemByKey = items.associateBy { it.key }
            val selectedKey = selectedItem?.key
            regions.forEach { (key, region) ->
                if (key == selectedKey) {
                    return@forEach
                }
                val item = itemByKey[key] ?: return@forEach
                val rect = regionToDisplayRect(region, canvasSize, bitmap) ?: return@forEach
                drawAnnotationRect(rect, item)
            }
            if (selectedItem != null && selectedKey != null) {
                val selectedRegionForDraw = regions[selectedKey]
                val selectedRect = selectedRegionForDraw?.let { regionToDisplayRect(it, canvasSize, bitmap) }
                if (selectedRect != null) {
                    drawAnnotationRect(selectedRect, selectedItem)
                    drawSelectionHandles(selectedRect, selectedItem)
                    drawDeleteHandle(selectedRect, canvasSize)
                }
            }
            val start = dragStart
            val current = dragCurrent
            if (start != null && current != null) {
                val rect = Rect(
                    left = min(start.x, current.x),
                    top = min(start.y, current.y),
                    right = max(start.x, current.x),
                    bottom = max(start.y, current.y)
                )
                selectedItem?.let { drawAnnotationRect(rect, it) }
            }
        }
    }
}

@Composable
private fun FloatingRegionAdjustPanel(
    modifier: Modifier,
    item: AnnotationItem,
    region: CaptchaRegion?,
    step: Int,
    onStepChange: (Int) -> Unit,
    onMove: (Int, Int) -> Unit,
    onResize: (Int, Int) -> Unit,
    onResetDefault: () -> Unit,
    onReuseSize: () -> Unit,
    reuseSizeEnabled: Boolean,
    onPanelDrag: (Offset) -> Unit
) {
    Surface(
        modifier = modifier.width(218.dp),
        shape = RoundedCornerShape(8.dp),
        color = Color.White.copy(alpha = 0.94f),
        border = BorderStroke(1.dp, item.color.copy(alpha = 0.55f))
    ) {
        Column(
            modifier = Modifier.padding(8.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(item.color.copy(alpha = 0.12f), RoundedCornerShape(4.dp))
                    .padding(horizontal = 8.dp, vertical = 5.dp)
                    .pointerInput(item.key) {
                        detectDragGestures { _, dragAmount ->
                            onPanelDrag(dragAmount)
                        }
                    },
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    modifier = Modifier.weight(1f),
                    text = item.shortTitle,
                    color = item.color,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = "拖动",
                    color = AppTextSecondary,
                    style = MaterialTheme.typography.labelSmall
                )
            }
            Text(
                text = region?.let { "x=${it.x} y=${it.y} w=${it.w} h=${it.h}" } ?: "未生成区域",
                color = AppTextPrimary,
                style = MaterialTheme.typography.labelSmall
            )
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf(1, 5, 20).forEach { value ->
                    StepButton(
                        modifier = Modifier.weight(1f),
                        text = "${value}px",
                        selected = step == value,
                        onClick = { onStepChange(value) }
                    )
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Spacer(modifier = Modifier.weight(1f))
                AdjustButton(
                    modifier = Modifier.weight(1f),
                    text = "↑",
                    onClick = { onMove(0, -step) }
                )
                Spacer(modifier = Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                AdjustButton(
                    modifier = Modifier.weight(1f),
                    text = "←",
                    onClick = { onMove(-step, 0) }
                )
                AdjustButton(
                    modifier = Modifier.weight(1f),
                    text = "↓",
                    onClick = { onMove(0, step) }
                )
                AdjustButton(
                    modifier = Modifier.weight(1f),
                    text = "→",
                    onClick = { onMove(step, 0) }
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                AdjustButton(
                    modifier = Modifier.weight(1f),
                    text = "宽-",
                    onClick = { onResize(-step * 2, 0) }
                )
                AdjustButton(
                    modifier = Modifier.weight(1f),
                    text = "宽+",
                    onClick = { onResize(step * 2, 0) }
                )
                AdjustButton(
                    modifier = Modifier.weight(1f),
                    text = "高-",
                    onClick = { onResize(0, -step * 2) }
                )
                AdjustButton(
                    modifier = Modifier.weight(1f),
                    text = "高+",
                    onClick = { onResize(0, step * 2) }
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                AdjustButton(
                    modifier = Modifier.weight(1f),
                    text = "默认",
                    onClick = onResetDefault
                )
                AdjustButton(
                    modifier = Modifier.weight(1f),
                    text = "同尺寸",
                    enabled = reuseSizeEnabled,
                    onClick = onReuseSize
                )
            }
        }
    }
}

@Composable
private fun StepButton(
    modifier: Modifier,
    text: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    if (selected) {
        Button(
            modifier = modifier.height(32.dp),
            onClick = onClick,
            shape = ButtonShape,
            colors = ButtonDefaults.buttonColors(
                containerColor = AppPrimary,
                contentColor = Color.White
            ),
            contentPadding = ButtonDefaults.TextButtonContentPadding
        ) {
            Text(text = text, style = MaterialTheme.typography.labelSmall)
        }
    } else {
        OutlinedButton(
            modifier = modifier.height(32.dp),
            onClick = onClick,
            shape = ButtonShape,
            border = BorderStroke(1.dp, AppPrimary.copy(alpha = 0.55f)),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = AppPrimary),
            contentPadding = ButtonDefaults.TextButtonContentPadding
        ) {
            Text(text = text, style = MaterialTheme.typography.labelSmall)
        }
    }
}

@Composable
private fun AdjustButton(
    modifier: Modifier,
    text: String,
    enabled: Boolean = true,
    onClick: () -> Unit
) {
    OutlinedButton(
        modifier = modifier.height(32.dp),
        onClick = onClick,
        enabled = enabled,
        shape = ButtonShape,
        border = BorderStroke(1.dp, AppTextSecondary.copy(alpha = 0.35f)),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = AppTextPrimary),
        contentPadding = ButtonDefaults.TextButtonContentPadding
    ) {
        Text(text = text, style = MaterialTheme.typography.labelSmall)
    }
}

@Composable
private fun DimensionsStatus(
    sourceImage: CaptchaSourceImage?,
    screenSize: CaptchaScreenSize
) {
    val ready = sourceImage?.let {
        it.bitmap.width == screenSize.width && it.bitmap.height == screenSize.height
    } == true
    val text = sourceImage?.let {
        "截图 ${it.bitmap.width} x ${it.bitmap.height}，当前屏幕 ${screenSize.width} x ${screenSize.height}"
    } ?: "当前屏幕 ${screenSize.width} x ${screenSize.height}"
    Text(
        text = text,
        color = when {
            sourceImage == null -> AppTextSecondary
            ready -> AppPrimary
            else -> AppError
        },
        style = MaterialTheme.typography.bodySmall
    )
}

@Composable
private fun MissingItemsStatus(
    items: List<AnnotationItem>,
    regions: Map<String, CaptchaRegion>
) {
    val missing = missingItems(items, regions)
    Text(
        text = if (missing.isEmpty()) "必填区域已完成" else "未完成：${missing.joinToString("、")}",
        color = if (missing.isEmpty()) AppPrimary else AppTextSecondary,
        style = MaterialTheme.typography.bodySmall
    )
}

@Composable
private fun CalibrationStatusRow(
    title: String,
    description: String,
    ready: Boolean
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
                    style = MaterialTheme.typography.titleSmall,
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

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawSelectionHandles(
    rect: Rect,
    item: AnnotationItem
) {
    val handle = 18f
    val edgeColor = item.color.copy(alpha = 0.95f)
    drawRect(
        color = edgeColor,
        topLeft = Offset(rect.left - handle / 2f, rect.center.y - handle / 2f),
        size = Size(handle, handle)
    )
    drawRect(
        color = edgeColor,
        topLeft = Offset(rect.right - handle / 2f, rect.center.y - handle / 2f),
        size = Size(handle, handle)
    )
    drawRect(
        color = edgeColor,
        topLeft = Offset(rect.center.x - handle / 2f, rect.top - handle / 2f),
        size = Size(handle, handle)
    )
    drawRect(
        color = edgeColor,
        topLeft = Offset(rect.center.x - handle / 2f, rect.bottom - handle / 2f),
        size = Size(handle, handle)
    )
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawDeleteHandle(
    rect: Rect,
    canvasSize: IntSize
) {
    val sizePx = 32.dp.toPx()
    val handleRect = deleteHandleVisualRect(
        rect = rect,
        sizePx = sizePx,
        canvasSize = canvasSize,
        gapPx = 6.dp.toPx()
    )
    val crossInset = sizePx * 0.28f
    val crossStroke = max(4f, sizePx * 0.09f)
    drawRect(
        color = AppError,
        topLeft = Offset(handleRect.left, handleRect.top),
        size = Size(handleRect.width, handleRect.height)
    )
    drawLine(
        color = Color.White,
        start = Offset(handleRect.left + crossInset, handleRect.top + crossInset),
        end = Offset(handleRect.right - crossInset, handleRect.bottom - crossInset),
        strokeWidth = crossStroke
    )
    drawLine(
        color = Color.White,
        start = Offset(handleRect.right - crossInset, handleRect.top + crossInset),
        end = Offset(handleRect.left + crossInset, handleRect.bottom - crossInset),
        strokeWidth = crossStroke
    )
}

private fun startSimulation(
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
    val currentRegions = if (type.key == TYPE_MATH) mathRegions else sliderRegions
    val missing = missingItems(type.items, currentRegions)
    if (missing.isNotEmpty()) {
        return "请先完成：${missing.joinToString("、")}"
    }
    return try {
        AutomationScripts.ensureReady(context)
        val requestFile = CaptchaCalibrationStore.simulationRequestFile(context)
        val resultFile = CaptchaCalibrationStore.simulationResultFile(context)
        if (resultFile.exists()) {
            resultFile.delete()
        }
        val profile = buildTransientProfile(
            context = context,
            screenSize = screenSize,
            mathRegions = mathRegions,
            sliderRegions = sliderRegions
        )
        val sourceFile = CaptchaCalibrationStore.sourceImageFile(context, type.sourceName)
        if (!sourceFile.exists()) {
            return "${type.title}来源截图未写入，请重新选择截图"
        }
        requestFile.parentFile?.mkdirs()
        val requestJson = JSONObject()
            .put("schemaVersion", 1)
            .put("type", type.key)
            .put("imagePath", sourceFile.path)
            .put("resultPath", resultFile.path)
            .put("profile", profile.toJson())
        requestFile.writeText(requestJson.toString(2))

        val scriptFile = AutomationScripts.captchaSimulatorScriptFile(context)
        val execution = Scripts.run(ScriptFile(scriptFile.path))
        if (execution == null) {
            "模拟识别脚本启动失败"
        } else {
            null
        }
    } catch (e: Exception) {
        e.message ?: "模拟识别启动失败"
    }
}

private fun buildTransientProfile(
    context: Context,
    screenSize: CaptchaScreenSize,
    mathRegions: Map<String, CaptchaRegion>,
    sliderRegions: Map<String, CaptchaRegion>
): CaptchaCalibrationProfile {
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
    return baseProfile.copy(
        deviceWidth = screenSize.width,
        deviceHeight = screenSize.height,
        mathProfile = CaptchaMathProfile(
            completed = mathRegions[KEY_MATH_EXPRESSION]?.isValid == true &&
                mathRegions[KEY_MATH_INPUT]?.isValid == true &&
                mathRegions[KEY_MATH_SUBMIT]?.isValid == true,
            expressionRegion = mathRegions[KEY_MATH_EXPRESSION],
            inputRegion = mathRegions[KEY_MATH_INPUT],
            submitRegion = mathRegions[KEY_MATH_SUBMIT]
        ),
        sliderProfile = CaptchaSliderProfile(
            completed = sliderRegions[KEY_SLIDER_IMAGE_SEARCH]?.isValid == true &&
                sliderRegions[KEY_SLIDER_HANDLE]?.isValid == true &&
                sliderRegions[KEY_SLIDER_TRACK]?.isValid == true &&
                sliderRegions[KEY_SLIDER_SUBMIT]?.isValid == true,
            imageSearchRegion = sliderRegions[KEY_SLIDER_IMAGE_SEARCH],
            handleRegion = sliderRegions[KEY_SLIDER_HANDLE],
            trackRegion = sliderRegions[KEY_SLIDER_TRACK],
            submitRegion = sliderRegions[KEY_SLIDER_SUBMIT]
        )
    )
}

private fun readSimulationResult(resultFile: File): Pair<String, Boolean>? {
    if (!resultFile.exists()) {
        return null
    }
    return try {
        val json = JSONObject(resultFile.readText())
        formatSimulationResult(json)
    } catch (e: Exception) {
        "模拟识别结果读取失败：${e.message ?: "未知错误"}" to true
    }
}

private fun formatSimulationResult(json: JSONObject): Pair<String, Boolean> {
    val ok = json.optBoolean("ok", false)
    val type = json.optString("type")
    if (type == TYPE_MATH) {
        return if (ok) {
            val raw = json.optString("raw")
            val expression = json.optString("expression")
            val answer = json.optString("answer")
            val detail = json.optString("detail")
            "模拟识别成功：$expression = $answer，raw=$raw，$detail" to false
        } else {
            "模拟识别失败：${json.optString("reason", "unknown")}" to true
        }
    }
    if (type == TYPE_SLIDER) {
        return if (ok) {
            val start = json.optJSONObject("startPoint")
            val target = json.optJSONObject("targetPoint")
            val trackRatio = json.optDouble("trackRatio", 0.0)
            val arrowRatio = json.optDouble("arrowRatio", 0.0)
            val startText = pointJsonText(start)
            val targetText = pointJsonText(target)
            "模拟识别成功：起点$startText，目标$targetText，轨道=${ratioText(trackRatio)}，箭头=${ratioText(arrowRatio)}" to false
        } else {
            "模拟识别失败：${json.optString("reason", "unknown")}" to true
        }
    }
    return "模拟识别失败：${json.optString("reason", "unknown")}" to true
}

private fun pointJsonText(json: JSONObject?): String {
    if (json == null) {
        return "(无)"
    }
    return "(${json.optInt("x")},${json.optInt("y")})"
}

private fun ratioText(value: Double): String {
    return String.format(Locale.US, "%.3f", value)
}

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

private fun saveSourceImage(context: Context, bitmap: Bitmap, type: CalibrationType) {
    AutomationScripts.ensureReady(context)
    val file: File = CaptchaCalibrationStore.sourceImageFile(context, type.sourceName)
    file.parentFile?.mkdirs()
    file.outputStream().use { output ->
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
    }
}

private fun missingItems(
    items: List<AnnotationItem>,
    regions: Map<String, CaptchaRegion>
): List<String> {
    return items
        .filter { regions[it.key]?.isValid != true }
        .map { it.title }
}

private fun displayRectToRegion(
    start: Offset,
    end: Offset,
    canvasSize: IntSize,
    bitmap: Bitmap
): CaptchaRegion? {
    if (canvasSize.width <= 0 || canvasSize.height <= 0) {
        return null
    }
    val left = min(start.x, end.x).coerceIn(0f, canvasSize.width.toFloat())
    val top = min(start.y, end.y).coerceIn(0f, canvasSize.height.toFloat())
    val right = max(start.x, end.x).coerceIn(0f, canvasSize.width.toFloat())
    val bottom = max(start.y, end.y).coerceIn(0f, canvasSize.height.toFloat())
    if (right - left < 2f || bottom - top < 2f) {
        return null
    }
    val scaleX = bitmap.width.toFloat() / canvasSize.width.toFloat()
    val scaleY = bitmap.height.toFloat() / canvasSize.height.toFloat()
    val x = (left * scaleX).roundToInt().coerceIn(0, bitmap.width - 1)
    val y = (top * scaleY).roundToInt().coerceIn(0, bitmap.height - 1)
    val w = ((right - left) * scaleX).roundToInt().coerceAtLeast(1)
    val h = ((bottom - top) * scaleY).roundToInt().coerceAtLeast(1)
    return CaptchaRegion(
        x = x,
        y = y,
        w = min(w, bitmap.width - x),
        h = min(h, bitmap.height - y)
    )
}

private fun regionToDisplayRect(
    region: CaptchaRegion,
    canvasSize: IntSize,
    bitmap: Bitmap
): Rect? {
    if (canvasSize.width <= 0 || canvasSize.height <= 0 || !region.isValid) {
        return null
    }
    val scaleX = canvasSize.width.toFloat() / bitmap.width.toFloat()
    val scaleY = canvasSize.height.toFloat() / bitmap.height.toFloat()
    return Rect(
        left = region.x * scaleX,
        top = region.y * scaleY,
        right = (region.x + region.w) * scaleX,
        bottom = (region.y + region.h) * scaleY
    )
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

private fun reusableSizeRegion(
    selectedKey: String,
    items: List<AnnotationItem>,
    regions: Map<String, CaptchaRegion>
): CaptchaRegion? {
    val beforeSelected = items
        .takeWhile { it.key != selectedKey }
        .mapNotNull { regions[it.key] }
        .lastOrNull { it.isValid }
    return beforeSelected ?: items
        .filter { it.key != selectedKey }
        .mapNotNull { regions[it.key] }
        .firstOrNull { it.isValid }
}

private fun reuseRegionSize(
    selectedKey: String,
    items: List<AnnotationItem>,
    regions: Map<String, CaptchaRegion>,
    bitmap: Bitmap
): CaptchaRegion? {
    val source = reusableSizeRegion(selectedKey, items, regions) ?: return null
    val current = regions[selectedKey] ?: defaultRegionForItem(selectedKey, bitmap)
    val centerX = current.x + current.w / 2f
    val centerY = current.y + current.h / 2f
    return clampRegion(
        CaptchaRegion(
            x = (centerX - source.w / 2f).roundToInt(),
            y = (centerY - source.h / 2f).roundToInt(),
            w = source.w,
            h = source.h
        ),
        bitmap
    )
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

private fun deleteHandleVisualRect(
    rect: Rect,
    sizePx: Float,
    canvasSize: IntSize,
    gapPx: Float
): Rect {
    if (canvasSize.width <= 0 || canvasSize.height <= 0) {
        return Rect(
            left = rect.right + gapPx,
            top = rect.top,
            right = rect.right + gapPx + sizePx,
            bottom = rect.top + sizePx
        )
    }
    val candidates = listOf(
        Rect(rect.right + gapPx, rect.top, rect.right + gapPx + sizePx, rect.top + sizePx),
        Rect(rect.right - sizePx, rect.top - gapPx - sizePx, rect.right, rect.top - gapPx),
        Rect(rect.left - gapPx - sizePx, rect.top, rect.left - gapPx, rect.top + sizePx),
        Rect(rect.right + gapPx, rect.bottom - sizePx, rect.right + gapPx + sizePx, rect.bottom),
        Rect(rect.right - sizePx, rect.bottom + gapPx, rect.right, rect.bottom + gapPx + sizePx),
        Rect(rect.left - gapPx - sizePx, rect.bottom - sizePx, rect.left - gapPx, rect.bottom),
        Rect(rect.left, rect.top - gapPx - sizePx, rect.left + sizePx, rect.top - gapPx),
        Rect(rect.left, rect.bottom + gapPx, rect.left + sizePx, rect.bottom + gapPx + sizePx)
    )
    return candidates.firstOrNull { candidate ->
        candidate.isInsideCanvas(canvasSize) && !candidate.intersects(rect)
    } ?: clampRectToCanvas(candidates.first(), canvasSize)
}

private fun deleteHandleHitRect(
    rect: Rect,
    visualSizePx: Float,
    hitSizePx: Float,
    canvasSize: IntSize,
    gapPx: Float
): Rect {
    val visualRect = deleteHandleVisualRect(
        rect = rect,
        sizePx = visualSizePx,
        canvasSize = canvasSize,
        gapPx = gapPx
    )
    val center = visualRect.center
    return clampRectToCanvas(
        Rect(
            left = center.x - hitSizePx / 2f,
            top = center.y - hitSizePx / 2f,
            right = center.x + hitSizePx / 2f,
            bottom = center.y + hitSizePx / 2f
        ),
        canvasSize
    )
}

private fun Rect.isInsideCanvas(canvasSize: IntSize): Boolean {
    return left >= 0f &&
        top >= 0f &&
        right <= canvasSize.width &&
        bottom <= canvasSize.height
}

private fun Rect.intersects(other: Rect): Boolean {
    return left < other.right &&
        right > other.left &&
        top < other.bottom &&
        bottom > other.top
}

private fun clampRectToCanvas(rect: Rect, canvasSize: IntSize): Rect {
    if (canvasSize.width <= 0 || canvasSize.height <= 0) {
        return rect
    }
    val left = rect.left.coerceIn(0f, (canvasSize.width - rect.width).coerceAtLeast(0f))
    val top = rect.top.coerceIn(0f, (canvasSize.height - rect.height).coerceAtLeast(0f))
    return Rect(
        left = left,
        top = top,
        right = left + rect.width,
        bottom = top + rect.height
    )
}

private fun regionEditModeForOffset(
    rect: Rect,
    offset: Offset,
    edgeSlop: Float
): RegionEditMode {
    val insideRect = rect.contains(offset)
    val inExpandedBounds = offset.x >= rect.left - edgeSlop &&
        offset.x <= rect.right + edgeSlop &&
        offset.y >= rect.top - edgeSlop &&
        offset.y <= rect.bottom + edgeSlop
    if (!inExpandedBounds) {
        return RegionEditMode.None
    }
    val insideEdgeSlop = min(edgeSlop, max(12f, min(rect.width, rect.height) * 0.30f))
    val activeEdgeSlop = if (insideRect) insideEdgeSlop else edgeSlop
    val inVerticalBand = offset.y >= rect.top - edgeSlop && offset.y <= rect.bottom + edgeSlop
    val inHorizontalBand = offset.x >= rect.left - edgeSlop && offset.x <= rect.right + edgeSlop
    val leftDistance = kotlin.math.abs(offset.x - rect.left)
    val rightDistance = kotlin.math.abs(offset.x - rect.right)
    val topDistance = kotlin.math.abs(offset.y - rect.top)
    val bottomDistance = kotlin.math.abs(offset.y - rect.bottom)
    var nearestDistance = Float.MAX_VALUE
    var nearestMode = RegionEditMode.None
    fun accept(distance: Float, mode: RegionEditMode) {
        if (distance <= activeEdgeSlop && distance < nearestDistance) {
            nearestDistance = distance
            nearestMode = mode
        }
    }
    if (inVerticalBand) {
        accept(leftDistance, RegionEditMode.ResizeLeft)
        accept(rightDistance, RegionEditMode.ResizeRight)
    }
    if (inHorizontalBand) {
        accept(topDistance, RegionEditMode.ResizeTop)
        accept(bottomDistance, RegionEditMode.ResizeBottom)
    }
    return when {
        nearestMode != RegionEditMode.None -> nearestMode
        insideRect -> RegionEditMode.Move
        else -> RegionEditMode.None
    }
}

private fun displayDeltaToBitmap(
    delta: Offset,
    canvasSize: IntSize,
    bitmap: Bitmap
): Pair<Int, Int> {
    if (canvasSize.width <= 0 || canvasSize.height <= 0) {
        return 0 to 0
    }
    return Pair(
        (delta.x * bitmap.width / canvasSize.width).roundToInt(),
        (delta.y * bitmap.height / canvasSize.height).roundToInt()
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

private fun profileRegionSummary(markedCompleted: Boolean): String {
    return if (markedCompleted) {
        "已写入必填区域"
    } else {
        "未写入必填区域"
    }
}

private fun toast(context: Context, message: String) {
    Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
}
