const { withPodfile } = require("expo/config-plugins");

const withModularHeaders = (config) => {
  return withPodfile(config, (config) => {
    const podfileContent = config.modResults.contents;
    // prevent multiple additions
    if (!podfileContent.includes("use_modular_headers!")) {
      // Add it near the top of the file
      config.modResults.contents = `use_modular_headers!\n${podfileContent}`;
    }
    return config;
  });
};

module.exports = withModularHeaders;
