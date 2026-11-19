import { useEffect, useState } from 'react';
import { Download, Image as ImageIcon } from 'lucide-react';
import { fileUrl, type Player, type Team } from './data';

const gold = '#efd598';
const navy = '#101b30';
const pale = '#b5c4dc';

async function portrait(url: string) {
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    return response.ok ? await createImageBitmap(await response.blob()) : null;
  } catch { return null; }
}

function canvas(width: number, height: number) {
  const image = document.createElement('canvas');
  image.width = width;
  image.height = height;
  const ctx = image.getContext('2d')!;
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#263f61');
  bg.addColorStop(.52, navy);
  bg.addColorStop(1, '#0a1222');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = gold;
  ctx.fillRect(0, 0, width, 12);
  return { image, ctx };
}

function words(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, width: number, size: number, color = '#ffffff', weight = 700) {
  ctx.font = `${weight} ${size}px "Inter Variable", system-ui, sans-serif`;
  const measured = ctx.measureText(value).width;
  if (measured > width) ctx.font = `${weight} ${Math.max(1, Math.floor(size * width / measured))}px "Inter Variable", system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

function photo(ctx: CanvasRenderingContext2D, bitmap: ImageBitmap | null, name: string, x: number, y: number, size: number, radius: number) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, radius);
  ctx.clip();
  ctx.fillStyle = '#314968';
  ctx.fillRect(x, y, size, size);
  if (bitmap) {
    const side = Math.min(bitmap.width, bitmap.height);
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, x, y, size, size);
  } else {
    const initials = name.trim().split(/\s+/).slice(0, 2).map(word => [...word][0]).join('').toUpperCase();
    ctx.textAlign = 'center';
    words(ctx, initials, x + size / 2, y + size * .64, size * .8, size * .35, gold);
  }
  ctx.restore();
}

function header(ctx: CanvasRenderingContext2D, season: string, width: number) {
  words(ctx, 'CRICK ENGLISH', 84, 103, width / 2, 34, gold);
  ctx.textAlign = 'right';
  words(ctx, season, width - 84, 103, width / 2 - 100, 32, pale, 500);
  ctx.textAlign = 'left';
}

export async function renderPlayerCard(player: Player, season: string, team?: Team) {
  const { image, ctx } = canvas(1600, 2000);
  header(ctx, season, image.width);
  const bitmap = await portrait(fileUrl(player, player.photo));
  photo(ctx, bitmap, player.name, 200, 165, 1200, 52);
  bitmap?.close();
  ctx.textAlign = 'center';
  words(ctx, player.name, 800, 1544, 1432, 112);
  const meta = [player.role, player.batch && 'Batch ' + player.batch].filter(Boolean).join('  ·  ');
  words(ctx, meta, 800, 1654, 1432, 56, gold);
  if (team) words(ctx, team.name, 800, 1762, 1432, 52, pale, 500);
  ctx.fillStyle = gold;
  ctx.fillRect(744, 1856, 112, 6);
  return image;
}

export async function renderTeamCard(team: Team, season: string, players: Player[]) {
  const { image, ctx } = canvas(1920, Math.max(1080, 334 + Math.ceil(players.length / 2) * 122));
  header(ctx, season, image.width);
  const crest = await portrait(fileUrl(team, team.logo));
  photo(ctx, crest, team.name, 84, 139, 130, 24);
  crest?.close();
  words(ctx, team.name, 242, 216, 1594, 85);
  const owner = team.owner_name?.trim();
  words(ctx, [`SQUAD · ${players.length}`, owner && 'Owner: ' + owner].filter(Boolean).join('   |   '), 245, 269, 1591, 32, gold);
  for (let offset = 0; offset < players.length; offset += 4) {
    await Promise.all(players.slice(offset, offset + 4).map(async (player, idx) => {
      const bitmap = await portrait(fileUrl(player, player.photo));
      const i = offset + idx;
      const x = 84 + i % 2 * 888;
      const y = 310 + Math.floor(i / 2) * 122;
      ctx.fillStyle = '#22334e';
      ctx.beginPath();
      ctx.roundRect(x, y, 864, 106, 15);
      ctx.fill();
      photo(ctx, bitmap, player.name, x + 12, y + 12, 82, 12);
      bitmap?.close();
      words(ctx, player.name, x + 114, y + 48, 723, 35);
      words(ctx, [player.role, player.batch && 'Batch ' + player.batch].filter(Boolean).join('  ·  '), x + 114, y + 83, 723, 24, pale, 500);
    }));
  }
  if (!players.length) words(ctx, 'Squad pending', 84, 418, 1752, 42, pale);
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
      await document.fonts.ready;
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
