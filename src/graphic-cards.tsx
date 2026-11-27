import { useEffect, useState } from 'react';
import { statValue } from './recorded-stats';
import { Download, Image as ImageIcon } from 'lucide-react';
import { fileUrl, oversText, stageLabel, type Match, type Player, type PlayerStat, type Team } from './data';
import { teamLogoBackground, teamLogoFrame } from './team-logo';

const ink = '#101928';
const gold = '#f2cf84';
const paper = '#f7f1e5';
const pale = '#c5d1e3';
const accents = ['#315989', '#285e55', '#624179', '#863f46'];

async function portrait(url: string) {
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    return response.ok ? await createImageBitmap(await response.blob()) : null;
  } catch { return null; }
}

function teamAccent(team?: Team) {
  if (team && /^#[0-9a-f]{6}$/i.test(team.color)) return team.color;
  let hash = 0;
  for (const char of (team?.name ?? '')) hash = (Math.imul(31, hash) + char.codePointAt(0)!) >>> 0;
  return accents[hash % accents.length];
}

function canvas(height: number, accent: string) {
  const image = document.createElement('canvas');
  image.width = 2160;
  image.height = height * 2;
  const ctx = image.getContext('2d')!;
  ctx.scale(2, 2);
  const bg = ctx.createLinearGradient(0, height, 1080, 0);
  bg.addColorStop(0, '#080e1b');
  bg.addColorStop(.57, '#142238');
  bg.addColorStop(1, accent);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1080, height);
  ctx.strokeStyle = '#ffffff14';
  ctx.lineWidth = 1;
  for (let x = 500; x <= 1900; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - 840, height);
    ctx.stroke();
  }
  ctx.fillStyle = gold;
  ctx.fillRect(0, 0, 1080, 7);
  return { image, ctx };
}

