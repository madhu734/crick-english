import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rateFigures, rowStrikeRate, statValue } from '../src/recorded-stats.ts';

test('paper runs count separately from strike rate when balls are unrecorded', () => {
  const paper = {runs:59,balls_faced:0,unrecorded:['balls_faced']};
  const scored = {runs:10,balls_faced:5};
  assert.deepEqual(rateFigures([paper,scored]),{runs:10,balls:5});
  assert.equal(rowStrikeRate(paper),'—');
  assert.equal(statValue(paper,'balls_faced'),'—');
  assert.equal(rowStrikeRate(scored),'200.0');
  assert.equal(statValue({runs:0},'runs'),0);
  assert.deepEqual(rateFigures([paper]),{runs:0,balls:0});
});
