// Physical Chrome wheel deltas and inter-packet gaps (ms), not synthetic DOM events.
module.exports = {
  single: {pixels:[32],gap:0,step:1},
  belowEight: {pixels:[8],gap:0,step:0},
  belowSixteen: {pixels:[16],gap:0,step:0},
  belowNegative: {pixels:[-16],gap:0,step:0},
  four: {pixels:[8,8,8,8],gap:75,step:1},
  eight: {pixels:Array(8).fill(4),gap:75,step:1},
  sparse: {pixels:[12,12,12],gap:350,step:1},
  reverse: {pixels:Array(4).fill(-8),gap:75,step:-1},
  sparseReverse: {pixels:Array(3).fill(-12),gap:300,step:-1},
  jitter: {pixels:[1,-1,2,-2,1,-1],gap:75,step:0},
  speck: {pixels:[2],gap:0,step:0},
  spacedSpecks: {pixels:Array(16).fill(2),gap:350,step:0},
  separated: {pixels:[12,12,12],gap:860,step:0},
  notch: {pixels:[110],gap:0,step:1},
  large: {pixels:[880],gap:0,step:8},
};
