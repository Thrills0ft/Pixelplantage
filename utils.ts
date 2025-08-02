/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// --- Inlined simplex-noise for portability and offline use ---
// Source: https://github.com/jwagner/simplex-noise.js (MIT License)
// Only the 2D noise function is included as it's the only one used.
export function createNoise2D(random = Math.random) {
    const G2 = (3 - Math.sqrt(3)) / 6;
    const grad3 = new Float32Array([1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1]);
    const p = new Uint8Array(256);
    const perm = new Uint8Array(512);
    const permMod12 = new Uint8Array(512);
    for (let i = 0; i < 256; i++) {
        p[i] = i;
    }
    for (let i = 255; i > 0; i--) {
        const r = Math.floor(random() * (i + 1));
        const t = p[i];
        p[i] = p[r];
        p[r] = t;
    }
    for (let i = 0; i < 512; i++) {
        const v = p[i & 255];
        perm[i] = v;
        permMod12[i] = v % 12;
    }
    return function noise2D(x: number, y: number) {
        const s = (x + y) * 0.5 * (Math.sqrt(3) - 1);
        const i = Math.floor(x + s);
        const j = Math.floor(y + s);
        const t = (i + j) * G2;
        const X0 = i - t;
        const Y0 = j - t;
        const x0 = x - X0;
        const y0 = y - Y0;
        let i1, j1;
        if (x0 > y0) {
            i1 = 1;
            j1 = 0;
        } else {
            i1 = 0;
            j1 = 1;
        }
        const x1 = x0 - i1 + G2;
        const y1 = y0 - j1 + G2;
        const x2 = x0 - 1 + 2 * G2;
        const y2 = y0 - 1 + 2 * G2;
        const ii = i & 255;
        const jj = j & 255;
        let n0, n1, n2;
        let t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 < 0) {
            n0 = 0;
        } else {
            t0 *= t0;
            const gi = permMod12[ii + perm[jj]] * 3;
            n0 = t0 * t0 * (grad3[gi] * x0 + grad3[gi + 1] * y0);
        }
        let t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 < 0) {
            n1 = 0;
        } else {
            t1 *= t1;
            const gi = permMod12[ii + i1 + perm[jj + j1]] * 3;
            n1 = t1 * t1 * (grad3[gi] * x1 + grad3[gi + 1] * y1);
        }
        let t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 < 0) {
            n2 = 0;
        } else {
            t2 *= t2;
            const gi = permMod12[ii + 1 + perm[jj + 1]] * 3;
            n2 = t2 * t2 * (grad3[gi] * x2 + grad3[gi + 1] * y2);
        }
        return 70 * (n0 + n1 + n2);
    };
}
