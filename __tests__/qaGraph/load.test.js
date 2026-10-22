/**
 * @jest-environment node
 *
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadGraph, validateGraph } from '../../QA/graph/tools/load';

const fixture = path.join(__dirname, 'fixtures', 'mini.yaml');
const fresh = () => structuredClone(loadGraph(fixture));
const find = (list, id) => list.find((item) => item.id === id);

describe('qa graph loader', () => {
  it('loads the mini fixture without errors', () => {
    expect(validateGraph(loadGraph(fixture)).errors).toEqual([]);
  });

  it('accepts empty axes, setups, actions and constraints', () => {
    const graph = fresh();
    Object.assign(graph, {
      features: graph.features.map((f) => ({ ...f, actions: [], introduces: [] })),
      axes: [],
      setups: [],
      actions: [],
      constraints: [],
    });
    expect(validateGraph(graph).errors).toEqual([]);
  });

  it('reports unknown axis value in a constraint', () => {
    const graph = fresh();
    find(graph.constraints, 'c-priv').when.dest = ['simple', 'nope'];
    const { errors } = validateGraph(graph);
    expect(errors.some((e) => e.includes('c-priv') && e.includes('nope'))).toBe(true);
  });

  it('warns when a flag gates a feature that does not list it', () => {
    const graph = fresh();
    find(graph.flags, 'fbt').gates = ['fee-f', 'pin-f'];
    const { errors, warnings } = validateGraph(graph);
    expect(errors).toEqual([]);
    expect(warnings).toContainEqual(
      "flag fbt: gates feature 'pin-f', but that feature does not list the flag"
    );
  });

  it('warns when a feature lists a flag that does not gate it', () => {
    const graph = fresh();
    find(graph.features, 'pin-f').flags = ['fbt'];
    expect(validateGraph(graph).warnings).toContainEqual(
      "feature pin-f: lists flag 'fbt', but the flag does not gate it"
    );
  });

  it('gives the mini fixture no warnings', () => {
    expect(validateGraph(fresh()).warnings).toEqual([]);
  });

  it('reports dangling feature link', () => {
    const graph = fresh();
    find(graph.features, 'pin-f').links = [{ to: 'ghost', reason: 'x' }];
    expect(validateGraph(graph).errors.some((e) => e.includes('ghost'))).toBe(true);
  });

  it('requires outcome on rejected constraints', () => {
    const graph = fresh();
    delete find(graph.constraints, 'c-priv').outcome;
    expect(validateGraph(graph).errors.some((e) => e.includes('c-priv'))).toBe(true);
  });

  it('rejects duplicate ids within a collection', () => {
    const graph = fresh();
    graph.setups.push({ ...find(graph.setups, 'ws-single') });
    expect(validateGraph(graph).errors.some((e) => e.includes('ws-single'))).toBe(true);
  });

  it('includes the file path in YAML syntax errors', () => {
    const tmp = path.join(os.tmpdir(), `qa-graph-bad-${process.pid}.yaml`);
    fs.writeFileSync(tmp, 'a: [');
    try {
      expect(() => loadGraph(tmp)).toThrow(tmp);
    } finally {
      fs.unlinkSync(tmp);
    }
  });
});
