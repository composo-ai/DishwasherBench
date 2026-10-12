/**
 * Nearest point of a fixed set to a query point, by a uniform hash grid: used where a piece of
 * surface has no block of its own and is credited to the nearest block that exists.
 *
 * Deterministic: of two points at the same distance the one with the lower index wins, and no
 * iteration order of the hash reaches the result.
 *
 * Units: metres.
 */

/** Rings of grid cells searched before every point is tried. */
const RINGS = 2;
/** Hash cells are numbered within 2^17 per axis (three axes fit the 53 bits of a number). */
const MASK = 0x1ffff;
const HALF = 0x10000;

/** A set of points that answers nearest-point queries. */
export class NearestPoints {
  private readonly points: ArrayLike<number>;
  private readonly members: Uint32Array;
  private readonly h: number;
  private readonly cells = new Map<number, number[]>();

  /**
   * `points` holds three numbers per point; `members` lists the indices of the points that take
   * part, ascending; `cellSize` is the edge of a hash cell (a typical spacing of the points).
   */
  constructor(points: ArrayLike<number>, members: Uint32Array, cellSize: number) {
    this.points = points;
    this.members = members;
    this.h = cellSize;
    for (const i of members) {
      const key = this.key(
        Math.floor((points[3 * i] as number) / cellSize),
        Math.floor((points[3 * i + 1] as number) / cellSize),
        Math.floor((points[3 * i + 2] as number) / cellSize),
      );
      const list = this.cells.get(key);
      if (list === undefined) this.cells.set(key, [i]);
      else list.push(i);
    }
  }

  /** One number per hash cell; cells further than 2^16 from the origin may share a key. */
  private key(ix: number, iy: number, iz: number): number {
    return (
      ((ix + HALF) & MASK) * (MASK + 1) * (MASK + 1) +
      ((iy + HALF) & MASK) * (MASK + 1) +
      ((iz + HALF) & MASK)
    );
  }

  /**
   * Index of the nearest member to (x, y, z) that `accept` allows (default: any), or -1 when
   * there is none. The search covers the hash cells within two of the point's own; a member found
   * there but further than the cells searched may not be the very nearest. When none is found
   * there, every member is tried if `exhaustive`, else the answer is -1.
   */
  nearest(
    x: number,
    y: number,
    z: number,
    accept?: (index: number) => boolean,
    exhaustive = true,
  ): number {
    const p = this.points;
    let best = -1;
    let bestD = Number.POSITIVE_INFINITY;
    const consider = (i: number): void => {
      if (accept !== undefined && !accept(i)) return;
      const d = Math.hypot(
        (p[3 * i] as number) - x,
        (p[3 * i + 1] as number) - y,
        (p[3 * i + 2] as number) - z,
      );
      if (d < bestD || (d === bestD && i < best)) {
        bestD = d;
        best = i;
      }
    };
    const ix = Math.floor(x / this.h);
    const iy = Math.floor(y / this.h);
    const iz = Math.floor(z / this.h);
    // Shell by shell: once a point is found nearer than the inner faces of the next shell, no
    // point further out can be nearer.
    for (let ring = 0; ring <= RINGS; ring++) {
      for (let ax = ix - ring; ax <= ix + ring; ax++) {
        for (let ay = iy - ring; ay <= iy + ring; ay++) {
          const edge = Math.abs(ax - ix) === ring || Math.abs(ay - iy) === ring;
          for (let az = iz - ring; az <= iz + ring; az += edge ? 1 : Math.max(1, 2 * ring)) {
            const list = this.cells.get(this.key(ax, ay, az));
            if (list !== undefined) for (const i of list) consider(i);
          }
        }
      }
      if (best >= 0 && bestD <= ring * this.h) return best;
    }
    if (best >= 0 || !exhaustive) return best;
    for (const i of this.members) consider(i);
    return best;
  }
}
