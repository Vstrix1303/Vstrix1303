# Voices the game's lines in Malayalam: each English line in ml.json is spoken from its Malayalam translation
# by Meta's MMS text-to-speech for Malayalam (facebook/mms-tts-mal, CC-BY-NC 4.0), then pitched into a man's,
# a woman's and a child's voice with ffmpeg, as small Ogg/Opus files the game plays in place of the English.
#   python tools/voice/make.py <out dir>
import hashlib, json, os, subprocess, sys
import numpy as np, scipy.io.wavfile as wav, torch
from transformers import VitsModel, AutoTokenizer

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
lines = json.load(open(os.path.join(HERE, 'ml.json'), encoding='utf-8'))
tok = AutoTokenizer.from_pretrained('facebook/mms-tts-mal')
model = VitsModel.from_pretrained('facebook/mms-tts-mal').eval()
torch.manual_seed(7)
# the voice's register: ratio of pitch for each kind of speaker (the base voice is a man's)
VARIANTS = {'m': 0.96, 'f': 1.3, 'c': 1.48}
manifest = {}
key = lambda s: hashlib.sha1(s.encode('utf-8')).hexdigest()[:12]
for i, (en, ml) in enumerate(lines.items()):
    k = key(en)
    have = all(os.path.exists(os.path.join(OUT, f'{k}_{v}.ogg')) for v in VARIANTS)
    if not have:
        ids = tok(ml, return_tensors='pt')
        with torch.no_grad():
            y = model(**ids, noise_scale=0.6, noise_scale_duration=0.75, speaking_rate=1.05).waveform[0].numpy()
        sr = model.config.sampling_rate
        y = y / max(1e-4, np.abs(y).max()) * 0.9
        tmp = os.path.join(OUT, f'{k}.wav'); wav.write(tmp, sr, (y * 32767).astype(np.int16))
        for v, r in VARIANTS.items():
            # pitch by r with the length kept: resample up, then stretch back
            af = f'asetrate={int(sr * r)},aresample=24000,atempo={1 / r:.4f},highpass=f=70,lowpass=f=7600' + (',equalizer=f=2600:t=q:w=1.2:g=2' if v != 'm' else ',equalizer=f=180:t=q:w=1:g=2')
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', tmp, '-af', af, '-ac', '1', '-c:a', 'libopus', '-b:a', '20k', os.path.join(OUT, f'{k}_{v}.ogg')], check=True)
        dur = len(y) / sr
        os.remove(tmp)
    else:
        dur = manifest.get(k, {}).get('d', 0)
    manifest[k] = {'d': round(float(dur), 2)} if not have else manifest.get(k, {'d': 0})
    if i % 20 == 0: print(i, len(lines), en[:40], flush=True)
json.dump({'lang': 'ml', 'source': 'Meta MMS-TTS Malayalam (facebook/mms-tts-mal), CC-BY-NC 4.0', 'lines': {key(en): manifest.get(key(en), {}) for en in lines}}, open(os.path.join(OUT, 'manifest.json'), 'w'), ensure_ascii=False)
print('done', len(lines))
