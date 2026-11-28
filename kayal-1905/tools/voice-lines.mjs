// Collects the game's spoken lines (barks, NPC lines, encounters, greetings, narration) from the source,
// for translation and voicing: node tools/voice-lines.mjs > lines.json
import fs from 'node:fs';
const files = ['world.js', 'activities.js', 'encounters.js', 'standing.js', 'traffic.js', 'story.js', 'npc.js', 'interiors.js'];
const out = new Set();
const str = /'((?:[^'\\]|\\.){6,})'|`((?:[^`\\$]|\\.){6,})`/g;
for (const f of files) {
  const src = fs.readFileSync('src/' + f, 'utf8').split('\n');
  for (const line of src) {
    // spoken contexts only: arrays of lines, dialogue tuples, barks and narration calls
    if (!/lines:|calls =|BARK|bark\(|narrate\(|dialog\(|\[(vic|th|wife|man|mum|kid|d|m|to|n|bait|'M'),|GREET|good:|fair:|bad:|armed:|say\[|speak\(|^\s+'[A-Z]|^\s+\[|village:|port:|hill:|coast:|SAYS|walker:|motor:|cyclist:/.test(line)) continue;
    let m; str.lastIndex = 0;
    while ((m = str.exec(line))) {
      const t = (m[1] || m[2]).replace(/\\'/g, "'");
      if (/^[a-z_]+$/.test(t) || !/[a-z]/.test(t) || !/\s/.test(t) || /\$\{|<b>|<\/|\.png|#[0-9a-f]{3}/i.test(t)) continue;
      out.add(t);
    }
  }
}
process.stdout.write(JSON.stringify([...out], null, 1));
