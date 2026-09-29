/** Grille de hachage spatial : indices d'éléments rangés par case de `cell` mètres. */
export class SampleGrid {
  private readonly map = new Map<number, number[]>();
  constructor(readonly cell: number) {}

  private key(ix: number, iz: number): number {
    return (ix + 32768) * 65536 + (iz + 32768);
  }

  add(i: number, x: number, z: number): void {
    const k = this.key(Math.floor(x / this.cell), Math.floor(z / this.cell));
    let b = this.map.get(k);
    if (!b) { b = []; this.map.set(k, b); }
    b.push(i);
  }

  /** Remplit `out` avec les indices des cases qui recouvrent le carré (x ± r, z ± r). */
  query(x: number, z: number, radius: number, out: number[]): number[] {
    out.length = 0;
    const c = this.cell;
    const x0 = Math.floor((x - radius) / c), x1 = Math.floor((x + radius) / c);
    const z0 = Math.floor((z - radius) / c), z1 = Math.floor((z + radius) / c);
    for (let iz = z0; iz <= z1; iz++) {
      for (let ix = x0; ix <= x1; ix++) {
        const b = this.map.get(this.key(ix, iz));
        if (b) for (const i of b) out.push(i);
      }
    }
    return out;
  }
}
