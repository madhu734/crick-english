import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowRight, CalendarDays, ChevronRight, Clock3, RefreshCw, Search, Trophy, UsersRound } from 'lucide-react';
import '@fontsource-variable/inter';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import { Admin } from './admin';
import { MatchAnalysis } from './match-analysis';
import { GraphicCard, renderPlayerCard, renderResultCard, renderTeamCard } from './graphic-cards';
import { signedRuns } from './scoring';
import { dateText, emptyTournament, fileUrl, matchPerformances, oversText, playerTotals, publicDb, readMatches, readTournament, runsPerOver, seasonPerformances, stageLabel, standings, strikeRate, timeText, type Tournament, type Innings } from './data';
import type { Performance } from './scoring';
import { Avatar, BackLink, Badge, Crest, Empty, Layout, MatchCard, PageTitle, SiteLink } from './ui';
import './style.css';

function App() {
  const location = useLocation();
  const isAdmin = /^\/admin\/?$/.test(location.pathname);
  const [data, setData] = useState<Tournament>(emptyTournament);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const seasonId = data.season?.id;
  const shouldRefreshMatches = location.pathname === '/' || location.pathname.startsWith('/matches/');

  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);

  useEffect(() => {
    if (isAdmin) return;
    const abort = new AbortController();
    readTournament(publicDb, abort.signal).then(value => {
      setData(value); setError(''); setLoading(false);
    }).catch(() => {
      if (!abort.signal.aborted) { setError('Tournament data could not load.'); setLoading(false); }
    });
    return () => abort.abort();
  }, [isAdmin, reload]);

  useEffect(() => {
    if (isAdmin || !seasonId || !shouldRefreshMatches) return;
    const abort = new AbortController();
    let pending = false;
    const refresh = async () => {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const matches = await readMatches(publicDb, seasonId, abort.signal);
        if (!abort.signal.aborted) setData(previous => ({ ...previous, matches }));
      } catch { /* Keep the last available scores on a brief connection loss. */ }
      finally { pending = false; }
    };
    const timer = window.setInterval(refresh, 10_000);
    document.addEventListener('visibilitychange', refresh);
    return () => { abort.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [isAdmin, seasonId, shouldRefreshMatches]);

  if (isAdmin) return <main className="admin-shell"><Admin /></main>;

  return <Layout>
    {error && <div className="shell"><div role="alert" className="notice">{error}
      <button type="button" className="quiet" onClick={() => { setLoading(true); setError(''); setReload(n => n + 1); }}>Retry</button></div></div>}
    {loading && location.pathname !== '/' ? <div className="shell page"><Empty title="Loading tournament…" /></div> : <Routes>
      <Route path="/" element={<Home data={data} loading={loading} />} />
      <Route path="/matches/:id" element={<MatchPage data={data} onRefresh={() => setReload(n => n + 1)} />} />
      <Route path="/teams" element={<TeamsPage data={data} />} />
      <Route path="/teams/:id" element={<TeamPage data={data} />} />
      <Route path="/players/:id" element={<PlayerPage data={data} />} />
      <Route path="/points" element={<PointsPage data={data} />} />
      <Route path="/history" element={<HistoryPage data={data} />} />
      <Route path="*" element={<Missing noun="Page" />} />
    </Routes>}
  </Layout>;
}

