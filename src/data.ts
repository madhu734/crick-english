import PocketBase, { BaseAuthStore, LocalAuthStore, type RecordModel } from 'pocketbase';
import type { Lineup, Performance } from './scoring';

export const databaseUrl = import.meta.env.VITE_POCKETBASE_URL ?? 'https://pbdb2.duckdns.org';
export const publicDb = new PocketBase(databaseUrl, new BaseAuthStore());
export const staffDb = new PocketBase(databaseUrl, new LocalAuthStore('crick-english-staff'));

export type Season = RecordModel & { number: number; name: string; active: boolean };
export type Team = RecordModel & { season: string; name: string; short_name: string; color: string; logo: string };
export const playerRoles = ['Bowler', 'Batsman', 'All-rounder', 'Wicketkeeper'] as const;
export type Player = RecordModel & { name: string; batch: string; role: typeof playerRoles[number]; photo: string; team: string };
export type Stage = 'league' | 'group' | 'semifinal' | 'final' | 'friendly';
export type Status = 'scheduled' | 'live' | 'completed' | 'abandoned';
export type Innings = { team: string; runs: number; wickets: number; balls: number; allOut?: boolean; quota?: number; extras?: number; endedEarly?: boolean; adjustedRuns?: number };
export type Scorecard = { innings: Innings[]; result?: string; recent?: string[]; currentBatters?: string[]; currentBowler?: string; playingSides?: Lineup[]; playerStats?: Performance[] };
export type Match = RecordModel & {
  season: string; team_a: string; team_b: string; starts_at: string; stage: Stage;
  overs: number; status: Status; published: boolean; winner: string; scorecard: Scorecard | null; updated: string;
};
export type PlayerStat = RecordModel & {
  match: string; team: string; player: string; runs: number; balls_faced: number; fours: number; sixes: number;
  wickets: number; balls_bowled: number; runs_conceded: number; batted: boolean; not_out: boolean; retired?: boolean;
};
export type History = RecordModel & {
  season_number: number; year: number; champion: string; runner_up: string; champion_logo: string; runner_up_logo: string; published: boolean;
  champion_captain?: string; runner_up_captain?: string; team_photo?: string; edition?: string;
};
export type Tournament = {
  season: Season | undefined; teams: Team[]; players: Player[]; matches: Match[]; stats: PlayerStat[]; history: History[];
};
export const emptyTournament: Tournament = { season: undefined, teams: [], players: [], matches: [], stats: [], history: [] };
export const stageLabel: Record<Stage, string> = { league: 'League', group: 'League', semifinal: 'Semi-final', final: 'Final', friendly: 'Friendly' };

export async function readMatches(db: PocketBase, season: string, signal?: AbortSignal) {
  return db.collection('ce_matches').getFullList<Match>({
    filter: db.filter('season = {:season}', { season }), sort: 'starts_at', fields: 'id,collectionId,collectionName,season,team_a,team_b,starts_at,stage,overs,status,published,winner,scorecard,updated', requestKey: null, signal,
  });
}

export async function readTournament(db: PocketBase, signal?: AbortSignal): Promise<Tournament> {
  const query = { requestKey: null, signal };
  const [seasons, history] = await Promise.all([
    db.collection('ce_seasons').getFullList<Season>({ ...query, sort: '-number' }),
    db.collection('ce_season_history').getFullList<History>({ ...query, sort: '-season_number' }),
  ]);
  const season = seasons.find(item => item.active) ?? seasons[0];
  if (!season) return { ...emptyTournament, history };
  const args = { season: season.id };
  const [teams, players, matches, stats] = await Promise.all([
    db.collection('ce_teams').getFullList<Team>({ ...query, sort: 'name', filter: db.filter('season = {:season}', args) }),
    db.collection('ce_players').getFullList<Player>({ ...query, sort: 'name' }),
    readMatches(db, season.id, signal),
    db.collection('ce_player_match_stats').getFullList<PlayerStat>({ ...query, filter: db.filter('match.season = {:season}', args) }),
  ]);
  return { season, teams, players, matches, stats, history };
}

