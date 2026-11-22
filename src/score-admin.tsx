import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ChevronLeft, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { oversText, staffDb, type Match, type Tournament } from './data';
import { deliveryLabel, signedRuns, dismissals, publishScore, quickBall, scoreMatch, MATCH_OVERS, MAX_PLAYERS, type Delivery, type Dismissal, type InningsLog, type InningsState, type Lineup, type MatchLog, type Opening, type Play } from './scoring';
import { Avatar, Crest, Empty } from './ui';
import { CompactSelect } from './compact-select';

export type MatchWithLog = Match & { scoring: MatchLog | null; score_token: string };

export function ScoreAdmin({ id, data, onMatchSaved }: { id: string; data: Tournament; onMatchSaved: (match: Match) => void }) {
  const [match, setMatch] = useState<MatchWithLog>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const savingNow = useRef(false);
  const names = Object.fromEntries(data.teams.map(team => [team.id, team.name]));
  const collection = staffDb.collection('ce_matches');

  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    staffDb.collection('ce_matches').getOne<MatchWithLog>(id, { signal: abort.signal, requestKey: null }).then(value => {
      if (!abort.signal.aborted) { setMatch(value); onMatchSaved(value); setLoadError(''); }
    }).catch(() => {
      if (!abort.signal.aborted) setLoadError('Could not open scoring. Check your connection and try again.');
    }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [id, reload, onMatchSaved]);

  async function save(next: MatchLog) {
    if (!match || savingNow.current) return false;
    setError('');
    let payload: ReturnType<typeof publishScore>;
    try { payload = publishScore(next, names); }
    catch (failure) { setError((failure as Error).message); return false; }
    savingNow.current = true;
    setSaving(true);
    const score_token = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
    try {
      const saved = await collection.update<MatchWithLog>(match.id, {
        ...payload, scoring: next, score_token, score_parent: match.score_token ?? '',
      }, { requestKey: null, signal: AbortSignal.timeout(10000) });
      setMatch(saved); onMatchSaved(saved); return true;
    } catch {
      try {
        const latest = await collection.getOne<MatchWithLog>(match.id, { requestKey: null, signal: AbortSignal.timeout(5000) });
        setMatch(latest); onMatchSaved(latest);
        if (latest.score_token === score_token) return true;
        else if (latest.score_token !== match.score_token) {
          setError('Another scoring session changed this match. The saved score is now shown. Review it before entering the ball again.');
          return true;
        } else setError('This entry was not saved. Check your connection and try again.');
      } catch {
        setLoadError('Could not confirm the save. Reload the saved score before entering another ball.');
      }
    } finally {
      savingNow.current = false;
      setSaving(false);
    }
    return false;
  }

  return <ScoreEditor key={id} match={match} data={data} saving={saving} loading={loading}
    loadError={loadError} saveError={error} onSave={save} onReload={() => setReload(value => value + 1)} />;
}

