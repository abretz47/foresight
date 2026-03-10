import XCTest

// MARK: - Foresight Screenshot Tests
//
// These tests are driven by fastlane `snapshot` (capture_ios_screenshots).
// Run with:  bundle exec fastlane ios screenshots
//
// The app is launched with the launch argument "-UITestMode YES" so that
// production network calls are suppressed and the UI is in a known state.

class ForesightUITests: XCTestCase {

    var app: XCUIApplication!

    override func setUp() {
        super.setUp()
        continueAfterFailure = false

        app = XCUIApplication()
        setupSnapshot(app)

        // Suppress animations for faster, more reliable screenshots
        app.launchArguments = ["-UITestMode", "YES"]
        app.launch()
    }

    // MARK: - Screenshot tests

    /// 01 – Login screen
    func testScreenshot01_Login() {
        snapshot("01_Login")
    }

    /// 02 – Home screen (main menu)
    func testScreenshot02_Home() {
        navigateToHome()
        snapshot("02_Home")
    }

    /// 03 – Shot Profile screen
    func testScreenshot03_ShotProfile() {
        navigateToHome()

        let shotProfileButton = app.buttons["Shot Profile"]
        if shotProfileButton.waitForExistence(timeout: 5) {
            shotProfileButton.tap()
        }

        snapshot("03_ShotProfile")
    }

    /// 04 – Record Details (shot selection) screen
    func testScreenshot04_RecordDetails() {
        navigateToHome()

        let recordDataButton = app.buttons["Record Data"]
        if recordDataButton.waitForExistence(timeout: 5) {
            recordDataButton.tap()
        }

        snapshot("04_RecordDetails")
    }

    /// 05 – Record / Analyze screen
    func testScreenshot05_Record() {
        navigateToHome()

        let analyzeDataButton = app.buttons["Analyze Data"]
        if analyzeDataButton.waitForExistence(timeout: 5) {
            analyzeDataButton.tap()
        }

        snapshot("05_Analyze")
    }

    // MARK: - Helpers

    /// Enter a demo username and tap the login button to reach the Home screen.
    private func navigateToHome() {
        // The text field on the Login screen accepts a free-form username.
        let usernameField = app.textFields.firstMatch
        if usernameField.waitForExistence(timeout: 5) {
            usernameField.tap()
            usernameField.typeText("Demo User")
        }

        let loginButton = app.buttons["Login"]
        if loginButton.waitForExistence(timeout: 5) {
            loginButton.tap()
        }

        // Wait for the Home screen header to appear
        _ = app.staticTexts["Welcome"].waitForExistence(timeout: 10)
    }
}
