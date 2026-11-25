#!/usr/bin/env python3
"""fetch-chunk.py — the secondary-source fetcher of VRG Kocka (Térkép chunk, phase K0).

Builds one chunk source, Map/kocka/chunks/<id>.json, for a 200 m x 200 m x 200 m cube around a point:
terrain from the AWS Open Data terrain tiles (terrarium PNG, the same encoding lib/dem.js reads from our own
terrain.pmtiles), buildings, roads, rail, water, land, street furniture and places from Overture Maps (GeoParquet on
public S3, read with HTTP range requests: only the footers and the few row groups that touch the cube are fetched).

The cube: centred on the point, its floor 20 m below the ground at the point (the "ground level shows 20 m above
the deepest level of the cube"), its top 180 m above it. Geometry is stored in local metres (x east, y north, from
the point), heights in metres above sea level. Attributes are stored as the sources give them; the height model
(what an untagged building is assumed to be) lives in lib/chunk.js, so it is tested and shared with the page.

    python3 Map/kocka/tools/fetch-chunk.py 47.52629716033015 19.037238239418304 --id kolosy-zsigmond
    options: --size 200 --below 20 --release 2026-11-18.0 --title "..."

Needs: pyarrow fsspec aiohttp requests shapely pillow numpy  (pip install ...). Network: s3.amazonaws.com and
overturemaps-us-west-2.s3.us-west-2.amazonaws.com only. Footer statistics are cached in Map/kocka/.cache/ (gitignored),
so a second chunk anywhere costs only its own row groups.

This is the SECONDARY path. The primary path (phase K2) reads the Térkép's own local data instead:
Map/data/hungary.pmtiles (OSM buildings with heights), terrain.pmtiles, bp-heights.bin.
"""
import argparse, concurrent.futures as cf, datetime, io, json, math, os, re, sys

import fsspec, numpy as np, pyarrow as pa, pyarrow.parquet as pq, requests
from PIL import Image
from shapely import wkb
from shapely.geometry import box, mapping, shape, LineString, Polygon, MultiPolygon, Point

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CACHE = os.path.join(ROOT, '.cache')
OVT = 'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/'
TERRAIN = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
R_EARTH = 6371008.8
THEMES = ['buildings/building', 'buildings/building_part', 'transportation/segment', 'base/water', 'base/land',
          'base/land_use', 'base/land_cover', 'base/infrastructure', 'places/place']


def log(*a):
    print(*a, file=sys.stderr, flush=True)


# ---------- local frame ----------
class Frame:
    def __init__(s, lat, lon):
        s.lat, s.lon = lat, lon
        s.kx = math.cos(math.radians(lat)) * R_EARTH * math.pi / 180
        s.ky = R_EARTH * math.pi / 180

    def xy(s, lon, lat):
        return ((lon - s.lon) * s.kx, (lat - s.lat) * s.ky)

    def lonlat(s, x, y):
        return (s.lon + x / s.kx, s.lat + y / s.ky)


def to_local(geom, F):
    from shapely.ops import transform
    return transform(lambda x, y, z=None: (np.array(F.xy(np.asarray(x), np.asarray(y)))), geom)


def r1(v):
    return round(float(v), 2)


def ring(coords):
    pts = [[r1(x), r1(y)] for x, y in list(coords)[:-1]]
    return pts