function words(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, width: number, size: number, color = '#ffffff', display = false) {
  const family = display ? '"Barlow Condensed", "Arial Narrow", sans-serif' : '"Inter Variable", system-ui, sans-serif';
  ctx.font = `700 ${size}px ${family}`;
  const ratio = Math.min(1, width / (ctx.measureText(value).width || 1));
  if (ratio < 1) ctx.font = `700 ${Math.floor(size * ratio)}px ${family}`;
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

function box(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

function picture(ctx: CanvasRenderingContext2D, bitmap: ImageBitmap | null, initials: string, x: number, y: number,
                 width: number, height: number, radius: number, contain = false, logoFile?: string) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.clip();
  ctx.fillStyle = contain ? teamLogoBackground(logoFile) : '#293b55';
  ctx.fillRect(x, y, width, height);
  if (bitmap) {
    const [top, right, bottom, left] = teamLogoFrame(logoFile) ?? [0, 0, 0, 0];
    const sourceWidth = bitmap.width * (100 - left - right) / 100;
    const sourceHeight = bitmap.height * (100 - top - bottom) / 100;
    const scale = contain
      ? .88 * Math.min(width / sourceWidth, height / sourceHeight)
      : Math.max(width / sourceWidth, height / sourceHeight);
    const w = sourceWidth * scale;
    const h = sourceHeight * scale;
    ctx.drawImage(bitmap, bitmap.width * left / 100, bitmap.height * top / 100, sourceWidth, sourceHeight,
      x + (width - w) / 2, y + (height - h) * (contain ? .5 : .35), w, h);
  } else {
    ctx.textAlign = 'center';
    const size = Math.min(width, height) * (contain ? .32 : .39);
    if (contain) {
      const center = x + width / 2;
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.moveTo(center - 39, y + 28);
      ctx.lineTo(center + 39, y + 28);
      ctx.lineTo(center + 35, y + 87);
      ctx.lineTo(center, y + 111);
      ctx.lineTo(center - 35, y + 87);
      ctx.closePath();
      ctx.fill();
    }
    words(ctx, initials, x + width / 2, y + height / 2 + size * .32 - (contain ? 5 : 0),
      contain ? 65 : width * .8, size, gold, true);
  }
  ctx.restore();
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(word => [...word][0] ?? '').join('').toUpperCase();
}

function header(ctx: CanvasRenderingContext2D, season: string) {
  words(ctx, 'CRICK ENGLISH', 54, 71, 480, 39, '#ffffff', true);
  ctx.textAlign = 'right';
  words(ctx, season.toUpperCase(), 1026, 71, 395, 23, gold);
  ctx.textAlign = 'left';
}

function footer(ctx: CanvasRenderingContext2D, height: number) {
  box(ctx, 54, height - 65, 972, 1, 0, '#ffffff55');
  words(ctx, 'crickenglish.enggames.tech', 54, height - 32, 972, 19, pale);
}

export async function renderPlayerCard(player: Player, season: string, team?: Team) {
  const accent = teamAccent(team);
  const { image, ctx } = canvas(1350, accent);
  header(ctx, season);
  const [bitmap, crest] = await Promise.all([
    portrait(fileUrl(player, player.photo)),
    portrait(team ? fileUrl(team, team.logo) : ''),
  ]);
  box(ctx, 54, 110, 972, 1144, 28, paper);
  box(ctx, 54, 154, 8, 150, 4, accent);
  if (team) {
    picture(ctx, crest, team.short_name || initials(team.name), 94, 154, 194, 150, 18, true, team.logo);
    words(ctx, team.name.toUpperCase(), 322, 252, 656, 75, ink, true);
  } else {
    words(ctx, 'PLAYER PROFILE', 94, 252, 892, 75, ink, true);
  }
  crest?.close();
  box(ctx, 94, 345, 892, 2, 0, '#10192830');
  words(ctx, player.name.toUpperCase(), 91, 479, 895, 110, ink, true);

  box(ctx, 94, 541, 436, 596, 24, accent);
  picture(ctx, bitmap, initials(player.name), 94, 541, 436, 584, 24);
  bitmap?.close();
  const role = player.role.trim();
  const batch = player.batch.trim();
  if (role || batch) {
    box(ctx, 558, 541, 428, 596, 24, ink);
    box(ctx, 598, 590, 50, 4, 2, gold);
    if (role) {
      words(ctx, 'PLAYING ROLE', 598, 760, 348, 24, pale);
      words(ctx, role.toUpperCase(), 595, 837, 351, 69, '#ffffff', true);
    }
    if (batch) {
      if (role) box(ctx, 598, 996, 348, 1, 0, '#ffffff45');
      words(ctx, 'Batch ' + batch, 598, role ? 1052 : 849, 348, 26, pale);
    }
  }
  box(ctx, 94, 1194, 892, 2, 0, '#10192830');
  footer(ctx, 1350);
  return image;
}

export async function renderTeamCard(team: Team, season: string, players: Player[]) {
  const captain = players.find(player => player.id === team.captain);
  const leadership = [
    { role: 'OWNER', name: team.owner_name?.trim(), photo: fileUrl(team, team.owner_photo ?? '') },
    { role: 'MANAGER', name: team.manager_name?.trim(), photo: fileUrl(team, team.manager_photo ?? '') },
    { role: 'CAPTAIN', name: captain?.name, photo: captain ? fileUrl(captain, captain.photo) : '' },
  ].filter(person => person.name);
  const gridTop = leadership.length ? 448 : 322;
  const columns = players.length <= 4 ? Math.min(2, Math.max(1, players.length)) : players.length <= 9 ? 3 : 4;
  const rows = Math.ceil(players.length / columns);
  const tileWidth = Math.floor((972 - (columns - 1) * 16) / columns);
  const tileHeight = rows <= 1 ? 892 : rows === 2 ? 446 : 291;
  const height = Math.max(1350, gridTop + rows * (tileHeight + 16) + 77);
  const { image, ctx } = canvas(height, teamAccent(team));
  header(ctx, season);
  box(ctx, 54, 111, 972, 182, 23, paper);
  const crest = await portrait(fileUrl(team, team.logo));
  picture(ctx, crest, team.short_name || initials(team.name), 76, 132, 138, 138, 16, true, team.logo);
  crest?.close();
  words(ctx, team.name.toUpperCase(), 244, 214, 750, 77, ink, true);
  const subtitle = `SQUAD   /   ${players.length} ${players.length === 1 ? 'PLAYER' : 'PLAYERS'}`;
  words(ctx, subtitle, 247, 259, 747, 22, '#394a61');
  const leadershipPhotos = await Promise.all(leadership.map(person => portrait(person.photo)));
  const columnWidth = Math.floor(972 / Math.max(1, leadership.length));
  leadership.forEach((person, index) => {
    const x = 54 + columnWidth * index;
    const photo = leadershipPhotos[index];
    box(ctx, x, 311, columnWidth - 8, 108, 14, ink);
    picture(ctx, photo, initials(person.name!), x + 12, 323, 77, 84, 10);
    photo?.close();
    words(ctx, person.role, x + 103, 352, columnWidth - 122, 17, gold);
    words(ctx, person.name!, x + 103, 389, columnWidth - 122, 31, '#ffffff', true);
  });
  for (let offset = 0; offset < players.length; offset += 4) {
    await Promise.all(players.slice(offset, offset + 4).map(async (player, idx) => {
      const bitmap = await portrait(fileUrl(player, player.photo));
      const i = offset + idx;
      const row = Math.floor(i / columns);
      const rowCount = Math.min(columns, players.length - row * columns);
      const x = 54 + (columns - rowCount) * (tileWidth + 16) / 2 + i % columns * (tileWidth + 16);
      const y = gridTop + row * (tileHeight + 16);
      const textHeight = tileWidth >= 400 ? 95 : 67;
      picture(ctx, bitmap, initials(player.name), x, y, tileWidth, tileHeight, 14);
      bitmap?.close();
      const strip = y + tileHeight - textHeight;
      box(ctx, x, strip, tileWidth, textHeight, 12, '#101a2c');
      box(ctx, x + 12, strip + 13, 3, textHeight - 26, 1, gold);
      words(ctx, player.name + (player.id === team.captain ? ' (C)' : ''), x + 24, strip + textHeight * .48, tileWidth - 38, tileWidth >= 400 ? 37 : 28, '#ffffff', true);
      words(ctx, [player.role, player.batch && 'Batch ' + player.batch].filter(Boolean).join(' · '),
        x + 24, strip + textHeight * .79, tileWidth - 38, tileWidth >= 400 ? 20 : 14, pale);
    }));
  }
  if (!players.length) words(ctx, 'Squad pending', 54, gridTop + 78, 972, 42, pale, true);
  footer(ctx, height);
  return image;
}

const resultDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dhaka' });

export async function renderResultCard({ match, season, teams, players, stats, awarded }: {
  match: Match;
  season: string;
  teams: (Team | undefined)[];
  players: Player[];
  stats: PlayerStat[];
  awarded?: Player;
}) {
  const playerNames = new Map(players.map(player => [player.id, player.name]));
  const sides = [match.team_a, match.team_b].map((id, index) => {
    const rows = stats.filter(row => row.team === id);
    return {
      id,
      team: teams[index],
      name: teams[index]?.name ?? 'TBD',
      innings: match.scorecard?.innings.find(row => row.team === id),
      superOver: match.scorecard?.superOver?.innings.find(row => row.team === id),
      batters: rows.filter(row => row.batted)
        .sort((a, b) => b.runs - a.runs || a.balls_faced - b.balls_faced).slice(0, 2),
      bowlers: rows.filter(row => row.balls_bowled || row.wickets || row.runs_conceded)
        .sort((a, b) => b.wickets - a.wickets || a.runs_conceded - b.runs_conceded || b.balls_bowled - a.balls_bowled).slice(0, 2),
    };
  });
  const hasFigures = sides.some(side => side.batters.length || side.bowlers.length);
  const hasSuperOver = sides.some(side => side.superOver);
  const figuresTop = hasSuperOver ? 741 : 638;
  const bodyEnd = hasFigures ? figuresTop + 354 : hasSuperOver ? 727 : 624;
  const awardTop = hasFigures ? bodyEnd : bodyEnd + 24;
  const awardHeight = hasFigures ? 1242 - awardTop : 144;
  const height = Math.max(900, (awarded ? awardTop + awardHeight : bodyEnd) + 108);
  const { image, ctx } = canvas(height, '#293b66');
  const [crests, awardPhoto] = await Promise.all([
    Promise.all(sides.map(({ team }) => portrait(team ? fileUrl(team, team.logo) : ''))),
    awarded ? portrait(fileUrl(awarded, awarded.photo)) : Promise.resolve(null),
  ]);

  header(ctx, season);
  words(ctx, 'MATCH RESULT', 52, 175, 574, 86, '#ffffff', true);
  ctx.textAlign = 'right';
  words(ctx, stageLabel[match.stage].toUpperCase(), 1026, 132, 394, 22, gold);
  words(ctx, resultDate.format(new Date(match.starts_at)), 1026, 172, 394, 28, pale);
  ctx.textAlign = 'left';

  for (const [index, side] of sides.entries()) {
    const x = 54 + index * 495;
    box(ctx, x, 210, 477, 280, 24, ink);
    box(ctx, x + 21, 230, 435, 5, 3, match.winner === side.id ? gold : '#ffffff48');
    picture(ctx, crests[index], side.team?.short_name || initials(side.name), x + 25, 255, 112, 109, 13, true, side.team?.logo);
    crests[index]?.close();
    words(ctx, side.name.toUpperCase(), x + 153, 326, 298, 45, '#ffffff', true);
    box(ctx, x + 25, 383, 427, 1, 0, '#ffffff45');
    const { innings } = side;
    if (innings) {
      words(ctx, `${innings.runs}/${innings.wickets}`, x + 24, 460, 283, 86, '#ffffff', true);
      ctx.textAlign = 'right';
      words(ctx, oversText(innings.balls) + ' OVERS', x + 451, 452, 155, 24, pale);
      ctx.textAlign = 'left';
    } else {
      words(ctx, 'SCORE UNAVAILABLE', x + 25, 445, 427, 30, pale);
    }
  }

  const winner = sides.find(side => side.id === match.winner);
  const result = match.scorecard?.result?.trim() ||
    (match.status === 'abandoned' ? 'No result' : winner ? winner.name + ' won' : 'Match completed');
  box(ctx, 54, 512, 972, 100, 18, gold);
  ctx.textAlign = 'center';
  words(ctx, result.toUpperCase(), 540, 583, 906, 60, ink, true);
  ctx.textAlign = 'left';

  if (hasSuperOver) {
    box(ctx, 54, 632, 972, 77, 15, '#233252');
    const scores = sides.filter(side => side.superOver).map(side => {
      const innings = side.superOver!;
      return `${side.team?.short_name || side.name} ${innings.runs}/${innings.wickets} (${oversText(innings.balls)} ov)`;
    });
    words(ctx, 'SUPER OVER', 78, 680, 170, 24, gold);
    words(ctx, scores.join('    ·    '), 265, 681, 737, 34, '#ffffff', true);
  }

  if (hasFigures) {
    for (const [index, side] of sides.entries()) {
      const x = 54 + index * 495;
      box(ctx, x, figuresTop, 477, 328, 18, paper);
      const headings = [
        { title: match.scorecard?.entryMode === 'summary' ? 'RECORDED BATTERS' : 'TOP BATTERS', columns: 'RUNS (BALLS)', rows: side.batters, offset: 0 },
        { title: match.scorecard?.entryMode === 'summary' ? 'RECORDED BOWLERS' : 'TOP BOWLERS', columns: 'W/R (OV)', rows: side.bowlers, offset: 154 },
      ];
      for (const { title, columns, rows, offset } of headings) {
        const top = figuresTop + offset;
        words(ctx, title, x + 25, top + 42, 426, 24, '#394a61');
        ctx.textAlign = 'right';
        if (rows.length) words(ctx, columns, x + 451, top + 41, 121, 15, '#394a61');
        ctx.textAlign = 'left';
        if (!rows.length) words(ctx, 'Figures unavailable', x + 25, top + 91, 426, 29, '#394a61', true);
        rows.forEach((row, rank) => {
          const y = top + 86 + 42 * rank;
          const figures = offset === 0
            ? `${row.runs}${row.not_out ? '*' : ''} (${statValue(row, 'balls_faced')})`
            : `${row.wickets}/${row.runs_conceded} (${oversText(row.balls_bowled)})`;
          words(ctx, playerNames.get(row.player) ?? 'Player', x + 25, y, 292, 32, ink, true);
          ctx.textAlign = 'right';
          words(ctx, figures, x + 451, y, 121, 32, ink, true);
          ctx.textAlign = 'left';
        });
      }
      box(ctx, x + 25, figuresTop + 154, 427, 1, 0, '#10192835');
    }
  }

  if (awarded) {
    const figures = stats.find(row => row.player === awarded.id);
    const summary: string[] = [];
    if (figures?.batted) summary.push(`${figures.runs}${figures.not_out ? '*' : ''} runs` +
      (figures.unrecorded?.includes('balls_faced') ? '' : ` off ${figures.balls_faced} balls`));
    if (figures && (figures.balls_bowled || figures.wickets || figures.runs_conceded)) {
      summary.push(`${figures.wickets}/${figures.runs_conceded} in ${oversText(figures.balls_bowled)} overs`);
    }
    const center = awardTop + awardHeight / 2;
    const photoSize = Math.min(156, awardHeight - 28);
    const textLeft = 97 + photoSize;
    box(ctx, 54, awardTop, 972, awardHeight, 19, '#233252');
    picture(ctx, awardPhoto, initials(awarded.name), 72, center - photoSize / 2, photoSize, photoSize, 13);
    awardPhoto?.close();
    words(ctx, 'PLAYER OF THE MATCH', textLeft, center - 25, 1001 - textLeft, 21, gold);
    words(ctx, awarded.name, textLeft - 2, center + 26, 1003 - textLeft, 56, '#ffffff', true);
    if (summary.length) words(ctx, summary.join(' · '), textLeft, center + 57, 1001 - textLeft, 26, pale, true);
  }
  footer(ctx, height);
  return image;
}

export function GraphicCard({ name, kind, render }: { name: string; kind: 'Player' | 'Team' | 'Result'; render: () => Promise<HTMLCanvasElement> }) {
  const [preview, setPreview] = useState<{ url: string; width: number; height: number }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  const filename = `Crick-English-${kind === 'Result' ? 'Result-' : ''}${name.replace(/[^\p{L}\p{N} ._-]+/gu, '-').trim()}.png`;
  const downloadLabel = kind === 'Result' ? 'Download result card' : 'Download PNG';

  async function generate(download = false) {
    setBusy(true);
    setError(false);
    try {
      await document.fonts.load('700 50px "Barlow Condensed"');
      await document.fonts.load('700 20px "Inter Variable"');
      const canvas = await render();
      const png = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!png) throw new Error('PNG unavailable');
      const url = URL.createObjectURL(png);
      setPreview({ url, width: canvas.width, height: canvas.height });
      if (download) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
      }
    } catch { setError(true); }
    finally { setBusy(false); }
  }

  return <section className="panel graphic-export">
    <div className="section-heading">
      <h2>{kind} card</h2>
      <div className="graphic-actions">
        {!preview && <button type="button" className="quiet" disabled={busy} onClick={() => void generate()}><ImageIcon size={17} /> Preview card</button>}
        {preview
          ? <a className="button primary small" href={preview.url} download={filename}><Download size={17} /> {downloadLabel}</a>
          : <button type="button" className="button primary small" disabled={busy} onClick={() => void generate(true)}><Download size={17} /> {busy ? 'Preparing…' : downloadLabel}</button>}
      </div>
    </div>
    {error && <p role="alert">Could not create the card. Try again.</p>}
    {preview && <><img src={preview.url} width={preview.width} height={preview.height} alt={`${kind} card for ${name}`} /><small>{preview.width} × {preview.height} px</small></>}
  </section>;
}
