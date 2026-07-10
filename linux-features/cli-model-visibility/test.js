#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  applyWebviewAssetPatchDescriptors,
  normalizePatchDescriptors,
} = require("../../scripts/patches/engine.js");
const {
  loadLinuxFeaturePatchDescriptors,
} = require("../../scripts/lib/linux-features.js");
const {
  applyCliModelVisibilityPatch,
  descriptors,
} = require("./patch.js");

function applyPatchTwice(patchFn, source) {
  const once = patchFn(source);
  assert.notEqual(once, source);
  assert.equal(patchFn(once), once);
  return once;
}

function modelVisibilityHelperFixture() {
  return "function ati({additionalAvailableModels:e,apiKeyDaybreakSupported:t,authMethod:n,availableModels:r,hasConfiguredModelCatalog:i,isCustomModelProvider:a,model:o,useHiddenModels:s}){let c=o.availableAccessPrograms?.cyber;return n===`apikey`&&!t&&c!=null&&c.length>0&&!c.includes(`standard`)?!1:e?.has(o.model)===!0||o.model!==`codex-auto-review`&&(i&&!o.hidden||(s&&!a&&n!==`amazonBedrock`?r.has(o.model)||n===`apikey`&&t&&!o.hidden&&c?.some(e=>e!==`standard`)===!0:!o.hidden))}";
}

function modelCatalogFixture() {
  return "function iti({additionalAvailableModels:e,authMethod:t,availableModels:n,defaultModel:r,enabledReasoningEfforts:i,hasConfiguredModelCatalog:a,includeUltraReasoningEffort:o,isCustomModelProvider:s=!1,models:c,useHiddenModels:l}){let u=[],d=null;return c.forEach(r=>{if(ati({additionalAvailableModels:e,authMethod:t,availableModels:n,hasConfiguredModelCatalog:a,isCustomModelProvider:s,model:r,useHiddenModels:l})){u.push(r),r.isDefault&&(d=r)}}),d??=u.find(e=>e.model===r)??null,{models:u,defaultModel:d}}" + modelVisibilityHelperFixture();
}

// The shape api-key-model-visibility leaves behind: its own clause and marker
// appended to the same gate this feature rewrites.
function apiKeyPatchedFixture() {
  return modelCatalogFixture().replace(
    "s&&!a&&n!==`amazonBedrock`",
    "s&&!a&&n!==`amazonBedrock`&&n!==`apikey`/*codexLinuxApiKeyModelVisibility*/",
  );
}

function evaluateCatalog(
  source,
  authMethod,
  useHiddenModels = true,
  isCustomModelProvider = false,
  hasConfiguredModelCatalog = false,
) {
  const catalog = Function(`${source};return iti;`)();
  return catalog({
    authMethod,
    availableModels: new Set(["gpt-5.5"]),
    defaultModel: "gpt-5.5",
    enabledReasoningEfforts: new Set(),
    hasConfiguredModelCatalog,
    includeUltraReasoningEffort: true,
    isCustomModelProvider,
    models: [
      { model: "gpt-5.6-sol", hidden: false, isDefault: true },
      { model: "gpt-5.6-terra", hidden: false, isDefault: false },
      { model: "gpt-5.6-luna", hidden: false, isDefault: false },
      { model: "gpt-5.5", hidden: false, isDefault: false },
      { model: "codex-auto-review", hidden: true, isDefault: false },
    ],
    useHiddenModels,
  });
}

function modelNames(catalog) {
  return catalog.models.map((model) => model.model);
}

const VISIBLE_MODELS = ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna", "gpt-5.5"];

