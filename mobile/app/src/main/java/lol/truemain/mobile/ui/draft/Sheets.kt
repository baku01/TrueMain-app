package lol.truemain.mobile.ui.draft

import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.SheetState
import androidx.compose.material3.SheetValue
import androidx.compose.material3.rememberBottomSheetState
import androidx.compose.runtime.Composable

/**
 * The Draft tab's sheets open straight to full height: each one is a list to
 * choose from, and a half-open sheet would hide the half the player is after.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun rememberFullSheetState(): SheetState =
    rememberBottomSheetState(SheetValue.Hidden, setOf(SheetValue.Hidden, SheetValue.Expanded))