export function ScoreEditor({ match, data, saving = false, loading = false, loadError = '', saveError = '', onSave, onReload, backTo = '/admin' }: {
  match?: MatchWithLog; data: Tournament; saving?: boolean; loading?: boolean; loadError?: string; saveError?: string;
  onSave: (next: MatchLog) => boolean | Promise<boolean>; onReload?: () => void; backTo?: string;
}) {
  const [error, setError] = useState('');
  const [details, setDetails] = useState<'wide' | 'noBall' | 'byes' | 'wicketMenu' | 'wicket' | 'replaceBatter' | 'endEarly' | 'adjustment' | number | null>(null);
  const [confirm, setConfirm] = useState<'reopen' | 'previous' | null>(null);
  const [superBatting, setSuperBatting] = useState('');
  const names = Object.fromEntries(data.teams.map(team => [team.id, team.name]));
  const playerName = (player: string) => data.players.find(item => item.id === player)?.name ?? 'Player';
  const log = match?.scoring;
  const entries = log?.superOver ?? log?.innings ?? [];
  const quota = log?.superOver ? 1 : log?.overs ?? MATCH_OVERS;
  const withEntries = (current: MatchLog, innings: InningsLog[]): MatchLog =>
    current.superOver ? { ...current, superOver: innings } : { ...current, innings };
  let score: ReturnType<typeof scoreMatch> | undefined;
  let invalid = '';
  try { if (log) score = scoreMatch(log); }
  catch { invalid = 'This match contains a scoring entry that cannot be reopened.'; }

  async function save(next: MatchLog) {
    setError('');
    try {
      if (await onSave(next)) { setDetails(null); setConfirm(null); setSuperBatting(''); }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save the score.');
    }
  }

  function add(play: Play) {
    if (!log || log.outcome) return;
    const innings = entries.map((item, index) => index === entries.length - 1 ? { ...item, plays: [...item.plays, play] } : item);
    void save(withEntries(log, innings));
  }

  function undo() {
    if (!log || log.outcome) return;
    const index = entries.length - 1;
    if (!entries[index].plays.length) return;
    void save(withEntries(log, entries.map((item, n) => n === index ? { ...item, plays: item.plays.slice(0, -1) } : item)));
  }

  function correct(index: number, delivery: Delivery) {
    if (!log || log.outcome || !score) return;
    const current = entries[entries.length - 1];
    const original = current.plays[index];
    if (original?.type !== 'ball' || original.delivery.wicket || delivery.wicket) return;
    const editsFollow = current.plays.slice(index + 1).some(play => play.type !== 'adjustRuns' && play.type !== 'closeInnings');
    const swapped = (ball: Delivery) => !ball.boundary && ball.runs % 2 !== 0;
    if (editsFollow && ((original.delivery.kind === 'legal') !== (delivery.kind === 'legal') || swapped(original.delivery) !== swapped(delivery))) {
      setError('This change affects later deliveries. Undo back to this ball before changing the over count or strike.');
      return;
    }
    const plays = current.plays.map((entry, n): Play => n === index ? { type: 'ball', delivery } : entry);
    void save(withEntries(log, [...entries.slice(0, -1), { ...current, plays }]));
  }

  const active = score?.active;
  const playing = log?.lineups.find(side => side.team === active?.team);
  const fielding = log?.lineups.find(side => side.team !== active?.team);
  const nextBatters = active?.availableBatters ?? [];
  const currentLog = entries[entries.length - 1];
  const deliveryRows = new Map(active?.deliveries.map(row => [row.index, row]));
  const logEntries = currentLog?.plays.map((play, index) => ({ play, index }))
    .filter(({ play }) => play.type !== 'swap' && play.type !== 'bowler').reverse() ?? [];
  const logFormOpen = typeof details === 'number' || details === 'adjustment' || details === 'endEarly';
  const formError = error || saveError;
  const wicketFormOpen = details === 'wicket';

  function showLogForm(next: number | 'adjustment' | 'endEarly') {
    setConfirm(null);
    setDetails(details === next ? null : next);
    setError('');
  }

  function closeDetails() {
    setDetails(null);
    setError('');
  }
  const statusLabel = log?.outcome === 'final' ? 'Final result' : log?.outcome === 'noResult' ? 'No result' : active?.done ? (entries.length === 1 ? 'Innings break' : 'Ready to finalize') : 'Live';

  const wicketOpen = details === 'wicketMenu' || details === 'wicket' || details === 'replaceBatter';
  function toggleDetails(mode: 'wide' | 'noBall' | 'byes' | 'wicketMenu') {
    setConfirm(null);
    setDetails((mode === 'wicketMenu' ? wicketOpen : details === mode) ? null : mode);
    setError('');
  }

  return <div className="shell page scorer-page">
    <div className="scorer-top">
      <Link className="back-link score-back" to={backTo} onClick={event => { if (saving) event.preventDefault(); }}><ChevronLeft size={16} /> Matches</Link>
      {saving ? <p className="updated" role="status">Saving score…</p> : log && score && <span className={'scorer-status ' + (!log.outcome && !active?.done ? 'is-live' : '')}>{statusLabel}</span>}
    </div>
    {formError && !logFormOpen && !wicketFormOpen && details !== 'byes' && <p className="error" role="alert">{formError}</p>}
    {loading ? <Empty title="Loading match…" /> : loadError ? <div className="panel padded"><p role="alert">{loadError}</p>{onReload && <button className="quiet" type="button" onClick={onReload}>Reload score</button>}</div> :
      invalid ? <p className="error" role="alert">{invalid}</p> :
      match && !log ? (match.status === 'scheduled' ? <MatchSetup match={match} data={data} disabled={saving} start={save} /> :
        <Empty title="Existing scorecard">This scorecard was entered as a summary. Open a scheduled match for ball-by-ball scoring.</Empty>) :
      match && log && score && active && playing && fielding && currentLog ? <>
        <div className="detail-score panel scorer-summary">
          {log.lineups.map(side => {
            const innings = score.innings.find(item => item.team === side.team);
            return <div key={side.team}><div className="scorer-team-name"><Crest team={data.teams.find(team => team.id === side.team)} /><strong>{names[side.team]}</strong></div>
              {innings ? <p className="scorer-figure">{innings.runs}/{innings.wickets} <small>({oversText(innings.balls)} ov)</small></p> :
                <p className="scorer-pending">Yet to bat</p>}
              {innings?.endedEarly && <p className="scorer-pending">Innings ended early</p>}
            </div>;
          })}
          {match.scorecard?.result && <p className="score-result">{match.scorecard.result}</p>}
        </div>
        {score.superOver && <section className="panel padded"><h2>Super Over</h2>
          {score.superOver.innings.map(innings => <p key={innings.team}>{names[innings.team]} · {innings.runs}/{innings.wickets} ({oversText(innings.balls)} ov)</p>)}
        </section>}
        {log.outcome ? <div className="panel padded scoring-actions"><button className="quiet" disabled={saving} onClick={() => setConfirm('reopen')}>Reopen for correction</button></div> :
          <div className="two-col scorer-grid">
            <section className="panel padded scorer-controls">
              {active.done ? entries.length === 1 ? <>
                <h2>{log.superOver ? 'Start the Super Over chase' : 'Start the chase'}</h2>
                <OpeningForm key={playing.team + ':chase'} batting={fielding} fielding={playing} playerName={playerName} disabled={saving || logFormOpen} action="Start second innings"
                  onOpen={opening => save(withEntries(log, [...entries, { team: fielding.team, opening, plays: [] }]))} />
              </> : <>
                <h2>Review result</h2><p>{match.scorecard?.result}</p>
                <div className="scoring-actions">
                  <button className="button primary" disabled={saving || logFormOpen} onClick={() => save({ ...log, outcome: 'final' })}>
                    {!score.superOver && score.tied ? 'Finalize as tie' : 'Finalize result'}
                  </button>
                  {!score.superOver && score.tied && !superBatting &&
                    <button className="quiet" disabled={saving || logFormOpen} onClick={() => setSuperBatting(playing.team)}>Set up Super Over</button>}
                </div>
                {!score.superOver && score.tied && superBatting && <>
                  <CompactSelect label="Super Over batting first" value={superBatting} onChange={setSuperBatting} disabled={saving}
                    options={log.lineups.map(side => ({ value: side.team, label: names[side.team] }))} />
                  <OpeningForm key={superBatting} batting={log.lineups.find(side => side.team === superBatting)!}
                    fielding={log.lineups.find(side => side.team !== superBatting)!} playerName={playerName} action="Start Super Over"
                    disabled={saving || logFormOpen} onOpen={opening => save({ ...log, superOver: [{ team: superBatting, opening, plays: [] }] })} />
                </>}
              </> : <>
                <h2>Enter delivery</h2>
                <dl className="crease">
                  {([
                    ['On strike', active.striker, 'crease-striker'],
                    ['Non-striker', active.partner, 'crease-partner'],
                    ['Bowler', active.bowler, 'crease-bowler'],
                  ] as const).map(([role, id, className]) => {
                    const player = data.players.find(row => row.id === id);
                    const figures = (score.superOver?.players ?? score.players).find(row => row.player === id);
                    const bowling = role === 'Bowler';
                    const runs = bowling ? figures?.runs_conceded : figures?.runs;
                    const balls = bowling ? figures?.balls_bowled : figures?.balls_faced;
                    return <div key={role} className={className}>
                      <dt>{role}</dt>
                      <dd>{player && <Avatar player={player} />}{id ? playerName(id) : 'Select next bowler'}</dd>
                      {figures && <dd className="crease-figures" aria-label={runs + (bowling ? ' runs conceded in ' : ' runs from ') + balls + ' balls'}>
                        {runs} <small>({balls})</small>
                      </dd>}
                    </div>;
                  })}
                </dl>
                {active.bowler ? <div className="scoring-buttons" aria-label="Score a delivery">
                  {[0, 1, 2, 3, 4, 6].map(runs => <button key={runs} type="button" className="quiet" disabled={saving || details !== null}
                    onClick={() => add(quickBall(runs))}>{runs}</button>)}
                  <button className="quiet score-event" disabled={saving} aria-pressed={details === 'wide'} onClick={() => toggleDetails('wide')}>Wide +</button>
                  <button className="quiet score-event" disabled={saving} aria-pressed={details === 'noBall'} onClick={() => toggleDetails('noBall')}>No-ball +</button>
                  <button className="quiet score-event" disabled={saving} aria-expanded={wicketOpen} onClick={() => toggleDetails('wicketMenu')}>Wicket</button>
                </div> : <>
                  <NextBowler key={active.previousBowler + active.balls} lineup={fielding} active={active} playerName={playerName} disabled={saving || logFormOpen}
                    onPick={player => add({ type: 'bowler', player })} />
                  <div className="scoring-actions"><button className="quiet" type="button" disabled={saving}
                    aria-expanded={wicketOpen} onClick={() => toggleDetails('wicketMenu')}>Wicket</button></div>
                </>}
              </>}
              {details === 'wicketMenu' && !active.done && <div className="scoring-actions wicket-options" role="group" aria-label="Wicket options">
                {active.bowler && <button className="button primary small" type="button" disabled={saving} onClick={() => setDetails('wicket')}>Record wicket</button>}
                <button className="quiet" type="button" disabled={saving || !nextBatters.length}
                  onClick={() => setDetails('replaceBatter')}>Replace batter</button>
              </div>}
              {details === 'replaceBatter' && !active.done &&
                <BatterReplacement active={active} available={nextBatters} playerName={playerName} disabled={saving}
                  onSave={(outgoing, incoming) => add({ type: 'replaceBatter', outgoing, incoming })}
                  onCancel={() => setDetails('wicketMenu')} />}
              {(details === 'wide' || details === 'noBall') && !active.done &&
                <QuickExtras kind={details} disabled={saving} onSave={delivery => add({ type: 'ball', delivery })}
                  onCancel={() => setDetails(null)} />}
              {details === 'byes' && !active.done &&
                <ByesForm disabled={saving} error={formError} onCancel={closeDetails}
                  onSave={delivery => add({ type: 'ball', delivery })} />}
              {wicketFormOpen && !active.done &&
                <DeliveryForm active={active} playerName={playerName} nextBatters={nextBatters}
                  wicket error={formError} lastBall={active.balls === quota * 6 - 1}
                  disabled={saving} onCancel={closeDetails} onSave={delivery => add({ type: 'ball', delivery })} />}
              <div className="scoring-actions">
                {!active.done && <button className="quiet" disabled={saving || details !== null} onClick={() => add({ type: 'swap' })}>Swap strike</button>}
                {!active.done && active.bowler && <button className="quiet" disabled={saving} aria-expanded={details === 'byes'} onClick={() => toggleDetails('byes')}>Byes</button>}
                <button className="quiet" disabled={saving || !currentLog.plays.length || details !== null} onClick={undo}><RotateCcw size={15} /> Undo last entry</button>
                {(entries.length === 2 || log.superOver) && !currentLog.plays.length && <button className="quiet" disabled={saving || logFormOpen} onClick={() => setConfirm('previous')}>{log.superOver && entries.length === 1 ? 'Cancel Super Over' : 'Return to first innings'}</button>}
              </div>
            </section>
            <RecentDeliveries innings={active} />
            <section className="panel padded scorer-log"><h2>Delivery log</h2>
              {logEntries.length ? <ol className="delivery-log">{logEntries.map(({ play, index }) => {
                if (play.type === 'replaceBatter' || play.type === 'adjustRuns' || play.type === 'closeInnings') return <li key={index}>
                  <span className="delivery-number" aria-hidden="true">—</span><div>
                    {play.type === 'replaceBatter' ? <><strong>Batter replaced</strong><small>{playerName(play.outgoing)} → {playerName(play.incoming)}</small></> :
                      <strong>{play.type === 'closeInnings' ? 'Innings ended early' : 'Run adjustment ' + signedRuns(play.runs)}</strong>}
                  </div>
                </li>;
                if (play.type !== 'ball') return null;
                const row = deliveryRows.get(index);
                if (!row) return null;
                const editing = details === index;
                return <li key={index} className={editing ? 'editing-delivery' : undefined}>
                  <div className="delivery-row">
                    <span className="delivery-number">{row.over}</span><div><strong>{row.label}</strong><small>{playerName(row.bowler)} to {playerName(row.batter)}</small></div>
                    {!row.wicket && <button className="quiet small" aria-label={'Edit delivery ' + row.over + ' entry ' + (index + 1)}
                      aria-expanded={editing} disabled={saving} onClick={() => showLogForm(index)}>Edit</button>}
                  </div>
                  {editing && <DeliveryForm active={active} playerName={playerName} nextBatters={nextBatters} lastBall={false} wicket={false}
                    edit={play.delivery} error={formError} disabled={saving} onCancel={closeDetails} onSave={delivery => correct(index, delivery)} />}
                </li>;
              })}</ol> : <p>No deliveries recorded yet.</p>}
              <div className="innings-tools">
                <div className="scoring-actions">
                  {!active.done && <button type="button" className="quiet" disabled={saving} aria-expanded={details === 'endEarly'}
                    onClick={() => showLogForm('endEarly')}>End innings early</button>}
                  <button type="button" className="quiet" disabled={saving} aria-expanded={details === 'adjustment'}
                    onClick={() => showLogForm('adjustment')}>Run adjustment / penalty</button>
                </div>
                {details === 'endEarly' && <div className="innings-tool-form" role="group" aria-label="End innings early">
                  <p>{entries.length === 1 ? 'End this innings at its current score and set the target for the chase?' :
                    'End the chase at its current score and review the result?'}</p>
                  {formError && <p className="error" role="alert">{formError}</p>}
                  <div className="form-actions">
                    <button type="button" className="button primary" disabled={saving} onClick={() => add({ type: 'closeInnings' })}>Confirm end innings</button>
                    <button type="button" className="quiet" disabled={saving} onClick={closeDetails}>Cancel</button>
                  </div>
                </div>}
                {details === 'adjustment' && <RunAdjustmentForm team={names[active.team] ?? 'Batting team'} error={formError}
                  disabled={saving} onCancel={closeDetails} onSave={runs => add({ type: 'adjustRuns', runs })} />}
              </div>
            </section>
          </div>}
        {confirm && <div className="panel padded scoring-confirm" role="group" aria-label="Confirm score change">
          <p>{confirm === 'reopen' ? 'Reopen this result for scoring corrections? The points table will update when you finalize it again.' :
            log.superOver && entries.length === 1 ? 'Cancel Super Over setup and return to the tied result?' : 'Return to the first innings? You can set up the chase again after making corrections.'}</p>
          <div className="scoring-actions"><button className="button primary" disabled={saving} onClick={() => {
            if (confirm === 'previous') void save(log.superOver && entries.length === 1 ? { ...log, superOver: undefined } : withEntries(log, entries.slice(0, 1)));
            else void save({ ...log, outcome: undefined });
          }}>Confirm</button><button className="quiet" disabled={saving} onClick={() => setConfirm(null)}>Cancel</button></div>
        </div>}
      </> : null}
  </div>;
}

