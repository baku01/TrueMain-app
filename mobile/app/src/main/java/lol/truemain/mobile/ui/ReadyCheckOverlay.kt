package lol.truemain.mobile.ui

import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import lol.truemain.mobile.R
import lol.truemain.mobile.graph
import lol.truemain.mobile.lcu.double
import lol.truemain.mobile.lcu.str
import lol.truemain.mobile.link.LinkState
import lol.truemain.mobile.session.Session
import lol.truemain.mobile.ui.components.TmMark
import lol.truemain.mobile.ui.theme.Tm

/**
 * The match found, over whatever tab is open, with a buzz: the moment the
 * phone app exists for. Shown while the client waits for this player's answer.
 */
@Composable
fun ReadyCheckOverlay() {
    val context = LocalContext.current
    val graph = context.graph
    val check by graph.session.state(Session.READY_CHECK).collectAsState()
    val link by graph.link.state.collectAsState()
    val scope = rememberCoroutineScope()
    var pendingAction by remember { mutableStateOf<String?>(null) }
    var errorRes by remember { mutableStateOf<Int?>(null) }

    val inProgress = check.str("state") == "InProgress"
    val response = check.str("playerResponse") ?: "None"
    val serverTimer = check.double("timer") ?: 0.0
    val isOnline = link is LinkState.Open
    val visible = inProgress && (response == "None" || response == "Accepted")

    var totalSeconds by remember(inProgress) { mutableDoubleStateOf(12.0) }
    if (serverTimer > totalSeconds) totalSeconds = serverTimer
    var elapsed by remember(inProgress) { mutableDoubleStateOf(serverTimer) }

    LaunchedEffect(visible) {
        if (!visible) {
            pendingAction = null
            errorRes = null
        }
    }

    LaunchedEffect(inProgress, serverTimer, isOnline) {
        elapsed = serverTimer
        if (!inProgress || !isOnline) return@LaunchedEffect
        val anchor = SystemClock.elapsedRealtime()
        while (true) {
            delay(200)
            elapsed = (serverTimer + (SystemClock.elapsedRealtime() - anchor) / 1000.0).coerceAtMost(totalSeconds)
        }
    }

    LaunchedEffect(inProgress && response == "None") {
        if (inProgress && response == "None") {
            context.getSystemService(Vibrator::class.java)?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 300, 150, 300, 150, 500), -1))
        }
    }

    AnimatedVisibility(visible, enter = fadeIn(), exit = fadeOut()) {
        val primary = Tm.colors.primary
        val cardShape = RoundedCornerShape(16.dp)
        val remaining = (totalSeconds - elapsed).coerceAtLeast(0.0)
        Box(
            Modifier.fillMaxSize().background(Tm.Ink950.copy(alpha = 0.90f))
                .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {},
            contentAlignment = Alignment.Center,
        ) {
            Column(
                Modifier
                    .padding(24.dp)
                    .fillMaxWidth()
                    .clip(cardShape)
                    .background(Tm.colors.pane)
                    .background(
                        Brush.verticalGradient(
                            0f to primary.copy(alpha = 0.16f),
                            0.45f to Color.Transparent,
                        ),
                    )
                    .border(1.dp, primary.copy(alpha = 0.35f), cardShape)
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                TmMark(size = 28.dp)
                Text(
                    stringResource(R.string.ready_title),
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = Tm.Ink100,
                )
                Box(
                    Modifier
                        .size(116.dp)
                        .border(1.dp, Tm.Gold.copy(alpha = 0.4f), androidx.compose.foundation.shape.CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(
                        progress = { (remaining / totalSeconds).toFloat().coerceIn(0f, 1f) },
                        color = Tm.Rose400,
                        trackColor = Tm.Ink800,
                        strokeWidth = 6.dp,
                        strokeCap = StrokeCap.Round,
                        modifier = Modifier.size(104.dp),
                    )
                    Text(
                        stringResource(R.string.ready_seconds, kotlin.math.ceil(remaining).toInt()),
                        fontFamily = Tm.DisplayFont,
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold,
                        color = Tm.Ink100,
                    )
                }
                if (!isOnline) {
                    Text(
                        stringResource(R.string.link_offline),
                        color = Tm.Red,
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                } else {
                    errorRes?.let { res ->
                        Text(
                            stringResource(res),
                            color = Tm.Red,
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
                if (response == "Accepted") {
                    Text(stringResource(R.string.ready_accepted), color = Tm.Success, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
                } else {
                    Button(
                        shape = Tm.ButtonShape,
                        onClick = {
                            pendingAction = "accept"
                            errorRes = null
                            scope.launch {
                                val ok = graph.session.act("POST", "/lol-matchmaking/v1/ready-check/accept")
                                if (!ok) errorRes = R.string.error_generic
                                pendingAction = null
                            }
                        },
                        enabled = pendingAction == null,
                        colors = ButtonDefaults.buttonColors(containerColor = Tm.Rose400, contentColor = Tm.colors.textInverted),
                        modifier = Modifier.fillMaxWidth().height(50.dp),
                    ) {
                        if (pendingAction == "accept") {
                            CircularProgressIndicator(Modifier.size(18.dp), color = Tm.colors.textInverted, strokeWidth = 2.dp)
                            Spacer(Modifier.width(8.dp))
                        }
                        Text(stringResource(R.string.ready_accept), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                    }
                    Row(Modifier.fillMaxWidth()) {
                        OutlinedButton(
                            shape = Tm.ButtonShape,
                            onClick = {
                                pendingAction = "decline"
                                errorRes = null
                                scope.launch {
                                    val ok = graph.session.act("POST", "/lol-matchmaking/v1/ready-check/decline")
                                    if (!ok) errorRes = R.string.error_generic
                                    pendingAction = null
                                }
                            },
                            enabled = pendingAction == null,
                            modifier = Modifier.fillMaxWidth().height(44.dp),
                        ) {
                            if (pendingAction == "decline") {
                                CircularProgressIndicator(Modifier.size(16.dp), color = Tm.Ink300, strokeWidth = 2.dp)
                                Spacer(Modifier.width(8.dp))
                            }
                            Text(stringResource(R.string.ready_decline), color = Tm.Ink300)
                        }
                    }
                }
            }
        }
    }
}
