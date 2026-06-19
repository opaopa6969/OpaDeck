// Japan base map preset for the geoScene renderer.
//
// Following the "tetsugo" lesson, the renderer stays generic and the Japan
// specifics live in this dataset. The base map is a schematic *tile cartogram*:
// each of the 47 prefectures is a unit cell on a 12x11 grid. That keeps the
// dataset tiny and dependency-free while staying recognizably Japan-shaped, and
// it is pure data -- no business logic.
//
// JAPAN_TILE_GRID: { code, name, col, row } for every prefecture (code 1..47,
// the standard JIS prefecture order). createJapanBaseMap() turns it into the
// generic base-map shape the renderer consumes: positioned regions plus a
// project(lng, lat) for geographic point/line layers.

export const JAPAN_TILE_GRID = [
  { code: 1, name: 'Hokkaido', col: 11, row: 0 },
  { code: 2, name: 'Aomori', col: 10, row: 1 },
  { code: 3, name: 'Iwate', col: 11, row: 2 },
  { code: 4, name: 'Miyagi', col: 11, row: 3 },
  { code: 5, name: 'Akita', col: 10, row: 2 },
  { code: 6, name: 'Yamagata', col: 10, row: 3 },
  { code: 7, name: 'Fukushima', col: 11, row: 4 },
  { code: 8, name: 'Ibaraki', col: 11, row: 5 },
  { code: 9, name: 'Tochigi', col: 10, row: 4 },
  { code: 10, name: 'Gunma', col: 9, row: 4 },
  { code: 11, name: 'Saitama', col: 10, row: 5 },
  { code: 12, name: 'Chiba', col: 11, row: 6 },
  { code: 13, name: 'Tokyo', col: 10, row: 6 },
  { code: 14, name: 'Kanagawa', col: 10, row: 7 },
  { code: 15, name: 'Niigata', col: 9, row: 3 },
  { code: 16, name: 'Toyama', col: 8, row: 4 },
  { code: 17, name: 'Ishikawa', col: 7, row: 4 },
  { code: 18, name: 'Fukui', col: 7, row: 5 },
  { code: 19, name: 'Yamanashi', col: 9, row: 6 },
  { code: 20, name: 'Nagano', col: 9, row: 5 },
  { code: 21, name: 'Gifu', col: 8, row: 5 },
  { code: 22, name: 'Shizuoka', col: 9, row: 7 },
  { code: 23, name: 'Aichi', col: 8, row: 6 },
  { code: 24, name: 'Mie', col: 7, row: 6 },
  { code: 25, name: 'Shiga', col: 6, row: 5 },
  { code: 26, name: 'Kyoto', col: 6, row: 4 },
  { code: 27, name: 'Osaka', col: 5, row: 6 },
  { code: 28, name: 'Hyogo', col: 5, row: 5 },
  { code: 29, name: 'Nara', col: 6, row: 6 },
  { code: 30, name: 'Wakayama', col: 5, row: 7 },
  { code: 31, name: 'Tottori', col: 4, row: 4 },
  { code: 32, name: 'Shimane', col: 3, row: 4 },
  { code: 33, name: 'Okayama', col: 4, row: 5 },
  { code: 34, name: 'Hiroshima', col: 3, row: 5 },
  { code: 35, name: 'Yamaguchi', col: 2, row: 5 },
  { code: 36, name: 'Tokushima', col: 5, row: 8 },
  { code: 37, name: 'Kagawa', col: 4, row: 7 },
  { code: 38, name: 'Ehime', col: 3, row: 8 },
  { code: 39, name: 'Kochi', col: 4, row: 8 },
  { code: 40, name: 'Fukuoka', col: 2, row: 7 },
  { code: 41, name: 'Saga', col: 1, row: 7 },
  { code: 42, name: 'Nagasaki', col: 0, row: 7 },
  { code: 43, name: 'Kumamoto', col: 1, row: 8 },
  { code: 44, name: 'Oita', col: 2, row: 8 },
  { code: 45, name: 'Miyazaki', col: 2, row: 9 },
  { code: 46, name: 'Kagoshima', col: 1, row: 9 },
  { code: 47, name: 'Okinawa', col: 0, row: 10 },
];

// Approximate geographic bounding box of Japan, used by project().
const JAPAN_BBOX = { lngMin: 122, lngMax: 154, latMin: 24, latMax: 46 };

export function createJapanBaseMap(options = {}) {
  const cell = Number(options.cell) || 26;
  const gap = Number(options.gap) || 2;
  const cols = 12;
  const rows = 11;
  const width = cols * cell;
  const height = rows * cell;

  const regions = JAPAN_TILE_GRID.map((prefecture) => {
    const x = prefecture.col * cell;
    const y = prefecture.row * cell;
    const w = cell - gap;
    const h = cell - gap;
    return {
      code: prefecture.code,
      codeText: padCode(prefecture.code),
      name: prefecture.name,
      x,
      y,
      w,
      h,
      cx: x + w / 2,
      cy: y + h / 2,
    };
  });

  const lookup = new Map();
  for (const region of regions) {
    lookup.set(String(region.code), region);
    lookup.set(region.codeText, region);
    lookup.set(region.name.toLowerCase(), region);
  }

  return {
    id: 'japan',
    cell,
    cols,
    rows,
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
    regions,
    regionByCode(code) {
      return lookup.get(String(code)) || lookup.get(String(code).toLowerCase()) || null;
    },
    project(lng, lat) {
      const nx = (Number(lng) - JAPAN_BBOX.lngMin) / (JAPAN_BBOX.lngMax - JAPAN_BBOX.lngMin);
      const ny = (JAPAN_BBOX.latMax - Number(lat)) / (JAPAN_BBOX.latMax - JAPAN_BBOX.latMin);
      return { x: clamp01(nx) * width, y: clamp01(ny) * height };
    },
  };
}

function padCode(code) {
  return String(code).padStart(2, '0');
}

function clamp01(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
