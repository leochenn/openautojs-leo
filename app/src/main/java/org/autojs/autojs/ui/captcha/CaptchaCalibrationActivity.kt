@file:OptIn(ExperimentalMaterial3Api::class, ExperimentalComposeUiApi::class)

package org.autojs.autojs.ui.captcha

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
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
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CardDefaults
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import org.autojs.autojs.model.automation.AutomationScripts
import org.autojs.autojs.model.automation.CaptchaCalibrationProfile
import org.autojs.autojs.model.automation.CaptchaCalibrationStore
import org.autojs.autojs.model.automation.CaptchaMathProfile
import org.autojs.autojs.model.automation.CaptchaRegion
import org.autojs.autojs.model.automation.CaptchaScreenSize
import org.autojs.autojs.model.automation.CaptchaSliderProfile
import org.autojs.autojs.ui.compose.theme.AutoXJsTheme
import org.openautojs.autojs.R
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sqrt

private val AppPrimary = Color(0xFF009688)
private val AppTextPrimary = Color(0xFF282C2F)
private val AppTextSecondary = Color(0xFF6F767A)
private val AppDivider = Color(0xFFF2F3F5)
private val AppError = Color(0xFFFD7778)
private val AppWarning = Color(0xFFFF9800)
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

private data class ImageViewport(
    val scale: Float,
    val offset: Offset
)

private enum class RegionEditMode {
    None,
    Create,
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

