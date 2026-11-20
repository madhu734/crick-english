import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publishScore, quickBall, scoreMatch } from '../src/scoring.ts';

const start = (plays = [], overs = 2) => ({
  version: 1, overs, lineups: [{team: 'a', players: ['a1','a2','a3']},{team: 'b', players: ['b1','b2','b3']}],
  innings: [{team: 'a', opening: {striker: 'a1', partner: 'a2', bowler: 'b1'}, plays}],
});
const ball = (kind, runType, runs, wicket) => ({type:'ball',delivery:{kind,runType,runs,wicket}});
const names = { a:'Team A', b:'Team B' };

test('a tied match can finalize directly or use separate Super Over scoring', () => {
  const opening = { striker: 'b1', partner: 'b2', bowler: 'a1' };
  const close = { type: 'closeInnings' };
  const log = start([quickBall(4), close], 14);
  const openingInnings = { team: 'b', opening, plays: [quickBall(4), close] };
  log.innings.push(openingInnings);
  assert.equal(publishScore({ ...log, outcome: 'final' }, names).winner, '');
  const superOpening = { ...openingInnings, plays: Array.from({length: 6}, () => quickBall(1)) };
  const superChase = { ...log.innings[0], plays: [quickBall(6), quickBall(1)] };
  assert.throws(() => scoreMatch({ ...log, superOver: [superOpening], outcome: 'final' }), /Finish the chase/);
  assert.throws(() => scoreMatch({ ...log, superOver: [{...superOpening, plays: [...superOpening.plays, quickBall(1)]}] }), /already finished/);
  assert.throws(() => scoreMatch({ ...log, innings: [log.innings[0]], superOver: [superOpening] }), /tied match/);
  const result = publishScore({ ...log, superOver: [superOpening, superChase], outcome: 'final' }, names);
  assert.equal(result.winner, 'a');
  assert.deepEqual(result.scorecard.innings.map(i => i.runs), [4, 4]);
  assert.deepEqual(result.scorecard.superOver.innings.map(i => [i.runs, i.quota]), [[6, 1], [7, 1]]);
  assert.equal(result.scorecard.playerStats.find(row => row.player === 'a1').runs, 4);
  const anotherTie = { ...superChase, plays: [quickBall(6), close] };
  assert.equal(publishScore({ ...log, superOver: [superOpening, anotherTie], outcome: 'final' }, names).winner, '');
});

test('wides, no-balls and byes are attributed to the correct totals and ends', () => {
  const { active, players } = scoreMatch(start([
    ball('wide','bat',1),
    ball('noBall','bye',1),
    ball('legal','legBye',2),
    quickBall(4),
  ]));
  assert.deepEqual([active.runs,active.balls,active.striker], [10,2,'a1']);
  assert.deepEqual(active.extras,{wide:2,noBall:1,bye:1,legBye:2});
  const batter = players.find(p=>p.player==='a1');
  const partner = players.find(p=>p.player==='a2');
  const bowler = players.find(p=>p.player==='b1');
  assert.deepEqual([batter.runs,batter.balls_faced,batter.fours,partner.balls_faced],[4,2,1,1]);
  assert.deepEqual([bowler.runs_conceded,bowler.balls_bowled],[7,2]);
});

test('the sixth legal ball and odd runs can swap ends twice; an over requires a different bowler', () => {
  const plays = [...Array.from({length:5},()=>quickBall(0)),quickBall(1)];
  const {active} = scoreMatch(start(plays));
  assert.deepEqual([active.striker,active.balls,active.bowler],['a1',6,'']);
  assert.throws(()=>scoreMatch(start([...plays,quickBall(0)])),/next bowler/);
  assert.throws(()=>scoreMatch(start([...plays,{type:'bowler',player:'b1'}])),/different bowler/);
  assert.equal(scoreMatch(start([...plays,{type:'bowler',player:'b2'},quickBall(2)])).active.runs,3);
});

test('a non-striker run out is not charged to the bowler and all-out ends the innings', () => {
  const runOut = ball('legal','bat',0,{player:'a2',how:'Run out',next:'a3',incomingOnStrike:false});
  const caught = ball('legal','bat',0,{player:'a1',how:'Caught'});
  const {active,players} = scoreMatch(start([runOut,caught]));
  assert.equal(active.allOut,true);
  assert.equal(active.wickets,2);
  assert.equal(players.find(p=>p.player==='b1').wickets,1);
  assert.throws(()=>scoreMatch(start([runOut,caught,quickBall(1)])),/already finished/);
  assert.throws(()=>scoreMatch(start([ball('noBall','bat',0,{player:'a1',how:'Caught',next:'a3'})])),/no-ball/);
});

test('chase stops at target and can finalize or reopen without changing performance figures', () => {
  const log = start([quickBall(4), ...Array.from({length:5},()=>quickBall(0))], 1);
  log.innings.push({team:'b',opening:{striker:'b1',partner:'b2',bowler:'a1'},plays:[quickBall(6)]});
  assert.equal(publishScore(log,names).status,'live');
  const result = publishScore({...log,outcome:'final'},names);
  assert.equal(result.status,'completed');
  assert.equal(result.winner,'b');
  assert.equal(result.scorecard.result,'Team B won by 2 wickets.');
  assert.deepEqual(result.scorecard.playerStats,publishScore(log,names).scorecard.playerStats);
  assert.throws(()=>scoreMatch({...log,innings:[log.innings[0]],outcome:'final'}),/finish the chase/i);
});

