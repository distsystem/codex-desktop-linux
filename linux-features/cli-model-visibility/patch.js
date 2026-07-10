"use strict";

const JS_IDENT = "[A-Za-z_$][\\w$]*";
const PATCH_MARKER = "codexLinuxCliModelVisibility";
const API_KEY_MARKER = "codexLinuxApiKeyModelVisibility";

function warn(message, patchName) {
  console.warn(`WARN: ${message} - skipping ${patchName}`);
}

function applyCliModelVisibilityPatch(source) {
  if (source.includes(`/*${PATCH_MARKER}*/`)) {
    return source;
  }

  // The optional api-key clause keeps this composable with the
  // api-key-model-visibility feature, which rewrites the same expression.
  const modelVisibilityPattern = new RegExp(
    `(function ${JS_IDENT}\\(\\{authMethod:(${JS_IDENT}),availableModels:${JS_IDENT},` +
      `defaultModel:${JS_IDENT},enabledReasoningEfforts:${JS_IDENT},` +
      `includeUltraReasoningEffort:${JS_IDENT},models:${JS_IDENT},` +
      `useHiddenModels:(${JS_IDENT})\\}\\)\\{let[\\s\\S]{0,600}?[,;]${JS_IDENT}=)` +
      `(\\3&&\\2!==\\\`amazonBedrock\\\`` +
      `(?:&&\\2!==\\\`apikey\\\`/\\*${API_KEY_MARKER}\\*/)?)` +
      `(?=[,;])`,
    "g",
  );

  const patched = source.replace(
    modelVisibilityPattern,
    (_match, prefix, _authMethodVar, _useHiddenModelsVar, gateExpression) =>
      `${prefix}!1&&${gateExpression}/*${PATCH_MARKER}*/`,
  );

  if (patched !== source) {
    return patched;
  }

  if (
    source.includes("list-models-for-host") &&
    source.includes("useHiddenModels") &&
    source.includes("amazonBedrock")
  ) {
    warn("Could not find desktop model allowlist gate", "CLI model visibility patch");
  }
  return source;
}

const descriptors = [
  {
    id: "cli-model-visibility-ui",
    phase: "webview-asset",
    order: 20551,
    ciPolicy: "optional",
    pattern: /^app-initial~app-main~.*\.js$/,
    missingDescription: "app main webview bundle",
    skipDescription: "CLI model visibility patch",
    apply: applyCliModelVisibilityPatch,
  },
];

module.exports = {
  applyCliModelVisibilityPatch,
  descriptors,
};