function RunAdjustmentForm({ team, error, disabled, onSave, onCancel }: {
  team: string; error: string; disabled: boolean; onSave: (runs: number) => void; onCancel: () => void;
}) {
  const [deduct, setDeduct] = useState(false);
  return <form className="editor innings-tool-form" aria-label="Run adjustment" onSubmit={event => {
    event.preventDefault();
    const runs = Number(new FormData(event.currentTarget).get('runs'));
    onSave(deduct ? -runs : runs);
  }}>
    <p>Adjust team total · <strong>{team}</strong></p>
    <div className="tabs" aria-label="Adjustment direction">
      <button type="button" aria-pressed={!deduct} disabled={disabled} onClick={() => setDeduct(false)}>Add runs</button>
      <button type="button" aria-pressed={deduct} disabled={disabled} onClick={() => setDeduct(true)}>Deduct runs</button>
    </div>
    <label>Runs<input name="runs" type="number" inputMode="numeric" min={1} required step={1} /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="form-actions">
      <button className="button primary" disabled={disabled}>Apply adjustment</button>
      <button type="button" className="quiet" disabled={disabled} onClick={onCancel}>Cancel</button>
    </div>
  </form>;
}

function RecentDeliveries({ innings }: { innings: InningsState }) {
  const groups: { over: number; deliveries: InningsState['deliveries'] }[] = [];
  for (const delivery of innings.deliveries.slice(-12)) {
    const over = Number(delivery.over.split('.')[0]) + 1;
    let group = groups[groups.length - 1];
    if (!group || group.over !== over) {
      group = { over, deliveries: [] };
      groups.push(group);
    }
    group.deliveries.push(delivery);
  }
  return <section className="panel scorer-recent" aria-label="Recent deliveries">
    <h2>Recent balls</h2>
    {groups.length ? <div className="scorer-recent-overs">{[...groups].reverse().map(group =>
      <div className="scorer-recent-over" key={group.over}>
        <span className="scorer-over-label">Over {group.over}</span>
        <div className="scorer-over-balls">{[...group.deliveries].reverse().map(ball =>
          <span className={'ball ' + (ball.wicket ? 'ball-W' : ball.label === '4' || ball.label === '6' ? 'ball-' + ball.label : '')}
            key={ball.index} aria-label={'Over ' + group.over + ', ' + ball.over + ', ' + ball.label}>{ball.label}</span>)}</div>
      </div>)}</div> : <p>No deliveries yet.</p>}
  </section>;
}

