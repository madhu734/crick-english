export type RunType = 'bat' | 'bye' | 'legBye';
export const dismissals = ['Bowled', 'Caught', 'LBW', 'Stumped', 'Hit wicket', 'Run out', 'Obstructing the field', 'Hit the ball twice'] as const;
export type Dismissal = typeof dismissals[number];
export type Delivery = {
  kind: 'legal' | 'wide' | 'noBall';
  runType: RunType;
  runs: number;
  boundary?: 4 | 6;
  wicket?: { player: string; how: Dismissal; next?: string; incomingOnStrike?: boolean };
};
export type Play = { type: 'ball'; delivery: Delivery } | { type: 'bowler'; player: string } | { type: 'swap' }
  | { type: 'replaceBatter'; outgoing: string; incoming: string }
  | { type: 'adjustRuns'; runs: number } | { type: 'closeInnings' };
export type Lineup = { team: string; players: string[] };
export type Opening = { striker: string; partner: string; bowler: string };
export type InningsLog = { team: string; opening: Opening; plays: Play[] };
export type MatchLog = {
  version: 1; overs: number; lineups: [Lineup, Lineup]; innings: InningsLog[]; outcome?: 'final' | 'noResult';
  superOver?: InningsLog[];
};
export const MATCH_OVERS = 24;
export const MAX_PLAYERS = 11;
export type Performance = {
  player: string; team: string; runs: number; balls_faced: number; fours: number; sixes: number;
  wickets: number; balls_bowled: number; runs_conceded: number; batted: boolean; not_out: boolean; retired?: boolean; unrecorded?: string[];
};
export type FallOfWicket = { wicket: number; runs: number; player: string; balls: number };
type Extras = { wide: number; noBall: number; bye: number; legBye: number };
type ScorePoint = { index: number; legalBalls: number; totalRuns: number; totalWickets: number };
type DeliveryRecord = ScorePoint & {
  over: string; label: string; batter: string; bowler: string; wicket?: Delivery['wicket'];
};
export type InningsState = {
  team: string; striker: string; partner: string; bowler: string; previousBowler: string; runs: number;
  wickets: number; balls: number; extras: Extras; allOut: boolean; done: boolean; endedEarly: boolean;
  deliveries: DeliveryRecord[]; adjustments: (ScorePoint & { runs: number })[]; adjustedRuns: number; availableBatters: string[];
};

export function fallOfWickets(innings: InningsState): FallOfWicket[] {
  return innings.deliveries.flatMap(delivery => delivery.wicket ? [{
    wicket: delivery.totalWickets, runs: delivery.totalRuns,
    player: delivery.wicket.player, balls: delivery.legalBalls,
  }] : []);
}