# ---------- terrain ----------
def terrain_grid(F, half, step, z=15):
    n = 2 ** z
    tiles = {}

    def pix(lon, lat):
        fx = (lon + 180) / 360 * n * 256
        sl = math.sin(math.radians(lat))
        fy = (0.5 - math.log((1 + sl) / (1 - sl)) / (4 * math.pi)) * n * 256
        return fx, fy

    def h_at_px(px, py):
        tx, ty = int(px // 256), int(py // 256)
        k = (tx, ty)
        if k not in tiles:
            r = requests.get(TERRAIN.format(z=z, x=tx, y=ty), timeout=60)
            r.raise_for_status()
            a = np.asarray(Image.open(io.BytesIO(r.content)).convert('RGB')).astype(np.float64)
            tiles[k] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
        return tiles[k][int(py) - ty * 256, int(px) - tx * 256]

    def sample(lon, lat):  # bilinear between pixel centres
        fx, fy = pix(lon, lat)
        fx -= 0.5; fy -= 0.5
        x0, y0 = math.floor(fx), math.floor(fy)
        ax, ay = fx - x0, fy - y0
        h00 = h_at_px(x0 + .5, y0 + .5); h10 = h_at_px(x0 + 1.5, y0 + .5)
        h01 = h_at_px(x0 + .5, y0 + 1.5); h11 = h_at_px(x0 + 1.5, y0 + 1.5)
        return (h00 * (1 - ax) + h10 * ax) * (1 - ay) + (h01 * (1 - ax) + h11 * ax) * ay

    cnt = int(round(2 * half / step)) + 1
    rows = []
    for j in range(cnt):  # j = 0 is the south edge
        y = -half + j * step
        row = []
        for i in range(cnt):
            x = -half + i * step
            lon, lat = F.lonlat(x, y)
            row.append(int(round(sample(lon, lat) * 100)))
        rows.append(row)
    g0 = sample(F.lon, F.lat)
    mpp = 156543.03392 * math.cos(math.radians(F.lat)) / n
    return {'x0': -half, 'y0': -half, 'step': step, 'nx': cnt, 'ny': cnt, 'cm': rows,
            'tileZoom': z, 'tilePixelM': round(mpp, 2)}, g0


# ---------- overture ----------
def list_keys(release, theme):
    t, ty = theme.split('/')
    keys, token = [], None
    while True:
        u = OVT + f'?list-type=2&prefix=release/{release}/theme={t}/type={ty}/'
        if token: u += '&continuation-token=' + requests.utils.quote(token)
        xml = requests.get(u, timeout=60).text
        keys += re.findall(r'<Key>([^<]*\.parquet)</Key>', xml)
        m = re.search(r'<NextContinuationToken>([^<]*)</NextContinuationToken>', xml)
        if not m: return keys
        token = m.group(1)


def footer_index(release, theme):
    """Per file, per row group: [xmin_min, xmax_max, ymin_min, ymax_max]. Cached."""
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, f'footers-{release}-{theme.replace("/", "-")}.json')
    if os.path.exists(path):
        return json.load(open(path))
    keys = list_keys(release, theme)
    fs = fsspec.filesystem('https')

    def one(k):
        for attempt in range(3):
            try:
                with fs.open(OVT + k, block_size=2 ** 20) as f:
                    md = pq.ParquetFile(f).metadata
                ix = {md.schema.column(i).path: i for i in range(md.num_columns)}
                out = []
                for g in range(md.num_row_groups):
                    rg = md.row_group(g)
                    v = []
                    for n, side in (('bbox.xmin', 0), ('bbox.xmax', 1), ('bbox.ymin', 0), ('bbox.ymax', 1)):
                        s = rg.column(ix[n]).statistics
                        v.append((s.min if side == 0 else s.max) if s is not None and s.has_min_max else None)
                    out.append(v)
                return k, out
            except Exception as e:  # noqa
                err = e
        raise RuntimeError(f'{k}: {err}')

    idx = {}
    log(f'  indexing {len(keys)} files of {theme} (once) ...')
    with cf.ThreadPoolExecutor(24) as ex:
        for k, v in ex.map(one, keys):
            idx[k] = v
    json.dump(idx, open(path, 'w'))
    return idx


def read_theme(release, theme, bb):
    X0, Y0, X1, Y1 = bb
    idx = footer_index(release, theme)
    fs = fsspec.filesystem('https')
    rows = []
    for k, groups in idx.items():
        hit = [g for g, v in enumerate(groups) if None not in v and v[0] <= X1 and v[1] >= X0 and v[2] <= Y1 and v[3] >= Y0]
        if not hit: continue
        with fs.open(OVT + k, block_size=8 * 2 ** 20) as f:
            tb = pq.ParquetFile(f).read_row_groups(hit)
        bbs = tb.column('bbox').to_pylist()
        keep = [i for i, b in enumerate(bbs) if b['xmin'] <= X1 and b['xmax'] >= X0 and b['ymin'] <= Y1 and b['ymax'] >= Y0]
        for r in tb.take(pa.array(keep, type=pa.int64())).to_pylist():
            r['geometry'] = wkb.loads(r['geometry'])
            rows.append(r)
    return rows


