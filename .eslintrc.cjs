module.exports = {
  env: {
    browser: true,
    node: true,
    es2021: true
  },
  extends: ["eslint:recommended", "prettier"],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module"
  },
  rules: {
    "no-unused-vars": ["warn", { "args": "none", "varsIgnorePattern": "^_" }],
    "no-console": "off",
    "eqeqeq": ["error", "always"],
    "no-var": "error",
    "prefer-const": "warn",
    "consistent-return": "warn",
    "no-implicit-globals": "error"
  }
};