function withTempDir(callback) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-model-visibility-"));
  try {
    return callback(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function withFeatureConfig(enabled, callback) {
  const originalConfig = process.env.CODEX_LINUX_FEATURES_CONFIG;
  return withTempDir((tempDir) => {
    const configPath = path.join(tempDir, "features.json");
    fs.writeFileSync(configPath, `${JSON.stringify({ enabled })}\n`);
    process.env.CODEX_LINUX_FEATURES_CONFIG = configPath;
    try {
      return callback(path.resolve(__dirname, ".."));
    } finally {
      if (originalConfig == null) {
        delete process.env.CODEX_LINUX_FEATURES_CONFIG;
      } else {
        process.env.CODEX_LINUX_FEATURES_CONFIG = originalConfig;
      }
    }
  });
}

test("cli-model-visibility stays disabled until listed in features.json", () => {
  withFeatureConfig([], (featuresRoot) => {
    assert.deepEqual(loadLinuxFeaturePatchDescriptors({ featuresRoot }), []);
  });

  withFeatureConfig(["cli-model-visibility"], (featuresRoot) => {
    const loaded = loadLinuxFeaturePatchDescriptors({ featuresRoot });
    assert.deepEqual(
      loaded.map((descriptor) => [descriptor.id, descriptor.phase, descriptor.ciPolicy]),
      [["feature:cli-model-visibility:cli-model-visibility-ui", "webview-asset", "optional"]],
    );
  });
});

test("descriptor is optional and targets app main webview chunks", () => {
  assert.deepEqual(
    descriptors.map((descriptor) => [descriptor.id, descriptor.phase, descriptor.ciPolicy]),
    [["cli-model-visibility-ui", "webview-asset", "optional"]],
  );
  assert.equal(descriptors[0].pattern.test("app-initial-onboarding-page-abc.js"), true);
  assert.equal(descriptors[0].pattern.test("settings-page-abc.js"), false);
});

test("hosts without an auth method use visible CLI models instead of the allowlist", () => {
  const patched = applyPatchTwice(applyCliModelVisibilityPatch, modelCatalogFixture());
  const catalog = evaluateCatalog(patched, null);

  assert.match(patched, /!1&&s&&!a&&n!==`amazonBedrock`\/\*codexLinuxCliModelVisibility\*\//);
  assert.deepEqual(modelNames(catalog), VISIBLE_MODELS);
  assert.equal(catalog.defaultModel.model, "gpt-5.6-sol");
});

test("every auth method sees the visible CLI catalog", () => {
  const patched = applyCliModelVisibilityPatch(modelCatalogFixture());

  for (const authMethod of [null, "chatgpt", "apikey", "copilot", "amazonBedrock"]) {
    assert.deepEqual(modelNames(evaluateCatalog(patched, authMethod)), VISIBLE_MODELS);
  }
});

test("models marked hidden by the CLI stay hidden", () => {
  const patched = applyCliModelVisibilityPatch(modelCatalogFixture());

  assert.equal(modelNames(evaluateCatalog(patched, null)).includes("codex-auto-review"), false);
});

test("composes with the api-key model visibility clause already in the gate", () => {
  const patched = applyCliModelVisibilityPatch(apiKeyPatchedFixture());

  assert.match(patched, /codexLinuxApiKeyModelVisibility/);
  assert.match(patched, /codexLinuxCliModelVisibility/);
  assert.deepEqual(modelNames(evaluateCatalog(patched, null)), VISIBLE_MODELS);
  assert.deepEqual(modelNames(evaluateCatalog(patched, "apikey")), VISIBLE_MODELS);
});

test("extended upstream model gates fail soft instead of patching mid-expression", () => {
  const source = modelCatalogFixture().replace(
    "s&&!a&&n!==`amazonBedrock`?",
    "s&&!a&&n!==`amazonBedrock`&&featureGate?",
  );

  assert.equal(applyCliModelVisibilityPatch(source), source);
});

test("enabled descriptor patches a matching extracted webview asset", () => {
  withFeatureConfig(["cli-model-visibility"], (featuresRoot) => {
    withTempDir((extractedDir) => {
      const assetsDir = path.join(extractedDir, "webview", "assets");
      const assetPath = path.join(assetsDir, "app-initial-fixture.js");
      fs.mkdirSync(assetsDir, { recursive: true });
      fs.writeFileSync(assetPath, modelCatalogFixture());

      const normalized = normalizePatchDescriptors(
        loadLinuxFeaturePatchDescriptors({ featuresRoot }),
      );
      applyWebviewAssetPatchDescriptors(extractedDir, normalized, {}, null);

      assert.match(fs.readFileSync(assetPath, "utf8"), /codexLinuxCliModelVisibility/);
    });
  });
});
