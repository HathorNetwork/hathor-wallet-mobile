# QA feature graph

A YAML graph of the wallet's features, feature flags and test axes (`graph.yaml`). The tools in `tools/` validate it, generate test scenarios and a run plan from it, and render it into a self-contained HTML page. The YAML is the single source of truth; every visual is rendered from it.

## Commands

`node QA/graph/tools/cli.js <command> [options]`, also as npm scripts:

- `validate` checks the schema and cross-references. Prints `ERROR` and `WARN` lines; exits 1 on any error.
- `render` (`npm run qa:graph`) validates, then writes the page to `QA/graph/dist/graph.html` (git-ignored). The page is labelled with the YAML commit and date and the tools commit (HEAD), each marked `UNCOMMITTED` when its files have uncommitted changes.
- `check` (`npm run qa:graph:check`) validates and compares the graph against the code: flags in `src/constants.js`, routes in `src/App.js`, and the files changed since the base. It exits 1 only on schema errors; a stale graph is a `WARN` and a `NOTE` is informational, both exit 0.

Options, each followed by a value:

- `--graph <file>`: the graph to read; default `QA/graph/graph.yaml`.
- `--out <file>`: where `render` writes; default `QA/graph/dist/graph.html`.
- `--base <ref>`: what `check` diffs against (`<ref>...HEAD`); default `origin/master`. Without that ref (a fork or shallow clone) it warns and assumes no changed files.

The validator also warns about unknown keys (`setup x: unknown key 'runable'`), so a typo does not silently drop a field.

## Schema

`graph.yaml` has these top-level keys, all required (a list may be empty): `version`, `costs`, `environments`, `features`, `flags`, `axes`, `setups`, `actions`, `constraints`. Ids are unique within a collection and within one YAML version; they are not required to be stable across versions.

### version and costs

`version` is `1`. `costs` maps a cost key to a number: `cheap: 1`, `medium: 5`, `expensive: 20`, `very-expensive: 60`. Every cost named elsewhere must be one of these keys.

### environments

`{ id, name, notes }`. Where a setup runs: usually a network (`testnet`), but it can be any place a tester needs, such as `store-device` (a store build on a physical phone).

### features

`{ id, name, description, status, screens, files, flags, links, introduces, actions }`

- `status` is `in-scope` or `out-of-scope`.
- `screens` lists navigation routes; `files` lists source paths or directories (ending in `/`) that implement the feature. The freshness check uses `files`.
- `flags` lists the ids of flags that affect the feature.
- `links` is a list of `{ to, reason }`: this feature **depends on** `to`, with a one-line reason. When `to` changes, this feature is touched via code. `to` must be an existing feature. Write a link only for a code dependency; when the relation is really an axis value (sending a fee token, a private send, the facade, a passkey wallet), use `introduces` on the feature that brings the value instead, so impact narrows to the scenarios on that value.
- `introduces` lists `axisId:valueId` pairs, axis values this feature brings in (such as `token:fee`, or the setup value `facade:wallet-service`).
- `actions` lists the ids of actions that exercise the feature in every scenario. A feature owns these actions and the action whose `feature` names it. A feature exercised by an action only on some values (a private send inside the send action) lists no action and introduces those values instead.

### flags

`{ id, name, constant, default, gates, combinesWith, appliesAt, status }`

- `name` is the remote flag name and `constant` the constant in the code.
- `gates` lists the features the flag turns on or off.
- `combinesWith` is free text about interactions with other flags.
- `appliesAt` is `live`, `next-start` or `next-pin`: when a change of the flag takes effect.
- `axisValues` (optional) lists `axisId:valueId` pairs the flag controls, such as `facade:wallet-service` or `flag-fbt:off`. Each must name an existing axis value. Picking the flag spreads via axis to the scenarios on these values.

### axes

`{ id, name, kind, values, how, switch }`

