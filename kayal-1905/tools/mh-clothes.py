# Extracts the MakeHuman clothes the game uses into plain JSON and small detail textures, for
# tools/mh-build.mjs to fit onto each body.
#   python3 tools/mh-clothes.py <makehuman/data> <out dir>
# MakeHuman's system assets (clothes included) are CC0 — see LICENSE.ASSETS.md in the MakeHuman
# repository. Each garment's mesh comes from its compiled .npz (MakeHuman 1.1 ships these in place of
# the .obj), its fitting data from the .mhclo: for every garment vertex three base-mesh vertices,
# barycentric weights and an offset scaled by the body's own measurements; and the list of
# base-mesh vertices the garment hides.
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter

DATA, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
GARMENTS = {  # name: (folder, mhclo, texture mode)
    'cs01': ('male_casualsuit01', 'male_casualsuit01', 'detail'),   # long-sleeved shirt tucked into belted trousers
    'cs06': ('male_casualsuit06', 'male_casualsuit06', 'detail'),   # half-sleeved collared shirt, trousers
    'suit': ('male_elegantsuit01', 'male_elegantsuit01', 'suit'),   # jacket, shirt and tie, trousers
    'shoes': ('shoes03', 'shoes03', 'detail'),                      # plain leather shoes
    'fcs01': ('female_casualsuit01', 'female_casualsuit01', 'detail'),  # a fitted short-sleeved top: cropped, the blouse
    'fedora': ('fedora01', 'fedora', 'detail'),
}

def mhclo(path):
    refs, scales, delete, mode = [], {}, [], None
    for line in open(path, encoding='utf-8', errors='replace'):
        line = line.split('#')[0].strip()
        if not line: continue
        w = line.split()
        if w[0] in ('x_scale', 'y_scale', 'z_scale'): scales[w[0][0]] = [int(w[1]), int(w[2]), float(w[3])]; continue
        if w[0] == 'verts': mode = 'v'; continue
        if w[0] == 'delete_verts': mode = 'd'; continue
        if mode == 'v':
            if len(w) == 9: refs.append([int(w[0]), int(w[1]), int(w[2]), float(w[3]), float(w[4]), float(w[5]), float(w[6]), float(w[7]), float(w[8])])
            elif len(w) == 1 and w[0].isdigit(): refs.append([int(w[0]), int(w[0]), int(w[0]), 1.0, 0.0, 0.0, 0.0, 0.0, 0.0])
            else: mode = None
        elif mode == 'd':
            i = 0
            while i < len(w):
                if i + 2 < len(w) and w[i + 1] == '-': delete.extend(range(int(w[i]), int(w[i + 2]) + 1)); i += 3
                elif w[i].isdigit(): delete.append(int(w[i])); i += 1
                else: i += 1
    return refs, scales, delete

for name, (folder, base, tex) in GARMENTS.items():
    d = os.path.join(DATA, 'clothes', folder)
    refs, scales, delete = mhclo(os.path.join(d, base + '.mhclo'))
    z = np.load(os.path.join(d, base + '.npz'))
    coord, fvert, fuvs, texco = z['coord'], z['fvert'], z['fuvs'], z['texco']
    assert len(refs) == len(coord), (name, len(refs), len(coord))
    # textures: a grey detail map (folds, seams, weave) relative to the cloth's own average, so the
    # game can dye it any colour; the suit keeps its white shirt and dark tie apart from the cloth
    mat = open(os.path.join(d, base + '.mhmat')).read() if os.path.exists(os.path.join(d, base + '.mhmat')) else ''
    tname = next((l.split()[1] for l in mat.splitlines() if l.startswith('diffuseTexture')), None)
    texfile = None
    if tname:
        src = os.path.join(d, os.path.basename(tname))
        if not os.path.exists(src): src = os.path.join(d, 'materials', os.path.basename(tname))
        if os.path.exists(src):
            im = Image.open(src).convert('RGB').resize((512, 512), Image.LANCZOS)
            a = np.asarray(im).astype(np.float32) / 255.0
            lum = a @ np.array([0.299, 0.587, 0.114], np.float32)
            ao_p = os.path.join(d, base + '_ao.png')
            if os.path.exists(ao_p):
                ao = np.asarray(Image.open(ao_p).convert('L').resize((512, 512), Image.LANCZOS)).astype(np.float32) / 255.0
            else: ao = np.ones_like(lum)
            # local mean over a wide window: the cloth's base tone, which the detail is taken against
            mean = np.asarray(Image.fromarray((lum * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(24))).astype(np.float32) / 255.0 + 0.02
            det = np.clip(lum / mean, 0.45, 1.5) * (0.55 + 0.45 * ao)
            det = 0.35 + (det - 1.0) * 0.6 + 0.4          # shrink the contrast; 0.75 = the dye colour as given
            # printed logos (warm colours on the blue tops) are not cloth: flatten them to plain weave
            r, g, b = a[..., 0], a[..., 1], a[..., 2]
            logo = np.asarray(Image.fromarray((((r > b * 0.95) & (lum > 0.08)) | (lum / mean > 1.3)).astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(3))).astype(np.float32) / 255.0
            if name == 'fcs01':      # the chest print: flatten the whole disc it sits in, outline and all
                ys, xs = np.nonzero(logo[:256, 300:] > 0.5); xs = xs + 300      # on the front panel
                if len(xs):
                    cy, cx = ys.mean(), xs.mean(); yy, xx = np.mgrid[0:512, 0:512]
                    logo = np.maximum(logo, np.clip((70 - np.hypot(yy - cy, xx - cx)) / 12, 0, 1))
            if tex != 'suit' and name != 'shoes': det = det * (1 - logo) + 0.75 * logo
            out = np.zeros((512, 512, 3), np.uint8)
            out[..., 0] = np.clip(det * 255, 0, 255)
            if tex == 'suit':
                out[..., 1] = np.clip((lum - 0.45) / 0.2, 0, 1) * 255            # the shirt
                r, g, b = a[..., 0], a[..., 1], a[..., 2]
                out[..., 2] = np.clip((r - np.maximum(g, b) - 0.05) / 0.1, 0, 1) * 255   # a reddish tie
            texfile = name + '.png'
            Image.fromarray(out).save(os.path.join(OUT, texfile), optimize=True)
    tris = []
    for f, u in zip(fvert.tolist(), fuvs.tolist()):
        if f[3] == f[0] or f[3] == f[2]: tris.append([f[0], f[1], f[2], u[0], u[1], u[2]])
        else: tris += [[f[0], f[1], f[2], u[0], u[1], u[2]], [f[0], f[2], f[3], u[0], u[2], u[3]]]
    json.dump({'refs': refs, 'scales': scales, 'delete': sorted(set(delete)), 'tris': tris, 'uv': np.round(texco, 5).tolist(), 'tex': texfile},
              open(os.path.join(OUT, name + '.json'), 'w'))
    print(name, len(coord), 'verts', len(tris), 'tris', len(delete), 'hidden', texfile)