def src_of(r):
    s = r.get('sources') or []
    return sorted({x.get('dataset') for x in s if x.get('dataset')})


def name_of(r):
    n = r.get('names') or {}
    return n.get('primary') if isinstance(n, dict) else None


def polys(g):
    if g.is_empty: return []
    if isinstance(g, Polygon): return [g]
    if isinstance(g, MultiPolygon): return list(g.geoms)
    if hasattr(g, 'geoms'): return [p for x in g.geoms for p in polys(x)]
    return []


def lines(g):
    if g.is_empty: return []
    if isinstance(g, LineString): return [g]
    if hasattr(g, 'geoms'): return [l for x in g.geoms for l in lines(x)]
    return []


def poly_out(p, half):
    """Exterior + holes; flag each exterior edge that lies on the cube's side (a cut, not a real wall)."""
    ext = ring(p.exterior.coords)
    cut = []
    e = 0.05
    for i in range(len(ext)):
        a, b = ext[i], ext[(i + 1) % len(ext)]
        on = (abs(a[0] - b[0]) < e and abs(abs(a[0]) - half) < e) or (abs(a[1] - b[1]) < e and abs(abs(a[1]) - half) < e)
        if on: cut.append(i)
    o = {'ring': ext}
    if cut: o['cut'] = cut
    holes = [ring(h.coords) for h in p.interiors]
    if holes: o['holes'] = holes
    return o


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('lat', type=float); ap.add_argument('lon', type=float)
    ap.add_argument('--id', required=True); ap.add_argument('--title', default=None)
    ap.add_argument('--size', type=float, default=200); ap.add_argument('--below', type=float, default=20)
    ap.add_argument('--release', default='2026-11-18.0'); ap.add_argument('--step', type=float, default=4)
    a = ap.parse_args()
    F = Frame(a.lat, a.lon)
    half = a.size / 2
    clip = box(-half, -half, half, half)
    m = 30 / F.kx, 30 / F.ky  # read a little wider than the cube
    lon0, lat0 = F.lonlat(-half, -half)
    lon1, lat1 = F.lonlat(half, half)
    bb = (lon0 - m[0], lat0 - m[1], lon1 + m[0], lat1 + m[1])

    log('terrain ...')
    terrain, g0 = terrain_grid(F, half, a.step)
    ground = round(g0, 2)
    out = {
        'format': 'vrg-kocka/1', 'id': a.id, 'title': a.title or a.id,
        'created': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'center': {'lat': a.lat, 'lon': a.lon}, 'size': a.size, 'below': a.below,
        'ground': ground, 'zBase': round(ground - a.below, 2), 'zTop': round(ground - a.below + a.size, 2),
        'frame': 'local metres from the centre: x east, y north (equirectangular); z metres above sea level',
        'bounds': {'west': round(lon0, 7), 'south': round(lat0, 7), 'east': round(lon1, 7), 'north': round(lat1, 7)},
        'terrain': terrain,
        'buildings': [], 'roads': [], 'rails': [], 'water': [], 'areas': [], 'trees': [], 'treeRows': [],
        'barriers': [], 'assets': [], 'places': [],
        'sources': [
            {'id': 'terrain', 'name': 'AWS Open Data Terrain Tiles (Mapzen terrarium), z15', 'licence': 'see registry.opendata.aws/terrain-tiles (SRTM, EU-DEM, … attributions)'},
            {'id': 'overture', 'name': f'Overture Maps Foundation, release {a.release}', 'licence': 'ODbL (OpenStreetMap-derived themes), CDLA-Permissive-2.0 / others per theme; © OpenStreetMap contributors'},
        ],
    }
    counts = {}
    for theme in THEMES:
        log(theme, '...')
        rows = read_theme(a.release, theme, bb)
        counts[theme] = len(rows)
        for r in rows:
            g = to_local(r['geometry'], F)
            sub, cls, nm, src = r.get('subtype'), r.get('class'), name_of(r), src_of(r)
            if theme.startswith('buildings/'):
                if r.get('is_underground'): continue
                for p in polys(g.intersection(clip)):
                    if p.area < 2: continue
                    b = poly_out(p, half)
                    b.update({k: v for k, v in {
                        'id': r['id'][:8], 'part': theme.endswith('_part') or None, 'name': nm, 'cls': cls, 'sub': sub,
                        'height': r.get('height'), 'minHeight': r.get('min_height'), 'floors': r.get('num_floors'),
                        'minFloor': r.get('min_floor'), 'roof': r.get('roof_shape'), 'roofHeight': r.get('roof_height'),
                        'src': src, 'cutAll': None}.items() if v is not None})
                    out['buildings'].append(b)
            elif theme == 'transportation/segment':
                for l in lines(g.intersection(clip)):
                    o = {'cls': cls, 'line': [[r1(x), r1(y)] for x, y in l.coords]}
                    if nm: o['name'] = nm
                    (out['rails'] if sub == 'rail' else out['roads']).append(o)
            elif theme == 'base/water':
                gi = g.intersection(clip)
                for p in polys(gi): out['water'].append({'cls': cls, **poly_out(p, half)})
                for l in lines(gi): out['water'].append({'cls': cls, 'line': [[r1(x), r1(y)] for x, y in l.coords]})
            elif theme == 'base/land' and sub == 'tree':
                gi = g.intersection(clip)
                if gi.is_empty: continue
                if isinstance(gi, Point): out['trees'].append([r1(gi.x), r1(gi.y)])
                for l in lines(gi): out['treeRows'].append([[r1(x), r1(y)] for x, y in l.coords])
            elif theme in ('base/land', 'base/land_use', 'base/land_cover'):
                if sub in ('physical',) or cls in ('mountain_range', 'residential', 'university', 'land'): continue
                for p in polys(g.intersection(clip)):
                    if p.area < 4: continue
                    out['areas'].append({'kind': theme.split('/')[1], 'cls': cls or sub, **poly_out(p, half)})
            elif theme == 'base/infrastructure':
                gi = g.intersection(clip)
                if gi.is_empty: continue
                if isinstance(gi, Point):
                    out['assets'].append({'cls': cls, 'sub': sub, 'x': r1(gi.x), 'y': r1(gi.y), **({'name': nm} if nm else {})})
                elif sub == 'barrier' or cls in ('fence', 'wall', 'retaining_wall', 'hedge'):
                    for l in lines(gi.boundary if polys(gi) else gi):
                        out['barriers'].append({'cls': cls, 'line': [[r1(x), r1(y)] for x, y in l.coords]})
                else:
                    for p in polys(gi):
                        out['areas'].append({'kind': 'infrastructure', 'cls': cls, **poly_out(p, half)})
            elif theme == 'places/place':
                if not isinstance(g, Point) or not clip.contains(g) or (r.get('confidence') or 0) < 0.6 or not nm: continue
                cat = (r.get('basic_category') or ((r.get('categories') or {}).get('primary')) or '')
                out['places'].append({'name': nm, 'cat': cat, 'x': r1(g.x), 'y': r1(g.y), 'conf': round(r['confidence'], 2)})
    out['places'].sort(key=lambda p: -p['conf'])
    out['places'] = out['places'][:60]
    out['counts'] = {k.split('/')[1]: v for k, v in counts.items()}
    dst = os.path.join(ROOT, 'chunks', a.id + '.json')
    with open(dst, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    log(f'wrote {dst}  ({os.path.getsize(dst) // 1024} KB): ground {ground} m, '
        f'{len(out["buildings"])} buildings, {len(out["roads"])} roads, {len(out["rails"])} rails, '
        f'{len(out["trees"])} trees, {len(out["assets"])} assets, {len(out["places"])} places')


if __name__ == '__main__':
    main()
