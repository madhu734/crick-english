type LogoFrame = readonly [top: number, right: number, bottom: number, left: number];

// These files have extra background around the crest. A replacement logo uses its full image.
const logoFrames = new Map<string, LogoFrame>([
  ['lords_2ammq9i5i4.PNG', [29, 22, 39, 22]],
  ['phoenix_kbp1s68715.png', [10, 18, 10, 18]],
  ['raptors_aql7zc18fu.jpeg', [5, 28, 7, 28]],
  ['whk_k4z8x9vhqq.jpeg', [8, 10, 9, 10]],
]);

export function teamLogoFrame(file = '') {
  return logoFrames.get(file);
}
