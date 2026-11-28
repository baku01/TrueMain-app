package lol.truemain.mobile.ui.connect

import android.app.Activity
import android.content.ClipboardManager
import android.content.Context
import android.content.ContextWrapper
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import lol.truemain.mobile.R
import lol.truemain.mobile.graph
import lol.truemain.mobile.link.Invite
import lol.truemain.mobile.link.LinkState
import lol.truemain.mobile.ui.components.Panel
import lol.truemain.mobile.ui.components.TmMark
import lol.truemain.mobile.ui.components.TmWordmark
import lol.truemain.mobile.ui.theme.Tm

/**
 * Pairing: the steps on the computer, the QR scanner (Play services' own, so
 * the app asks for no camera permission) and a pasted link for a phone
 * without it. Also where a phone the computer forgot lands.
 */
@Composable
fun ConnectScreen(state: LinkState) {
    val context = LocalContext.current
    val graph = context.graph
    val linkState by graph.link.state.collectAsState()
    var pasted by remember { mutableStateOf("") }
    var problem by remember { mutableStateOf<String?>(null) }
    val badLink = stringResource(R.string.connect_bad_link)
    val noScanner = stringResource(R.string.connect_scanner_unavailable)

    fun pair(text: String?) {
        val invite = text?.let(Invite::parse)
        if (invite == null) {
            problem = badLink
            return
        }
        problem = null
        graph.link.pair(invite)
    }

    val connecting = linkState is LinkState.Connecting || linkState is LinkState.Searching
    val primary = Tm.colors.primary
    Box(Modifier.fillMaxSize().background(Tm.colors.bg)) {
        // Subtle radial glow at top, echoing desktop's `.tm-emblem`
        Box(
            Modifier
                .fillMaxWidth()
                .height(260.dp)
                .background(
                    Brush.verticalGradient(
                        listOf(primary.copy(alpha = if (Tm.colors.light) 0.10f else 0.16f), Color.Transparent),
                    ),
                ),
        )
        Column(
            Modifier
                .fillMaxSize()
                .navigationBarsPadding()
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            Spacer(Modifier.height(16.dp))

            // Brand emblem tile + wordmark
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(
                    Modifier
                        .size(44.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(
                            Brush.verticalGradient(
                                listOf(primary.copy(alpha = 0.25f), Tm.colors.pane),
                            ),
                        )
                        .border(1.dp, primary.copy(alpha = 0.35f), RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    TmMark(size = 26.dp)
                }
                TmWordmark(fontSize = 20.sp, markSize = 0.dp)
            }

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    stringResource(R.string.connect_title),
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = Tm.Ink100,
                )
                Text(
                    stringResource(R.string.connect_body),
                    style = MaterialTheme.typography.bodyLarge,
                    color = Tm.Ink300,
                )
            }

            if (state is LinkState.Revoked) {
                Text(stringResource(R.string.connect_revoked), color = Tm.Gold, style = MaterialTheme.typography.bodyMedium)
            }

            Panel(padding = 16.dp) {
                listOf(R.string.connect_step1, R.string.connect_step2, R.string.connect_step3).forEachIndexed { index, step ->
                    Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Box(
                            Modifier
                                .size(24.dp)
                                .clip(RoundedCornerShape(6.dp))
                                .background(Tm.Rose950),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                "${index + 1}",
                                fontFamily = Tm.DisplayFont,
                                fontSize = 12.sp,
                                color = Tm.Rose300,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                        Text(
                            stringResource(step),
                            color = Tm.Ink200,
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                }
            }

            Button(
                shape = Tm.ButtonShape,
                enabled = !connecting,
                onClick = {
                    problem = null
                    runCatching {
                        val host = context.findActivity() ?: context
                        val options = GmsBarcodeScannerOptions.Builder()
                            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
                            .enableAutoZoom()
                            .build()
                        GmsBarcodeScanning.getClient(host, options).startScan()
                            .addOnSuccessListener { barcode -> pair(barcode.rawValue) }
                            .addOnFailureListener { problem = noScanner }
                    }.onFailure {
                        problem = noScanner
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = Tm.Rose400, contentColor = Tm.colors.textInverted),
                modifier = Modifier.fillMaxWidth().height(50.dp),
            ) {
                Text(stringResource(R.string.connect_scan), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            }

            OutlinedTextField(
                value = pasted,
                onValueChange = { pasted = it },
                enabled = !connecting,
                label = { Text(stringResource(R.string.connect_paste)) },
                singleLine = true,
                shape = Tm.ButtonShape,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { if (!connecting && pasted.isNotBlank()) pair(pasted) }),
                trailingIcon = {
                    TextButton(
                        enabled = !connecting,
                        onClick = {
                            val clipboard = context.getSystemService(ClipboardManager::class.java)
                            val clip = clipboard?.primaryClip?.getItemAt(0)?.coerceToText(context)?.toString()?.trim()
                            if (!clip.isNullOrEmpty()) pasted = clip
                        },
                    ) {
                        Text(stringResource(R.string.connect_paste_button), color = Tm.colors.primary, style = MaterialTheme.typography.labelMedium)
                    }
                },
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Tm.colors.primary,
                    unfocusedBorderColor = Tm.colors.border,
                    focusedContainerColor = Tm.colors.bgMuted,
                    unfocusedContainerColor = Tm.colors.bgMuted,
                ),
                modifier = Modifier.fillMaxWidth(),
            )
            if (pasted.isNotBlank()) {
                TextButton(shape = Tm.ButtonShape, enabled = !connecting, onClick = { pair(pasted) }) {
                    Text(stringResource(R.string.connect_paste_action), color = Tm.Rose400)
                }
            }

            when (val current = linkState) {
                is LinkState.Connecting, LinkState.Searching -> Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(Modifier.size(18.dp), color = Tm.Rose400, strokeWidth = 2.dp)
                    Spacer(Modifier.size(10.dp))
                    Text(stringResource(if (current is LinkState.Searching) R.string.link_searching else R.string.link_connecting), color = Tm.Ink300)
                }
                is LinkState.Offline -> Text(linkError(current.code), color = Tm.Red, style = MaterialTheme.typography.bodyMedium)
                else -> {}
            }
            problem?.let { Text(it, color = Tm.Red, style = MaterialTheme.typography.bodyMedium) }
        }
    }
}

@Composable
fun linkError(code: String?): String = when (code) {
    "bad-token" -> stringResource(R.string.link_error_bad_token)
    "link-off" -> stringResource(R.string.link_error_link_off)
    null, "unreachable", "closed" -> stringResource(R.string.link_error_unreachable)
    else -> stringResource(R.string.link_error_other, code)
}

private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}
