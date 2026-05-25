@file:OptIn(ExperimentalMaterial3Api::class)

package org.autojs.autojs.ui.logupload

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Environment
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.openautojs.autojs.R
import java.io.*
import java.text.SimpleDateFormat
import java.util.*
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

// 复用 BeginnerHomeActivity 的颜色定义
private val AppPrimary = Color(0xFF009688)
private val AppAccent = Color(0xFF03A9F4)
private val AppTextPrimary = Color(0xFF282C2F)
private val AppTextSecondary = Color(0xFF9DA0A2)
private val AppDivider = Color(0xFFF2F3F5)
private val AppError = Color(0xFFFD999A)
private val CardShape = RoundedCornerShape(8.dp)
private val ButtonShape = RoundedCornerShape(4.dp)

data class LogEntry(
    val dirName: String,
    val dirPath: File,
    val logFiles: List<File>,
    val totalSize: Long,
    val isSelected: Boolean = false
)

class LogUploadActivity : ComponentActivity() {
    companion object {
        fun start(context: Context) {
            context.startActivity(Intent(context, LogUploadActivity::class.java))
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Color.White
                ) {
                    LogUploadScreen()
                }
            }
        }
    }
}

@Composable
private fun LogUploadScreen() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var logEntries by remember { mutableStateOf<List<LogEntry>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var isUploading by remember { mutableStateOf(false) }
    var uploadProgress by remember { mutableStateOf("") }
    var showProgressDialog by remember { mutableStateOf(false) }

    // 加载日志列表
    LaunchedEffect(Unit) {
        withContext(Dispatchers.IO) {
            logEntries = loadLogEntries(context)
            isLoading = false
        }
    }

    Scaffold(
        containerColor = Color.White,
        topBar = {
            TopAppBar(
                title = { Text(text = "上传日志") },
                colors = TopAppBarDefaults.smallTopAppBarColors(
                    containerColor = Color.White,
                    titleContentColor = AppTextPrimary
                ),
                navigationIcon = {
                    IconButton(onClick = { (context as ComponentActivity).finish() }) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
                            contentDescription = "返回"
                        )
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            if (isLoading) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = AppPrimary)
                }
            } else if (logEntries.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "暂无日志记录",
                        color = AppTextSecondary
                    )
                }
            } else {
                // 提示文字
                Text(
                    text = "选择要上传的日志（最近 ${logEntries.size} 次运行）",
                    modifier = Modifier.padding(16.dp),
                    color = AppTextSecondary,
                    style = MaterialTheme.typography.bodyMedium
                )

                // 日志列表
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    contentPadding = PaddingValues(horizontal = 16.dp)
                ) {
                    items(logEntries) { entry ->
                        LogEntryItem(
                            entry = entry,
                            onToggle = { toggled ->
                                logEntries = logEntries.map {
                                    if (it.dirName == entry.dirName) it.copy(isSelected = toggled)
                                    else it
                                }
                            }
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                }

                // 上传按钮
                val selectedCount = logEntries.count { it.isSelected }
                Button(
                    onClick = {
                        if (selectedCount > 0) {
                            showProgressDialog = true
                            scope.launch {
                                uploadLogs(context, logEntries.filter { it.isSelected }) { progress ->
                                    uploadProgress = progress
                                }
                                showProgressDialog = false
                                isUploading = false
                            }
                        } else {
                            Toast.makeText(context, "请先选择要上传的日志", Toast.LENGTH_SHORT).show()
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    shape = ButtonShape,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AppPrimary,
                        contentColor = Color.White
                    ),
                    enabled = !isUploading
                ) {
                    Text(text = if (selectedCount > 0) "上传选中的 $selectedCount 条日志" else "上传日志")
                }
            }
        }
    }

    // 上传进度对话框
    if (showProgressDialog) {
        ProgressDialog(
            progressText = uploadProgress,
            onDismissRequest = { /* 不允许关闭 */ }
        )
    }
}

@Composable
private fun LogEntryItem(
    entry: LogEntry,
    onToggle: (Boolean) -> Unit
) {
    OutlinedCard(
        modifier = Modifier.fillMaxWidth(),
        shape = CardShape,
        border = BorderStroke(
            1.dp,
            if (entry.isSelected) AppPrimary else AppDivider
        ),
        colors = CardDefaults.outlinedCardColors(
            containerColor = if (entry.isSelected) AppPrimary.copy(alpha = 0.05f) else Color.White
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Checkbox(
                checked = entry.isSelected,
                onCheckedChange = onToggle,
                colors = CheckboxDefaults.colors(
                    checkedColor = AppPrimary,
                    uncheckedColor = AppTextSecondary
                )
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = entry.dirName,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = AppTextPrimary
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "${entry.logFiles.size} 个文件 · ${formatFileSize(entry.totalSize)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = AppTextSecondary
                )
            }
        }
    }
}

