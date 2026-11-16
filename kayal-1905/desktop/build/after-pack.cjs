// macOS refuses to run unsigned code on Apple Silicon. Without a paid Developer ID we
// give the app an ad-hoc signature ("signed by nobody in particular") so it can start.
// Runs only when building on a Mac; on other systems there is no codesign to call.
const { execFileSync } = require('child_process');
const path = require('path');
exports.default = async function afterPack(ctx) {
  if (ctx.electronPlatformName !== 'darwin' || process.platform !== 'darwin') return;
  // a universal build first packs an Intel and an Apple Silicon copy, then merges them: sign only the result
  if (/-temp$/.test(ctx.appOutDir)) return;
  const app = path.join(ctx.appOutDir, `${ctx.packager.appInfo.productFilename}.app`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--verbose=2', app], { stdio: 'inherit' });
  console.log('  • ad-hoc signed', app);
};