function requireRule(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function quickBall(runs: number): Play {
  return { type: 'ball', delivery: { kind: 'legal', runType: 'bat', runs, boundary: runs === 4 || runs === 6 ? runs : undefined } };
}

export const signedRuns = (runs: number) => runs > 0 ? '+' + runs : String(runs);

export function deliveryLabel(ball: Delivery) {
  const suffix = ball.wicket ? 'W' : '';
  const extras = ball.kind === 'wide' ? 'wd' : ball.kind === 'noBall' ? 'nb' : '';
  const runLabel = ball.runs ? String(ball.runs) + (ball.runType === 'bye' ? 'b' : ball.runType === 'legBye' ? 'lb' : '') : '';
  return [extras, runLabel, suffix].filter(Boolean).join('+') || '0';
}

function checkDelivery(ball: Delivery, state: InningsState) {
  requireRule(Number.isInteger(ball.runs) && ball.runs >= 0 && ball.runs <= 20, 'Enter a whole number of runs from 0 to 20.');
  if (ball.boundary) {
    requireRule(ball.boundary === ball.runs && (ball.boundary === 4 || ball.runType === 'bat' && ball.kind !== 'wide'),
      'A boundary six must be hit off the bat. Boundary runs must match the runs entered.');
  }
  const wicket = ball.wicket;
  if (!wicket) return;
  requireRule(dismissals.includes(wicket.how), 'Choose the dismissal.');
  requireRule([state.striker, state.partner].includes(wicket.player), 'Choose one of the current batters.');
  const independent = ['Run out', 'Obstructing the field', 'Hit the ball twice'];
  if (ball.kind === 'noBall') requireRule(independent.includes(wicket.how), 'This dismissal cannot be recorded on a no-ball.');
  if (ball.kind === 'wide') requireRule(['Stumped', 'Hit wicket', 'Run out', 'Obstructing the field'].includes(wicket.how), 'This dismissal cannot be recorded on a wide.');
  if (!independent.includes(wicket.how)) requireRule(wicket.player === state.striker, 'This dismissal applies to the striker.');
  if (!['Run out', 'Obstructing the field'].includes(wicket.how)) requireRule(ball.runs === 0, 'This dismissal does not allow completed runs.');
  if (ball.boundary) requireRule(false, 'Record a boundary or a wicket on this delivery.');
}

function replayInnings(log: InningsLog, batting: Lineup, fielding: Lineup, overs: number, target: number | undefined, figures: Map<string, Performance>) {
  const { striker, partner, bowler } = log.opening;
  requireRule(striker !== partner && batting.players.includes(striker) && batting.players.includes(partner),
    'Choose two different opening batters from the batting side.');
  requireRule(fielding.players.includes(bowler), 'Choose an opening bowler from the fielding side.');
  const state: InningsState = {
    team: batting.team, striker, partner, bowler, previousBowler: '', runs: 0, wickets: 0, balls: 0,
    extras: { wide: 0, noBall: 0, bye: 0, legBye: 0 }, allOut: false, done: false, endedEarly: false, deliveries: [], adjustments: [], adjustedRuns: 0, availableBatters: [],
  };
  const used = new Set<string>();
  const canEnter = (player: string) => batting.players.includes(player) &&
    (!used.has(player) || figures.get(player)?.retired === true);
  const enter = (player: string) => {
    const row = figures.get(player)!;
    used.add(player);
    row.batted = true;
    row.not_out = true;
    delete row.retired;
  };
  const replaceAtCrease = (outgoing: string, incoming: string) => {
    enter(incoming);
    if (state.striker === outgoing) state.striker = incoming;
    else state.partner = incoming;
  };
  enter(striker); enter(partner);
  const swap = () => { [state.striker, state.partner] = [state.partner, state.striker]; };

  const reachedTarget = () => target !== undefined && state.runs >= target;
  const isDone = () => state.endedEarly || state.allOut || state.balls === overs * 6 || reachedTarget();
  for (const [index, play] of log.plays.entries()) {
    if (play.type === 'adjustRuns') {
      const updatedRuns = state.runs + play.runs;
      requireRule(Number.isSafeInteger(play.runs) && play.runs !== 0, 'Enter a non-zero whole number of runs.');
      requireRule(Number.isSafeInteger(updatedRuns) && updatedRuns >= 0, 'The adjusted score must be a valid non-negative total.');
      state.runs = updatedRuns;
      state.adjustedRuns += play.runs;
      state.adjustments.push({ index, runs: play.runs, legalBalls: state.balls, totalRuns: state.runs, totalWickets: state.wickets });
      state.done = isDone();
      continue;
    }
    requireRule(!state.done, 'The innings is already finished. Undo or correct a later entry first.');
    if (play.type === 'closeInnings') {
      state.endedEarly = true;
      state.done = true;
      continue;
    }
    if (play.type === 'swap') { swap(); continue; }
    if (play.type === 'replaceBatter') {
      requireRule([state.striker, state.partner].includes(play.outgoing), 'Choose one of the current batters.');
      requireRule(canEnter(play.incoming), 'Choose a batter who has not batted or has retired.');
      figures.get(play.outgoing)!.retired = true;
      replaceAtCrease(play.outgoing, play.incoming);
      continue;
    }
    if (play.type === 'bowler') {
      requireRule(!state.bowler && fielding.players.includes(play.player) && play.player !== state.previousBowler,
        'Choose a different bowler for the new over.');
      state.bowler = play.player;
      continue;
    }
    requireRule(state.bowler, 'Choose the next bowler before entering a delivery.');
    const ball = play.delivery;
    checkDelivery(ball, state);
    const bowlerStats = figures.get(state.bowler)!;
    const batterStats = figures.get(state.striker)!;
    const legal = ball.kind === 'legal';
    const over = Math.floor(state.balls / 6) + '.' + (state.balls % 6 + 1);
    const batter = state.striker, bowler = state.bowler;

    if (ball.kind !== 'wide') batterStats.balls_faced++;
    if (legal) { state.balls++; bowlerStats.balls_bowled++; }
    if (ball.kind === 'wide') {
      state.extras.wide += 1 + ball.runs;
      bowlerStats.runs_conceded += 1 + ball.runs;
    } else {
      if (ball.kind === 'noBall') { state.extras.noBall++; bowlerStats.runs_conceded++; }
      if (ball.runType === 'bat') {
        batterStats.runs += ball.runs;
        bowlerStats.runs_conceded += ball.runs;
        if (ball.boundary === 4) batterStats.fours++;
        if (ball.boundary === 6) batterStats.sixes++;
      } else state.extras[ball.runType] += ball.runs;
    }
    state.runs += ball.runs + Number(!legal);

    if (!ball.boundary && ball.runs % 2) swap();
    const wicket = ball.wicket;
    const closingBall = state.balls === overs * 6 || reachedTarget();
    if (wicket) {
      requireRule(target === undefined || state.runs < target, 'The chase was already won on this delivery.');
      state.wickets++;
      figures.get(wicket.player)!.not_out = false;
      if (!['Run out', 'Obstructing the field', 'Hit the ball twice'].includes(wicket.how)) bowlerStats.wickets++;
      state.allOut = state.wickets === batting.players.length - 1;
      if (!closingBall && !state.allOut) {
        const next = wicket.next;
        requireRule(next && canEnter(next), 'Choose a batter who has not batted or has retired.');
        replaceAtCrease(wicket.player, next);
        if (wicket.how === 'Run out' || wicket.how === 'Obstructing the field') {
          if ((state.striker === next) !== Boolean(wicket.incomingOnStrike)) swap();
        }
      }
    }
    state.deliveries.push({
      index, over, label: deliveryLabel(ball), batter, bowler, wicket,
      legalBalls: state.balls, totalRuns: state.runs, totalWickets: state.wickets,
    });
    state.done = isDone();
    if (legal && state.balls % 6 === 0 && state.balls < overs * 6 && !state.allOut) {
      swap();
      state.previousBowler = state.bowler;
      state.bowler = '';
    }
  }
  state.availableBatters = batting.players.filter(canEnter);
  return state;
}

function scoreInningsPair(log: MatchLog) {
  requireRule(log.version === 1 && Number.isInteger(log.overs) && log.overs >= 1 && log.overs <= 50, 'Invalid match format.');
  const [a, b] = log.lineups;
  const everyone = [...a.players, ...b.players];
  requireRule(a.team !== b.team && a.players.length === b.players.length && a.players.length >= 2 && a.players.length <= MAX_PLAYERS &&
    new Set(everyone).size === everyone.length, 'Choose equal playing sides with 2–11 distinct players per team.');
  requireRule(log.innings.length === 1 || log.innings.length === 2, 'A match needs one or two innings.');
  const figures = new Map<string, Performance>();
  for (const { team, players } of log.lineups) {
    for (const player of players) figures.set(player, {
      player, team, runs: 0, balls_faced: 0, fours: 0, sixes: 0, wickets: 0, balls_bowled: 0,
      runs_conceded: 0, batted: false, not_out: false,
    });
  }
  const innings: InningsState[] = [];
  for (const entry of log.innings) {
    const batting = log.lineups.find(side => side.team === entry.team);
    const fielding = log.lineups.find(side => side.team !== entry.team);
    const first = innings[0];
    requireRule(batting && fielding && (!first || first.done && first.team !== batting.team), 'Complete the first innings before opening the chase.');
    innings.push(replayInnings(entry, batting, fielding, log.overs, first ? first.runs + 1 : undefined, figures));
  }
  const [first, second] = innings;
  const winner = second?.done ? second.runs > first.runs ? second.team :
    second.runs < first.runs ? first.team : '' : '';
  const active = innings[innings.length - 1];
  return { innings, active, players: [...figures.values()], winner, canFinalize: !!second?.done };
}

export function scoreMatch(log: MatchLog) {
  const regulation = scoreInningsPair(log);
  const tied = regulation.canFinalize && !regulation.winner;
  requireRule(!log.superOver || tied, 'A Super Over can only follow a tied match.');
  const superOver = log.superOver && scoreInningsPair({
    ...log, innings: log.superOver, overs: 1,
  });
  const deciding = superOver ?? regulation;
  requireRule(log.outcome !== 'final' || deciding.canFinalize, 'Finish the chase before finalizing.');
  return {
    ...regulation,
    active: deciding.active,
    winner: log.outcome === 'noResult' ? '' : deciding.winner,
    canFinalize: deciding.canFinalize,
    tied,
    superOver,
  };
}

export function publishScore(log: MatchLog, names: Record<string, string>) {
  const result = scoreMatch(log);
  const [first, second] = result.innings;
  let message: string | undefined;
  if (log.outcome === 'noResult') message = 'No result.';
  else if (second && !result.superOver) {
    if (!second.done) {
      const needed = first.runs + 1 - second.runs;
      const remaining = log.overs * 6 - second.balls;
      message = names[second.team] + ' need ' + needed + ' from ' + remaining + (remaining === 1 ? ' ball.' : ' balls.');
    } else if (!result.winner) message = 'Match tied.';
    else {
      const chasing = result.winner === second.team;
      const lineup = log.lineups.find(side => side.team === second.team)!;
      const margin = chasing ? lineup.players.length - 1 - second.wickets : first.runs - second.runs;
      message = names[result.winner] + ' won by ' + margin + (chasing ? (margin === 1 ? ' wicket.' : ' wickets.') : (margin === 1 ? ' run.' : ' runs.'));
    }
  } else if (first.done) message = 'Innings break · Target ' + (first.runs + 1);
  if (result.superOver && log.outcome !== 'noResult') {
    const [opening, chase] = result.superOver.innings;
    if (!opening.done) message = 'Super Over in progress.';
    else if (!chase) message = 'Super Over innings break · Target ' + (opening.runs + 1);
    else if (!chase.done) message = names[chase.team] + ' need ' + (opening.runs + 1 - chase.runs) + ' from ' + (6 - chase.balls) + ' in the Super Over.';
    else message = result.winner ? names[result.winner] + ' won the Super Over.' : 'Super Over tied. Match tied.';
  }
  const summarize = (innings: InningsState, quota: number) => ({
    team: innings.team, runs: innings.runs, wickets: innings.wickets, balls: innings.balls, allOut: innings.allOut,
    quota, endedEarly: innings.endedEarly, adjustedRuns: innings.adjustedRuns,
    extras: Object.values(innings.extras).reduce((total, runs) => total + runs, 0), extrasBreakdown: innings.extras,
    fallOfWickets: fallOfWickets(innings),
  });
  const active = !result.active.done && !log.outcome ? result.active : undefined;
  return {
    status: log.outcome === 'final' ? 'completed' as const : log.outcome === 'noResult' ? 'abandoned' as const : 'live' as const,
    winner: log.outcome === 'final' ? result.winner : '',
    scorecard: {
      innings: result.innings.map(innings => summarize(innings, log.overs)),
      ...(result.superOver ? { superOver: {
        innings: result.superOver.innings.map(innings => summarize(innings, 1)),
        playerStats: result.superOver.players,
      }} : {}),
      recent: result.active.deliveries.slice(-20).map(entry => entry.label),
      currentBatters: active ? [active.striker, active.partner] : [],
      currentBowler: active?.bowler ?? '',
      playingSides: log.lineups,
      playerStats: result.players,
      result: message,
    },
  };
}
