/**
 * Expo config plugin – withUITests
 *
 * Adds a ForesightUITests UI test target to the generated Xcode project so
 * that `fastlane snapshot` (capture_ios_screenshots) can find the test bundle.
 *
 * What this plugin does during `expo prebuild`:
 *   1. Copies *.swift files from fastlane/snapshot_tests/ios/ → ios/ForesightUITests/
 *   2. Adds a ui_test_bundle native target named "ForesightUITests" to the .xcodeproj
 *   3. Registers the Swift source files in the new target's Sources build phase
 *   4. Sets the required build settings:
 *        TEST_TARGET_NAME  → main app target name  (required by XCUITest host)
 *        SWIFT_VERSION     → 5.0
 *        LD_RUNPATH_SEARCH_PATHS → standard UITest value
 */

const { withXcodeProject } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

const TARGET_NAME = "ForesightUITests";
const SWIFT_VERSION = "5.0";

/**
 * @param {import('@expo/config-plugins').ExpoConfig} config
 */
function withUITests(config) {
  return withXcodeProject(config, (modConfig) => {
    const project = modConfig.modResults;
    const projectRoot = modConfig.modRequest.projectRoot;
    // projectName is the Xcode project/scheme name (e.g. "Foresight")
    const projectName = modConfig.modRequest.projectName;

    // ── 1. Skip if the UITest target already exists ─────────────────────────
    const nativeTargets = project.pbxNativeTargetSection();
    const alreadyExists = Object.values(nativeTargets).some(
      (t) => t && typeof t === "object" && t.name === TARGET_NAME
    );
    if (alreadyExists) {
      return modConfig;
    }

    // ── 2. Copy Swift test sources into ios/ForesightUITests/ ────────────────
    const srcDir = path.join(
      projectRoot,
      "fastlane",
      "snapshot_tests",
      "ios"
    );
    const destDir = path.join(projectRoot, "ios", TARGET_NAME);
    fs.mkdirSync(destDir, { recursive: true });

    const swiftFiles = [];
    if (fs.existsSync(srcDir)) {
      for (const file of fs.readdirSync(srcDir)) {
        if (file.endsWith(".swift")) {
          fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
          swiftFiles.push(file);
        }
      }
    }

    // ── 3. Add the UITest target to the Xcode project ────────────────────────
    const bundleId = `${
      modConfig.ios?.bundleIdentifier ?? "com.bretza.foresight"
    }.${TARGET_NAME}`;

    const newTarget = project.addTarget(
      TARGET_NAME,
      "ui_test_bundle",
      TARGET_NAME,
      bundleId
    );

    if (!newTarget) {
      console.warn("[withUITests] addTarget returned null – skipping");
      return modConfig;
    }

    // ── 4. Register Swift source files in the new target ────────────────────
    for (const file of swiftFiles) {
      project.addSourceFile(`${TARGET_NAME}/${file}`, {
        target: newTarget.uuid,
      });
    }

    // ── 5. Configure build settings for UITest target ────────────────────────
    const configListUUID =
      newTarget.pbxNativeTarget.buildConfigurationList;
    const configList =
      project.pbxXCConfigurationList()[configListUUID];

    if (configList?.buildConfigurations) {
      for (const { value: configUUID } of configList.buildConfigurations) {
        const buildConfig =
          project.pbxXCBuildConfigurationSection()[configUUID];
        if (buildConfig?.buildSettings) {
          // Points XCUITest host to the main app target
          buildConfig.buildSettings["TEST_TARGET_NAME"] =
            `"${projectName}"`;
          buildConfig.buildSettings["SWIFT_VERSION"] =
            `"${SWIFT_VERSION}"`;
          buildConfig.buildSettings["LD_RUNPATH_SEARCH_PATHS"] =
            '"$(inherited) @executable_path/Frameworks @loader_path/Frameworks"';
        }
      }
    }

    return modConfig;
  });
}

module.exports = withUITests;
