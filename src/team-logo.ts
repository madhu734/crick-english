type LogoFrame = readonly [top: number, right: number, bottom: number, left: number];

// These files have extra background around the crest. A replacement logo uses its full image.
const logoFrames = new Map<string, LogoFrame>([
  ['lords_2ammq9i5i4.PNG', [29, 22, 39, 22]],
  ['phoenix_kbp1s68715.png', [5, 14, 0, 14]],
  ['raptors_aql7zc18fu.jpeg', [2, 24, 0, 24]],
  ['whk_k4z8x9vhqq.jpeg', [3, 6, 0, 6]],
]);

export function teamLogoFrame(file = '') {
  return logoFrames.get(file);
}

export function teamLogoViewBox(file = '') {
  const sizes: Record<string, [number, number]> = {
    'lords_2ammq9i5i4.PNG': [1536, 1024],
    'phoenix_kbp1s68715.png': [500, 500],
    'raptors_aql7zc18fu.jpeg': [1376, 768],
    'whk_k4z8x9vhqq.jpeg': [1024, 1024],
  };
  const size = sizes[file];
  const frame = teamLogoFrame(file);
  if (!size || !frame) return undefined;
  const [width, height] = size;
  const [top, right, bottom, left] = frame;
  return { width, height, viewBox: [width * left / 100, height * top / 100,
    width * (100 - left - right) / 100, height * (100 - top - bottom) / 100].join(' ') };
}

export function teamLogoBackground(file = '') {
  if (file.startsWith('phoenix_')) return '#080808';
  if (file.startsWith('raptors_')) return '#09182b';
  if (file.startsWith('whk_')) return '#12334e';
  return '#ffffff';
}
