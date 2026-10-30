/** 位置块的真实逻辑：定位、反查地名、地图瓦片。 */
import { getMapProvider } from "../../../lib/mapProviders";

export type Coord = { lat: number; lon: number };
export type Place = { name: string; addr: string };

export type GeoFail = "unsupported" | "desktop-unsupported" | "denied" | "timeout" | "unavailable";

/** 在 Tauri 桌面壳里（Windows / macOS / Linux） */
export function inDesktopShell(): boolean {
  if (typeof window === "undefined") return false;
  if (!("__TAURI_INTERNALS__" in window)) return false;
  return !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function parseCoord(raw: string): Coord | null {
  const m = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/.exec(raw.trim());
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

export function formatCoord(c: Coord): string {
  return `${c.lat.toFixed(6)}, ${c.lon.toFixed(6)}`;
}

/**
 * 取当前位置。
 * - 浏览器：navigator.geolocation
 * - Tauri 移动端：@tauri-apps/plugin-geolocation
 * - Tauri 桌面端：插件 desktop.rs 是空实现（返回零点），直接抛 desktop-unsupported，
 *   界面提示「暂不支持」并把用户引到搜地点——绝不把 0,0 当坐标写进笔记。
 */
export async function currentPosition(
  timeoutMs = 12000,
): Promise<Coord & { accuracy: number }> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    if (inDesktopShell()) throw new Error("desktop-unsupported" satisfies GeoFail);
    return pluginPosition(timeoutMs);
  }
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("unsupported" satisfies GeoFail));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => {
        const fail: GeoFail =
          err.code === err.PERMISSION_DENIED
            ? "denied"
            : err.code === err.TIMEOUT
              ? "timeout"
              : "unavailable";
        reject(new Error(fail));
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}

/** Tauri 移动端：走插件 */
async function pluginPosition(timeoutMs: number): Promise<Coord & { accuracy: number }> {
  const geo = await import("@tauri-apps/plugin-geolocation");
  let state: string;
  try {
    state = (await geo.checkPermissions()).location;
    if (state !== "granted") state = (await geo.requestPermissions(["location"])).location;
  } catch {
    throw new Error("unavailable" satisfies GeoFail);
  }
  if (state !== "granted") throw new Error("denied" satisfies GeoFail);
  try {
    const pos = await geo.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: timeoutMs,
      maximumAge: 30_000,
    });
    return { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy };
  } catch {
    throw new Error("unavailable" satisfies GeoFail);
  }
}

/**
 * 反查地名：Photon（komoot 的 OSM 索引），免 key、带 CORS。
 * 国内可用，OpenStreetMap 官方 Nominatim 在这里是超时的。
 * 失败返回 null —— 坐标照样留着，名字让用户自己填。
 */
