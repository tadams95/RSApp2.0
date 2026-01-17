const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Config plugin to fix React Native Firebase non-modular header errors
 * This adds CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES
 * to all pods to fix the Firebase/RN compatibility issue
 */
const withFirebaseFix = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );

      let podfileContent = fs.readFileSync(podfilePath, "utf-8");

      // Check if the fix is already applied
      if (podfileContent.includes("CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES")) {
        console.log("[withFirebaseFix] Fix already applied, skipping...");
        return config;
      }

      // The fix to add after react_native_post_install closing paren
      const firebaseFix = `

    # Fix for React Native Firebase non-modular header errors with New Architecture
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        build_config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end`;

      // Find the react_native_post_install call with its closing parenthesis and add fix after it
      // This regex matches the full react_native_post_install(...) call
      const postInstallRegex = /(react_native_post_install\s*\(\s*installer[\s\S]*?\n\s*\))/;
      
      if (postInstallRegex.test(podfileContent)) {
        podfileContent = podfileContent.replace(
          postInstallRegex,
          `$1${firebaseFix}`
        );
        console.log("[withFirebaseFix] Successfully added Firebase fix to Podfile");
      } else {
        console.warn("[withFirebaseFix] Could not find react_native_post_install in Podfile");
      }

      fs.writeFileSync(podfilePath, podfileContent);

      return config;
    },
  ]);
};

module.exports = withFirebaseFix;
