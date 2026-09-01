import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../context/ManagerContext.tsx', import.meta.url), 'utf8');

test('ManagerContext serializes lifecycle mutations', () => {
  assert.match(source, /lifecycleMutationRef/);
  assert.match(source, /itemMutationRef/);
  assert.match(source, /persistWriteRef/);
});

test('ManagerContext does not resurrect persisted RUNNING sessions', () => {
  assert.match(source, /Never resurrect it automatically/);
  assert.match(source, /stored\.status === 'RUNNING' \|\| stored\.sessionId/);
  assert.match(source, /setStatus\('STOPPED'\)/);
});

test('ManagerContext invalidates generations when stopping/restoring', () => {
  assert.match(source, /managerGenerationRef\.current \+= 1/);
  assert.match(source, /globalStopVersion/);
});

test('Chrome lifecycle is explicitly cleared for restored Chrome sessions', () => {
  assert.match(source, /clearChromeTabLifecycles/);
  assert.match(source, /stored\.browserMode === 'chrome'/);
});
