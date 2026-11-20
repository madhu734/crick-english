import { useEffect, useState } from 'react';
import { Download, Image as ImageIcon } from 'lucide-react';
import { fileUrl, type Player, type Team } from './data';
import { teamLogoFrame } from './team-logo';

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
  ctx.fillStyle = contain ? '#ffffff' : '#293b55';
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
  const columns = players.length <= 4 ? Math.min(2, Math.max(1, players.length)) : players.length <= 9 ? 3 : 4;
  const rows = Math.ceil(players.length / columns);
  const tileWidth = Math.floor((972 - (columns - 1) * 16) / columns);
  const tileHeight = rows <= 1 ? 892 : rows === 2 ? 446 : 291;
  const height = Math.max(1350, 331 + rows * (tileHeight + 16) + 68);
  const { image, ctx } = canvas(height, teamAccent(team));
  header(ctx, season);
  box(ctx, 54, 111, 972, 182, 23, paper);
  const crest = await portrait(fileUrl(team, team.logo));
  picture(ctx, crest, team.short_name || initials(team.name), 76, 132, 138, 138, 16, true, team.logo);
  crest?.close();
  words(ctx, team.name.toUpperCase(), 244, 214, 750, 77, ink, true);
  const subtitle = ['SQUAD', `${players.length} ${players.length === 1 ? 'PLAYER' : 'PLAYERS'}`, team.owner_name?.trim()].filter(Boolean).join('   /   ');
  words(ctx, subtitle, 247, 259, 747, 22, '#394a61');
  for (let offset = 0; offset < players.length; offset += 4) {
    await Promise.all(players.slice(offset, offset + 4).map(async (player, idx) => {
      const bitmap = await portrait(fileUrl(player, player.photo));
      const i = offset + idx;
      const row = Math.floor(i / columns);
      const rowCount = Math.min(columns, players.length - row * columns);
      const x = 54 + (columns - rowCount) * (tileWidth + 16) / 2 + i % columns * (tileWidth + 16);
      const y = 322 + row * (tileHeight + 16);
      const textHeight = tileWidth >= 400 ? 95 : 67;
      picture(ctx, bitmap, initials(player.name), x, y, tileWidth, tileHeight, 14);
      bitmap?.close();
      const strip = y + tileHeight - textHeight;
      box(ctx, x, strip, tileWidth, textHeight, 12, '#101a2c');
      box(ctx, x + 12, strip + 13, 3, textHeight - 26, 1, gold);
      words(ctx, player.name, x + 24, strip + textHeight * .48, tileWidth - 38, tileWidth >= 400 ? 37 : 28, '#ffffff', true);
      words(ctx, [player.role, player.batch && 'Batch ' + player.batch].filter(Boolean).join(' · '),
        x + 24, strip + textHeight * .79, tileWidth - 38, tileWidth >= 400 ? 20 : 14, pale);
    }));
  }
  if (!players.length) words(ctx, 'Squad pending', 54, 400, 972, 42, pale, true);
  footer(ctx, height);
  return image;
}

export function GraphicCard({ name, kind, render }: { name: string; kind: 'Player' | 'Team'; render: () => Promise<HTMLCanvasElement> }) {
  const [preview, setPreview] = useState<{ url: string; width: number; height: number }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  const filename = `Crick-English-${name.replace(/[^\p{L}\p{N} ._-]+/gu, '-').trim()}.png`;

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
          ? <a className="button primary small" href={preview.url} download={filename}><Download size={17} /> Download PNG</a>
          : <button type="button" className="button primary small" disabled={busy} onClick={() => void generate(true)}><Download size={17} /> {busy ? 'Preparing…' : 'Download PNG'}</button>}
      </div>
    </div>
    {error && <p role="alert">Could not create the card. Try again.</p>}
    {preview && <><img src={preview.url} width={preview.width} height={preview.height} alt={`${kind} card for ${name}`} /><small>{preview.width} × {preview.height} px</small></>}
  </section>;
}
