package lol.truemain.mobile.update

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AppUpdaterTest {
    @Test
    fun parsesValidManifest() {
        val raw = """
            {
              "versionCode": 142,
              "versionName": "0.3.142",
              "url": "https://github.com/baku01/TrueMain-app/releases/download/android-latest/TrueMain-Android.apk",
              "sha256": "deadbeef",
              "notes": "Build abc123"
            }
        """.trimIndent()
        val info = AppUpdater.parseManifest(raw)!!
        assertEquals(142, info.versionCode)
        assertEquals("0.3.142", info.versionName)
        assertEquals("deadbeef", info.sha256)
        assertEquals("Build abc123", info.notes)
    }

    @Test
    fun rejectsHttpOrMalformedManifest() {
        val httpOnly = """{"versionCode":10,"versionName":"0.3.10","url":"http://example.com/app.apk"}"""
        assertNull(AppUpdater.parseManifest(httpOnly))
        assertNull(AppUpdater.parseManifest("not json"))
    }

    @Test
    fun detectsNewerVersionCode() {
        assertTrue(AppUpdater.isNewer(101, 100))
        assertFalse(AppUpdater.isNewer(100, 100))
        assertFalse(AppUpdater.isNewer(99, 100))
    }
}