    var step by rememberSaveable { mutableStateOf(0) }
    var selectedTypeKey by rememberSaveable { mutableStateOf(TYPE_MATH) }
    val selectedType = calibrationTypeOf(selectedTypeKey)
    var mathRegions by remember { mutableStateOf(regionsFromMathProfile(profile?.mathProfile)) }
    var sliderRegions by remember { mutableStateOf(regionsFromSliderProfile(profile?.sliderProfile)) }
    var mathImage by remember { mutableStateOf<CaptchaSourceImage?>(null) }
    var sliderImage by remember { mutableStateOf<CaptchaSourceImage?>(null) }
    var message by remember { mutableStateOf<String?>(null) }
    var messageIsError by remember { mutableStateOf(false) }
    var dimensionError by remember { mutableStateOf<String?>(null) }

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
                    step = 2
                } else {
                    dimensionError = "截图尺寸 ${bitmap.width} x ${bitmap.height}，与当前屏幕 ${imgScreenSize.width} x ${imgScreenSize.height} 不一致。请使用本机当前屏幕截图。"
                }
            } catch (e: Exception) {
                message = "读取截图失败：${e.message ?: "未知错误"}"
                messageIsError = true
            }
        }
    }

    val currentImage = if (selectedType.key == TYPE_MATH) mathImage else sliderImage

    Scaffold(
        containerColor = Color.White,
        topBar = {
            if (step < 2) {
                TopAppBar(
                    title = { Text(text = if (step == 0) "验证码校准" else "选择截图") },
                    navigationIcon = {
                        TextButton(
                            onClick = { if (step > 0) step-- else onBack() },
                            colors = ButtonDefaults.textButtonColors(contentColor = AppPrimary)
                        ) {
                            Text(text = if (step > 0) "返回" else "退出")
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
            0 -> TypeSelectionStep(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                profile = profile,
                onSelectType = { key ->
                    selectedTypeKey = key
                    step = 1
                }
            )
            1 -> ImagePickStep(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                type = selectedType,
                currentImage = currentImage,
                onPickImage = { imagePickerLauncher.launch("image/*") },
                onUseExisting = { step = 2 }
            )
            2 -> {
                val currentRegions = if (selectedType.key == TYPE_MATH) mathRegions else sliderRegions
                FullScreenAnnotateStep(
                    sourceImage = currentImage,
                    type = selectedType,
                    regions = currentRegions,
                    message = message,
                    messageIsError = messageIsError,
                    onBack = { step = 1 },
                    onRegionChange = { key, region ->
                        if (selectedType.key == TYPE_MATH) {
                            mathRegions = mathRegions + (key to region)
                        } else {
                            sliderRegions = sliderRegions + (key to region)
                        }
                    },
                    onDeleteRegion = { key ->
                        if (selectedType.key == TYPE_MATH) {
                            mathRegions = mathRegions - key
                        } else {
                            sliderRegions = sliderRegions - key
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
                            step = 0
                        } else {
                            message = saveResult
                            messageIsError = true
                        }
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
    onSelectType: (String) -> Unit
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

        Spacer(modifier = Modifier.weight(1f))
        Text(
            modifier = Modifier.fillMaxWidth(),
            text = "点击卡片开始校准",
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
    onDeleteRegion: (String) -> Unit,
    onSave: () -> Unit
) {
    val context = LocalContext.current
    val view = LocalView.current
    FullScreenDialogEffect(context = context, dialogView = view)

    val items = type.items
    var selectedItemKey by rememberSaveable { mutableStateOf<String?>(null) }

    // 进入时自动选中第一个未完成的区域，或第一个区域
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
            onDeleteSelected = { key -> onDeleteRegion(key) }
        )

        // 顶部步骤指示器
        StepIndicator(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .fillMaxWidth()
                .padding(8.dp),
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
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(8.dp),
        color = Color.Black.copy(alpha = 0.7f)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            items.forEachIndexed { index, item ->
                val completed = regions[item.key]?.isValid == true
                val selected = item.key == selectedItemKey
                if (index > 0) {
                    Text(
                        text = "→",
                        color = Color.White.copy(alpha = 0.5f),
                        style = MaterialTheme.typography.labelSmall
                    )
                }
                Row(
                    modifier = Modifier
                        .clickable { onSelectedItemChange(item.key) }
                        .background(
                            color = when {
                                selected -> item.color
                                completed -> item.color.copy(alpha = 0.3f)
                                else -> Color.Transparent
                            },
                            shape = RoundedCornerShape(4.dp)
                        )
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        text = if (completed) "✓" else "${index + 1}",
                        color = Color.White,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = item.shortTitle,
                        color = Color.White,
                        style = MaterialTheme.typography.labelSmall
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
    onDeleteSelected: (String) -> Unit
) {
    val bitmap = sourceImage.bitmap
    val imageBitmap = remember(bitmap) { bitmap.asImageBitmap() }
    var canvasSize by remember { mutableStateOf(IntSize.Zero) }
    var imageScale by remember(bitmap) { mutableStateOf(MIN_IMAGE_SCALE) }
    var imageOffset by remember(bitmap) { mutableStateOf(Offset.Zero) }
    var dragStart by remember { mutableStateOf<Offset?>(null) }
    var dragCurrent by remember { mutableStateOf<Offset?>(null) }
    var gestureStart by remember { mutableStateOf<Offset?>(null) }
    var gestureBaseRegion by remember { mutableStateOf<CaptchaRegion?>(null) }
    var gestureBaseImageOffset by remember { mutableStateOf<Offset?>(null) }
    var editMode by remember { mutableStateOf(RegionEditMode.None) }
    val selectedRegion = selectedItem?.let { regions[it.key] }
    val latestSelectedRegion by rememberUpdatedState(selectedRegion)
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
                            dragStart = null
                            dragCurrent = null
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
            .pointerInput(selectedItem?.key, canvasSize, bitmap) {
                val activeItem = selectedItem ?: return@pointerInput
                val deleteVisualSize = 32.dp.toPx()
                val deleteHitSize = 48.dp.toPx()
                val deleteGap = 6.dp.toPx()
                detectTapGestures(
                    onTap = { rawOffset ->
                        val offset = clampOffset(rawOffset, canvasSize)
                        val rect = latestSelectedRegion?.let {
                            regionToDisplayRect(it, latestViewport)
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
            .pointerInput(selectedItem?.key, canvasSize, bitmap) {
                val activeItem = selectedItem ?: return@pointerInput
                detectDragGesturesAfterLongPress(
                    onDragStart = { rawOffset ->
                        val offset = clampOffset(rawOffset, canvasSize)
                        val currentRegion = latestSelectedRegion
                        val rect = currentRegion?.let { regionToDisplayRect(it, latestViewport) }
                        if (rect != null && rect.contains(offset)) {
                            editMode = RegionEditMode.Move
                            dragStart = null
                            dragCurrent = null
                            gestureStart = offset
                            gestureBaseRegion = currentRegion
                            gestureBaseImageOffset = null
                        } else {
                            editMode = RegionEditMode.None
                            dragStart = null
                            dragCurrent = null
                            gestureStart = null
                            gestureBaseRegion = null
                            gestureBaseImageOffset = null
                        }
                    },
                    onDrag = { change, _ ->
                        if (editMode != RegionEditMode.Move) {
                            return@detectDragGesturesAfterLongPress
                        }
                        val start = gestureStart ?: return@detectDragGesturesAfterLongPress
                        val base = gestureBaseRegion ?: return@detectDragGesturesAfterLongPress
                        val delta = displayDeltaToBitmap(
                            delta = change.position - start,
                            viewport = latestViewport
                        )
                        onRegionChange(activeItem.key, moveRegion(base, delta.first, delta.second, bitmap))
                        change.consume()
                    },
                    onDragEnd = {
                        editMode = RegionEditMode.None
                        dragStart = null
                        dragCurrent = null
                        gestureStart = null
                        gestureBaseRegion = null
                        gestureBaseImageOffset = null
                    },
                    onDragCancel = {
                        editMode = RegionEditMode.None
                        dragStart = null
                        dragCurrent = null
                        gestureStart = null
                        gestureBaseRegion = null
                        gestureBaseImageOffset = null
                    }
                )
            }
            .pointerInput(selectedItem?.key, canvasSize, bitmap) {
                val activeItem = selectedItem ?: return@pointerInput
                val edgeSlop = 40.dp.toPx()
                val deleteVisualSize = 32.dp.toPx()
                val deleteHitSize = 48.dp.toPx()
                val deleteGap = 6.dp.toPx()
                detectDragGestures(
                    onDragStart = { rawOffset ->
                        val offset = clampOffset(rawOffset, canvasSize)
                        val currentRegion = latestSelectedRegion
                        val rect = currentRegion?.let { regionToDisplayRect(it, latestViewport) }
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
                            editMode = RegionEditMode.None
                            dragStart = null
                            dragCurrent = null
                            gestureStart = null
                            gestureBaseRegion = null
                            gestureBaseImageOffset = null
                            return@detectDragGestures
                        }
                        if (rect == null) {
                            editMode = if (latestImageScale > MIN_IMAGE_SCALE) RegionEditMode.ImagePan else RegionEditMode.Create
                            dragStart = if (editMode == RegionEditMode.Create) offset else null
                            dragCurrent = if (editMode == RegionEditMode.Create) offset else null
                            gestureStart = if (editMode == RegionEditMode.ImagePan) offset else null
                            gestureBaseRegion = null
                            gestureBaseImageOffset = if (editMode == RegionEditMode.ImagePan) latestImageOffset else null
                        } else {
                            val detectedMode = regionEditModeForOffset(rect, offset, edgeSlop)
                            editMode = when {
                                detectedMode == RegionEditMode.ResizeLeft ||
                                    detectedMode == RegionEditMode.ResizeRight ||
                                    detectedMode == RegionEditMode.ResizeTop ||
                                    detectedMode == RegionEditMode.ResizeBottom -> detectedMode
                                latestImageScale > MIN_IMAGE_SCALE -> RegionEditMode.ImagePan
                                else -> RegionEditMode.None
                            }
                            dragStart = null
                            dragCurrent = null
                            gestureStart = if (editMode == RegionEditMode.None) null else offset
                            gestureBaseRegion = if (editMode == RegionEditMode.ImagePan || editMode == RegionEditMode.None) null else currentRegion
                            gestureBaseImageOffset = if (editMode == RegionEditMode.ImagePan) latestImageOffset else null
                        }
                    },
                    onDrag = { change, _ ->
                        val mode = editMode
                        if (mode == RegionEditMode.Create) {
                            dragCurrent = clampOffset(change.position, canvasSize)
                            return@detectDragGestures
                        }
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
                                    viewport = latestViewport,
                                    bitmap = bitmap
                                )?.let { onRegionChange(activeItem.key, it) }
                            }
                        }
                        editMode = RegionEditMode.None
                        dragStart = null
                        dragCurrent = null
                        gestureStart = null
                        gestureBaseRegion = null
                        gestureBaseImageOffset = null
                    },
                    onDragCancel = {
                        editMode = RegionEditMode.None
                        dragStart = null
                        dragCurrent = null
                        gestureStart = null
                        gestureBaseRegion = null
                        gestureBaseImageOffset = null
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
            regions.forEach { (key, region) ->
                if (key == selectedKey) return@forEach
                val item = itemByKey[key] ?: return@forEach
                val rect = regionToDisplayRect(region, viewport) ?: return@forEach
                drawAnnotationRect(rect, item)
            }
            if (selectedItem != null && selectedKey != null) {
                val selectedRegionForDraw = regions[selectedKey]
                val selectedRect = selectedRegionForDraw?.let { regionToDisplayRect(it, viewport) }
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

private fun displayRectToRegion(
    start: Offset,
    end: Offset,
    viewport: ImageViewport,
    bitmap: Bitmap
): CaptchaRegion? {
    if (viewport.scale <= 0f) {
        return null
    }
    val startInBitmap = displayOffsetToBitmap(start, viewport, bitmap)
    val endInBitmap = displayOffsetToBitmap(end, viewport, bitmap)
    val left = min(startInBitmap.x, endInBitmap.x).coerceIn(0f, bitmap.width.toFloat())
    val top = min(startInBitmap.y, endInBitmap.y).coerceIn(0f, bitmap.height.toFloat())
    val right = max(startInBitmap.x, endInBitmap.x).coerceIn(0f, bitmap.width.toFloat())
    val bottom = max(startInBitmap.y, endInBitmap.y).coerceIn(0f, bitmap.height.toFloat())
    if (right - left < 2f || bottom - top < 2f) {
        return null
    }
    val x = left.roundToInt().coerceIn(0, bitmap.width - 1)
    val y = top.roundToInt().coerceIn(0, bitmap.height - 1)
    val w = (right - left).roundToInt().coerceAtLeast(1)
    val h = (bottom - top).roundToInt().coerceAtLeast(1)
    return CaptchaRegion(
        x = x,
        y = y,
        w = min(w, bitmap.width - x),
        h = min(h, bitmap.height - y)
    )
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

private fun displayOffsetToBitmap(
    offset: Offset,
    viewport: ImageViewport,
    bitmap: Bitmap
): Offset {
    return Offset(
        x = ((offset.x - viewport.offset.x) / viewport.scale).coerceIn(0f, bitmap.width.toFloat()),
        y = ((offset.y - viewport.offset.y) / viewport.scale).coerceIn(0f, bitmap.height.toFloat())
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