export function fileUrl(record: RecordModel, file?: string) {
  return file ? publicDb.files.getURL(record, file) : '';
}

const dateLabel = new Intl.DateTimeFormat('en-BD', { timeZone: 'Asia/Dhaka', weekday: 'short', day: 'numeric', month: 'short' });
const timeLabel = new Intl.DateTimeFormat('en-BD', { timeZone: 'Asia/Dhaka', hour: 'numeric', minute: '2-digit' });
export const dateText = (when: string) => dateLabel.format(new Date(when));
export const timeText = (when: string) => timeLabel.format(new Date(when));
export const oversText = (balls: number) => Math.floor(balls / 6) + '.' + balls % 6;

export const strikeRate = (runs: number, ballsFaced: number) => ballsFaced > 0 ? (100 * runs / ballsFaced).toFixed(1) : '—';

export const runsPerOver = (runs: number, legalBalls: number) => legalBalls > 0 ? (6 * runs / legalBalls).toFixed(2) : '—';

export function matchPerformances(match: Match, legacy: PlayerStat[]): PlayerStat[] {
  if (!match.scorecard?.playerStats) return legacy.filter(row => row.match === match.id);
  return match.scorecard.playerStats.map(row => ({
    ...row, id: match.id + ':' + row.player, match: match.id, collectionId: '', collectionName: '',
  }));
}

export function seasonPerformances(data: Tournament): PlayerStat[] {
  return data.matches.filter(match => match.status === 'completed' && match.published)
    .flatMap(match => matchPerformances(match, data.stats));
}

export function playerTotals(rows: PlayerStat[]) {
  return {
    played: rows.length, runs: sum(rows, 'runs'), wickets: sum(rows, 'wickets'), fours: sum(rows, 'fours'), sixes: sum(rows, 'sixes'),
    ballsFaced: sum(rows, 'balls_faced'), ballsBowled: sum(rows, 'balls_bowled'), conceded: sum(rows, 'runs_conceded'),
    highest: rows.filter(row => row.batted).sort((a, b) => b.runs - a.runs || Number(b.not_out) - Number(a.not_out))[0],
    best: rows.filter(row => row.balls_bowled > 0 || row.wickets > 0 || row.runs_conceded > 0).sort((a, b) => b.wickets - a.wickets || a.runs_conceded - b.runs_conceded)[0],
  };
}

function sum(rows: PlayerStat[], key: 'runs' | 'wickets' | 'fours' | 'sixes' | 'balls_faced' | 'balls_bowled' | 'runs_conceded') {
  return rows.reduce((total, row) => total + row[key], 0);
}

export function standings(teams: Team[], matches: Match[]) {
  return teams.map(team => {
    const played = matches.filter(match => match.published && (match.stage === 'league' || match.stage === 'group') &&
      (match.status === 'completed' || match.status === 'abandoned') && [match.team_a, match.team_b].includes(team.id));
    const won = played.filter(match => match.status === 'completed' && match.winner === team.id).length;
    const lost = played.filter(match => match.status === 'completed' && match.winner && match.winner !== team.id).length;
    let scored = 0, faced = 0, conceded = 0, bowled = 0;
    for (const match of played) {
      const innings = match.scorecard?.innings;
      const own = innings?.find(item => item.team === team.id);
      const opp = innings?.find(item => item.team !== team.id);
      if (match.status !== 'completed' || !own || !opp) continue;
      scored += own.runs;
      faced += own.allOut ? (own.quota ?? match.overs) * 6 : own.balls;
      conceded += opp.runs;
      bowled += opp.allOut ? (opp.quota ?? match.overs) * 6 : opp.balls;
    }
    const draws = played.length - won - lost;
    return { team, played: played.length, won, lost, draws, points: 2 * won + draws, nrr: faced && bowled ? 6 * (scored / faced - conceded / bowled) : null };
  }).sort((a, b) => b.points - a.points || b.won - a.won || (b.nrr ?? 0) - (a.nrr ?? 0) || a.team.name.localeCompare(b.team.name));
}
