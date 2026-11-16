// Downloads the CC0 textures listed in ../assets.json from Poly Haven into game/assets/,
// keeping a local cache so later builds don't download again.
const fs = require('fs'), path = require('path'), https = require('https');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets.json'), 'utf8'));
const cache = path.join(__dirname, '.asset-cache'), out = path.join(__dirname, 'game', 'assets', 'tex');
const KEY = { c: 'Diffuse', n: 'nor_gl', arm: 'arm' };
fs.mkdirSync(cache, { recursive: true }); fs.mkdirSync(out, { recursive: true });

// behind an HTTP proxy (some build sandboxes) let curl do the fetching; otherwise use Node directly
const viaProxy = !!(process.env.HTTPS_PROXY || process.env.https_proxy);
const curl = (url, asJson) => { const b = require('child_process').execFileSync('curl', ['-sSfL', '-A', 'kayal-1905-build', url], { maxBuffer: 1 << 28 }); return asJson ? JSON.parse(b) : b; };
const get = (url, asJson) => viaProxy ? Promise.resolve(curl(url, asJson)) : new Promise((res, rej) => {
  https.get(url, { headers: { 'User-Agent': 'kayal-1905-build' } }, (r) => {
    if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) return get(r.headers.location, asJson).then(res, rej);
    if (r.statusCode !== 200) return rej(new Error(`${url} -> HTTP ${r.statusCode}`));
    const parts = []; r.on('data', (d) => parts.push(d)); r.on('end', () => { const b = Buffer.concat(parts); res(asJson ? JSON.parse(b) : b); });
  }).on('error', rej);
});

(async () => {
  const res = manifest.resolution, list = {};
  for (const [slot, t] of Object.entries(manifest.textures)) {
    let files = null;
    for (const m of t.maps) {
      const name = `${slot}_${m}.jpg`, cached = path.join(cache, `${t.id}_${res}_${m}.jpg`);
      if (!fs.existsSync(cached)) {
        files = files || await get(`https://api.polyhaven.com/files/${t.id}`, true);
        const url = files[KEY[m]][res].jpg.url;
        fs.writeFileSync(cached, await get(url));
        process.stdout.write(`  downloaded ${t.id} ${m}\n`);
      }
      fs.copyFileSync(cached, path.join(out, name));
    }
    list[slot] = t.maps;
  }
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ source: manifest.source, textures: list }));
  const mb = fs.readdirSync(out).reduce((a, f) => a + fs.statSync(path.join(out, f)).size, 0) / 1048576;
  console.log(`textures ready: ${Object.keys(list).length} sets, ${mb.toFixed(1)} MB`);
})().catch((e) => { console.error('texture download failed:', e.message); process.exit(1); });