function MatchSetup({ match, data, disabled, start }: { match: Match; data: Tournament; disabled: boolean; start: (log: MatchLog) => void }) {
  const teamIds = [match.team_a, match.team_b];
  const [battingTeam, setBattingTeam] = useState(teamIds[0]);
  const [lineups, setLineups] = useState<[Lineup, Lineup]>(() => [match.team_a, match.team_b].map(team => ({
    team, players: data.players.filter(player => player.team === team).map(player => player.id).slice(0, MAX_PLAYERS),
  })) as [Lineup, Lineup]);
  const batting = lineups.find(side => side.team === battingTeam)!;
  const fielding = lineups.find(side => side.team !== battingTeam)!;
  const playerName = (id: string) => data.players.find(player => player.id === id)?.name ?? 'Player';
  const valid = !!match.team_a && !!match.team_b && match.team_a !== match.team_b &&
    lineups[0].players.length === lineups[1].players.length && lineups[0].players.length >= 2 && lineups[0].players.length <= MAX_PLAYERS;
  return <div className="two-col scorer-grid">
    <section className="panel padded"><h2>Playing squads</h2>
      <p className="updated">{!match.team_a || !match.team_b ? 'Set both teams in Manage before starting scoring.' : 'Any selected player can bat or bowl.'}</p>
      <div className="two-col">{lineups.map((side, index) => <fieldset className="lineup-checks" key={side.team}>
        <legend>{data.teams.find(team => team.id === side.team)?.name} ({side.players.length})</legend>
        {data.players.filter(player => player.team === side.team).map(({ id: player }) => <label key={player}>
          <input type="checkbox" checked={side.players.includes(player)} disabled={disabled || (side.players.length >= MAX_PLAYERS && !side.players.includes(player))} onChange={event => {
            const next: [Lineup, Lineup] = [...lineups];
            next[index] = { ...side, players: event.target.checked ? [...side.players, player] : side.players.filter(id => id !== player) };
            setLineups(next);
          }} />{playerName(player)}
        </label>)}
      </fieldset>)}</div>
      {!valid && <p className="updated">Choose the same number of players per side (2–11).</p>}
    </section>
    <section className="panel padded score-setup"><h2>First innings</h2>
      <CompactSelect label="Batting first" value={battingTeam} disabled={disabled} onChange={setBattingTeam}
        options={lineups.map(side => ({ value: side.team, label: data.teams.find(team => team.id === side.team)?.name ?? 'Team' }))} />
      <OpeningForm key={battingTeam + ':' + lineups.map(side => side.players.join(',')).join(':')} batting={batting} fielding={fielding}
        playerName={playerName} action="Start match" disabled={disabled || !valid}
        onOpen={opening => start({ version: 1, overs: MATCH_OVERS, lineups, innings: [{ team: battingTeam, opening, plays: [] }] })} />
    </section>
  </div>;
}