function Home({ data, loading }: { data: Tournament; loading: boolean }) {
  const [search, setSearch] = useSearchParams();
  const mode = search.get('show');
  const filtered = mode === 'fixtures' ? data.matches.filter(match => match.status === 'scheduled') :
    mode === 'results' ? data.matches.filter(match => ['completed', 'abandoned'].includes(match.status)) :
    data.matches.filter(match => match.status !== 'scheduled').sort((a, b) => Number(b.status === 'live') - Number(a.status === 'live'));
  function filter(value: string) {
    const next = new URLSearchParams(search);
    if (value) next.set('show', value); else next.delete('show');
    setSearch(next, { preventScrollReset: true });
  }
  return <>
    <section className="hero"><div className="shell hero-inner">
      <span className="hero-kicker"><span /> {data.season?.name ?? 'Season 9'} <span className="hero-sep">/</span> Department of English</span>
      <h1>Crick<br /><em>English</em></h1>
      <p>Fixtures, scores and player stats for the Department of English cricket tournament.</p>
      <a className="button hero-button" href="#matches">See matches <ArrowDown size={17} /></a>
    </div></section>
    <div className="shell home-content">
      <section className="match-section" id="matches">
        <div className="section-heading"><h2>Matches</h2><div className="tabs" aria-label="Filter matches">
          {[['', 'All matches'], ['fixtures', 'Fixtures'], ['results', 'Results']].map(([value, label]) =>
            <button key={label} type="button" aria-pressed={(mode ?? '') === value} onClick={() => filter(value)}>{label}</button>)}
        </div></div>
        {filtered.length ? <div className="match-grid">{filtered.map(match => <MatchCard key={match.id} match={match} teams={data.teams} />)}</div> :
          <Empty title={loading ? 'Loading matches…' : mode === 'fixtures' ? 'No upcoming fixtures' : mode === 'results' ? 'No results yet' : 'No matches started yet'}>{!loading && mode !== 'fixtures' && <>Upcoming matches are in Fixtures.</>}</Empty>}
      </section>
      <aside className="home-side">
        <div className="section-heading"><h2>Standings</h2></div>
        <div className="side-panel">
          {data.teams.length ? standings(data.teams, data.matches).slice(0, 5).map(row =>
            <SiteLink className="side-team" to={'/teams/' + row.team.id} key={row.team.id}><Crest team={row.team} /><strong>{row.team.name}</strong><span>{row.points} pts</span></SiteLink>) :
            <p className="side-empty">Standings will appear when teams are added.</p>}
          <SiteLink className="side-action" to="/points">Full points table <ArrowRight size={16} /></SiteLink>
        </div>
        <SiteLink className="side-shortcut" to="/teams"><UsersRound size={19} /> <strong>Teams &amp; Players</strong><ChevronRight size={17} /></SiteLink>
      </aside>
    </div>
  </>;
}

