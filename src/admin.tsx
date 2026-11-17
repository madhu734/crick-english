import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ClipboardList, LogOut, Pencil, Plus, ShieldCheck } from 'lucide-react';
import { dateText, emptyTournament, playerRoles, readTournament, staffDb, stageLabel, timeText, type Match, type Player, type Team } from './data';
import { Avatar, Crest, Empty, PageTitle } from './ui';
import { Link, useSearchParams } from 'react-router-dom';
import { ScoreAdmin } from './score-admin';
import { CompactSelect } from './compact-select';

type Section = 'matches' | 'teams' | 'players';
type Option = { value: string; label: string };
type Field = { name: string; label: string; type?: string; required?: boolean; maxLength?: number; min?: number; max?: number; options?: Option[] };
const sections: [Section, string, string][] = [
  ['matches', 'Matches', 'match'], ['teams', 'Teams', 'team'], ['players', 'Players', 'player'],
];
const validSession = () => staffDb.authStore.isValid && staffDb.authStore.record?.collectionName === 'ce_staff' && staffDb.authStore.record?.role === 'admin';
const option = (value: string, label: string): Option => ({ value, label });

export function Admin() {
  const [search] = useSearchParams();
  const scoringId = search.get('score');
  const [signedIn, setSignedIn] = useState(validSession);
  const [data, setData] = useState(emptyTournament);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const replaceMatch = useCallback((match: Match) => {
    setData(current => ({ ...current, matches: current.matches.map(row => row.id === match.id ? match : row) }));
  }, []);

  useEffect(() => staffDb.authStore.onChange(() => setSignedIn(validSession())), []);
  useEffect(() => {
    if (!signedIn) return;
    const abort = new AbortController();
    setLoading(true);
    readTournament(staffDb, abort.signal).then(setData).catch(() => {
      if (!abort.signal.aborted) setError('Could not load the admin records. Check the connection and try signing in again.');
    }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [signedIn]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setSaving(true); setError('');
    try {
      await staffDb.collection('ce_staff').authWithPassword(String(fields.get('email')), String(fields.get('password')));
      if (!validSession()) { staffDb.authStore.clear(); setError('This account needs committee admin access.'); }
    } catch { setError('Could not sign in. Check your committee email and password.'); }
    finally { setSaving(false); }
  }

  function signOut() {
    staffDb.authStore.clear();
    setData(emptyTournament); setError('');
  }

  if (!signedIn) return <div className="shell page narrow"><PageTitle title="Committee login" /><form className="panel padded login" onSubmit={login}>
    <label>Committee email<input type="email" name="email" autoComplete="username" required /></label>
    <label>Password<input type="password" name="password" autoComplete="current-password" required /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <button className="button primary" disabled={saving}><ShieldCheck size={17} /> {saving ? 'Signing in…' : 'Sign in'}</button>
  </form></div>;

  if (scoringId && !loading && data.season) return <ScoreAdmin key={scoringId} id={scoringId} data={data} onMatchSaved={replaceMatch} />;

  if (loading) return <div className="shell page"><Empty title="Loading records…" /></div>;
  return <TournamentAdmin data={data} refresh={async () => setData(await readTournament(staffDb))} onSignOut={signOut} loadError={error} />;
}

export function TournamentAdmin({ data, refresh, onSignOut, loadError = '', mobile = false, pendingMatches = [], online = true }: {
  data: typeof emptyTournament; refresh: () => Promise<void>; onSignOut?: () => void;
  loadError?: string; mobile?: boolean; pendingMatches?: string[]; online?: boolean;
}) {
  const [section, setSection] = useState<Section>('matches');
  const [editing, setEditing] = useState<string | null>(null);
  const editorRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (mobile && editing) editorRef.current?.scrollIntoView({ block: 'start' });
  }, [editing, mobile]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const teamOptions = data.teams.map(team => option(team.id, team.name));
  const fieldsBySection: Record<Section, Field[]> = {
    matches: [
      { name: 'team_a', label: 'Team A', options: teamOptions, required: true },
      { name: 'team_b', label: 'Team B', options: teamOptions, required: true },
      { name: 'starts_at', label: 'Date and time (Dhaka)', type: 'datetime-local', required: true },
      { name: 'stage', label: 'Stage', options: Object.entries(stageLabel).filter(([value]) => value !== 'group').map(([value, label]) => option(value, label)), required: true },
      { name: 'overs', label: 'Overs per innings', type: 'number', min: 1, max: 50, required: true },
      { name: 'published', label: 'Show on the public website', type: 'checkbox' },
    ],
    teams: [
      { name: 'name', label: 'Team name', required: true, maxLength: 100 },
      { name: 'short_name', label: 'Short name', required: true, maxLength: 8 },
      { name: 'color', label: 'Team color', type: 'color' },
      { name: 'logo', label: 'Team logo', type: 'file' },
    ],
    players: [
      { name: 'name', label: 'Player name', required: true, maxLength: 100 }, { name: 'batch', label: 'Batch', maxLength: 40 },
      { name: 'role', label: 'Playing role', required: true, options: playerRoles.map(role => option(role, role)) }, { name: 'team', label: 'Team', options: teamOptions }, { name: 'photo', label: 'Player photo', type: 'file' },
    ],
  };

  const records = data[section];
  const record = records.find(item => item.id === editing);
  const currentMatch = section === 'matches' ? record as Match | undefined : undefined;
  const scored = !!currentMatch && (currentMatch.status !== 'scheduled' || !!currentMatch.scorecard);
  const fields = fieldsBySection[section].filter(field => !scored || !['team_a', 'team_b', 'stage', 'overs'].includes(field.name));
  const sectionTitle = sections.find(([value]) => value === section)![2];
  const canAdd = online && (section === 'matches' ? data.teams.length >= 2 && !!data.season : section === 'teams' ? !!data.season : true);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setMessage('');
    if (!online || (mobile && !navigator.onLine)) { setError('Reconnect to PocketBase to save changes.'); return; }
    if (!validSession()) { setError('Could not authenticate with PocketBase. Reconnect and try again.'); onSignOut?.(); return; }
    const raw = new FormData(event.currentTarget);
    const payload = new FormData();
    for (const field of fields) {
      const value = raw.get(field.name);
      if (field.type === 'checkbox') { payload.append(field.name, String(raw.has(field.name))); continue; }
      if (value instanceof File) {
        if (value.size > 3 * 1024 * 1024) { setError(field.label + ' must be 3 MB or smaller.'); return; }
        if (value.size) payload.append(field.name, value);
        continue;
      }
      const trimmed = String(value ?? '').trim();
      if (field.required && !trimmed) { setError(field.label + ' is required.'); return; }
      if (field.type === 'datetime-local') {
        payload.append(field.name, new Date(trimmed + ':00+06:00').toISOString());
      } else if (trimmed || field.type !== 'number') payload.append(field.name, trimmed);
    }
    if (section === 'matches' && raw.has('team_a') && raw.get('team_a') === raw.get('team_b')) { setError('Choose two different teams.'); return; }
    if (!record && (section === 'teams' || section === 'matches')) {
      if (!data.season) { setError('Create an active season first.'); return; }
      payload.append('season', data.season.id);
      if (section === 'matches') payload.append('status', 'scheduled');
    }
    setSaving(true);
    try {
      const collection = staffDb.collection('ce_' + section);
      if (record) await collection.update(record.id, payload); else await collection.create(payload);
      setEditing(null);
      setMessage('Saved ' + sectionTitle + '.');
      try { await refresh(); }
      catch { setError('Saved successfully. Reload this page to update the list.'); }
    } catch (failure) {
      const response = (failure as { response?: { data?: Record<string, { message?: string }> } }).response?.data;
      const labels = fields.map(field => [field.name, field.label]);
      const detail = Object.entries(response ?? {}).map(([key, value]) => (labels.find(row => row[0] === key)?.[1] ?? key) + ' — ' + (value.message ?? 'invalid value')).join(' ');
      setError(detail || 'Could not save. Check that the entry is unique and that you are still signed in.');
    } finally { setSaving(false); }
  }

  const teamName = (key: string) => data.teams.find(team => team.id === key)?.name ?? 'Unknown team';
  function describe(item: typeof records[number]): [string, string] {
    switch (section) {
      case 'matches': { const row = item as Match; return [teamName(row.team_a) + ' vs ' + teamName(row.team_b), [dateText(row.starts_at), timeText(row.starts_at), row.published ? row.status : 'Draft'].join(' · ')]; }
      case 'teams': { const row = item as Team; return [row.name, row.short_name]; }
      case 'players': { const row = item as Player; return [row.name, [row.batch && 'Batch ' + row.batch, row.role, row.team && teamName(row.team)].filter(Boolean).join(' · ')]; }
    }
  }

  return <div className="shell page">
    <PageTitle kicker={data.season?.name} title="Tournament admin">{onSignOut && <button className="quiet logout" type="button" onClick={onSignOut}><LogOut size={16} /> Sign out</button>}</PageTitle>
    <div className="tabs admin-tabs">{sections.map(([key, label]) => <button key={key} aria-pressed={section === key} onClick={() => { setSection(key); setEditing(null); setError(''); setMessage(''); }} disabled={saving}>{label}</button>)}</div>
    {mobile && !online && <p className="notice" role="status">Connect to PocketBase to add or edit tournament records.</p>}
    {(error || loadError) && <p className="error" role="alert">{error || loadError}</p>}{message && <p className="success" role="status">{message}</p>}
    <div className="admin-grid">
      <section className="panel padded"><div className="section-heading"><h2>{sections.find(([key]) => key === section)?.[1]}</h2>
        <button className="button primary small" disabled={!canAdd || saving} onClick={() => { setEditing('new'); setError(''); setMessage(''); }}><Plus size={16} /> Add {sectionTitle}</button></div>
        {records.length ? <ul className="admin-list">{records.map(item => {
          const [title, subtitle] = describe(item);
          return <li key={item.id}>{section === 'players' && <Avatar player={item as Player} />}{section === 'teams' && <Crest team={item as Team} />}<div className="admin-record-name"><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}</div>
            <div className="match-admin-actions">{section === 'matches' && <Link className="quiet small" aria-label={'Score ' + title} to={mobile ? '/score/' + item.id : '/admin?score=' + item.id}>Score</Link>}
            <button className="quiet icon-button" disabled={!online || saving || (section === 'matches' && pendingMatches.includes(item.id))} aria-label={'Edit ' + title} onClick={() => { setEditing(item.id); setError(''); setMessage(''); }}><Pencil size={16} /></button></div>
          </li>;
        })}</ul> : <Empty title={'No ' + sections.find(([key]) => key === section)?.[1].toLowerCase() + ' yet'}>{!canAdd ? 'Add the required teams and players first.' : undefined}</Empty>}
      </section>
      {editing ? <form ref={editorRef} key={section + editing} onSubmit={save} className="panel padded editor">
        <h2>{record ? 'Edit ' : 'Add '}{sectionTitle}</h2>
        {fields.map(field => {
          const storedValue = record?.[field.name];
          const value = field.name === 'stage' && (storedValue === 'group' || !storedValue) ? 'league' : storedValue;
          if (field.type === 'checkbox') return <label className="check" key={field.name}><input name={field.name} type="checkbox" defaultChecked={Boolean(value)} /> {field.label}</label>;
          const date = value && field.type === 'datetime-local' ? new Date(new Date(String(value)).getTime() + 6 * 3600000).toISOString().slice(0, 16) : '';
          if (field.options) return <CompactSelect key={field.name} label={field.label} name={field.name}
            required={field.required} defaultValue={String(value ?? '')} options={field.options} disabled={saving || !online} />;
          return <label key={field.name}>{field.label}
            {field.type === 'file' ? <><input type="file" name={field.name} accept="image/jpeg,image/png,image/webp,image/avif" />{value && record && <div className="admin-current-image">{section === 'players' ? <Avatar player={record as Player} /> : <Crest team={record as Team} />}<small>Current image is kept unless replaced.</small></div>}</> :
              <input name={field.name} type={field.type ?? 'text'} required={field.required} maxLength={field.maxLength} min={field.min} max={field.max} defaultValue={
                field.type === 'datetime-local' ? date : String(value || (field.name === 'overs' ? 10 : field.type === 'color' ? '#547cb9' : ''))} />}
          </label>;
        })}
        <div className="form-actions"><button className="button primary" disabled={!online || saving}>{saving ? 'Saving…' : 'Save'}</button><button className="quiet" type="button" disabled={saving} onClick={() => setEditing(null)}>Cancel</button></div>
      </form> : <div className="panel padded admin-help"><ClipboardList size={23} /><p>Select an entry to edit it, or add a new one.</p></div>}
    </div>
  </div>;
}