@Composable
private fun ProgressDialog(
    progressText: String,
    onDismissRequest: () -> Unit
) {
    Dialog(
        onDismissRequest = onDismissRequest,
        properties = DialogProperties(dismissOnBackPress = false, dismissOnClickOutside = false)
    ) {
        Surface(
            shape = RoundedCornerShape(12.dp),
            color = Color.White
        ) {
            Row(
                modifier = Modifier.padding(24.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                CircularProgressIndicator(
                    color = AppPrimary,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(16.dp))
                Text(
                    text = progressText,
                    color = AppTextPrimary
                )
            }
        }
    }
}

// 加载日志条目
private fun loadLogEntries(context: Context): List<LogEntry> {
    val logDir = File(
        Environment.getExternalStorageDirectory(),
        "OpenAutoJS_NanjingBooking"
    )

    if (!logDir.exists() || !logDir.isDirectory) {
        return emptyList()
    }

    val entries = logDir.listFiles()
        ?.filter { it.isDirectory }
        ?.sortedByDescending { it.name }
        ?.take(10) // 最多显示最近 10 次
        ?.map { dir ->
            val files = dir.listFiles()?.toList() ?: emptyList()
            val totalSize = files.sumOf { it.length() }
            LogEntry(
                dirName = dir.name,
                dirPath = dir,
                logFiles = files,
                totalSize = totalSize
            )
        } ?: emptyList()

    return entries
}

// 上传日志
private suspend fun uploadLogs(
    context: Context,
    selectedEntries: List<LogEntry>,
    onProgress: (String) -> Unit
) {
    withContext(Dispatchers.IO) {
        try {
            // 1. 压缩日志
            withContext(Dispatchers.Main) {
                onProgress("正在压缩日志...")
            }
            val zipFile = compressLogs(selectedEntries)

            // 2. 上传到 ntfy
            withContext(Dispatchers.Main) {
                onProgress("正在上传...")
            }
            val success = uploadToNtfy(zipFile)

            // 3. 清理临时文件
            zipFile.delete()

            withContext(Dispatchers.Main) {
                if (success) {
                    Toast.makeText(context, "日志上传成功", Toast.LENGTH_LONG).show()
                    (context as ComponentActivity).finish()
                } else {
                    Toast.makeText(context, "上传失败，请检查网络后重试", Toast.LENGTH_LONG).show()
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
            withContext(Dispatchers.Main) {
                Toast.makeText(context, "上传失败：${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }
}

// 压缩日志文件
private fun compressLogs(entries: List<LogEntry>): File {
    val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
    val zipFile = File.createTempFile("OpenAutoJS_Log_$timestamp", ".zip")

    ZipOutputStream(BufferedOutputStream(FileOutputStream(zipFile))).use { zos ->
        entries.forEach { entry ->
            entry.logFiles.forEach { file ->
                val entryName = "${entry.dirName}/${file.name}"
                val zipEntry = ZipEntry(entryName)
                zos.putNextEntry(zipEntry)

                FileInputStream(file).use { fis ->
                    BufferedInputStream(fis).use { bis ->
                        bis.copyTo(zos)
                    }
                }
                zos.closeEntry()
            }
        }
    }

    return zipFile
}

// 上传到 ntfy 服务
private fun uploadToNtfy(zipFile: File): Boolean {
    val url = java.net.URL("https://ntfy.leochen3155.site/openautojs")
    val connection = url.openConnection() as java.net.HttpURLConnection

    try {
        connection.requestMethod = "POST"
        connection.doOutput = true
        connection.setRequestProperty("Filename", zipFile.name)
        connection.setRequestProperty("Title", "OpenAutoJS 日志上传")
        connection.connectTimeout = 30000
        connection.readTimeout = 30000

        // 写入文件
        FileInputStream(zipFile).use { fis ->
            BufferedInputStream(fis).use { bis ->
                connection.outputStream.use { os ->
                    bis.copyTo(os)
                }
            }
        }

        val responseCode = connection.responseCode
        return responseCode in 200..299
    } finally {
        connection.disconnect()
    }
}

// 格式化文件大小
private fun formatFileSize(bytes: Long): String {
    return when {
        bytes < 1024 -> "$bytes B"
        bytes < 1024 * 1024 -> "${bytes / 1024} KB"
        else -> "${"%.1f".format(bytes / (1024.0 * 1024.0))} MB"
    }
}