function MatchPage({ data, onRefresh }: { data: Tournament; onRefresh?: () => void }) {
  const { id } = useParams();
  const [search, setSearch] = useSearchParams();
  const match = data.matches.find(item => item.id === id);
  if (!match) return <Missing noun="Match" />;
  const teams = [match.team_a, match.team_b].map(key => data.teams.find(item => item.id === key));
  const squad = search.get('tab') === 'squad';
  function changeTab(toSquad: boolean) {
    const next = new URLSearchParams(search);
    if (toSquad) next.set('tab', 'squad'); else next.delete('tab');
    setSearch(next, { preventScrollReset: true });
  }
  const stats = matchPerformances(match, data.stats);
  const awarded = match.status === 'completed' && data.players.find(player => player.id === match.player_of_match);
  const awardedStats = awarded ? stats.find(row => row.player === awarded.id) : undefined;
  const playerName = (key: string) => {
    const player = data.players.find(item => item.id === key);
    const captain = data.teams.some(team => team.id === player?.team && team.captain === key);
    return (player?.name ?? 'Player') + (captain ? ' (C)' : '');
  };
  return <div className="shell page">
    <BackLink to="/">All matches</BackLink>
    <PageTitle kicker={stageLabel[match.stage]} title={teams.map(team => team?.name ?? 'TBD').join(' vs ')}>
      <div className="detail-meta"><Badge status={match.status} /><span><CalendarDays size={16} />{dateText(match.starts_at)} · {timeText(match.starts_at)}</span>
        <span><Clock3 size={16} />{match.overs} overs</span></div>
    </PageTitle>
    <div className="detail-score panel">
      {teams.map((team, index) => {
        const row = match.scorecard?.innings.find(item => item.team === team?.id);
        return <div className="score-block" key={team?.id ?? index}><Crest team={team} /><div><strong>{team?.name ?? 'TBD'}</strong>{row && <><p><b>{row.runs}/{row.wickets}</b> <span>({oversText(row.balls)} ov)</span></p><p className="inning-rate">Run rate {runsPerOver(row.runs, row.balls)}{row.endedEarly && ' · Innings ended early'}</p></>}</div></div>;
      })}
      {match.scorecard?.result && <p className="score-result">{match.scorecard.result}</p>}
    </div>
    <div className="detail-tabs tabs"><button aria-pressed={!squad} onClick={() => changeTab(false)}>Scorecard</button><button aria-pressed={squad} onClick={() => changeTab(true)}>Squads</button>{onRefresh && match.status === 'live' && <button type="button" onClick={onRefresh}>Refresh score</button>}</div>
    {!squad && match.scorecard && (match.status === 'completed' || match.status === 'abandoned') &&
      <GraphicCard key={match.id + ':' + match.updated} kind="Result" name={teams.map(team => team?.name ?? 'TBD').join(' vs ')}
        render={() => renderResultCard({ match, season: data.season?.name ?? '', teams, players: data.players, stats, awarded: awarded || undefined })} />}
    {!squad && awarded && <section className="panel match-award">
      <Avatar player={awarded} />
      <div><h2><Trophy size={17} /> Player of the Match</h2>
        <SiteLink to={'/players/' + awarded.id}>{awarded.name}</SiteLink>
        {awardedStats && <p>{awardedStats.runs} runs · {awardedStats.wickets} wickets</p>}
      </div>
    </section>}
    {squad ? <div className="two-col">{teams.map((team, index) => <section className="panel padded" key={team?.id ?? index}><h2>{team?.name ?? 'TBD'}</h2><PlayerList data={data} teamId={team?.id ?? ''} playersInMatch={match.scorecard?.playingSides?.find(side => side.team === team?.id)?.players} /></section>)}</div> :
      !match.scorecard ? <Empty title="Scorecard pending">Scores will appear once the match is scored.</Empty> : <>
        {!!match.scorecard.recent?.length && <section className="panel padded recent"><h2>{match.scorecard.superOver ? 'Super Over recent balls' : 'Recent balls'}</h2><div>{match.scorecard.recent.slice(-20).map((ball, i) => <span className={'ball ball-' + ball} key={i}>{ball}</span>)}</div>
          {!!match.scorecard.currentBatters?.length && <p>Batting: {match.scorecard.currentBatters.map(key => playerName(key)).join(' · ')}</p>}
          {match.scorecard.currentBowler && <p>Bowling: {playerName(match.scorecard.currentBowler)}</p>}</section>}
        {match.status === 'live' && match.updated && <p className="updated"><RefreshCw size={14} /> Last update {timeText(match.updated)} Dhaka time</p>}
        {stats.length ? <div className="two-col">{teams.map((team, index) => {
          const rows = stats.filter(row => row.team === team?.id);
          const innings = match.scorecard?.innings.find(row => row.team === team?.id);
          return <section className="panel padded" key={team?.id ?? index}><h2>{team?.name ?? 'TBD'}</h2>
            <h3>Batting</h3><div className="table-wrap"><table className="match-batting-table"><thead><tr><th scope="col">Batter</th><th scope="col">R</th><th scope="col">B</th><th scope="col">4s</th><th scope="col">6s</th><th scope="col"><abbr title="Strike rate">SR</abbr></th></tr></thead><tbody>{rows.filter(row => row.batted).map(row => <tr key={row.id}><td><SiteLink className="scorecard-player" to={'/players/' + row.player}>{data.players.find(player => player.id === row.player) && <Avatar player={data.players.find(player => player.id === row.player)!} />}{playerName(row.player)}</SiteLink>{row.retired && <small>Retired</small>}</td><td>{row.runs}{row.not_out ? '*' : ''}</td><td>{row.balls_faced}</td><td>{row.fours}</td><td>{row.sixes}</td><td>{strikeRate(row.runs, row.balls_faced)}</td></tr>)}</tbody></table></div>
            {innings?.extras !== undefined && <p className="updated">Extras: {innings.extras}
              {!!innings.adjustedRuns && <> · Run adjustment: {signedRuns(innings.adjustedRuns)}</>}</p>}
            <h3>Bowling</h3><div className="table-wrap"><table><thead><tr><th>Bowler</th><th>O</th><th>R</th><th>W</th></tr></thead><tbody>{rows.filter(row => row.balls_bowled || row.wickets || row.runs_conceded).map(row => <tr key={row.id}><td><SiteLink to={'/players/' + row.player}>{playerName(row.player)}</SiteLink></td><td>{oversText(row.balls_bowled)}</td><td>{row.runs_conceded}</td><td>{row.wickets}</td></tr>)}</tbody></table></div>
          </section>;
        })}</div> : <Empty title="Individual scorecard pending" />}
        {match.scorecard.superOver && <section>
          <h2>Super Over</h2>
          <div className="two-col">{match.scorecard.superOver.innings.map(innings =>
            <SuperOverInnings key={innings.team} innings={innings} figures={match.scorecard!.superOver!.playerStats}
              teamName={teams.find(team => team?.id === innings.team)?.name ?? 'Team'} playerName={playerName} />)}</div>
        </section>}
        <MatchAnalysis key={match.id} match={match} teams={data.teams} players={data.players} />
      </>}
  </div>;
}

