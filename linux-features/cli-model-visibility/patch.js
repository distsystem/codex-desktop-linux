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

  // The allowlist gate lives in the per-model visibility helper. Forcing the
  // gate false leaves `!model.hidden` as the only filter, so the CLI catalog
  // decides visibility for every host while Codex Auto Review stays excluded.
  // The daybreak early return stays intact; only the allowlist gate changes.
  // The optional api-key clause keeps this composable with the
  // api-key-model-visibility feature, which rewrites the same expression.
  const helperPattern = new RegExp(
    `(function ${JS_IDENT}\\(\\{additionalAvailableModels:(${JS_IDENT}),` +
      `apiKeyDaybreakSupported:(${JS_IDENT}),authMethod:(${JS_IDENT}),` +
      `availableModels:(${JS_IDENT}),hasConfiguredModelCatalog:(${JS_IDENT}),` +
      `isCustomModelProvider:(${JS_IDENT}),model:(${JS_IDENT}),` +
      `useHiddenModels:(${JS_IDENT})\\}\\)\\{[^{}]*?return [^{}]*?` +
      `\\2\\?\\.has\\(\\8\\.model\\)===!0\\|\\|\\8\\.model!==\\\`codex-auto-review\\\`&&\\(` +
      `\\6&&!\\8\\.hidden\\|\\|\\()` +
      `(\\9&&!\\7&&\\4!==\\\`amazonBedrock\\\`` +
      `(?:&&\\4!==\\\`apikey\\\`/\\*${API_KEY_MARKER}\\*/)?)` +
      `(?=\\?)`,
    "g",
  );

  const patched = source.replace(
    helperPattern,
    (
      _match,
      prefix,
      _additionalAvailableModelsVar,
      _apiKeyDaybreakSupportedVar,
      _authMethodVar,
      _availableModelsVar,
      _hasConfiguredModelCatalogVar,
      _isCustomModelProviderVar,
      _modelVar,
      _useHiddenModelsVar,
      gateExpression,
    ) => `${prefix}!1&&${gateExpression}/*${PATCH_MARKER}*/`,
  );

  if (patched !== source) {
    return patched;
  }

  if (
    source.includes("additionalAvailableModels") &&
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
    pattern: /^app-initial-[^.]+\.js$/,
    missingDescription: "app main webview bundle",
    skipDescription: "CLI model visibility patch",
    apply: applyCliModelVisibilityPatch,
  },
];

module.exports = {
  applyCliModelVisibilityPatch,
  descriptors,
};