test('tied and abandoned results have no winner', () => {
  const dots=Array.from({length:6},()=>quickBall(0));
  const log=start(dots,1);
  log.innings.push({team:'b',opening:{striker:'b1',partner:'b2',bowler:'a1'},plays:dots});
  assert.equal(publishScore({...log,outcome:'final'},names).scorecard.result,'Match tied.');
  assert.equal(publishScore({...log,outcome:'final'},names).winner,'');
  assert.equal(publishScore({...start(),outcome:'noResult'},names).status,'abandoned');
});

test('a batter change keeps the score and the correct end, and allows a retired batter to return', () => {
  const plays = [
    quickBall(4),
    {type:'replaceBatter', outgoing:'a1', incoming:'a3'},
    quickBall(2),
    {type:'replaceBatter', outgoing:'a2', incoming:'a1'},
  ];
  const beforeReturn = scoreMatch(start(plays.slice(0, 3)));
  assert.equal(beforeReturn.players.find(p => p.player === 'a1').retired, true);
  assert.deepEqual(beforeReturn.active.availableBatters, ['a1']);
  const {active, players} = scoreMatch(start(plays));
  assert.deepEqual([active.runs, active.wickets, active.balls, active.striker, active.partner], [6, 0, 2, 'a3', 'a1']);
  assert.deepEqual(active.deliveries.map(row => row.batter), ['a1', 'a3']);
  assert.equal(players.find(p => p.player === 'a1').retired, undefined);
  assert.equal(players.find(p => p.player === 'a2').not_out, true);
  assert.throws(() => scoreMatch(start([{type:'replaceBatter', outgoing:'a1', incoming:'a2'}])), /has not batted or has retired/);
});

test('signed adjustments change only the team total and are omitted from delivery counts', () => {
  const log = start([quickBall(1), { type: 'adjustRuns', runs: 5 }, { type: 'adjustRuns', runs: -3 }, quickBall(4)]);
  const withoutAdjustments = scoreMatch(start([quickBall(1), quickBall(4)]));
  const { active, players } = scoreMatch(log);
  assert.deepEqual([active.runs, active.balls, active.adjustedRuns, active.striker], [7, 2, 2, 'a2']);
  assert.deepEqual(players, withoutAdjustments.players);
  assert.deepEqual(active.adjustments.map(point => [point.runs, point.legalBalls, point.totalRuns]), [[5, 1, 6], [-3, 1, 3]]);
  assert.deepEqual(active.deliveries.map(row => row.totalRuns), [1, 7]);
  assert.equal(publishScore(log, names).scorecard.innings[0].extras, 0);
  assert.equal(publishScore(log, names).scorecard.innings[0].adjustedRuns, 2);
  assert.throws(() => scoreMatch(start([{ type: 'adjustRuns', runs: -1 }])), /non-negative/);
  assert.throws(() => scoreMatch(start([{ type: 'adjustRuns', runs: 1.5 }])), /whole number/);
});

test('closing early sets the chase target and permits an official result at actual overs', () => {
  const close = { type: 'closeInnings' };
  const log = start([quickBall(4), { type: 'adjustRuns', runs: 2 }, close, { type: 'adjustRuns', runs: -1 }]);
  assert.equal(publishScore(log, names).scorecard.result, 'Innings break · Target 6');
  assert.throws(() => scoreMatch(start([close, quickBall(1)])), /already finished/);
  log.innings.push({ team: 'b', opening: { striker: 'b1', partner: 'b2', bowler: 'a1' }, plays: [quickBall(4), close] });
  const result = publishScore({ ...log, outcome: 'final' }, names);
  assert.equal(result.scorecard.result, 'Team A won by 1 run.');
  assert.deepEqual(result.scorecard.innings.map(inn => [inn.runs, inn.balls, inn.allOut, inn.endedEarly]), [
    [5, 1, false, true], [4, 1, false, true],
  ]);
  log.innings[1].plays.pop();
  assert.equal(scoreMatch(log).canFinalize, false);
});

test('deducting runs below the target resumes an unfinished chase at the correct over', () => {
  const log = start([quickBall(4), { type: 'closeInnings' }]);
  log.innings.push({ team: 'b', opening: { striker: 'b1', partner: 'b2', bowler: 'a1' },
    plays: [...Array.from({ length: 5 }, () => quickBall(0)), quickBall(6)] });
  assert.equal(scoreMatch(log).canFinalize, true);
  log.innings[1].plays.push({ type: 'adjustRuns', runs: -2 });
  const { active, canFinalize } = scoreMatch(log);
  assert.equal(canFinalize, false);
  assert.deepEqual([active.runs, active.balls, active.striker, active.bowler, active.previousBowler], [4, 6, 'b2', '', 'a1']);
  log.innings[1].plays.push({ type: 'bowler', player: 'a2' }, { type: 'adjustRuns', runs: 1 });
  assert.equal(scoreMatch(log).canFinalize, true);
});