function PlayerSelect({ label, name, ids, playerName, previousBowler, disabled }: {
  label: string; name: string; ids: string[]; playerName: (id: string) => string; previousBowler?: string; disabled?: boolean;
}) {
  return <CompactSelect label={label} name={name} required disabled={disabled}
    options={ids.map(id => ({ value: id, label: playerName(id) + (id === previousBowler ? ' (bowled last over)' : ''), disabled: id === previousBowler }))} />;
}
function OpeningForm({ batting, fielding, playerName, action, disabled, onOpen }: {
  batting: Lineup; fielding: Lineup; playerName: (id: string) => string; action: string; disabled: boolean; onOpen: (opening: Opening) => void;
}) {
  return <form className="editor" onSubmit={event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onOpen({ striker: String(form.get('striker')), partner: String(form.get('partner')), bowler: String(form.get('bowler')) });
  }}>
    <PlayerSelect label="Striker" name="striker" ids={batting.players} playerName={playerName} disabled={disabled} />
    <PlayerSelect label="Non-striker" name="partner" ids={batting.players} playerName={playerName} disabled={disabled} />
    <PlayerSelect label="Opening bowler" name="bowler" ids={fielding.players} playerName={playerName} disabled={disabled} />
    <button className="button primary" disabled={disabled}>{action}</button>
  </form>;
}

