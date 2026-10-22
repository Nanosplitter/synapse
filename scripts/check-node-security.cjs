// Minimum patched versions from the October 21, 2026 Node security release.
const minimum = new Map([[22, [23, 4]], [24, [22, 1]], [26, [12, 1]]]);
const [major, minor, patch] = process.versions.node.split('.').map(Number);
const floor = minimum.get(major);
if (!floor || minor < floor[0] || (minor === floor[0] && patch < floor[1])) {
  throw new Error(`Node ${process.versions.node} is outside the approved patched runtime versions`);
}
console.log(`Node ${process.versions.node}: October 2026 security baseline satisfied`);
