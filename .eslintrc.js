module.exports = {
  root: true,
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
  ],
  parser: "@babel/eslint-parser",
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2021,
    sourceType: "module",
  },
  env: {
    browser: true,
    es2021: true,
    node: true,
    "react-native/react-native": true,
  },
  plugins: ["react", "react-native", "react-hooks"],
  rules: {
    // React rules
    "react/prop-types": "off",
    "react/display-name": "off",
    "react/jsx-uses-react": "error",
    "react/jsx-uses-vars": "error",

    // React hooks rules
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",

    // React Native rules
    "react-native/no-unused-styles": "warn",
    "react-native/split-platform-components": "warn",
    "react-native/no-inline-styles": "warn",
    "react-native/no-color-literals": "warn",

    // General code quality rules
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "no-unused-vars": "warn",
    "prefer-const": "warn",
  },
  settings: {
    react: {
      version: "detect",
    },
  },
};
