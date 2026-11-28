package lol.truemain.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import lol.truemain.mobile.R
import lol.truemain.mobile.graph
import lol.truemain.mobile.ui.theme.Tm
import lol.truemain.mobile.update.UpdateState

/** Compact banner shown whenever a newer Android build is available on GitHub Releases. */
@Composable
fun UpdateBanner(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val updater = context.graph.updater
    val state by updater.state.collectAsState()

    val visible = state !is UpdateState.Idle
    if (!visible) return

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(Tm.colors.bgElevated)
            .border(1.dp, Tm.colors.primary.copy(alpha = 0.45f), RoundedCornerShape(10.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp),
    ) {
        when (val s = state) {
            is UpdateState.Checking -> {
                Text(
                    stringResource(R.string.update_checking),
                    style = MaterialTheme.typography.bodySmall,
                    color = Tm.Ink200,
                )
            }
            is UpdateState.UpToDate -> {
                Row(
                    Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        stringResource(R.string.update_up_to_date),
                        style = MaterialTheme.typography.bodySmall,
                        color = Tm.Success,
                    )
                    TextButton(onClick = updater::dismiss) {
                        Text(stringResource(R.string.update_dismiss), color = Tm.Ink300)
                    }
                }
            }
            is UpdateState.Available -> {
                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(
                            stringResource(R.string.update_available_title, s.info.versionName),
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold,
                            color = Tm.Ink100,
                        )
                        Text(
                            stringResource(R.string.update_available_body),
                            style = MaterialTheme.typography.bodySmall,
                            color = Tm.Ink300,
                        )
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
                        TextButton(onClick = updater::dismiss) {
                            Text(stringResource(R.string.update_later), color = Tm.Ink400)
                        }
                        Spacer(Modifier.width(4.dp))
                        Button(
                            onClick = { updater.downloadAndInstall(context) },
                            shape = Tm.ButtonShape,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Tm.colors.primary,
                                contentColor = Tm.colors.textInverted,
                            ),
                        ) {
                            Text(stringResource(R.string.update_action))
                        }
                    }
                }
            }
            is UpdateState.Downloading -> {
                val pct = s.progress?.let { (it * 100).toInt() }
                Text(
                    if (pct != null) stringResource(R.string.update_downloading_pct, pct)
                    else stringResource(R.string.update_downloading),
                    style = MaterialTheme.typography.bodySmall,
                    color = Tm.Ink100,
                )
                Spacer(Modifier.height(6.dp))
                if (s.progress != null) {
                    LinearProgressIndicator(
                        progress = { s.progress },
                        modifier = Modifier.fillMaxWidth(),
                        color = Tm.colors.primary,
                        trackColor = Tm.colors.bgAccented,
                    )
                } else {
                    LinearProgressIndicator(
                        modifier = Modifier.fillMaxWidth(),
                        color = Tm.colors.primary,
                        trackColor = Tm.colors.bgAccented,
                    )
                }
            }
            is UpdateState.ReadyToInstall -> {
                Row(
                    Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        stringResource(R.string.update_ready_title, s.info.versionName),
                        style = MaterialTheme.typography.bodySmall,
                        color = Tm.Ink100,
                        modifier = Modifier.weight(1f),
                    )
                    Spacer(Modifier.width(8.dp))
                    Button(
                        onClick = { updater.downloadAndInstall(context) },
                        shape = Tm.ButtonShape,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Tm.colors.primary,
                            contentColor = Tm.colors.textInverted,
                        ),
                    ) {
                        Text(stringResource(R.string.update_install))
                    }
                }
            }
            is UpdateState.Error -> {
                Row(
                    Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        stringResource(R.string.update_error),
                        style = MaterialTheme.typography.bodySmall,
                        color = Tm.Red,
                        modifier = Modifier.weight(1f),
                    )
                    TextButton(onClick = { updater.check(silent = false) }) {
                        Text(stringResource(R.string.link_retry), color = Tm.colors.primary)
                    }
                    TextButton(onClick = updater::dismiss) {
                        Text(stringResource(R.string.update_dismiss), color = Tm.Ink300)
                    }
                }
            }
            UpdateState.Idle -> Unit
        }
    }
}
