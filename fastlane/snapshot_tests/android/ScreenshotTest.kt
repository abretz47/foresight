package com.abretz.foresight

import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.action.ViewActions.click
import androidx.test.espresso.action.ViewActions.replaceText
import androidx.test.espresso.matcher.ViewMatchers.withText
import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import tools.fastlane.screengrab.Screengrab
import tools.fastlane.screengrab.locale.LocaleTestRule
import org.junit.ClassRule
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

// ─────────────────────────────────────────────────────────────────────────────
// Foresight Android Screenshot Tests
//
// These tests are driven by fastlane `screengrab` (capture_android_screenshots).
// Run with:  bundle exec fastlane android screenshots
//
// Each test navigates to a screen and captures a screenshot via Screengrab.
// ─────────────────────────────────────────────────────────────────────────────

@RunWith(AndroidJUnit4::class)
class ScreenshotTest {

    companion object {
        @get:ClassRule
        @JvmStatic
        val localeTestRule = LocaleTestRule()
    }

    @get:Rule
    val activityRule = ActivityScenarioRule(MainActivity::class.java)

    // ── 01: Login screen ──────────────────────────────────────────────────────

    @Test
    fun screenshot01_Login() {
        Thread.sleep(1_000)
        Screengrab.screenshot("01_Login")
    }

    // ── 02: Home screen ───────────────────────────────────────────────────────

    @Test
    fun screenshot02_Home() {
        navigateToHome()
        Screengrab.screenshot("02_Home")
    }

    // ── 03: Shot Profile screen ───────────────────────────────────────────────

    @Test
    fun screenshot03_ShotProfile() {
        navigateToHome()
        onView(withText("Shot Profile")).perform(click())
        Thread.sleep(500)
        Screengrab.screenshot("03_ShotProfile")
    }

    // ── 04: Record Details (shot selection) screen ───────────────────────────

    @Test
    fun screenshot04_RecordDetails() {
        navigateToHome()
        onView(withText("Record Data")).perform(click())
        Thread.sleep(500)
        Screengrab.screenshot("04_RecordDetails")
    }

    // ── 05: Analyze screen ────────────────────────────────────────────────────

    @Test
    fun screenshot05_Analyze() {
        navigateToHome()
        onView(withText("Analyze Data")).perform(click())
        Thread.sleep(500)
        Screengrab.screenshot("05_Analyze")
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun navigateToHome() {
        Thread.sleep(500)
        try {
            // Enter a demo username and tap the Login button
            onView(withText("")).perform(replaceText("Demo User"))
            onView(withText("Login")).perform(click())
            Thread.sleep(1_000)
        } catch (_: Exception) {
            // Already past login; continue
        }
    }
}