function SuperOverInnings({ innings, figures, teamName, playerName }: {
  innings: Innings; figures: Performance[]; teamName: string; playerName: (id: string) => string;
}) {
  const batters = figures.filter(row => row.team === innings.team && row.batted);
  const bowlers = figures.filter(row => row.team !== innings.team && (row.balls_bowled || row.wickets || row.runs_conceded));
  return <section className="panel padded">
    <h3>{teamName} · {innings.runs}/{innings.wickets} ({oversText(innings.balls)} ov)</h3>
    <div className="table-wrap"><table><thead><tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead>
      <tbody>{batters.map(row => <tr key={row.player}><td><SiteLink to={'/players/' + row.player}>{playerName(row.player)}</SiteLink>{row.retired && <small>Retired</small>}</td>
        <td>{row.runs}{row.not_out ? '*' : ''}</td><td>{row.balls_faced}</td><td>{row.fours}</td><td>{row.sixes}</td><td>{strikeRate(row.runs, row.balls_faced)}</td></tr>)}</tbody>
    </table></div>
    <p className="updated">Extras {innings.extras ?? 0}{!!innings.adjustedRuns && <> · Run adjustment {signedRuns(innings.adjustedRuns)}</>}</p>
    <div className="table-wrap"><table><thead><tr><th>Bowler</th><th>O</th><th>R</th><th>W</th></tr></thead>
      <tbody>{bowlers.map(row => <tr key={row.player}><td><SiteLink to={'/players/' + row.player}>{playerName(row.player)}</SiteLink></td>
        <td>{oversText(row.balls_bowled)}</td><td>{row.runs_conceded}</td><td>{row.wickets}</td></tr>)}</tbody>
    </table></div>
  </section>;
}

function TeamsPage({ data }: { data: Tournament }) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const matches = query ? data.players.filter(player => player.name.toLowerCase().includes(query) || player.batch === query) : [];
  return <div className="shell page"><PageTitle kicker={data.season?.name} title="Teams & Players" />
    <section className="player-search">
      <div className="player-search-field">
        <Search size={20} aria-hidden="true" />
        <input id="player-search" type="search" aria-label="Search players by name or batch" value={search} onChange={event => setSearch(event.currentTarget.value)} />
      </div>
      {query && (matches.length ? <ul className="row-list">{matches.map(player => <li key={player.id}>
        <SiteLink to={'/players/' + player.id}><Avatar player={player} /><div><strong>{player.name}</strong>
          <small>{[data.teams.find(team => team.id === player.team)?.name, player.batch && 'Batch ' + player.batch].filter(Boolean).join(' · ')}</small>
        </div><ChevronRight size={17} /></SiteLink>
      </li>)}</ul> : <p role="status">No players found.</p>)}
    </section>
    {data.teams.length ? <div className="team-grid">{data.teams.map(team => <SiteLink to={'/teams/' + team.id} className="team-tile panel" key={team.id}><Crest team={team} /><div><h2>{team.name}</h2><p>{data.players.filter(player => player.team === team.id).length + ' players'}</p></div><ChevronRight size={19} /></SiteLink>)}</div> : <Empty title="Teams will appear here once added" />}
    {data.players.some(player => !player.team) && <section className="panel padded unassigned-players"><h2>Unassigned players</h2><PlayerList data={data} teamId="" /></section>}
  </div>;
}

function PlayerList({ data, teamId, playersInMatch }: { data: Tournament; teamId: string; playersInMatch?: string[] }) {
  const ids = new Set(playersInMatch ?? data.players.filter(player => player.team === teamId).map(player => player.id));
  const players = data.players.filter(player => ids.has(player.id));
  const captain = data.teams.find(team => team.id === teamId)?.captain;
  return players.length ? <ul className="row-list">{players.map(player => <li key={player.id}><SiteLink to={'/players/' + player.id}><Avatar player={player} /><div><strong>{player.name} {player.id === captain && <span aria-label="Captain" title="Captain">(C)</span>}</strong><small>{[player.role, player.batch && 'Batch ' + player.batch].filter(Boolean).join(' · ')}</small></div><ChevronRight size={17} /></SiteLink></li>)}</ul> : <Empty title="Squad pending" />;
}

