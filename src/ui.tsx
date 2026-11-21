import { useState, type CSSProperties, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { CalendarDays, ChevronRight, CircleDot, Download, Trophy } from 'lucide-react';
import { dateText, fileUrl, oversText, stageLabel, timeText, type Match, type Player, type Team } from './data';
import { teamLogoBackground, teamLogoViewBox } from './team-logo';

export function SiteLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return <Link to={to} className={className}>{children}</Link>;
}
export function SiteNav({ to, children }: { to: string; children: ReactNode }) {
  return <NavLink to={to} end={to === '/'}>{children}</NavLink>;
}
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return <SiteLink className="back-link" to={to}><ChevronRight size={15} /> {children}</SiteLink>;
}

export function Layout({ children }: { children: ReactNode }) {
  return <>
    <header className="header"><div className="shell header-inner">
      <SiteLink className="brand" to="/"><span className="brand-mark" aria-hidden="true"><Trophy size={20} strokeWidth={2.3} /></span><span>Crick <em>English</em></span></SiteLink>
      <nav aria-label="Main navigation"><SiteNav to="/">Home</SiteNav><SiteNav to="/teams">Teams &amp; Players</SiteNav><SiteNav to="/points">Points &amp; Stats</SiteNav><SiteNav to="/history">History</SiteNav></nav>
      <div className="header-app">
        <details className="app-install-help">
          <summary className="app-download">
            <Download size={18} aria-hidden="true" />
            <span>Download app<small>Android only</small></span>
          </summary>
          <div className="app-install-note">
            <strong>Installing on Android</strong>
            <p>This APK is downloaded outside Google Play, so Android may show an installation warning. Confirm that you used this official download link, then allow installation from your browser if prompted.</p>
            <a className="app-download-confirm" href="https://github.com/madhu734/CE-app/releases/latest/download/Crick-English.apk"><Download size={17} aria-hidden="true" /> Download APK</a>
            <a href="https://github.com/madhu734/CE-app/releases" target="_blank" rel="noopener noreferrer">View releases &amp; download details <ChevronRight size={14} aria-hidden="true" /></a>
          </div>
        </details>
      </div>
    </div></header>
    <main>{children}</main>
    <footer className="footer"><div className="shell"><span>Crick English</span>
      <div className="footer-support"><strong>Need help?</strong><p>For questions, suggestions, or profile updates, email <a href="mailto:support@enggames.tech">support@enggames.tech</a>. To request an update, include your profile name, the information currently shown, and what should replace it. If you want to change your photo, attach the new one.</p></div>
    </div></footer>
  </>;
}

export function PageTitle({ kicker, title, children }: { kicker?: string; title: string; children?: ReactNode }) {
  return <div className="page-title">{kicker && <span className="kicker">{kicker}</span>}<h1>{title}</h1>{children}</div>;
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty"><CalendarDays size={24} /><strong>{title}</strong>{children && <div>{children}</div>}</div>;
}
export function Crest({ team }: { team?: Team }) {
  const [failedUrl, setFailedUrl] = useState('');
  const url = team?.logo ? fileUrl(team, team.logo) : '';
  const frame = teamLogoViewBox(team?.logo);
  const color = /^#[0-9a-f]{6}$/i.test(team?.color ?? '') ? team!.color : '#547cb9';
  return <span className="crest" aria-hidden="true" style={{ '--crest': color, background: team?.logo ? teamLogoBackground(team.logo) : undefined } as CSSProperties}>
    {url && failedUrl !== url ? frame
      ? <svg viewBox={frame.viewBox} preserveAspectRatio="xMidYMid meet"><image href={url}
          width={frame.width} height={frame.height} onError={() => setFailedUrl(url)} /></svg>
      : <img alt="" src={url} loading="lazy" onError={() => setFailedUrl(url)} />
      : team?.short_name ?? '—'}
  </span>;
}
export function Avatar({ player }: { player: Player }) {
  const [failedUrl, setFailedUrl] = useState('');
  const url = player.photo ? fileUrl(player, player.photo) : '';
  return <span className="avatar" aria-hidden="true">{url && failedUrl !== url ? <img src={url} alt="" loading="lazy" onError={() => setFailedUrl(url)} /> : player.name.split(/\s+/).slice(0, 2).map(value => value[0]).join('')}</span>;
}
export function Badge({ status }: { status: Match['status'] }) {
  const labels = { live: 'Live', scheduled: 'Upcoming', completed: 'Result', abandoned: 'Abandoned' };
  return <span className={'badge ' + status}>{status === 'live' && <CircleDot size={13} />}{labels[status]}</span>;
}
export function MatchCard({ match, teams }: { match: Match; teams: Team[] }) {
  return <SiteLink to={'/matches/' + match.id} className="match-card">
    <div className="match-meta"><Badge status={match.status} /><span>{stageLabel[match.stage]}</span></div>
    {[match.team_a, match.team_b].map((id, index) => {
      const team = teams.find(item => item.id === id);
      const score = match.scorecard?.innings.find(item => item.team === id);
      return <div className="match-team" key={index}><Crest team={team} /><strong>{team?.name ?? 'TBD'}</strong>
        {score && <span className="team-score"><strong>{score.runs}/{score.wickets}</strong> <small>({oversText(score.balls)})</small></span>}
      </div>;
    })}
    <div className="match-foot"><span>{match.scorecard?.result ?? (dateText(match.starts_at) + ' · ' + timeText(match.starts_at))}</span><ChevronRight size={17} /></div>
  </SiteLink>;
}