function NextBowler({ lineup, active, playerName, disabled, onPick }: {
  lineup: Lineup; active: InningsState; playerName: (id: string) => string; disabled: boolean; onPick: (player: string) => void;
}) {
  return <form className="editor" onSubmit={event => {
    event.preventDefault(); onPick(String(new FormData(event.currentTarget).get('bowler')));
  }}><PlayerSelect name="bowler" label="Next bowler" ids={lineup.players} playerName={playerName} previousBowler={active.previousBowler} disabled={disabled} />
    <button className="button primary" disabled={disabled}>Set bowler</button>
  </form>;
}

function BatterReplacement({ active, available, playerName, disabled, onSave, onCancel }: {
  active: InningsState; available: string[]; playerName: (id: string) => string; disabled: boolean;
  onSave: (outgoing: string, incoming: string) => void; onCancel: () => void;
}) {
  return <form className="panel padded editor delivery-form" onSubmit={event => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    onSave(String(fields.get('outgoing')), String(fields.get('incoming')));
  }}>
    <h3>Replace batter</h3>
    <p className="updated">The incoming batter takes the same end. The score stays the same.</p>
    <CompactSelect label="Leaving batter" name="outgoing" required defaultValue={active.striker} disabled={disabled} options={[
      { value: active.striker, label: playerName(active.striker) + ' (on strike)' },
      { value: active.partner, label: playerName(active.partner) + ' (non-striker)' },
    ]} />
    <PlayerSelect label="Incoming batter" name="incoming" ids={available} playerName={playerName} disabled={disabled} />
    <div className="form-actions">
      <button className="button primary" disabled={disabled || !available.length}>Confirm replacement</button>
      <button className="quiet" type="button" disabled={disabled} onClick={onCancel}>Cancel</button>
    </div>
  </form>;
}