function TeamPage({ data }: { data: Tournament }) {
  const { id } = useParams();
  const team = data.teams.find(item => item.id === id);
  if (!team) return <Missing noun="Team" />;
  const matches = data.matches.filter(match => [match.team_a, match.team_b].includes(team.id));
  return <div className="shell page"><BackLink to="/teams">All teams</BackLink><div className="profile-heading"><Crest team={team} /><PageTitle kicker={data.season?.name} title={team.name} /></div>
    {(team.owner_name?.trim() || team.owner_photo) && <section className="panel team-owner">
      {team.owner_photo && <img src={fileUrl(team, team.owner_photo)} alt={team.owner_name ? team.owner_name + ', team owner' : 'Team owner'} loading="lazy" />}
      <div><small>TEAM OWNER</small><strong>{team.owner_name?.trim() || 'Team owner'}</strong></div>
    </section>}
    <GraphicCard key={team.id} name={team.name} kind="Team" render={() => renderTeamCard(team, data.season?.name ?? '', data.players.filter(player => player.team === team.id))} />
    {team.captain && data.players.filter(player => player.id === team.captain && player.team === team.id).map(player => <section className="panel team-owner" key={player.id}><Avatar player={player} /><div><small>TEAM CAPTAIN</small><SiteLink to={'/players/' + player.id}><strong>{player.name}</strong></SiteLink></div></section>)}
    {(team.manager_name?.trim() || team.manager_photo) && <section className="panel team-owner">
      {team.manager_photo && <img src={fileUrl(team, team.manager_photo)} alt="Team manager" loading="lazy" />}
      <div><small>TEAM MANAGER</small><strong>{team.manager_name?.trim() || 'Team manager'}</strong></div>
    </section>}
    <div className="two-col"><section className="panel padded"><h2>Squad</h2><PlayerList data={data} teamId={team.id} /></section>
    <section><div className="section-heading"><h2>Matches</h2></div><div className="stack">{matches.length ? matches.map(match => <MatchCard match={match} teams={data.teams} key={match.id} />) : <Empty title="No fixtures yet" />}</div></section></div>
  </div>;
}

