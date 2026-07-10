# CLI Model Visibility

This opt-in feature makes the desktop model picker trust the non-hidden model
catalog returned by Codex CLI, instead of the Statsig availability allowlist.

The upstream desktop UI intersects `model/list` with a Statsig
`available_models` allowlist. The allowlist is delivered per Statsig user and
its newer-model rollout rules target the `userID` id type. The Linux desktop
signs in through Codex CLI credentials, so it never hydrates a Statsig
`userID` and reports `authMethod = null` for its hosts. Every gate therefore
evaluates the default rule, and newer model families (for example the GPT-5.6
family) stay hidden in the picker even though `model/list` reports them and
the CLI exposes them.

Bypassing the allowlist for one auth method is not enough, because the Linux
host has none. This feature disables the allowlist branch outright, leaving
the CLI's `hidden` flag as the only filter.

## Enable

Add the feature id to `linux-features/features.json`:

```json
{
  "enabled": [
    "cli-model-visibility"
  ]
}
```

Then rebuild the app:

```bash
./install.sh
```

## Behavior

- The picker shows every `model/list` entry whose `hidden` field is false.
- Models that the CLI marks as hidden remain hidden.
- The feature does not grant model access. The backend still enforces plan
  entitlement when a request runs.
- Composes with `api-key-model-visibility`: that feature's rewrite of the same
  expression is recognized and preserved.

## Risks

The picker can list a model ahead of its staged desktop rollout. If the
account is not entitled, the backend rejects requests at runtime.

## Test

```bash
node --test linux-features/cli-model-visibility/test.js
```
