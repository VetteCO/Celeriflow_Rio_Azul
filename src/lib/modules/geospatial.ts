import { distanceMeters, type GeoFeature } from "./domain";
export type Position = [number, number];
export function featurePoints(feature: GeoFeature): Position[] {
  const c = feature.geometry.coordinates;
  switch (feature.geometry.type) {
    case "Point": return [c as Position];
    case "MultiPoint": case "LineString": return c as Position[];
    case "MultiLineString": case "Polygon": return (c as Position[][]).flat();
    case "MultiPolygon": return (c as Position[][][]).flat(2);
  }
}
export function featureLines(feature: GeoFeature): Position[][] {
  const c = feature.geometry.coordinates;
  if (feature.geometry.type === "LineString") return [c as Position[]];
  if (feature.geometry.type === "MultiLineString" || feature.geometry.type === "Polygon") return c as Position[][];
  if (feature.geometry.type === "MultiPolygon") return (c as Position[][][]).flat();
  return [];
}
function onSegment(p: Position, a: Position, b: Position) {
  const cross = (p[1] - a[1]) * (b[0] - a[0]) - (p[0] - a[0]) * (b[1] - a[1]);
  return Math.abs(cross) < 1e-12 && p[0] >= Math.min(a[0], b[0]) - 1e-12 && p[0] <= Math.max(a[0], b[0]) + 1e-12 && p[1] >= Math.min(a[1], b[1]) - 1e-12 && p[1] <= Math.max(a[1], b[1]) + 1e-12;
}
export function inRing(point: Position, ring: Position[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j]; if (onSegment(point, a, b)) return true;
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export function containsPoint(feature: GeoFeature, point: Position) {
  const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates as Position[][]] : feature.geometry.type === "MultiPolygon" ? feature.geometry.coordinates as Position[][][] : [];
  return polygons.some(rings => inRing(point, rings[0]) && !rings.slice(1).some(hole => inRing(point, hole)));
}
export function featureDistance(feature: GeoFeature, point: Position) {
  if (containsPoint(feature, point)) return 0;
  let minimum = featurePoints(feature).reduce((min, p) => Math.min(min, distanceMeters(point, p)), Infinity);
  // Local tangent projection for the nearest point on each segment; final distance uses the haversine.
  const cos = Math.max(0.000001, Math.cos(point[1] * Math.PI / 180));
  for (const line of featureLines(feature)) for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i]; const dx = (b[0] - a[0]) * cos, dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, (((point[0] - a[0]) * cos) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    minimum = Math.min(minimum, distanceMeters(point, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]));
  }
  return minimum;
}
function intersects(a: Position, b: Position, c: Position, d: Position) {
  const cross = (p: Position, q: Position, r: Position) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const x = cross(a, b, c), y = cross(a, b, d), z = cross(c, d, a), w = cross(c, d, b);
  return x * y < 0 && z * w < 0 || onSegment(c, a, b) || onSegment(d, a, b) || onSegment(a, c, d) || onSegment(b, c, d);
}
export function intersectsRing(feature: GeoFeature, ring: Position[]) {
  if (ring.length < 3) return true;
  const closed = [...ring, ring[0]];
  if (featurePoints(feature).some(p => inRing(p, closed)) || ring.some(p => containsPoint(feature, p))) return true;
  return featureLines(feature).some(line => line.slice(1).some((p, i) => closed.slice(1).some((q, j) => intersects(line[i], p, closed[j], q))));
}