function PlayerPage({ data }: { data: Tournament }) {
  const { id } = useParams();
  const player = data.players.find(item => item.id === id);
  if (!player) return <Missing noun="Player" />;
  const team = data.teams.find(item => item.id === player.team);
  const rows = seasonPerformances(data).filter(row => row.player === id);
  const total = playerTotals(rows);
  const batting = rows.filter(row => row.batted);
  const bowling = rows.filter(row => row.balls_bowled || row.wickets || row.runs_conceded);
  const battingFigures: [string, string | number][] = [['Runs', total.runs], ['Highest', total.highest ? total.highest.runs + (total.highest.not_out ? '*' : '') : '—'],
    ['Fours / Sixes', total.fours + ' / ' + total.sixes], ['Strike rate', strikeRate(total.runs, total.ballsFaced)]];
  const bowlingFigures: [string, string | number][] = [['Wickets', total.wickets], ['Overs', oversText(total.ballsBowled)],
    ['Best bowling', total.best ? total.best.wickets + '/' + total.best.runs_conceded : '—'],
    ['Economy', runsPerOver(total.conceded, total.ballsBowled)]];
  const matchLink = (row: typeof rows[number]) => {
    const match = data.matches.find(item => item.id === row.match);
    const opponent = data.teams.find(item => item.id === (match?.team_a === row.team ? match.team_b : match?.team_a));
    return <SiteLink to={'/matches/' + row.match}>{opponent ? 'vs ' + opponent.name : 'Match scorecard'}{match && <small>{dateText(match.starts_at)}</small>}</SiteLink>;
  };
  return <div className="shell page"><BackLink to={team ? '/teams/' + team.id : '/teams'}>{team?.name ?? 'All teams'}</BackLink><div className="profile-heading"><Avatar player={player} /><PageTitle kicker={player.role || 'Player'} title={player.name}><div className="detail-meta">{team && <SiteLink to={'/teams/' + team.id}>{team.name}</SiteLink>}{player.batch && <span>Batch {player.batch}</span>}</div></PageTitle></div>
    <GraphicCard key={player.id} name={player.name} kind="Player" render={() => renderPlayerCard(player, data.season?.name ?? '', team)} />
    <div className="section-heading"><h2>{data.season?.name ?? 'Season'} stats</h2>{rows.length > 0 && <span className="stats-matches">{total.played} {total.played === 1 ? 'match' : 'matches'}</span>}</div>
    {rows.length ? <div className="two-col player-stats">
      <section className="panel padded"><h2>Batting</h2>
        {batting.length ? <><StatFigures figures={battingFigures} /><div className="table-wrap">
          <table><thead><tr><th>Match</th><th>Runs</th><th>Balls</th><th>4s</th><th>6s</th></tr></thead><tbody>{batting.map(row =>
            <tr key={row.id}><td>{matchLink(row)}</td><td>{row.runs}{row.not_out ? '*' : ''}</td><td>{row.balls_faced}</td><td>{row.fours}</td><td>{row.sixes}</td></tr>)}</tbody></table>
        </div></> : <p className="stats-matches">No batting innings yet.</p>}
      </section>
      <section className="panel padded"><h2>Bowling</h2>
        {bowling.length ? <><StatFigures figures={bowlingFigures} /><div className="table-wrap">
          <table><thead><tr><th>Match</th><th>Overs</th><th>Runs</th><th>Wickets</th></tr></thead><tbody>{bowling.map(row =>
            <tr key={row.id}><td>{matchLink(row)}</td><td>{oversText(row.balls_bowled)}</td><td>{row.runs_conceded}</td><td>{row.wickets}</td></tr>)}</tbody></table>
        </div></> : <p className="stats-matches">No bowling figures yet.</p>}
      </section>
    </div> : <Empty title="No match stats yet">Stats appear after a scored match is finalized.</Empty>}
  </div>;
}