function QuickExtras({ kind, disabled, onSave, onCancel }: {
  kind: 'wide' | 'noBall'; disabled: boolean; onSave: (delivery: Delivery) => void; onCancel: () => void;
}) {
  const choices = kind === 'wide' ? [1, 2, 4] : [1, 2, 3, 4, 6];
  function record(runs: number) {
    onSave({ kind, runType: 'bat', runs, boundary: runs === 4 || runs === 6 ? runs : undefined });
  }
  return <div className="quick-extras" role="group" aria-label={kind === 'wide' ? 'Wide runs' : 'No-ball runs'}>
    <div className="quick-extras-top">
      <span>Additional runs <small>+1 penalty added automatically</small></span>
      <button className="quiet small" type="button" disabled={disabled} onClick={onCancel}>Cancel</button>
    </div>
    <div className="quick-extras-choices">
      <button className="quiet" type="button" disabled={disabled} onClick={() => record(0)}>{kind === 'wide' ? 'Wide only' : 'No-ball only'}</button>
      {choices.map(runs => <button className="quiet" type="button" disabled={disabled} key={runs} onClick={() => record(runs)}>{runs}</button>)}
    </div>
  </div>;
}

function ByesForm({ disabled, error, onSave, onCancel }: {
  disabled: boolean; error: string; onSave: (delivery: Delivery) => void; onCancel: () => void;
}) {
  const [runType, setRunType] = useState<'bye' | 'legBye'>('bye');
  return <form className="panel padded editor delivery-form byes-form" aria-label="Record byes" onSubmit={event => {
    event.preventDefault();
    const runs = Number(new FormData(event.currentTarget).get('runs'));
    onSave({ kind: 'legal', runType, runs });
  }}>
    <div className="tabs" role="group" aria-label="Type of bye">
      <button type="button" disabled={disabled} aria-pressed={runType === 'bye'} onClick={() => setRunType('bye')}>Bye</button>
      <button type="button" disabled={disabled} aria-pressed={runType === 'legBye'} onClick={() => setRunType('legBye')}>Leg bye</button>
    </div>
    <label>Runs<input name="runs" type="number" inputMode="numeric" min={1} max={20} defaultValue={1} required disabled={disabled} /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="form-actions">
      <button className="button primary" disabled={disabled}>Save byes</button>
      <button type="button" className="quiet" disabled={disabled} onClick={onCancel}>Cancel</button>
    </div>
  </form>;
}

