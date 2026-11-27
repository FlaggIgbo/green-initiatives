// Replaces Vite-only import.meta.glob(...) calls with ({}) so Jest can parse them.
const transformImportMetaGlob = () => ({
  visitor: {
    CallExpression(path) {
      const callee = path.get("callee");
      if (
        callee.isMemberExpression() &&
        callee.get("object").isMetaProperty() &&
        callee.get("property").isIdentifier({ name: "glob" })
      ) {
        path.replaceWithSourceString("({})");
      }
    },
  },
});

module.exports = {
  presets: [
    ["@babel/preset-env", { targets: { node: "current" } }],
    ["@babel/preset-react", { runtime: "automatic" }],
    "@babel/preset-typescript",
  ],
  plugins: [
    transformImportMetaGlob,
    "babel-plugin-transform-import-meta",
    "babel-plugin-transform-vite-meta-env",
  ],
};
