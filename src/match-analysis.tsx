import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { oversText, publicDb, runsPerOver, type Match, type Player, type Team } from './data';
import { scoreMatch, signedRuns, type InningsState, type MatchLog } from './scoring';

type Metric = 'runs' | 'wickets' | 'rate';
const metrics: Record<Metric, string> = { runs: 'Runs', wickets: 'Wickets', rate: 'Run rate' };
const colors = ['#2058b3', '#ac4724'];
type ChartPoint = InningsState['deliveries'][number] | InningsState['adjustments'][number];

export function MatchAnalysis({ match, teams, players }: { match: Match; teams: Team[]; players: Player[] }) {
  const [innings, setInnings] = useState<InningsState[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    publicDb.collection('ce_matches').getOne<{ scoring: MatchLog | null }>(match.id, {
      fields: 'scoring', signal: controller.signal, requestKey: null,
    }).then(row => {
      if (controller.signal.aborted) return;
      setInnings(row.scoring ? scoreMatch(row.scoring).innings : []);
      setStatus('ready');
    }).catch(() => { if (!controller.signal.aborted) setStatus('error'); });
    return () => controller.abort();
  }, [match.id, match.updated, retry]);

  const playerName = (id: string) => players.find(player => player.id === id)?.name ?? 'Player';
  const teamName = (id: string) => teams.find(team => team.id === id)?.name ?? 'Team';
  const selected = innings.find(inn => inn.team === selectedTeam) ?? innings[innings.length - 1];
  const overs = new Map<number, InningsState['deliveries']>();
  for (const ball of selected?.deliveries ?? []) {
    const over = Number(ball.over.split('.')[0]) + 1;
    if (!overs.has(over)) overs.set(over, []);
    overs.get(over)!.push(ball);
  }
  return <>
    <section className="panel padded match-analysis">
      <div className="section-heading"><h2>Ball by ball</h2>
        {innings.length > 1 && <div className="tabs" aria-label="Batting innings">{innings.map(inn =>
          <button key={inn.team} type="button" aria-pressed={inn.team === selected?.team} onClick={() => setSelectedTeam(inn.team)}>{teamName(inn.team)}</button>)}</div>}
      </div>
      {status === 'error' ? <div className="analysis-empty"><p>Could not load the ball log.</p><button className="quiet small" onClick={() => setRetry(n => n + 1)}>Try again</button></div> :
        status === 'loading' ? <p className="analysis-empty">Loading deliveries…</p> :
        !selected ? <p className="analysis-empty">Ball-by-ball data is unavailable for this scorecard.</p> :
        !overs.size ? <p className="analysis-empty">No deliveries recorded in this innings yet.</p> :
        <div className="over-list">{[...overs.entries()].reverse().map(([over, balls]) => {
          const last = balls[balls.length - 1];
          return <details key={selected.team + ':' + over} open={over === overs.size}>
            <summary><strong>Over {over}</strong><span>{last.totalRuns}/{last.totalWickets} ({oversText(last.legalBalls)} ov)</span></summary>
            <ol className="ball-events">{balls.map(ball => <li key={ball.index}>
              <span className="delivery-number">{ball.over}</span><span className={'ball ball-' + ball.label}>{ball.label}</span>
              <span>{playerName(ball.bowler)} to {playerName(ball.batter)}
                {ball.wicket && <small>{playerName(ball.wicket.player)} · {ball.wicket.how}</small>}</span>
              <span className="ball-total">{ball.totalRuns}/{ball.totalWickets}</span>
            </li>)}</ol>
          </details>;
        })}</div>}
      {!!selected?.adjustments.length && <ul className="analysis-adjustments" aria-label="Run adjustments">
        {selected.adjustments.map(point => <li key={point.index}>Run adjustment {signedRuns(point.runs)} · {oversText(point.legalBalls)} ov
          <strong>{point.totalRuns}/{point.totalWickets}</strong></li>)}</ul>}
    </section>
    {status === 'ready' && match.status === 'completed' && innings.length === 2 && innings.every(inn => inn.deliveries.length > 0) &&
      <InningsChart innings={innings} teamName={teamName} />}
  </>;
}

