# QA feature graph

A YAML graph of the wallet's features, feature flags and test axes (`graph.yaml`). The tools in `tools/` validate it, generate test scenarios and a run plan from it, and render it into a self-contained HTML page. The YAML is the single source of truth; every visual is rendered from it.

## Commands

- `npm run qa:graph` renders the page into `QA/graph/dist/` (git-ignored).
- `npm run qa:graph:check` validates the schema and compares the graph against the code. It exits 1 only on schema errors; a stale graph is reported as a warning and exits 0.

## Schema

`graph.yaml` has these top-level keys, all required (a list may be empty): `version`, `costs`, `environments`, `features`, `flags`, `axes`, `setups`, `actions`, `constraints`. Ids are unique within a collection and within one YAML version; they are not required to be stable across versions.

### version and costs

`version` is `1`. `costs` maps a cost key to a number: `cheap: 1`, `medium: 5`, `expensive: 20`, `very-expensive: 60`. Every cost named elsewhere must be one of these keys.

### environments

`{ id, name, notes }`. A network the app can be pointed at, such as `testnet`.

### features

`{ id, name, description, status, screens, files, flags, links, introduces, actions }`

- `status` is `in-scope` or `out-of-scope`.
- `screens` lists navigation routes; `files` lists source paths or directories (ending in `/`) that implement the feature. The freshness check uses `files`.
- `flags` lists the ids of flags that affect the feature.
- `links` is a list of `{ to, reason }`: another feature that is affected when this one changes, with a one-line reason. `to` must be an existing feature.
- `introduces` lists `axisId:valueId` pairs, new axis values this feature brings in.
- `actions` lists the ids of actions that exercise the feature.

### flags

`{ id, name, constant, default, gates, combinesWith, appliesAt, status }`

- `name` is the remote flag name and `constant` the constant in the code.
- `gates` lists the features the flag turns on or off.
- `combinesWith` is free text about interactions with other flags.
- `appliesAt` is `live`, `next-start` or `next-pin`: when a change of the flag takes effect.

### axes

`{ id, name, kind, values, how, switch }`

- `kind` is `setup` (expensive to change, forms the setups) or `action` (cheap to vary inside one setup).
- `values` is a list of `{ id, name }`; `how` says how a tester changes the axis.
- `switch.cost` is the default cost of changing the axis value.
- `switch.transitions` is a list of `{ from, to, cost?, impossible?, when? }`. A matching entry overrides the default cost; `impossible: true` means the transition cannot be done at all. Costs are directional and may be conditional (`when` is free text).
- `switch.fallback` is `{ cost, how }`: what to do when a needed transition is impossible, typically a fresh wallet. The run plan never schedules an impossible transition; it uses the fallback.

### setups

`{ id, name, values, environment, runnable, notes? }`

`values` maps every setup axis to one of its values. `environment` is an environment id. `runnable: false` marks a setup that cannot be reached today.

### actions

`{ id, name, feature, axes, setups, path }`

- `feature` is the feature the action exercises; `axes` lists the action axes varied by it; `setups` lists the setups it runs in.
- `path.steps` is a list of `{ id, screen, name }`.
- `path.outcomes` is a list of `{ id, kind, at, message, source, verified }`. `kind` is `success` or `error`, `at` is a step id, `message` is the text copied from the code, `source` is `path:line`, and `verified: false` until a tester has seen it on a device.

### constraints

`{ id, action, when, class, outcome?, note }`

`when` maps axis ids (setup or action) to a value id or a list of value ids. A combination matches when every listed axis has one of the listed values. `class` is one of:

- `invalid`: the combination cannot be constructed; it is excluded and produces no scenario.
- `rejected`: it can be constructed and the app refuses it. Requires `outcome`, which must be an error outcome of the action.
- `edge`: valid but risky; may name an `outcome`.
- `lib-risk`: valid but relies on behavior in the wallet library.

## Scenarios

A scenario is one (action, setup, action-axis values) combination. Its id is `${action}:${setup}:${action axis values joined by '.' in the action's axes order}`. Expensive axes form setups; inside each (action, setup) the tools pick pairwise coverage over the action axes, plus every rejected, edge and lib-risk combination. `expected` holds the outcome ids of matched rejected or edge constraints, else the action's success outcomes.

## Run files

`runs/TEMPLATE.yaml` shows the shape of one QA run result. Copy it to `runs/<date>-<platform>.yaml` and fill it in. Fields: `yamlCommit`, `yamlDate`, `appBuild`, `device`, `platform`, `environment`, `scope: { reason, picks }`, and `results`, a list of `{ scenario, status, notes }` with `status` one of `passed`, `failed`, `skipped`.

Scenario ids mean what they meant at `yamlCommit`. A run is anchored to that commit, not to ids that are stable across versions, so to interpret an old run, read the graph as of its `yamlCommit` (for example with `git show <yamlCommit>:QA/graph/graph.yaml`).
