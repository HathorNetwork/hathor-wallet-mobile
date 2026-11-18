# Agent instructions

## QA feature graph

`QA/graph/graph.yaml` is the map QA tests from: the wallet's features, feature flags, test axes, setups, and the path and expected messages of each action. Testers and tools read it to decide what to test after a change, so a graph that lags the code sends QA down the wrong paths.

A PR that adds or changes a feature, a flag, a screen, an axis value or a user-facing message updates the graph in the same PR.

Run the `qa-graph-check` skill (`.agents/skills/qa-graph-check/SKILL.md`) before opening any PR. Schema and commands: `QA/graph/README.md`.