function InningsChart({ innings, teamName }: { innings: InningsState[]; teamName: (id: string) => string }) {
  const [metric, setMetric] = useState<Metric>('runs');
  const canvas = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const draw = () => drawInnings(element, innings, metric);
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    return () => observer.disconnect();
  }, [innings, metric]);

  return <section className="panel padded match-analysis">
    <div className="section-heading"><h2>Innings comparison</h2>
      <div className="tabs" aria-label="Chart metric">{Object.entries(metrics).map(([key, name]) =>
        <button key={key} type="button" aria-pressed={metric === key} onClick={() => setMetric(key as Metric)}>{name}</button>)}</div>
    </div>
    <div className="chart-key">{innings.map((inn, index) => <span key={inn.team}><i style={{ borderColor: colors[index] }} />
      {teamName(inn.team)}: <strong>{metric === 'rate' ? runsPerOver(inn.runs, inn.balls) : inn[metric]}</strong></span>)}</div>
    <canvas ref={canvas} role="img" aria-label={metrics[metric] + ' by overs for ' + innings.map(inn => teamName(inn.team)).join(' and ')} />
    {metric === 'runs' && <p className="analysis-empty">Circles mark wickets.</p>}
  </section>;
}

function drawInnings(canvas: HTMLCanvasElement, innings: InningsState[], metric: Metric) {
  const width = canvas.clientWidth, height = canvas.clientHeight;
  if (!width || !height) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  const left = 40, right = width - 15, top = 15, bottom = height - 41;
  const maxOvers = Math.max(1, Math.ceil(Math.max(...innings.map(i => i.balls)) / 6));
  const value = (ball: ChartPoint) => metric === 'runs' ? ball.totalRuns :
    metric === 'wickets' ? ball.totalWickets : ball.legalBalls ? 6 * ball.totalRuns / ball.legalBalls : 0;
  const series = innings.map(inn => [...inn.deliveries, ...inn.adjustments].sort((a, b) => a.index - b.index));
  const peak = Math.max(1, ...series.flatMap(points => points.map(value)));
  const step = Math.max(1, Math.ceil(peak / 5));
  const maxY = Math.ceil(peak / step) * step;
  const x = (balls: number) => left + balls / (maxOvers * 6) * (right - left);
  const y = (v: number) => bottom - v / maxY * (bottom - top);
  ctx.font = '11px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  for (let mark = 0; mark <= maxY; mark += step) {
    ctx.strokeStyle = '#dce4ef';
    ctx.beginPath(); ctx.moveTo(left, y(mark)); ctx.lineTo(right, y(mark)); ctx.stroke();
    ctx.fillStyle = '#43546d'; ctx.fillText(String(mark), left - 7, y(mark));
  }
  ctx.textAlign = 'center';
  const stride = Math.max(1, Math.ceil(maxOvers / (width < 480 ? 5 : 9)));
  for (let over = 0; over <= maxOvers; over += stride) ctx.fillText(String(over), x(over * 6), bottom + 15);
  ctx.fillText('Overs', (left + right) / 2, height - 8);
  series.forEach((events, index) => {
    const points = events.filter(ball => metric !== 'rate' || ball.legalBalls > 0);
    if (!points.length) return;
    ctx.beginPath();
    ctx.strokeStyle = colors[index]; ctx.lineWidth = 2.4; ctx.lineJoin = 'round';
    ctx.setLineDash(index === 1 ? [5, 3] : []);
    if (metric === 'rate') ctx.moveTo(x(points[0].legalBalls), y(value(points[0])));
    else ctx.moveTo(x(0), y(0));
    for (const point of points) ctx.lineTo(x(point.legalBalls), y(value(point)));
    ctx.stroke();
    ctx.setLineDash([]);
    const markers = metric === 'runs' ? points.filter(point => 'wicket' in point && point.wicket) : [];
    for (const point of [...markers, points[points.length - 1]]) {
      ctx.beginPath(); ctx.arc(x(point.legalBalls), y(value(point)), 3, 0, Math.PI * 2);
      ctx.fillStyle = colors[index]; ctx.fill();
    }
  });
}