function StatFigures({ figures }: { figures: [string, string | number][] }) {
  return <div className="stat-grid">{figures.map(([label, value]) => <div className="stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>;
}

function PointsPage({ data }: { data: Tournament }) {
  const [search] = useSearchParams();
  const stats = search.get('tab') === 'stats';
  return <div className="shell page"><PageTitle kicker={data.season?.name} title="Points & Stats" />
    <div className="detail-tabs tabs"><SiteLink to="/points" className={!stats ? 'selected' : ''}>Points Table</SiteLink><SiteLink to="/points?tab=stats" className={stats ? 'selected' : ''}>Tournament Stats</SiteLink></div>
    {stats ? <TournamentStats data={data} /> :
      data.teams.length ? <section className="panel padded"><h2>League standings</h2><div className="table-wrap"><table><thead><tr><th>Team</th><th>Played</th><th>Won</th><th>Lost</th><th>T/NR</th><th>Pts</th><th>NRR</th></tr></thead><tbody>{standings(data.teams, data.matches).map(row => <tr key={row.team.id}><td><SiteLink className="table-team" to={'/teams/' + row.team.id}><Crest team={row.team} />{row.team.name}</SiteLink></td><td>{row.played}</td><td>{row.won}</td><td>{row.lost}</td><td>{row.draws}</td><td><b>{row.points}</b></td><td>{row.nrr === null ? '—' : (row.nrr > 0 ? '+' : '') + row.nrr.toFixed(3)}</td></tr>)}</tbody></table></div></section> : <Empty title="Points table pending" />}
  </div>;
}

function TournamentStats({ data }: { data: Tournament }) {
  const performances = seasonPerformances(data);
  if (!performances.length) return <Empty title="Tournament stats pending" />;

  const totals = playerTotals(performances);
  const players = data.players.map(player => ({
    player, ...playerTotals(performances.filter(row => row.player === player.id)),
  }));
  const byName = (a: typeof players[number], b: typeof players[number]) => a.player.name.localeCompare(b.player.name);
  const mostRuns = players.filter(row => row.runs > 0).sort((a, b) => b.runs - a.runs || byName(a, b));
  const mostWickets = players.filter(row => row.wickets > 0).sort((a, b) => b.wickets - a.wickets || byName(a, b));
  const minimumStrikeRateBalls = 10;
  const highestStrikeRate = players.filter(row => row.ballsFaced >= minimumStrikeRateBalls)
    .sort((a, b) => b.runs * a.ballsFaced - a.runs * b.ballsFaced || byName(a, b));

  return <>
    <div className="tournament-boundaries"><StatFigures figures={[[ 'Tournament fours', totals.fours], ['Tournament sixes', totals.sixes]]} /></div>
    <div className="tournament-leaders">
      {[
        { title: 'Most runs', rows: mostRuns, value: (row: typeof players[number]) => row.runs },
        { title: 'Most wickets', rows: mostWickets, value: (row: typeof players[number]) => row.wickets },
        { title: 'Highest strike rate', rows: highestStrikeRate, value: (row: typeof players[number]) => strikeRate(row.runs, row.ballsFaced),
          qualification: `Minimum ${minimumStrikeRateBalls} balls faced` },
      ].map(({ title, rows, value, qualification }) => <section className="panel padded" key={title}>
        <h2>{title}</h2>
        {qualification && <p className="updated">{qualification}</p>}
        {rows.length ? <ol className="row-list">{rows.slice(0, 10).map((row, index) => <li key={row.player.id}>
          <SiteLink to={'/players/' + row.player.id}>
            <span className="leader-rank" aria-label={'Rank ' + (index + 1)}>{index + 1}</span>
            <Avatar player={row.player} /><strong>{row.player.name}</strong><b>{value(row)}</b>
          </SiteLink>
        </li>)}</ol> : <p className="updated">No qualifying figures yet.</p>}
      </section>)}
    </div>
  </>;
}

function HistoryPage({ data }: { data: Tournament }) {
  return <div className="shell page"><PageTitle title="History" /><div className="history-grid">{data.history.map(season => {
    const title = `Season ${season.season_number}${season.edition ? ` (${season.edition})` : ''}`;
    return <article className="panel history-card" key={season.id}>
      <div className="history-top"><Trophy size={23} /><h2>{title}</h2>{!!season.year && <span>{season.year}</span>}</div>
      <div className="history-body">
        {[
          { label: 'Champion', name: season.champion, logo: season.champion_logo, captain: season.champion_captain },
          { label: 'Runner-up', name: season.runner_up, logo: season.runner_up_logo, captain: season.runner_up_captain },
        ].map(({ label, name, logo, captain }) => <div className="history-team" key={label}>
          {logo && <img className="history-logo" src={fileUrl(season, logo)} alt="" loading="lazy" />}
          <div><small>{label}</small><strong>{name}</strong>{captain?.trim() && <p className="history-captain">Captain: {captain.trim()}</p>}</div>
        </div>)}
      </div>
      {[
        { role: 'Champion', name: season.champion, photo: season.team_photo },
        { role: 'Runner-up', name: season.runner_up, photo: season.runner_up_photo },
      ].map(({ role, name, photo }) => photo?.trim() && <figure className="history-photo" key={role}>
        <img src={publicDb.files.getURL(season, photo, { thumb: '960x0' })} alt={`${name} team photo, ${title} ${role.toLowerCase()}`} loading="lazy" decoding="async" />
        <figcaption>{role} · {name}</figcaption>
      </figure>)}
    </article>;
  })}</div>{!data.history.length && <Empty title="The archive is coming soon">Champion and runner-up records will appear as they are added.</Empty>}</div>;
}

function Missing({ noun }: { noun: string }) {
  return <div className="shell page"><BackLink to="/">Home</BackLink><Empty title={noun + ' unavailable'}>Check the link or return to Home.</Empty></div>;
}

createRoot(document.getElementById('root')!, {
  onUncaughtError() {
    const root = document.getElementById('root')!;
    root.replaceChildren();
    const panel = document.createElement('div');
    panel.className = 'shell page';
    const title = document.createElement('h1');
    title.textContent = 'Crick English';
    const message = document.createElement('p');
    message.textContent = 'The page could not load. Please reload to try again.';
    const reload = document.createElement('button');
    reload.className = 'button primary';
    reload.textContent = 'Reload website';
    reload.onclick = () => {
      const url = new URL(location.href);
      url.searchParams.set('refresh', String(Date.now()));
      location.replace(url.href);
    };
    panel.append(title, message, reload);
    root.append(panel);
  },
}).render(<BrowserRouter><App /></BrowserRouter>);