export async function reverseGeocode(c: Coord, timeoutMs = 8000): Promise<Place | null> {
  // Photon 只认 default/de/en/fr，传 lang=zh 会 400；中文用 Accept-Language 要
  const url = `https://photon.komoot.io/reverse?lat=${c.lat}&lon=${c.lon}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "Accept-Language": "zh-CN,zh;q=0.9" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: Array<{ properties?: PhotonProps }>;
    };
    const p = data.features?.[0]?.properties;
    if (!p) return null;
    return composePlace(p);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type PlaceHit = Place & { coord: Coord };

type PhotonProps = {
  name?: string;
  street?: string;
  housenumber?: string;
  locality?: string;
  district?: string;
  city?: string;
  county?: string;
  state?: string;
};

/** Photon 有时把省给成英文缩写（"ZJ"），这种丢掉，只留看得懂的中文层级 */
function isReadableArea(s: string | undefined): s is string {
  // 判「有没有非 ASCII 字符」：\x00 只是区间起点，不是想匹配控制字符
  // eslint-disable-next-line no-control-regex
  return Boolean(s) && /[^\x00-\x7F]/.test(s as string);
}

function composeAddr(p: PhotonProps): string {
  return [isReadableArea(p.state) ? p.state : "", p.city, p.county, p.district, p.locality, p.street, p.housenumber]
    .filter((x): x is string => Boolean(x))
    .filter((x, i, arr) => arr.indexOf(x) === i)
    .join(" · ");
}

function composePlace(p: PhotonProps): Place | null {
  const street = [p.street, p.housenumber].filter((x): x is string => Boolean(x)).join("");
  const name = p.name || street || p.city || "";
  const addr = composeAddr(p);
  if (!name && !addr) return null;
  return { name: name || addr, addr: addr || name };
}

/**
 * 按名字搜地点：Photon 的正向检索。桌面没有 GPS 时这是最实用的一条路。
 * 结果按 Photon 的相关度排序，只留前 `limit` 条。
 */
export async function searchPlaces(query: string, limit = 6, signal?: AbortSignal): Promise<PlaceHit[] | null> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=${limit}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "Accept-Language": "zh-CN,zh;q=0.9" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: Array<{ geometry?: { coordinates?: [number, number] }; properties?: PhotonProps }>;
    };
    const out: PlaceHit[] = [];
    for (const f of data.features ?? []) {
      const coords = f.geometry?.coordinates;
      const p = f.properties;
      if (!coords || !p) continue;
      const place = composePlace(p);
      if (!place) continue;
      out.push({ ...place, coord: { lat: coords[1], lon: coords[0] } });
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/* ---------- 坐标：WGS-84 ↔ GCJ-02 ----------
   高德瓦片是 GCJ-02（火星坐标），直接拿浏览器的 WGS-84 去钉会偏 300–700 米。
   存的是 WGS-84（通用、可移植），画图和跳转前再转一次。 */

const PI = Math.PI;
const AXIS = 6378245.0;
// WGS84 椭球偏心率平方，常量原样抄自公开资料，精度损失可忽略
// eslint-disable-next-line no-loss-of-precision
const EE = 0.00669342162296594323;

function outOfChina(lat: number, lon: number): boolean {
  return lon < 72.004 || lon > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x: number, y: number): number {
  let ret = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2) / 3;
  ret += ((20 * Math.sin(y * PI) + 40 * Math.sin((y / 3) * PI)) * 2) / 3;
  ret += ((160 * Math.sin((y / 12) * PI) + 320 * Math.sin((y * PI) / 30)) * 2) / 3;
  return ret;
}

function transformLon(x: number, y: number): number {
  let ret = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2) / 3;
  ret += ((20 * Math.sin(x * PI) + 40 * Math.sin((x / 3) * PI)) * 2) / 3;
  ret += ((150 * Math.sin((x / 12) * PI) + 300 * Math.sin((x / 30) * PI)) * 2) / 3;
  return ret;
}

export function wgs84ToGcj02(c: Coord): Coord {
  if (outOfChina(c.lat, c.lon)) return c;
  let dLat = transformLat(c.lon - 105, c.lat - 35);
  let dLon = transformLon(c.lon - 105, c.lat - 35);
  const radLat = (c.lat / 180) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180) / (((AXIS * (1 - EE)) / (magic * sqrtMagic)) * PI);
  dLon = (dLon * 180) / ((AXIS / sqrtMagic) * Math.cos(radLat) * PI);
  return { lat: c.lat + dLat, lon: c.lon + dLon };
}

/* ---------- 地图瓦片 ---------- */

const TILE = 256;

function mercator(c: Coord, zoom: number) {
  const n = 2 ** zoom;
  const lat = Math.max(-85.0511, Math.min(85.0511, c.lat));
  const x = ((c.lon + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  return { x, y };
}

export type MapView = {
  /** 2×2 瓦片地址，顺序：左上、右上、左下、右下 */
  tiles: string[];
  /** 该点在 512×512 画布内的像素位置，用来把点推到正中 */
  px: number;
  py: number;
  /** 地图署名，必须显示 */
  attribution: string;
};

/** 按瓦片源拼 2×2 预览。输入始终是 WGS-84，坐标系统一由 provider 声明。 */
export function mapView(c: Coord, providerId?: string, zoom = 16): MapView {
  const provider = getMapProvider(providerId);
  const z = Math.min(zoom, provider.maxZoom);
  const src = provider.coordSystem === "gcj02" ? wgs84ToGcj02(c) : c;
  const { x, y } = mercator(src, z);
  const baseX = Math.floor(x) - 1;
  const baseY = Math.floor(y) - 1;
  const tiles: string[] = [];
  for (let dy = 0; dy < 2; dy += 1) {
    for (let dx = 0; dx < 2; dx += 1) {
      tiles.push(provider.tileUrl(baseX + dx, baseY + dy, z, dx + dy));
    }
  }
  return { tiles, px: (x - baseX) * TILE, py: (y - baseY) * TILE, attribution: provider.attribution };
}