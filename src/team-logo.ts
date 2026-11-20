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

export function teamLogoBackground(file = '') {
  if (file.startsWith('phoenix_')) return '#080808';
  if (file.startsWith('raptors_')) return '#09182b';
  if (file.startsWith('whk_')) return '#12334e';
  return '#ffffff';
}