- `kind` is `setup` (expensive to change, forms the setups) or `action` (cheap to vary inside one setup).
- `values` is a list of `{ id, name }`; `how` says how a tester changes the axis.
- `switch.cost` is the default cost of changing the axis value.
- `switch.transitions` is a list of `{ from, to, cost?, impossible?, when? }`. A matching entry overrides the default cost; `impossible: true` means the transition cannot be done at all. Costs are directional and may be conditional (`when` is free text).
- `switch.fallback` is `{ cost, how }`: what to do when a needed transition is impossible, typically a fresh wallet. The run plan never schedules an impossible transition; it uses the fallback.

### setups

`{ id, name, values, environment, runnable, notes? }`

`values` maps every setup axis to one of its values. `environment` is an environment id. `runnable: false` marks a setup that cannot be reached today: it still gets scenarios, shown greyed in the matrix, but the run plan never routes through it; its groups come last, marked not runnable, outside the switch cost.

### actions

`{ id, name, feature, axes, setups, path }`

- `feature` is the feature the action exercises; `axes` lists the action axes varied by it; `setups` lists the setups it runs in.
- `path.steps` is a list of `{ id, screen, name }`.
- `path.outcomes` is a list of `{ id, kind, at, message, source, verified, note? }`. `kind` is `success` or `error`, `at` is a step id, `message` is the text copied from the code, `source` is `path:line`, and `verified: false` until a tester has seen it on a device. `note` is an optional string for the tester (for example, why the message may not show); it is shown in the Paths view and the scenario inspector.

### constraints

`{ id, action, when, class, outcome?, note }`

`when` maps axis ids (setup or action) to a value id or a list of value ids. A combination matches when every listed axis has one of the listed values. `class` is one of:

- `invalid`: the combination cannot be constructed; it is excluded and produces no scenario.
- `rejected`: it can be constructed and the app refuses it. Requires `outcome`, which must be an error outcome of the action.
- `edge`: valid but risky; may name an `outcome`.
- `lib-risk`: valid but relies on behavior in the wallet library.

## Scenarios

A scenario is one (action, setup, action-axis values) combination. Its id is `${action}:${setup}:${action axis values joined by '.' in the action's axes order}`. Expensive axes form setups; inside each (action, setup) the tools pick pairwise coverage over the action axes, plus every rejected, edge and lib-risk combination. `expected` holds the outcome ids of matched rejected or edge constraints, in path step order, else the action's success outcomes. A rejection stops the path: when a rejected constraint matches, `expected` holds the rejected outcomes at the earliest step among them, plus edge outcomes at earlier steps; later ones are dropped.

## Impact (view A)

A pick is a feature, a flag or an axis value. It reaches features three ways:

- **via code**: the picked feature, and every feature whose `links` point at it (it depends on the pick).
- **via flag**: a picked flag reaches every feature it `gates`. A picked feature's flags only tag the features already touched; they do not spread to the flag's other features.
- **via axis**: an axis value reaches every action with a scenario on it. The values are the picked one, those the picked feature introduces, those a picked flag controls (`axisValues`), and those introduced by any feature reached via code or flag.

A feature reached via code or flag re-runs all scenarios of the actions it owns. An axis value re-runs only the scenarios on that value.

## Run plan (view D)

Scenarios are grouped by setup. Runnable setups are ordered greedily by the cheapest next setup switch; an impossible switch goes through the axis `fallback`. Inside a setup, scenarios are ordered greedily by the cheapest next action-axis switch (values carry over from one scenario to the next), never costing more than enumeration order; switches above `cheap` are spelled out before the scenario that needs them. Not-runnable setups come last.

## Run files

`runs/TEMPLATE.yaml` shows the shape of one QA run result. Copy it to `runs/<date>-<platform>.yaml` and fill it in. Fields: `yamlCommit`, `yamlDate`, `toolsCommit` (the commit of the tools that generated the scenarios, shown on the page label), `appBuild`, `device`, `platform`, `environment`, `scope: { reason, picks }`, and `results`, a list of `{ scenario, status, notes }` with `status` one of `passed`, `failed`, `skipped`.

Scenario ids mean what they meant at `yamlCommit`. A run is anchored to that commit, not to ids that are stable across versions, so to interpret an old run, read the graph as of its `yamlCommit` (for example with `git show <yamlCommit>:QA/graph/graph.yaml`) and run the tools as of its `toolsCommit`.