function DeliveryForm({ active, nextBatters, playerName, lastBall, wicket, edit, error, disabled, onSave, onCancel }: {
  active: InningsState; nextBatters: string[]; playerName: (id: string) => string; lastBall: boolean; wicket: boolean; edit?: Delivery; error?: string;
  disabled: boolean; onSave: (delivery: Delivery) => void; onCancel: () => void;
}) {
  const [kind, setKind] = useState<Delivery['kind']>(edit?.kind ?? 'legal');
  const [runType, setRunType] = useState<Delivery['runType']>(edit?.runType ?? 'bat');
  const [runs, setRuns] = useState(wicket ? '' : String(edit?.runs ?? 0));
  const [extraRuns, setExtraRuns] = useState(false);
  const showRuns = !wicket || extraRuns;
  const [boundary, setBoundary] = useState(!!edit?.boundary);
  const canBeBoundary = Number(runs) === 4 || (Number(runs) === 6 && kind !== 'wide' && runType === 'bat');
  const [how, setHow] = useState<Dismissal>('Bowled');
  const cross = how === 'Run out' || how === 'Obstructing the field';
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const runs = showRuns ? Number(form.get('runs')) : 0;
    const awardedBoundary = form.has('boundary') ? (runs === 6 ? 6 : 4) : undefined;
    onSave({ kind, runType: kind === 'wide' || !showRuns ? 'bat' : runType,
      runs, boundary: awardedBoundary, wicket: wicket ? { how, player: String(form.get('out')), next: String(form.get('next') ?? ''),
        incomingOnStrike: form.has('incoming') } : undefined });
  }
  return <form className={'panel padded editor delivery-form' + (edit ? ' inline-delivery-form' : wicket ? ' wicket-form' : '')} onSubmit={submit}>
    <h3>{edit ? 'Edit delivery · ' + deliveryLabel(edit) : 'Wicket details'}</h3>
    <CompactSelect label={wicket ? "Ball type" : "Delivery"} value={kind} disabled={disabled} onChange={next => setKind(next as Delivery['kind'])} options={[
      { value: 'legal', label: 'Legal ball' }, { value: 'wide', label: 'Wide (+1)' }, { value: 'noBall', label: 'No-ball (+1)' },
    ]} />
    {wicket && <div className="wicket-extra-choice">
      <span id="wicket-extra-question">Extra runs?</span>
      <div className="tabs" role="group" aria-labelledby="wicket-extra-question">
        <button type="button" disabled={disabled} aria-pressed={!extraRuns} onClick={() => setExtraRuns(false)}>No</button>
        <button type="button" disabled={disabled} aria-pressed={extraRuns} onClick={() => setExtraRuns(true)}>Yes</button>
      </div>
    </div>}
    {showRuns && kind !== 'wide' && <CompactSelect label="Credit runs to" value={runType} disabled={disabled}
      onChange={next => setRunType(next as Delivery['runType'])} options={[
        { value: 'bat', label: 'Batter' }, { value: 'bye', label: 'Byes' }, { value: 'legBye', label: 'Leg byes' },
      ]} />}
    {showRuns && <label className={wicket && kind === 'wide' ? 'wicket-full' : undefined}>
      {edit ? 'Runs before penalty' : 'Extra runs excluding wide/no-ball penalty'}
      <input name="runs" type="number" inputMode="numeric" min={wicket ? 1 : 0} max={20}
        disabled={disabled} required value={runs} onChange={event => { setRuns(event.target.value); setBoundary(false); }} />
    </label>}
    {!wicket && <label className="check"><input type="checkbox" name="boundary" disabled={disabled || !canBeBoundary}
      checked={canBeBoundary && boundary} onChange={event => setBoundary(event.target.checked)} /> Boundary (4 or 6)</label>}
    {wicket && <>
      <CompactSelect label="Dismissal" value={how} disabled={disabled} onChange={next => setHow(next as Dismissal)}
        options={dismissals.map(value => ({ value, label: value }))} />
      <PlayerSelect label="Which batsman out?" name="out" ids={[active.striker, active.partner]} playerName={playerName} disabled={disabled} />
      {nextBatters.length > 0 && !(lastBall && kind === 'legal') && <>
        <PlayerSelect label="Next batter" name="next" ids={nextBatters} playerName={playerName} disabled={disabled} />
        {cross && <label className="check wicket-full"><input type="checkbox" name="incoming" /> Incoming batter at striker’s end before any over change</label>}
      </>}
    </>}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="form-actions"><button className="button primary" disabled={disabled}>{edit ? 'Save correction' : 'Save delivery'}</button>
      <button className="quiet" type="button" disabled={disabled} onClick={onCancel}>Cancel</button></div>
  </form>;
}
