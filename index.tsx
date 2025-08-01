
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// --- Inlined simplex-noise for portability and offline use ---
// Source: https://github.com/jwagner/simplex-noise.js (MIT License)
// Only the 2D noise function is included as it's the only one used.
function createNoise2D(random = Math.random) {
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
    return function noise2D(x, y) {
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


// --- CONFIG ---
const TILE_SIZE = 48;
const MAP_WIDTH = 50;
const MAP_HEIGHT = 50;
const DAY_DURATION_MS = 10000;
const LAND_COST = 100;
const TAX_PER_TILE = 0.25;
const MAX_WATER = 999;

const TILE_TYPE = {
    WATER: 0,
    GRASS: 1,
    FOREST: 2,
    MOUNTAIN: 3,
    ROCK: 4,
    TILLED_SOIL: 5,
    FARMHOUSE: 6,
};

type PlantStatus = 'alive' | 'withered' | 'drowned' | 'ripe';

interface Plant {
    type: string;
    growthStage: number;
    moisture: number;
    status: PlantStatus;
}

interface PlantData {
    name: string;
    price: number;
    sell: number;
    growthTime: number;
    waterNeed: number;
    scoreRequirement: number;
}

const PLANT_DATA: { [key: string]: PlantData } = {
    sunflower: { name: 'Sonnenblume', price: 5, sell: 15, growthTime: 5, waterNeed: 0.5, scoreRequirement: 0 },
    carrot: { name: 'Karotte', price: 10, sell: 30, growthTime: 10, waterNeed: 1, scoreRequirement: 0 },
    tomato: { name: 'Tomate', price: 15, sell: 45, growthTime: 15, waterNeed: 2, scoreRequirement: 0 },
    strawberry: { name: 'Erdbeere', price: 20, sell: 65, growthTime: 17, waterNeed: 2.5, scoreRequirement: 250 },
    pumpkin: { name: 'Kürbis', price: 25, sell: 80, growthTime: 20, waterNeed: 3, scoreRequirement: 500 },
};

// --- SVG ASSETS ---
/**
 * Converts an SVG string to a data URL.
 * Using encodeURIComponent is more robust than btoa for SVGs, especially across different browsers and server configurations.
 * This avoids potential issues with character encoding that can cause btoa to fail.
 */
const svgToDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const assetSources: { [key: string]: string } = {
    grass: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill="#78c258"/><path d="M0 24 q 12 -12 24 0 t 24 0" fill="none" stroke="#8ad268" stroke-width="2"/><path d="M0 48 q 12 -12 24 0 t 24 0" fill="none" stroke="#8ad268" stroke-width="2"/></svg>'),
    tilled_soil: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill="#a17a58"/><path d="M0 12 H 48 M0 24 H 48 M0 36 H 48" fill="none" stroke="#8a6a4c" stroke-width="3"/></svg>'),
    water: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill="#4f8be2"/></svg>'),
    farmhouse: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" fill="#a17a58" /><path d="M12 42 L 84 42 L 84 50 L 48 68 L 12 50 Z" fill="rgba(0,0,0,0.2)" /><rect x="18" y="18" width="60" height="30" fill="#c62828" stroke="#a92323" stroke-width="1.5" /><path d="M14 20 L 48 4 L 82 20 Z" fill="#616161" stroke="#424242" stroke-width="2"/><path d="M14 20 H 82" stroke="#424242" stroke-width="1.5" /><rect x="36" y="28" width="24" height="20" fill="#8d6e63" stroke="#543a34" stroke-width="1" /><path d="M36 28 L 60 48" stroke="#543a34" stroke-width="2"/><path d="M36 48 L 60 28" stroke="#543a34" stroke-width="2"/><circle cx="48" cy="13" r="4" fill="#90a4ae" stroke="#424242" stroke-width="1.5"/><g transform="translate(10, 35)"><rect x="18" y="32" width="8" height="18" fill="#6d4c41" /><circle cx="22" cy="22" r="18" fill="#4caf50" /><circle cx="32" cy="28" r="10" fill="#66bb6a" /><circle cx="12" cy="28" r="10" fill="#66bb6a" /></g><g transform="translate(50, 68)"><!-- Tractor --><!-- Back wheel --><circle cx="8" cy="12" r="7" fill="#333" stroke="#111" stroke-width="1.5" /><!-- Front wheel --><circle cx="23" cy="14" r="4" fill="#333" stroke="#111" stroke-width="1.5" /><!-- Body --><rect x="5" y="4" width="20" height="8" fill="#fdd835" stroke="#c68615" stroke-width="1" rx="1" /><!-- Cabin --><rect x="5" y="0" width="8" height="5" fill="#90a4ae" stroke="#546e7a" stroke-width="1" rx="1" /><!-- Exhaust --><rect x="18" y="0" width="2" height="4" fill="#424242" /></g></svg>'),
    tree1: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect x="20" y="28" width="8" height="20" fill="#6d4c41"/><path d="M 24,4 A 20 20 0 0 1 24,44 A 20 20 0 0 1 24,4" fill="#4caf50"/><path d="M 12,18 A 12 12 0 0 1 12,42" fill="#388e3c"/></svg>'),
    tree2: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect x="22" y="30" width="6" height="18" fill="#8d6e63"/><path d="M 25 10 C 10 15, 10 35, 25 40 Z" fill="#2e7d32"/><path d="M 23 10 C 38 15, 38 35, 23 40 Z" fill="#558b2f"/></svg>'),
    rock1: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M5 43 C 2 30, 15 20, 25 22 C 45 25, 45 43, 45 43 Z" fill="#9e9e9e" stroke="#616161" stroke-width="1.5"/><path d="M25 22 C 20 30, 25 43, 25 43" fill="none" stroke="#616161" stroke-width="1"/></svg>'),
    rock2: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M8 43 C 5 35, 20 33, 22 35 C 25 38, 15 43, 8 43 Z" fill="#bdbdbd" stroke="#757575" stroke-width="1.5"/><path d="M20 43 C 18 30, 30 25, 40 28 C 50 32, 45 43, 20 43 Z" fill="#9e9e9e" stroke="#616161" stroke-width="1.5"/></svg>'),
    sun_icon: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="12" fill="#FFA500"/><line x1="24" y1="5" x2="24" y2="10" stroke="#FFA500" stroke-width="4" stroke-linecap="round"/><line x1="24" y1="38" x2="24" y2="43" stroke="#FFA500" stroke-width="4" stroke-linecap="round"/><line x1="5" y1="24" x2="10" y2="24" stroke="#FFA500" stroke-width="4" stroke-linecap="round"/><line x1="38" y1="24" x2="43" y2="24" stroke="#FFA500" stroke-width="4" stroke-linecap="round"/><line x1="9" y1="9" x2="12" y2="12" stroke="#FFA500" stroke-width="4" stroke-linecap="round"/><line x1="36" y1="36" x2="39" y2="39" stroke="#FFA500" stroke-width="4" stroke-linecap="round"/><line x1="9" y1="39" x2="12" y2="36" stroke="#FFA500" stroke-width="4" stroke-linecap="round"/><line x1="36" y1="12" x2="39" y2="9" stroke="#FFA500" stroke-width="4" stroke-linecap="round"/><circle cx="20" cy="23" r="1.5" fill="#4a4a4a"/><circle cx="28" cy="23" r="1.5" fill="#4a4a4a"/><path d="M 19 31 C 21 28, 27 28, 29 31" fill="none" stroke="#4a4a4a" stroke-width="2" stroke-linecap="round"/></svg>'),
    raindrop_icon: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 12 C16 24 16 36 24 44 C32 36 32 24 24 12 Z" fill="#3498db"/><path d="M14 8 C10 16 10 24 14 30 C18 24 18 16 14 8 Z" fill="#3498db" opacity="0.8"/><path d="M34 4 C30 12 30 20 34 26 C38 20 38 12 34 4 Z" fill="#3498db" opacity="0.8"/></svg>'),
    carrot_0: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 40 v-3" stroke="#4caf50" stroke-width="2" stroke-linecap="round" fill="none"/></svg>'),
    carrot_1: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 40 C 28 36, 20 36, 24 34" stroke="#4caf50" stroke-width="2" stroke-linecap="round" fill="none"/></svg>'),
    carrot_2: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 40 C 28 36, 20 36, 24 32 M24 38 C 20 34, 28 34, 24 30" stroke="#4caf50" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg>'),
    carrot_3: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M22 36 C 18 32, 20 28, 24 30 M26 36 C 30 32, 28 28, 24 30" fill="none" stroke="#4caf50" stroke-width="3" stroke-linecap="round"/></svg>'),
    carrot_4: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 42 C 24 40, 23 39, 23 38" stroke="#ffb74d" stroke-width="1.5" stroke-linecap="round" fill="none"/><path d="M22 36 C 18 32, 20 28, 24 30 M26 36 C 30 32, 28 28, 24 30" fill="none" stroke="#4caf50" stroke-width="3" stroke-linecap="round"/></svg>'),
    carrot_5: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 43 C 24 39, 23 37, 22 36" stroke="#ffb74d" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M20 34 C 16 30, 20 26, 24 28 M28 34 C 32 30, 28 26, 24 28" fill="none" stroke="#388e3c" stroke-width="3.5" stroke-linecap="round"/></svg>'),
    carrot_6: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 44 C 24 38, 22.5 36, 21 34" stroke="#ff9800" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M20 34 C 14 28, 20 22, 26 26 M28 34 C 34 28, 30 22, 26 26" fill="none" stroke="#388e3c" stroke-width="4" stroke-linecap="round"/></svg>'),
    carrot_7: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 44 C 23 36, 21 34, 19 32" stroke="#ff9800" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M20 32 C 14 26, 20 18, 26 22 M28 32 C 34 26, 30 18, 26 22 M24 28 C 18 22, 28 16, 30 20" fill="none" stroke="#388e3c" stroke-width="4" stroke-linecap="round"/></svg>'),
    carrot_8: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 45 C 18 35, 18 25, 24 25 C 30 25, 30 35, 24 45" fill="#ff8c00"/><path d="M24 25 C 16 25, 16 12, 24 16 C 32 12, 32 25, 24 25" fill="#2e8b57" /><path d="M24 16 C 20 16, 20 4, 24 8 C 28 4, 28 16, 24 16 Z" fill="#3cb371"/></svg>'),
    carrot_9: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M 24 46 C 14 34, 14 18, 24 18 C 34 18, 34 34, 24 46 Z" fill="#ff8c00" stroke="#d2691e" stroke-width="1"/><path d="M 19 28 C 23 29, 25 29, 29 28 M 17 36 C 22 37, 26 37, 31 36" stroke="#bf6a1f" stroke-width="1.5" fill="none" stroke-linecap="round" /><path d="M 24 20 C 14 20, 14 4, 24 8 C 34 4, 34 20, 24 20 Z" fill="#2e8b57"/><path d="M 24 20 C 20 20, 20 8, 24 12 C 28 8, 28 20, 24 20 Z" fill="#3cb371"/></svg>'),
    carrot_10: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M 24 46 C 10 32, 10 14, 24 14 C 38 14, 38 32, 24 46 Z" fill="#ff8c00" stroke="#d2691e" stroke-width="2"/><path d="M 19 24 C 23 25, 25 25, 29 24 M 17 32 C 22 33, 26 33, 31 32 M 19 40 C 23 41, 25 41, 29 40" stroke="#bf6a1f" stroke-width="1.5" fill="none" stroke-linecap="round" /><path d="M 24 16 C 14 16, 14 0, 24 6 C 34 0, 34 16, 24 16 Z" fill="#2e8b57"/><path d="M 24 16 C 20 16, 20 4, 24 8 C 28 4, 28 16, 24 16 Z" fill="#3cb371"/></svg>'),
    tomato_0: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 40 v -5" stroke="#388e3c" stroke-width="2" stroke-linecap="round"/></svg>'),
    tomato_1: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 42 v -10" stroke="#388e3c" stroke-width="2" stroke-linecap="round"/></svg>'),
    tomato_2: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 42 v -15" stroke="#388e3c" stroke-width="2.5" stroke-linecap="round"/></svg>'),
    tomato_3: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 42 v -18" stroke="#388e3c" stroke-width="2.5" stroke-linecap="round"/></svg>'),
    tomato_4: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 42 v -20" stroke="#388e3c" stroke-width="3" stroke-linecap="round"/><circle cx="21" cy="34" r="2" fill="#a5d6a7"/></svg>'),
    tomato_5: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 42 v -20" stroke="#388e3c" stroke-width="3" stroke-linecap="round"/><circle cx="20" cy="32" r="3" fill="#81c784"/></svg>'),
    tomato_6: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 42 v -22" stroke="#388e3c" stroke-width="3" stroke-linecap="round"/><circle cx="28" cy="28" r="3" fill="#81c784"/><circle cx="20" cy="32" r="4" fill="#66bb6a"/></svg>'),
    tomato_7: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 42 v -25" stroke="#388e3c" stroke-width="3" stroke-linecap="round"/><circle cx="28" cy="25" r="4" fill="#66bb6a"/><circle cx="20" cy="34" r="5" fill="#4caf50"/></svg>'),
    tomato_8: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 42 v -25" stroke="#388e3c" stroke-width="3" stroke-linecap="round"/><circle cx="28" cy="25" r="5" fill="#ffee58"/><circle cx="20" cy="34" r="5" fill="#4caf50"/></svg>'),
    tomato_9: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 42 v -25" stroke="#388e3c" stroke-width="3" stroke-linecap="round"/><circle cx="28" cy="25" r="5" fill="#ffd54f"/><circle cx="20" cy="34" r="5" fill="#ffee58"/></svg>'),
    tomato_10: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 42 v -25" stroke="#388e3c" stroke-width="3" stroke-linecap="round"/><circle cx="28" cy="25" r="5" fill="#ffca28"/><circle cx="20" cy="34" r="5" fill="#ffd54f"/></svg>'),
    tomato_11: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 42 v -25" stroke="#388e3c" stroke-width="3" stroke-linecap="round"/><circle cx="28" cy="25" r="5" fill="#ffa000"/><circle cx="20" cy="34" r="5" fill="#ffca28"/></svg>'),
    tomato_12: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 42 v -25" stroke="#388e3c" stroke-width="3" stroke-linecap="round"/><circle cx="28" cy="25" r="6" fill="#fb8c00"/><circle cx="20" cy="34" r="6" fill="#ffa000"/></svg>'),
    tomato_13: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 42 v -28" stroke="#388e3c" stroke-width="4" stroke-linecap="round"/><circle cx="22" cy="20" r="6" fill="#fb8c00"/><circle cx="28" cy="26" r="7" fill="#ef5350"/><circle cx="20" cy="35" r="7" fill="#d32f2f"/></svg>'),
    tomato_14: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 42 v -28" stroke="#388e3c" stroke-width="4" stroke-linecap="round"/><circle cx="22" cy="19" r="7" fill="#ef5350"/><circle cx="28" cy="26" r="8" fill="#d32f2f"/><circle cx="20" cy="35" r="8" fill="#d32f2f"/></svg>'),
    tomato_15: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 42 v -28" stroke="#388e3c" stroke-width="4" stroke-linecap="round"/><circle cx="20" cy="35" r="8" fill="#d32f2f"/><circle cx="28" cy="26" r="8" fill="#d32f2f"/><circle cx="22" cy="18" r="8" fill="#d32f2f"/><circle cx="23" cy="32" r="2" fill="#ff6b6b" opacity="0.8"/><circle cx="31" cy="23" r="2" fill="#ff6b6b" opacity="0.8"/><circle cx="25" cy="15" r="2" fill="#ff6b6b" opacity="0.8"/></svg>'),
    sunflower_0: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 42 v -8" stroke="#81c784" stroke-width="3" stroke-linecap="round"/></svg>'),
    sunflower_1: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 44 V 30" stroke="#558b2f" stroke-width="4" stroke-linecap="round" /><path d="M24 40 c-4 -2 -4 -6, 0 -8" fill="none" stroke="#66bb6a" stroke-width="3" stroke-linecap="round"/></svg>'),
    sunflower_2: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 44 V 28" stroke="#558b2f" stroke-width="4" stroke-linecap="round" /><path d="M24 38 c-5 -2 -5 -8, 0 -10" fill="none" stroke="#66bb6a" stroke-width="3" stroke-linecap="round"/><path d="M24 34 c5 -2, 5 -8, 0 -10" fill="none" stroke="#66bb6a" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="26" r="4" fill="#388e3c"/></svg>'),
    sunflower_3: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 46 V 22" stroke="#4caf50" stroke-width="5" stroke-linecap="round" /><path d="M24 40 c-8 -3 -8 -12, 0 -15" fill="none" stroke="#689f38" stroke-width="4" stroke-linecap="round"/><path d="M24 35 c8 -3, 8 -12, 0 -15" fill="none" stroke="#689f38" stroke-width="4" stroke-linecap="round"/><circle cx="24" cy="18" r="8" fill="#388e3c" /><path d="M18 16 C 20 12, 28 12, 30 16" fill="#ffeb3b" stroke="#fdd835" stroke-width="1" /></svg>'),
    sunflower_4: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 48 V 22" stroke="#4CAF50" stroke-width="6" stroke-linecap="round"/><path d="M24 38 C 16 36 14 28 22 26" fill="none" stroke="#558B2F" stroke-width="5" stroke-linecap="round"/><path d="M24 32 C 32 30 34 22 28 24" fill="none" stroke="#689F38" stroke-width="5" stroke-linecap="round"/><circle cx="24" cy="20" r="10" fill="#6d4c41"/><g transform="translate(24, 20)"><path d="M 0,0 C -6,-6 -8,-12 0,-15 C 8,-12 6,-6 0,0" fill="#ffca28" transform="rotate(22.5)"/><path d="M 0,0 C -6,-6 -8,-12 0,-15 C 8,-12 6,-6 0,0" fill="#ffca28" transform="rotate(112.5)"/><path d="M 0,0 C -6,-6 -8,-12 0,-15 C 8,-12 6,-6 0,0" fill="#ffca28" transform="rotate(202.5)"/><path d="M 0,0 C -6,-6 -8,-12 0,-15 C 8,-12 6,-6 0,0" fill="#ffca28" transform="rotate(292.5)"/></g></svg>'),
    sunflower_5: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 48 V 22" stroke="#4CAF50" stroke-width="7" stroke-linecap="round"/><path d="M24 38 C 14 36 12 28 21 26" fill="none" stroke="#558B2F" stroke-width="5" stroke-linecap="round"/><path d="M24 32 C 34 30 36 22 27 24" fill="none" stroke="#689F38" stroke-width="5" stroke-linecap="round"/><g transform="translate(24, 22)"><g transform="rotate(15)"><path d="M 0,0 C -8,-8 -10,-16 0,-20 C 10,-16 8,-8 0,0" fill="#ffb300" transform="rotate(0)"/><path d="M 0,0 C -8,-8 -10,-16 0,-20 C 10,-16 8,-8 0,0" fill="#ffb300" transform="rotate(45)"/><path d="M 0,0 C -8,-8 -10,-16 0,-20 C 10,-16 8,-8 0,0" fill="#ffb300" transform="rotate(90)"/><path d="M 0,0 C -8,-8 -10,-16 0,-20 C 10,-16 8,-8 0,0" fill="#ffb300" transform="rotate(135)"/><path d="M 0,0 C -8,-8 -10,-16 0,-20 C 10,-16 8,-8 0,0" fill="#ffb300" transform="rotate(180)"/><path d="M 0,0 C -8,-8 -10,-16 0,-20 C 10,-16 8,-8 0,0" fill="#ffb300" transform="rotate(225)"/><path d="M 0,0 C -8,-8 -10,-16 0,-20 C 10,-16 8,-8 0,0" fill="#ffb300" transform="rotate(270)"/><path d="M 0,0 C -8,-8 -10,-16 0,-20 C 10,-16 8,-8 0,0" fill="#ffb300" transform="rotate(315)"/></g><g><path d="M 0,0 C -7,-7 -9,-13 0,-16 C 9,-13 7,-7 0,0" fill="#ffca28" transform="rotate(0)"/><path d="M 0,0 C -7,-7 -9,-13 0,-16 C 9,-13 7,-7 0,0" fill="#ffca28" transform="rotate(45)"/><path d="M 0,0 C -7,-7 -9,-13 0,-16 C 9,-13 7,-7 0,0" fill="#ffca28" transform="rotate(90)"/><path d="M 0,0 C -7,-7 -9,-13 0,-16 C 9,-13 7,-7 0,0" fill="#ffca28" transform="rotate(135)"/><path d="M 0,0 C -7,-7 -9,-13 0,-16 C 9,-13 7,-7 0,0" fill="#ffca28" transform="rotate(180)"/><path d="M 0,0 C -7,-7 -9,-13 0,-16 C 9,-13 7,-7 0,0" fill="#ffca28" transform="rotate(225)"/><path d="M 0,0 C -7,-7 -9,-13 0,-16 C 9,-13 7,-7 0,0" fill="#ffca28" transform="rotate(270)"/><path d="M 0,0 C -7,-7 -9,-13 0,-16 C 9,-13 7,-7 0,0" fill="#ffca28" transform="rotate(315)"/></g><circle cx="0" cy="0" r="11" fill="#6d4c41"/></g></svg>'),
    strawberry_0: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><path d="M24 40 C 28 36, 20 36, 24 32" stroke="#4caf50" stroke-width="2" stroke-linecap="round" fill="none"/></g></svg>'),
    strawberry_1: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><g transform="translate(0, 5)"><path d="M 24 38 C 20 32, 22 28, 26 30" fill="#4caf50" stroke="#388e3c" stroke-width="1.5"/></g></g></svg>'),
    strawberry_2: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><g transform="translate(0, 5)"><path d="M 24 38 C 18 30, 20 24, 28 27" fill="#4caf50" stroke="#388e3c" stroke-width="2"/></g></g></svg>'),
    strawberry_3: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><g transform="translate(0, 5)"><path d="M 24 38 C 30 30, 28 24, 20 27" fill="#4caf50" stroke="#388e3c" stroke-width="2"/></g></g></svg>'),
    strawberry_4: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><g transform="translate(0, 5)"><path d="M 24 38 C 18 30, 20 20, 28 25" fill="#4caf50" stroke="#388e3c" stroke-width="2"/><path d="M 24 38 C 30 30, 28 20, 20 25" fill="#4caf50" stroke="#388e3c" stroke-width="2"/></g></g></svg>'),
    strawberry_5: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><g transform="translate(0, 5)"><path d="M 24 38 C 18 30, 20 20, 28 25" fill="#4caf50" stroke="#388e3c" stroke-width="2"/><path d="M 24 38 C 30 30, 28 20, 20 25" fill="#4caf50" stroke="#388e3c" stroke-width="2"/><circle cx="24" cy="24" r="2" fill="#e8f5e9" stroke="#c8e6c9" stroke-width="1"/></g></g></svg>'),
    strawberry_6: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><g transform="translate(0, 5)"><path d="M 24 38 C 18 30, 20 20, 28 25" fill="#4caf50" stroke="#388e3c" stroke-width="2"/><path d="M 24 38 C 30 30, 28 20, 20 25" fill="#4caf50" stroke="#388e3c" stroke-width="2"/><circle cx="21" cy="23" r="3" fill="#e8f5e9" stroke="#c8e6c9" stroke-width="1"/></g></g></svg>'),
    strawberry_7: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><g transform="translate(0, 5)"><path d="M 24 38 C 18 30, 20 20, 28 25" fill="#4caf50" stroke="#388e3c" stroke-width="2"/><path d="M 24 38 C 30 30, 28 20, 20 25" fill="#4caf50" stroke="#388e3c" stroke-width="2"/><circle cx="27" cy="23" r="3" fill="#e8f5e9" stroke="#c8e6c9" stroke-width="1"/></g></g></svg>'),
    strawberry_8: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><g transform="translate(0, 5)"><path d="M 24 38 C 18 30, 20 20, 28 25" fill="#4caf50" stroke="#388e3c" stroke-width="2"/><path d="M 24 38 C 30 30, 28 20, 20 25" fill="#4caf50" stroke="#388e3c" stroke-width="2"/><circle cx="24" cy="22" r="4" fill="#e8f5e9" stroke="#c8e6c9" stroke-width="1"/><circle cx="24" cy="22" r="2" fill="#ffeb3b"/></g></g></svg>'),
    strawberry_9: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><g transform="translate(0, 5)"><path d="M 24 38 C 18 30, 20 20, 28 25" fill="#4caf50" stroke="#388e3c" stroke-width="2"/><path d="M 24 38 C 30 30, 28 20, 20 25" fill="#4caf50" stroke="#388e3c" stroke-width="2"/><g><path d="M22 30 C 21 32, 24 33, 23 31 Z" fill="#c8e6c9"/></g></g></g></svg>'),
    strawberry_10: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><g transform="translate(0, 5)"><path d="M 24 38 C 18 30, 20 20, 28 25" fill="#4caf50" stroke="#388e3c" stroke-width="2"/><path d="M 24 38 C 30 30, 28 20, 20 25" fill="#4caf50" stroke="#388e3c" stroke-width="2"/><g><path d="M22 29 C 20 33, 24 34, 23 30 Z" fill="#a5d6a7"/></g></g></g></svg>'),
    strawberry_11: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><g transform="translate(0, 5)"><path d="M 24 38 C 18 30, 20 20, 28 25" fill="#4caf50" stroke="#388e3c" stroke-width="2"/><path d="M 24 38 C 30 30, 28 20, 20 25" fill="#4caf50" stroke="#388e3c" stroke-width="2"/><g><path d="M26 29 C 28 33, 24 34, 25 30 Z" fill="#a5d6a7"/></g></g></g></svg>'),
    strawberry_12: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><g transform="translate(0, 5)"><path d="M 24 38 C 18 30, 20 20, 28 25" fill="#4caf50" stroke="#388e3c" stroke-width="2"/><path d="M 24 38 C 30 30, 28 20, 20 25" fill="#4caf50" stroke="#388e3c" stroke-width="2"/><g><path d="M20 28 C 18 34, 24 36, 22 30 Z" fill="#ffcdd2"/></g></g></g></svg>'),
    strawberry_13: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><g transform="translate(0, 5)"><path d="M 24 38 C 18 30, 20 20, 28 25" fill="#4caf50" stroke="#388e3c" stroke-width="2"/><path d="M 24 38 C 30 30, 28 20, 20 25" fill="#4caf50" stroke="#388e3c" stroke-width="2"/><g><path d="M28 29 C 30 35, 24 37, 26 31 Z" fill="#ffcdd2"/></g></g></g></svg>'),
    strawberry_14: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><g transform="translate(0, 5)"><path d="M 24 38 C 18 30, 20 20, 28 25" fill="#4caf50" stroke="#388e3c" stroke-width="2"/><path d="M 24 38 C 30 30, 28 20, 20 25" fill="#4caf50" stroke="#388e3c" stroke-width="2"/><g><path d="M20 28 C 18 34, 24 36, 22 30 Z" fill="#ef9a9a"/></g></g></g></svg>'),
    strawberry_15: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><g transform="translate(0, 5)"><path d="M 24 38 C 18 30, 20 20, 28 25" fill="#4caf50" stroke="#388e3c" stroke-width="2"/><path d="M 24 38 C 30 30, 28 20, 20 25" fill="#4caf50" stroke="#388e3c" stroke-width="2"/><g><path d="M28 29 C 30 35, 24 37, 26 31 Z" fill="#ef9a9a"/></g></g></g></svg>'),
    strawberry_16: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><g transform="translate(0, 5)"><path d="M 24 38 C 18 30, 20 20, 28 25" fill="#4caf50" stroke="#388e3c" stroke-width="2"/><path d="M 24 38 C 30 30, 28 20, 20 25" fill="#4caf50" stroke="#388e3c" stroke-width="2"/><g><path d="M24 32 C 20 38, 30 38, 26 32 Z" fill="#e57373"/></g></g></g></svg>'),
    strawberry_17: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><g transform="translate(0, 5)"><path d="M 24 38 C 18 30, 20 20, 28 25" fill="#4caf50" stroke="#388e3c" stroke-width="2"/><path d="M 24 38 C 30 30, 28 20, 20 25" fill="#4caf50" stroke="#388e3c" stroke-width="2"/><g><path d="M20 28 C 18 34, 24 36, 22 30 Z" fill="#e53935"/><path d="M28 29 C 30 35, 24 37, 26 31 Z" fill="#e53935"/><path d="M24 32 C 20 38, 30 38, 26 32 Z" fill="#e53935"/></g></g></g></svg>'),
    pumpkin_0: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><path d="M24 40 v -5" stroke="#388e3c" stroke-width="2" stroke-linecap="round"/></g></svg>'),
    pumpkin_1: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><path d="M24 40 v-8" stroke="#388e3c" stroke-width="2.5" stroke-linecap="round"/></g></svg>'),
    pumpkin_2: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><path d="M 18 40 C 22 35, 28 40, 32 38" stroke="#4caf50" stroke-width="3" stroke-linecap="round" fill="none"/></g></svg>'),
    pumpkin_3: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><path d="M 16 40 C 22 32, 30 40, 38 36" stroke="#4caf50" stroke-width="3.5" stroke-linecap="round" fill="none"/></g></svg>'),
    pumpkin_4: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><path d="M 12 40 C 20 30, 30 40, 40 35" stroke="#4caf50" stroke-width="4" stroke-linecap="round" fill="none"/></g></svg>'),
    pumpkin_5: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><path d="M 12 40 C 20 30, 30 40, 40 35" stroke="#4caf50" stroke-width="4" stroke-linecap="round" fill="none"/><circle cx="38" cy="32" r="3" fill="#ffeb3b" stroke="#fbc02d" stroke-width="1"/></g></svg>'),
    pumpkin_6: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><path d="M 12 40 C 20 30, 30 40, 40 35" stroke="#4caf50" stroke-width="4" stroke-linecap="round" fill="none"/><circle cx="36" cy="31" r="4" fill="#ffeb3b" stroke="#fbc02d" stroke-width="1.5"/></g></svg>'),
    pumpkin_7: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><path d="M 12 40 C 20 30, 30 40, 40 35" stroke="#4caf50" stroke-width="4" stroke-linecap="round" fill="none"/><circle cx="30" cy="30" r="5" fill="#ffeb3b" stroke="#fbc02d" stroke-width="1.5"/></g></svg>'),
    pumpkin_8: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><path d="M 12 40 C 20 30, 30 40, 40 35" stroke="#4caf50" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M 32 40 C 28 41, 28 36, 32 36 C 36 36, 36 41, 32 40 Z" fill="#c8e6c9" stroke="#a5d6a7" stroke-width="1"/></g></svg>'),
    pumpkin_9: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><path d="M 12 40 C 20 30, 30 40, 40 35" stroke="#4caf50" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M 32 40 C 27 41.5, 27 34.5, 32 34.5 C 38 34.5, 38 41.5, 32 40 Z" fill="#a5d6a7" stroke="#81c784" stroke-width="1.5"/></g></svg>'),
    pumpkin_10: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><path d="M 12 40 C 20 30, 30 40, 40 35" stroke="#4caf50" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M 32 40 C 26 42, 26 33, 32 33 C 39 33, 39 42, 32 40 Z" fill="#81c784" stroke="#66bb6a" stroke-width="2"/></g></svg>'),
    pumpkin_11: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><path d="M 12 40 C 20 30, 30 40, 40 35" stroke="#4caf50" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M 32 40 C 25 42, 25 32, 32 32 C 40 32, 40 42, 32 40 Z" fill="#66bb6a" stroke="#43a047" stroke-width="2"/></g></svg>'),
    pumpkin_12: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><path d="M 12 40 C 20 30, 30 40, 40 35" stroke="#4caf50" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M 33 41 C 24 44, 24 30, 33 30 C 42 30, 42 44, 33 41 Z" fill="#ffecb3" stroke="#ffe082" stroke-width="2"/></g></svg>'),
    pumpkin_13: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><path d="M 12 40 C 20 30, 30 40, 40 35" stroke="#4caf50" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M 33 41 C 23 45, 23 29, 33 29 C 43 29, 43 45, 33 41 Z" fill="#ffe082" stroke="#ffd54f" stroke-width="2"/></g></svg>'),
    pumpkin_14: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><path d="M 12 40 C 20 30, 30 40, 40 35" stroke="#4caf50" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M 33.5 41.5 C 22 46, 22 28.5, 33.5 28.5 C 45 28.5, 45 46, 33.5 41.5 Z" fill="#ffd54f" stroke="#ffca28" stroke-width="2"/></g></svg>'),
    pumpkin_15: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><path d="M 12 40 C 20 30, 30 40, 40 35" stroke="#4caf50" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M 34 42 C 21 47, 21 28, 34 28 C 47 28, 47 47, 34 42 Z" fill="#ffca28" stroke="#ffc107" stroke-width="2"/></g></svg>'),
    pumpkin_16: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><path d="M 12 40 C 20 30, 30 40, 40 35" stroke="#4caf50" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M 34 42 C 20 48, 20 28, 34 28 C 48 28, 48 48, 34 42 Z" fill="#ffb300" stroke="#ffa000" stroke-width="2"/><rect x="32" y="24" width="4" height="6" fill="#558b2f" rx="2"/></g></svg>'),
    pumpkin_17: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><path d="M 12 40 C 20 30, 30 40, 40 35" stroke="#4caf50" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M 34 42 C 19 48, 19 28, 34 28 C 49 28, 49 48, 34 42 Z" fill="#ffa000" stroke="#ff8f00" stroke-width="2"/><path d="M34 28 C 31 35, 37 35, 34 42 M34 28 C 37 35, 31 35, 34 42" stroke="#e65100" stroke-width="0.5" stroke-linecap="round" fill="none"/><rect x="32" y="24" width="4" height="6" fill="#558b2f" rx="2"/></g></svg>'),
    pumpkin_18: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><path d="M 12 40 C 20 30, 30 40, 40 35" stroke="#4caf50" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M 34 42 C 18.5 48, 18.5 28, 34 28 C 49.5 28, 49.5 48, 34 42 Z" fill="#ff8f00" stroke="#ff6f00" stroke-width="2"/><path d="M34 28 C 30.5 35, 37.5 35, 34 42 M34 28 C 37.5 35, 30.5 35, 34 42" stroke="#e65100" stroke-width="1" stroke-linecap="round" fill="none"/><rect x="32" y="24" width="4" height="6" fill="#558b2f" rx="2"/></g></svg>'),
    pumpkin_19: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><path d="M 12 40 C 20 30, 30 40, 40 35" stroke="#4caf50" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M 34 42 C 18 48, 18 28, 34 28 C 50 28, 50 48, 34 42 Z" fill="#fb8c00" stroke="#f57c00" stroke-width="2"/><path d="M34 28 C 30 35, 38 35, 34 42 M34 28 C 38 35, 30 35, 34 42" stroke="#e65100" stroke-width="1.5" stroke-linecap="round" fill="none"/><rect x="32" y="24" width="4" height="6" fill="#558b2f" rx="2"/></g></svg>'),
    pumpkin_20: svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="translate(-12, -12) scale(1.8)"><path d="M 12 40 C 20 30, 30 40, 40 35" stroke="#4caf50" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M 34 42 C 18 48, 18 28, 34 28 C 50 28, 50 48, 34 42 Z" fill="#fb8c00" stroke="#f57c00" stroke-width="2"/><path d="M34 28 C 30 35, 38 35, 34 42 M34 28 C 38 35, 30 35, 34 42 M34 28 C 34 38, 34 38, 34 42" stroke="#e65100" stroke-width="2" stroke-linecap="round" fill="none"/><rect x="32" y="24" width="4" height="6" fill="#558b2f" rx="2"/></g></svg>'),
};


// --- GAME STATE ---
let gameState: {
    map: number[][];
    plants: {[key: string]: Plant};
    player: { money: number; score: number; ownedTiles: string[]; water: number; unlockedPlantCount: number; };
    time: { day: number; timeOfDay: number; animationFrame: number; };
    camera: { x: number; y: number; };
    selectedTool: string;
    farmhouse: { x: number; y: number; size: number; };
    plantingCoords: { x: number, y: number } | null;
} = {
    map: [],
    plants: {},
    player: {
        money: 100,
        score: 0,
        ownedTiles: [],
        water: 100,
        unlockedPlantCount: 0,
    },
    time: {
        day: 1,
        timeOfDay: 0,
        animationFrame: 0,
    },
    camera: { x: 0, y: 0 },
    selectedTool: 'hand',
    farmhouse: { x: 0, y: 0, size: 2 },
    plantingCoords: null,
};
let isPaused = false;

// --- RENDERING & CACHING ---
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');
const previewCanvas = document.getElementById('map-preview-canvas') as HTMLCanvasElement;
const previewCtx = previewCanvas.getContext('2d');

let mapCacheCanvas: HTMLCanvasElement | null = null;
let mapCacheCtx: CanvasRenderingContext2D | null = null;
let cacheNeedsRedraw = true;

const noise2D = createNoise2D();

// --- ASSET MANAGER ---
class AssetManager {
    public assets: { [key: string]: HTMLImageElement } = {};
    private promises: Promise<void>[] = [];

    constructor() {
        for (const key in assetSources) {
            const promise = new Promise<void>((resolve, reject) => {
                const img = new Image();
                this.assets[key] = img;
                img.onload = () => resolve();
                img.onerror = (err) => reject(new Error(`Failed to load asset: ${key} - ${err}`));
                img.src = assetSources[key];
            });
            this.promises.push(promise);
        }
    }

    async loadAssets() {
        await Promise.all(this.promises);
    }
}
const assetManager = new AssetManager();


// --- MAP & TILE HELPERS ---
function getTileType(x: number, y: number): number | undefined {
    if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return undefined;
    const { x: hx, y: hy, size } = gameState.farmhouse;
    if (x >= hx && x < hx + size && y >= hy && y < hy + size) {
        return TILE_TYPE.FARMHOUSE;
    }
    return gameState.map[y]?.[x];
}

function isWater(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return false;
    return gameState.map[y]?.[x] === TILE_TYPE.WATER;
}

function isAdjacentToOwnedOrFarmhouse(x: number, y: number): boolean {
    // Check adjacency to owned tiles (cardinal)
    const neighbors = [
        `${x},${y - 1}`, `${x},${y + 1}`,
        `${x - 1},${y}`, `${x + 1},${y}`,
    ];
    if (neighbors.some(key => gameState.player.ownedTiles.includes(key))) {
        return true;
    }

    // Check adjacency to farmhouse (cardinal)
    const { x: hx, y: hy, size } = gameState.farmhouse;
    // Check above and below the farmhouse
    if (x >= hx && x < hx + size) {
        if (y === hy - 1 || y === hy + size) {
            return true;
        }
    }
    // Check to the left and right of the farmhouse
    if (y >= hy && y < hy + size) {
        if (x === hx - 1 || x === hx + size) {
            return true;
        }
    }
    
    return false;
}

function isShoreline(x: number, y: number): boolean {
    return isWater(x, y-1) || isWater(x, y+1) || isWater(x-1, y) || isWater(x+1, y);
}


function placeFarmhouseAndInitialTiles() {
    const { map } = gameState;
    let placed = false;
    // Try to place the farmhouse up to 200 times
    for (let i = 0; i < 200 && !placed; i++) {
        const hx = Math.floor(MAP_WIDTH / 2) + Math.floor(Math.random() * 30 - 15);
        const hy = Math.floor(MAP_HEIGHT / 2) + Math.floor(Math.random() * 30 - 15);
        
        // Check if the 2x2 area for the farmhouse is valid grass
        if (hx >= 0 && hx < MAP_WIDTH - 1 && hy >= 0 && hy < MAP_HEIGHT - 1 &&
            map[hy][hx] === TILE_TYPE.GRASS && 
            map[hy][hx+1] === TILE_TYPE.GRASS && 
            map[hy+1][hx] === TILE_TYPE.GRASS &&
            map[hy+1][hx+1] === TILE_TYPE.GRASS) {
            
            gameState.farmhouse.x = hx;
            gameState.farmhouse.y = hy;
            
            gameState.player.ownedTiles = [];
            const { x: fhx, y: fhy, size } = gameState.farmhouse;
            const potentialTiles = [
                // Top
                { x: fhx, y: fhy - 1 }, { x: fhx + 1, y: fhy - 1 },
                // Bottom
                { x: fhx, y: fhy + size }, { x: fhx + 1, y: fhy + size },
                // Left
                { x: fhx - 1, y: fhy }, { x: fhx - 1, y: fhy + 1 },
                // Right
                { x: fhx + size, y: fhy }, { x: fhx + size, y: fhy + 1 },
            ];
            
            // Shuffle for variety
            potentialTiles.sort(() => Math.random() - 0.5);

            for (const tile of potentialTiles) {
                if (gameState.player.ownedTiles.length >= 3) break;
                const {x: tx, y: ty} = tile;
                if ( ty >= 0 && ty < MAP_HEIGHT && tx >= 0 && tx < MAP_WIDTH &&
                     map[ty]?.[tx] === TILE_TYPE.GRASS && !isShoreline(tx, ty)) {
                    gameState.player.ownedTiles.push(`${tx},${ty}`);
                }
            }
            
            placed = true;
        }
    }
    
    gameState.plants = {};
    cacheNeedsRedraw = true;
    centerCameraOnFarmhouse();
    drawPreview();
}

function generateMap() {
    const map: number[][] = [];
    const scale = 0.05;
    for (let y = 0; y < MAP_HEIGHT; y++) {
        map[y] = [];
        for (let x = 0; x < MAP_WIDTH; x++) {
            const noiseValue = (noise2D(x * scale, y * scale) + 1) / 2;
            let tile;
            if (noiseValue < 0.3) tile = TILE_TYPE.WATER;
            else if (noiseValue < 0.6) tile = TILE_TYPE.GRASS;
            else if (noiseValue < 0.8) tile = TILE_TYPE.FOREST;
            else if (noiseValue < 0.9) tile = TILE_TYPE.ROCK;
            else tile = TILE_TYPE.MOUNTAIN;
            map[y][x] = tile;
        }
    }

    const isLocalWater = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return false;
        return map[y]?.[x] === TILE_TYPE.WATER;
    };

    // Create a grass buffer around water
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (map[y][x] !== TILE_TYPE.GRASS && map[y][x] !== TILE_TYPE.WATER) {
                 if (isLocalWater(x, y-1) || isLocalWater(x, y+1) || isLocalWater(x-1, y) || isLocalWater(x+1, y) ||
                     isLocalWater(x-1, y-1) || isLocalWater(x-1, y+1) || isLocalWater(x+1, y-1) || isLocalWater(x+1, y+1)) {
                     map[y][x] = TILE_TYPE.GRASS;
                 }
            }
        }
    }
    
    gameState.map = map;
    placeFarmhouseAndInitialTiles();
}

// --- GAME LOOP ---
let lastTime = 0;
function gameLoop(timestamp: number) {
    if (!lastTime) lastTime = timestamp;
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    update(deltaTime);
    render();

    requestAnimationFrame(gameLoop);
}

function update(deltaTime: number) {
    if(isPaused) return;

    gameState.time.animationFrame = (gameState.time.animationFrame + deltaTime * 0.01) % 1000;

    // --- Continuous plant updates ---
    for (const key in gameState.plants) {
        const plant = gameState.plants[key];
        if (plant.status !== 'alive') continue;

        const plantData = PLANT_DATA[plant.type];
        // Decrease moisture based on time passed and plant's water need
        plant.moisture -= (deltaTime / DAY_DURATION_MS) * plantData.waterNeed;

        // Check if the plant has withered
        if (plant.moisture <= 0) {
            plant.status = 'withered';
            showNotification(`${plantData.name} ist verdorrt!`);
        }
    }

    gameState.time.timeOfDay += deltaTime;
    if (gameState.time.timeOfDay >= DAY_DURATION_MS) {
        gameState.time.timeOfDay = 0;
        gameState.time.day++;
        updateDaily();
        updateUI();
    }
}

// --- RENDERING PIPELINE ---
function drawWaterTransitions(ctx: CanvasRenderingContext2D) {
    const grassColor = "#78c258";
    const waterColor = "#4f8be2";
    const r = TILE_SIZE; // Use full tile for rounding for a smoother look.

    // Pass 1: Draw convex land corners (adding grass on water tiles)
    ctx.fillStyle = grassColor;
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (!isWater(x, y)) continue;

            const wx = x * TILE_SIZE;
            const wy = y * TILE_SIZE;

            const n_land = !isWater(x, y - 1);
            const s_land = !isWater(x, y + 1);
            const w_land = !isWater(x - 1, y);
            const e_land = !isWater(x + 1, y);
            
            const nw_land = !isWater(x - 1, y - 1);
            const ne_land = !isWater(x + 1, y - 1);
            const sw_land = !isWater(x - 1, y + 1);
            const se_land = !isWater(x + 1, y + 1);

            // top-left corner is rounded land
            if (n_land && w_land && nw_land) {
                ctx.beginPath();
                ctx.moveTo(wx, wy);
                ctx.arc(wx, wy, r, 0, Math.PI / 2);
                ctx.closePath();
                ctx.fill();
            }
            // top-right corner is rounded land
            if (n_land && e_land && ne_land) {
                ctx.beginPath();
                ctx.moveTo(wx + TILE_SIZE, wy);
                ctx.arc(wx + TILE_SIZE, wy, r, Math.PI / 2, Math.PI);
                ctx.closePath();
                ctx.fill();
            }
            // bottom-left corner is rounded land
            if (s_land && w_land && sw_land) {
                ctx.beginPath();
                ctx.moveTo(wx, wy + TILE_SIZE);
                ctx.arc(wx, wy + TILE_SIZE, r, 1.5 * Math.PI, 2 * Math.PI);
                ctx.closePath();
                ctx.fill();
            }
            // bottom-right corner is rounded land
            if (s_land && e_land && se_land) {
                ctx.beginPath();
                ctx.moveTo(wx + TILE_SIZE, wy + TILE_SIZE);
                ctx.arc(wx + TILE_SIZE, wy + TILE_SIZE, r, Math.PI, 1.5 * Math.PI);
                ctx.closePath();
                ctx.fill();
            }
        }
    }

    // Pass 2: Draw concave land corners (adding water on land tiles)
    ctx.fillStyle = waterColor;
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (isWater(x, y)) continue;

            const wx = x * TILE_SIZE;
            const wy = y * TILE_SIZE;
            
            const n_water = isWater(x, y - 1);
            const s_water = isWater(x, y + 1);
            const w_water = isWater(x - 1, y);
            const e_water = isWater(x + 1, y);
            
            const nw_land = !isWater(x - 1, y - 1);
            const ne_land = !isWater(x + 1, y - 1);
            const sw_land = !isWater(x - 1, y + 1);
            const se_land = !isWater(x + 1, y + 1);

            // Concave at top-left
            if (n_water && w_water && nw_land) {
                ctx.beginPath();
                ctx.moveTo(wx, wy);
                ctx.arc(wx, wy, r, Math.PI, 1.5 * Math.PI);
                ctx.closePath();
                ctx.fill();
            }
            // Concave at top-right
            if (n_water && e_water && ne_land) {
                ctx.beginPath();
                ctx.moveTo(wx + TILE_SIZE, wy);
                ctx.arc(wx + TILE_SIZE, wy, r, 1.5 * Math.PI, 2 * Math.PI);
                ctx.closePath();
                ctx.fill();
            }
            // Concave at bottom-left
            if (s_water && w_water && sw_land) {
                ctx.beginPath();
                ctx.moveTo(wx, wy + TILE_SIZE);
                ctx.arc(wx, wy + TILE_SIZE, r, Math.PI / 2, Math.PI);
                ctx.closePath();
                ctx.fill();
            }
            // Concave at bottom-right
            if (s_water && e_water && se_land) {
                ctx.beginPath();
                ctx.moveTo(wx + TILE_SIZE, wy + TILE_SIZE);
                ctx.arc(wx + TILE_SIZE, wy + TILE_SIZE, r, 0, Math.PI / 2);
                ctx.closePath();
                ctx.fill();
            }
        }
    }
}

function drawMapToCache() {
    if (!mapCacheCtx || !mapCacheCanvas) return;
    mapCacheCtx.clearRect(0, 0, mapCacheCanvas.width, mapCacheCanvas.height);

    const waterSprite = assetManager.assets.water;
    const grassSprite = assetManager.assets.grass;

    // Pass 1: Base tiles
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const is_water = isWater(x, y);
            const baseSprite = is_water ? waterSprite : grassSprite;
             if(baseSprite && baseSprite.complete) {
                mapCacheCtx.drawImage(baseSprite, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
             }
        }
    }

    // Pass 1.5: Water Transitions
    drawWaterTransitions(mapCacheCtx);


    // Pass 2: Assets on top of grass
     for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const tileType = getTileType(x, y);
            const seed = (Math.sin(x * 13.37 + y * 93.7) + 1) / 2;
            let asset: HTMLImageElement | undefined;
            
            switch(tileType) {
                case TILE_TYPE.FOREST:
                    asset = seed > 0.5 ? assetManager.assets.tree1 : assetManager.assets.tree2;
                    break;
                case TILE_TYPE.ROCK:
                case TILE_TYPE.MOUNTAIN:
                    asset = seed > 0.5 ? assetManager.assets.rock1 : assetManager.assets.rock2;
                    break;
            }

            if (asset && asset.complete) {
                mapCacheCtx.drawImage(asset, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
        }
    }
    // Pass 3: Farmhouse
    const {x: hx, y: hy, size} = gameState.farmhouse;
    const farmhouseAsset = assetManager.assets.farmhouse;
    if (farmhouseAsset && farmhouseAsset.complete) {
        mapCacheCtx.drawImage(farmhouseAsset, hx * TILE_SIZE, hy * TILE_SIZE, TILE_SIZE * size, TILE_SIZE * size);
    }

    cacheNeedsRedraw = false;
}

function drawPreview() {
    if (!previewCtx) return;
    if (cacheNeedsRedraw && mapCacheCanvas) {
        drawMapToCache();
    }
    if (mapCacheCanvas) {
        previewCtx.drawImage(mapCacheCanvas, 0, 0, previewCanvas.width, previewCanvas.height);
    }
}

function render() {
    if (!ctx || !canvas) return;
    
    if (cacheNeedsRedraw && mapCacheCanvas) {
        drawMapToCache();
        drawPreview();
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw map from cache
    if (mapCacheCanvas) {
        ctx.drawImage(
            mapCacheCanvas,
            gameState.camera.x, gameState.camera.y, canvas.width, canvas.height,
            0, 0, canvas.width, canvas.height
        );
    }

    ctx.save();
    ctx.translate(-gameState.camera.x, -gameState.camera.y);
    
    const startX = Math.max(0, Math.floor(gameState.camera.x / TILE_SIZE));
    const endX = Math.min(MAP_WIDTH, Math.ceil((gameState.camera.x + canvas.width) / TILE_SIZE));
    const startY = Math.max(0, Math.floor(gameState.camera.y / TILE_SIZE));
    const endY = Math.min(MAP_HEIGHT, Math.ceil((gameState.camera.y + canvas.height) / TILE_SIZE));

    // Draw dynamic elements (plants, grid, highlight)
    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const key = `${x},${y}`;
             const tileType = getTileType(x,y);
            
            if (gameState.player.ownedTiles.includes(key)) {
                // Draw tilled soil if it's tilled, otherwise grid
                if(tileType === TILE_TYPE.TILLED_SOIL) {
                    const soilAsset = assetManager.assets.tilled_soil;
                    if (soilAsset && soilAsset.complete) {
                        ctx.drawImage(soilAsset, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                    }
                } else {
                    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                }
            }
            if (gameState.plants[key]) {
                drawPlant(x, y, gameState.plants[key]);
            }
        }
    }
    
    const [tileX, tileY] = screenToTile(lastMousePos.x, lastMousePos.y);
    ctx.strokeStyle = '#ffc800';
    ctx.lineWidth = 3;
    ctx.strokeRect(tileX * TILE_SIZE + 1.5, tileY * TILE_SIZE + 1.5, TILE_SIZE - 3, TILE_SIZE - 3);

    ctx.restore();
}

// --- PLANT & UI DRAWING ---
function drawPlant(x: number, y: number, plant: Plant) {
    let sprite: HTMLImageElement | undefined;

    const tilledSoilSprite = assetManager.assets.tilled_soil;
    if (tilledSoilSprite && tilledSoilSprite.complete) {
        ctx.drawImage(tilledSoilSprite, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }

    const plantKey = `${plant.type}_${plant.growthStage}`;
    if ((plant.status === 'alive' || plant.status === 'ripe') && assetManager.assets[plantKey]) {
        sprite = assetManager.assets[plantKey];
        if (sprite && sprite.complete) {
            ctx.drawImage(sprite, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
    } else { // Withered or Drowned
        sprite = plant.status === 'withered' ? assetManager.assets.sun_icon : assetManager.assets.raindrop_icon;
        if (sprite && sprite.complete) {
            const iconSize = TILE_SIZE * 0.7;
            const iconX = x * TILE_SIZE + (TILE_SIZE - iconSize) / 2;
            const iconY = y * TILE_SIZE + (TILE_SIZE - iconSize) / 2;
            ctx.drawImage(sprite, iconX, iconY, iconSize, iconSize);
        }
    }

    // Only draw the water bar if the plant is alive
    if (plant.status === 'alive') {
        const barWidth = TILE_SIZE * 0.8;
        const barHeight = 5;
        const barX = x * TILE_SIZE + (TILE_SIZE - barWidth) / 2;
        const barY = y * TILE_SIZE + 3;

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        const moisturePercent = plant.moisture / 10;
        const fillWidth = barWidth * moisturePercent;

        let barColor: string;
        if (plant.moisture >= 2 && plant.moisture <= 8) {
            barColor = '#3498db'; // Blue for optimal
        } else {
            barColor = '#f1c40f'; // Yellow for warning
        }

        ctx.fillStyle = barColor;
        ctx.fillRect(barX, barY, fillWidth, barHeight);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }
}


function updateUI() {
    if (!UIElements.info.day) return;

    UIElements.info.day.textContent = `Tag: ${gameState.time.day}`;
    UIElements.info.score.textContent = `⭐ ${gameState.player.score}`;
    UIElements.info.money.textContent = `💰 ${gameState.player.money.toFixed(2).replace('.', ',')}€`;
    UIElements.info.water.textContent = `💧 ${gameState.player.water}`;
}

let notificationTimeout: number;
function showNotification(message: string) {
    clearTimeout(notificationTimeout);
    UIElements.notification.innerHTML = message;
    UIElements.notification.classList.remove('hidden');
    UIElements.notification.style.animation = 'none';
    void UIElements.notification.offsetHeight;
    UIElements.notification.style.animation = ''; 
    notificationTimeout = window.setTimeout(() => {
        UIElements.notification.classList.add('hidden');
    }, 2900);
}

// --- PLANT & GAME LOGIC ---
function updateDaily() {
    for (const key in gameState.plants) {
        const plant = gameState.plants[key];
        const plantData = PLANT_DATA[plant.type];
        
        if (plant.status !== 'alive') continue;

        // Grow if moisture is in the optimal range
        if (plant.moisture >= 2 && plant.moisture <= 8) {
            if (plant.growthStage < plantData.growthTime) {
                plant.growthStage++;
            }
        }
        
        // Check for ripeness
        if (plant.growthStage >= plantData.growthTime) {
            plant.status = 'ripe';
            showNotification(`${plantData.name} ist reif zur Ernte!`);
        }
    }
    
    // Daily Tax based on owned land
    const taxAmount = gameState.player.ownedTiles.length * TAX_PER_TILE;
    gameState.player.money -= taxAmount;
    checkGameOver();
}

function getCheapestPlantPrice(): number {
    const availablePlants = Object.values(PLANT_DATA).filter(p => gameState.player.score >= p.scoreRequirement);
    if (availablePlants.length === 0) return Infinity; // No plants available
    return Math.min(...availablePlants.map(p => p.price));
}

function triggerGameOver() {
    isPaused = true;
    UIElements.gameOverScreen.classList.remove('hidden');
    UIElements.finalScore.textContent = String(gameState.player.score);
    UIElements.toolbar.classList.add('hidden');
    UIElements.pauseBtn.classList.add('hidden');
}

function checkGameOver() {
    const cheapestPlantPrice = getCheapestPlantPrice();
    const hasNoMoney = gameState.player.money < cheapestPlantPrice;
    const hasNoViablePlants = !Object.values(gameState.plants).some(p => p.status === 'alive' || p.status === 'ripe');

    if (hasNoMoney && hasNoViablePlants) {
        triggerGameOver();
    }
}


// --- UI & INPUT ---
const UIElements = {
    startScreen: document.getElementById('start-screen'),
    loadingText: document.getElementById('loading-text'),
    startGameBtn: document.getElementById('start-game-btn') as HTMLButtonElement,
    generateMapBtn: document.getElementById('generate-map-btn') as HTMLButtonElement,
    gameUI: document.getElementById('game-ui'),
    info: {
        day: document.getElementById('day-display'),
        money: document.getElementById('money-display'),
        water: document.getElementById('water-display'),
        score: document.getElementById('score-display'),
    },
    toolbar: document.getElementById('toolbar'),
    seedSelector: {
        container: document.getElementById('seed-selector'),
        options: document.getElementById('seed-options'),
        closeButton: document.getElementById('close-seed-selector'),
    },
    waterPurchaseModal: {
        container: document.getElementById('water-purchase-modal'),
        buyAmountBtn: document.getElementById('buy-water-amount-btn') as HTMLButtonElement,
        closeBtn: document.getElementById('close-water-modal-btn') as HTMLButtonElement,
        amountInput: document.getElementById('water-amount-input') as HTMLInputElement,
        currentWater: document.getElementById('modal-water-level'),
    },
    notification: document.getElementById('notification'),
    pauseBtn: document.getElementById('pause-btn') as HTMLButtonElement,
    gameOverScreen: document.getElementById('game-over-screen'),
    finalScore: document.getElementById('final-score'),
};

function checkUnlocks() {
    const currentlyAvailable = Object.values(PLANT_DATA).filter(p => gameState.player.score >= p.scoreRequirement);
    
    if (currentlyAvailable.length > gameState.player.unlockedPlantCount) {
        const previouslyAvailableCount = gameState.player.unlockedPlantCount;
        
        // Sort all plants by score requirement to find the newly unlocked ones in order
        const allPlantsSorted = Object.values(PLANT_DATA).sort((a,b) => a.scoreRequirement - b.scoreRequirement);
        const newlyUnlocked = allPlantsSorted.slice(previouslyAvailableCount, currentlyAvailable.length);

        newlyUnlocked.forEach(plant => {
             showNotification(`Neue Pflanze verfügbar: ${plant.name}!`);
        });
        
        gameState.player.unlockedPlantCount = currentlyAvailable.length;
        populateSeedSelector();
    }
}

function populateSeedSelector() {
    if(!UIElements.seedSelector.options) return;
    UIElements.seedSelector.options.innerHTML = '';
    
    // Filter plants based on player's score
    const availablePlantKeys = Object.keys(PLANT_DATA)
        .filter(key => gameState.player.score >= PLANT_DATA[key].scoreRequirement);
        
    // Sort available plants by price (cheapest first)
    availablePlantKeys.sort((a, b) => PLANT_DATA[a].price - PLANT_DATA[b].price);

    availablePlantKeys.forEach(key => {
        const plant = PLANT_DATA[key];
        const option = document.createElement('div');
        option.className = 'seed-option';
        option.dataset.seed = key;
        option.innerHTML = `<span>${plant.name}</span><span>${plant.price.toFixed(2).replace('.', ',')}€</span>`;
        UIElements.seedSelector.options.appendChild(option);
    });
}

function updateActiveTool(toolName: string) {
    document.querySelectorAll('.tool-btn').forEach(btn => {
        const btnEl = btn as HTMLElement;
        const btnTool = btnEl.dataset.tool;
        if (btnTool === toolName) {
            btnEl.classList.add('active');
        } else {
            btnEl.classList.remove('active');
        }
    });
}

let isMouseDown = false;
let isPanning = false;
let lastMousePos = { x: 0, y: 0 };

function getEventPos(e: MouseEvent | TouchEvent) {
    if (e instanceof MouseEvent) {
        return { x: e.clientX, y: e.clientY };
    }
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    return touch ? { x: touch.clientX, y: touch.clientY } : lastMousePos;
}

function screenToTile(screenX: number, screenY: number): [number, number] {
    const worldX = screenX + gameState.camera.x;
    const worldY = screenY + gameState.camera.y;
    return [Math.floor(worldX / TILE_SIZE), Math.floor(worldY / TILE_SIZE)];
}

function onPointerDown(e: MouseEvent | TouchEvent) {
    isMouseDown = true;
    lastMousePos = getEventPos(e);
    isPanning = false;
}

function onPointerMove(e: MouseEvent | TouchEvent) {
    const pos = getEventPos(e);
    if (!isMouseDown) {
        lastMousePos = pos;
        return;
    };
    if (!isPanning && (Math.abs(pos.x - lastMousePos.x) > 5 || Math.abs(pos.y - lastMousePos.y) > 5)) {
        isPanning = true;
        canvas.style.cursor = 'grabbing';
    }

    if (isPanning) {
        const dx = pos.x - lastMousePos.x;
        const dy = pos.y - lastMousePos.y;
        gameState.camera.x -= dx;
        gameState.camera.y -= dy;
        const maxCamX = MAP_WIDTH * TILE_SIZE - canvas.width;
        const maxCamY = MAP_HEIGHT * TILE_SIZE - canvas.height;
        gameState.camera.x = Math.max(0, Math.min(maxCamX, gameState.camera.x));
        gameState.camera.y = Math.max(0, Math.min(maxCamY, gameState.camera.y));
    }
    lastMousePos = pos;
}

function onPointerUp(e: MouseEvent | TouchEvent) {
    if (!isPanning && isMouseDown) {
        handleMapClick(getEventPos(e));
    }
    isMouseDown = false;
    isPanning = false;
    canvas.style.cursor = 'grab';
}

function handleMapClick(pos: {x: number, y: number}) {
    if (isPaused) return;
    const [x, y] = screenToTile(pos.x, pos.y);

    if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return;

    const tileKey = `${x},${y}`;
    const tileType = getTileType(x,y);
    const isOwned = gameState.player.ownedTiles.includes(tileKey);
    const plant = gameState.plants[tileKey];
    
    switch(gameState.selectedTool) {
        case 'hand':
            if (plant) {
                 const plantData = PLANT_DATA[plant.type];
                 if (plant.status === 'ripe') {
                     showNotification(`${plantData.name}: Bereit zum Ernten!`);
                     return;
                 }
                 const growthProgress = Math.floor((plant.growthStage / plantData.growthTime) * 100);
                 let moistureText: string;
                 if (plant.status === 'withered') {
                     moistureText = 'Verdorrt';
                 } else if (plant.status === 'drowned') {
                     moistureText = 'Ertrunken';
                 } else if (plant.moisture >= 2 && plant.moisture <= 8) {
                     moistureText = 'Optimal';
                 } else if (plant.moisture < 2) {
                     moistureText = 'Zu trocken';
                 } else { // plant.moisture > 8
                     moistureText = 'Zu nass';
                 }
                 showNotification(`${plantData.name}: ${growthProgress}% / Feuchtigkeit: ${moistureText}`);
            } else if (isOwned && tileType === TILE_TYPE.TILLED_SOIL) {
                gameState.plantingCoords = { x, y };
                UIElements.seedSelector.container.classList.remove('hidden');
            } else if (isOwned && tileType === TILE_TYPE.GRASS) {
                showNotification('Wiese erst pflügen');
            } else if (tileType === TILE_TYPE.GRASS && !isOwned) {
                showNotification(`Land kaufen für ${LAND_COST}€.`);
            }
            break;
        case 'hoe':
            if (isOwned && tileType === TILE_TYPE.GRASS) {
                if (plant) delete gameState.plants[tileKey];
                gameState.map[y][x] = TILE_TYPE.TILLED_SOIL;
                showNotification('Feld gepflügt.');
                cacheNeedsRedraw = true;
            } else if (plant && (plant.status === 'withered' || plant.status === 'drowned')) {
                delete gameState.plants[tileKey];
                gameState.map[y][x] = TILE_TYPE.TILLED_SOIL;
                showNotification('Feld gepflügt.');
                cacheNeedsRedraw = true;
            } else if (plant) {
                showNotification("Eine gesunde Pflanze kann nicht umgepflügt werden. Ernte sie, wenn sie reif ist.");
            }
            break;
        case 'watering_can':
             if (gameState.player.water <= 0) {
                 showNotification("Kein Wasser mehr! Kaufe neues am See.");
                 return;
             }
             if (plant && plant.status === 'alive') {
                gameState.player.water--;
                plant.moisture = Math.min(10, plant.moisture + 1);
                updateUI();

                const plantData = PLANT_DATA[plant.type];
                const daysToHarvest = Math.max(0, plantData.growthTime - plant.growthStage);
                const notificationMessage = `${plantData.name}<br>Tage bis Ernte: ${daysToHarvest}<br>Feuchtigkeit: ${Math.round(plant.moisture)}`;
                showNotification(notificationMessage);

                if(plant.moisture >= 10) {
                    plant.status = 'drowned';
                    showNotification(`${PLANT_DATA[plant.type].name} ist ertrunken!`);
                }
             }
            break;
        case 'harvest':
            if (plant && plant.status === 'ripe') {
                const plantData = PLANT_DATA[plant.type];
                gameState.player.money += plantData.sell;
                gameState.player.score += plantData.sell;
                showNotification(`+${plantData.sell.toFixed(2).replace('.', ',')}€ für ${plantData.name}`);
                delete gameState.plants[tileKey];
                gameState.map[y][x] = TILE_TYPE.TILLED_SOIL;
                updateUI();
                checkUnlocks();
                cacheNeedsRedraw = true;
            } else if (plant) {
                showNotification("Diese Pflanze ist nicht reif.");
            }
            break;
        case 'buy_land':
            if (isWater(x,y)) {
                showWaterPurchaseModal();
                return;
            }

            const cheapestPlantPrice = getCheapestPlantPrice();
            const requiredMoney = LAND_COST + cheapestPlantPrice;

            if (isOwned) {
                // Do nothing, player already owns this.
            } else if (tileType !== TILE_TYPE.GRASS) {
                showNotification(`Du kannst nur Grasland kaufen.`);
            } else if (isShoreline(x, y)) {
                showNotification(`Ufergrundstücke können nicht gekauft werden.`);
            } else if (!isAdjacentToOwnedOrFarmhouse(x,y)) {
                showNotification(`Muss an dein Land oder das Farmhaus angrenzen.`);
            } else if (gameState.player.money < requiredMoney) {
                showNotification(`Du benötigst ${requiredMoney.toFixed(2).replace('.', ',')}€, um Land zu kaufen und noch Saatgut leisten zu können.`);
            } else {
                gameState.player.money -= LAND_COST;
                gameState.player.score += LAND_COST;
                gameState.player.ownedTiles.push(tileKey);
                updateUI();
                showNotification(`Land für ${LAND_COST}€ gekauft.`);
                checkUnlocks();
                checkGameOver();
            }
            break;
    }
}

// --- WATER PURCHASE ---
function showWaterPurchaseModal() {
    const { player } = gameState;
    const waterCostPerUnit = 0.5;

    if (player.water >= MAX_WATER) {
        showNotification("Dein Wasservorrat ist voll.");
        return;
    }

    const hasViablePlants = Object.values(gameState.plants).some(p => p.status === 'alive' || p.status === 'ripe');
    const cheapestPlantPrice = getCheapestPlantPrice();
    const moneyToReserve = hasViablePlants ? 0 : cheapestPlantPrice;

    const availableMoneyForWater = player.money - moneyToReserve;

    if (availableMoneyForWater < waterCostPerUnit) {
        if (!hasViablePlants) {
            showNotification(`Du musst mehr als ${cheapestPlantPrice.toFixed(2).replace('.', ',')}€ besitzen, um Wasser zu kaufen und Saatgut leisten zu können.`);
        } else {
             showNotification("Du hast nicht genug Geld, um Wasser zu kaufen.");
        }
        return;
    }
    
    const spaceInTank = MAX_WATER - player.water;
    const maxAmountBasedOnMoney = Math.floor(availableMoneyForWater / waterCostPerUnit);
    const maxAmount = Math.min(10, maxAmountBasedOnMoney, spaceInTank);

    if (maxAmount <= 0) {
        showNotification("Du kannst dir kein Wasser leisten oder dein Tank hat nicht genug Platz.");
        return;
    }

    UIElements.waterPurchaseModal.amountInput.max = String(maxAmount);
    UIElements.waterPurchaseModal.amountInput.value = String(maxAmount);
    UIElements.waterPurchaseModal.currentWater.textContent = String(player.water);
    UIElements.waterPurchaseModal.container.classList.remove('hidden');
}


function hideWaterPurchaseModal() {
    UIElements.waterPurchaseModal.container.classList.add('hidden');
}

function handleWaterPurchase(amountToBuy: number) {
    const { player } = gameState;
    const waterCostPerUnit = 0.5;

    if (amountToBuy <= 0) return;

    if (player.water >= MAX_WATER) {
        showNotification("Dein Wasservorrat ist bereits voll.");
        hideWaterPurchaseModal();
        return;
    }
    
    const actualAmountToBuy = Math.min(amountToBuy, MAX_WATER - player.water);
    const cost = actualAmountToBuy * waterCostPerUnit;

    if (player.money < cost) {
        showNotification("Nicht genug Euro!");
        return;
    }
    
    player.money -= cost;
    player.water += actualAmountToBuy;

    showNotification(`${actualAmountToBuy} Wasser für ${cost.toFixed(2).replace('.', ',')}€ gekauft.`);
    updateUI();
    hideWaterPurchaseModal();
    checkGameOver();
}

// --- INITIALIZATION ---
function centerCameraOnFarmhouse() {
    if(!canvas) return;
    gameState.camera.x = (gameState.farmhouse.x * TILE_SIZE) - (canvas.width / 2) + (TILE_SIZE * gameState.farmhouse.size / 2);
    gameState.camera.y = (gameState.farmhouse.y * TILE_SIZE) - (canvas.height / 2) + (TILE_SIZE * gameState.farmhouse.size / 2);
    const maxCamX = MAP_WIDTH * TILE_SIZE - canvas.width;
    const maxCamY = MAP_HEIGHT * TILE_SIZE - canvas.height;
    gameState.camera.x = Math.max(0, Math.min(maxCamX, gameState.camera.x));
    gameState.camera.y = Math.max(0, Math.min(maxCamY, gameState.camera.y));
}

function initCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    previewCanvas.width = 250;
    previewCanvas.height = 250;

    if (!mapCacheCanvas) {
        mapCacheCanvas = document.createElement('canvas');
        mapCacheCanvas.width = MAP_WIDTH * TILE_SIZE;
        mapCacheCanvas.height = MAP_HEIGHT * TILE_SIZE;
        mapCacheCtx = mapCacheCanvas.getContext('2d');
    }
    
    [ctx, mapCacheCtx, previewCtx].forEach(c => {
        if(c) {
            c.imageSmoothingEnabled = true;
        }
    });

    if(gameState.map.length > 0) {
        cacheNeedsRedraw = true;
        drawPreview();
        centerCameraOnFarmhouse();
    }
}

async function init() {
    initCanvas();
    window.addEventListener('resize', initCanvas);
    
    UIElements.generateMapBtn.addEventListener('click', placeFarmhouseAndInitialTiles);
    
    UIElements.startGameBtn.addEventListener('click', () => {
        UIElements.startScreen.classList.add('hidden');
        UIElements.gameUI.classList.remove('hidden');
        updateUI();
        requestAnimationFrame(gameLoop);
    });
    
    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('mousemove', onPointerMove);
    canvas.addEventListener('mouseup', onPointerUp);
    canvas.addEventListener('mouseleave', onPointerUp);
    canvas.addEventListener('touchstart', onPointerDown, { passive: true });
    canvas.addEventListener('touchmove', onPointerMove, { passive: true });
    canvas.addEventListener('touchend', onPointerUp);
    canvas.addEventListener('touchcancel', onPointerUp);

    UIElements.toolbar.addEventListener('click', e => {
        const target = (e.target as Element).closest<HTMLElement>('.tool-btn');
        if (!target || !target.dataset.tool) return;
        const tool = target.dataset.tool;
        gameState.selectedTool = tool;
        updateActiveTool(tool);
    });

    UIElements.seedSelector.options.addEventListener('click', e => {
        if (isPaused) return;
        const target = (e.target as Element).closest<HTMLElement>('.seed-option');
        if (!target || !target.dataset.seed || !gameState.plantingCoords) return;
        const seedType = target.dataset.seed;
        const seedData = PLANT_DATA[seedType];
        
        if(gameState.player.money >= seedData.price) {
            gameState.player.money -= seedData.price;
            const {x, y} = gameState.plantingCoords;
            gameState.plants[`${x},${y}`] = { type: seedType, growthStage: 0, moisture: 4, status: 'alive' };
            gameState.map[y][x] = TILE_TYPE.TILLED_SOIL;
            updateUI();
            cacheNeedsRedraw = true;
            checkGameOver();
        } else {
            showNotification(`Nicht genug Euro für ${seedData.name}!`);
        }
        
        UIElements.seedSelector.container.classList.add('hidden');
        gameState.plantingCoords = null;
    });

    UIElements.seedSelector.closeButton.addEventListener('click', () => {
        UIElements.seedSelector.container.classList.add('hidden');
        gameState.plantingCoords = null;
    });

    // Water Purchase Listeners
    UIElements.waterPurchaseModal.closeBtn.addEventListener('click', hideWaterPurchaseModal);
    UIElements.waterPurchaseModal.buyAmountBtn.addEventListener('click', () => {
        const amountToBuy = parseInt(UIElements.waterPurchaseModal.amountInput.value, 10);
        handleWaterPurchase(amountToBuy);
    });

    // Pause listener
    UIElements.pauseBtn.addEventListener('click', () => {
        isPaused = !isPaused;
        if (isPaused) {
            UIElements.pauseBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="transform: scale(1.2);"><path d="M8 5v14l11-7z"/></svg>`;
        } else {
            UIElements.pauseBtn.innerHTML = '❚❚';
        }
        UIElements.pauseBtn.title = isPaused ? 'Fortsetzen' : 'Pause';
    });

    gameState.player.unlockedPlantCount = Object.values(PLANT_DATA).filter(p => p.scoreRequirement <= gameState.player.score).length;
    populateSeedSelector();
    generateMap();
    updateActiveTool('hand');

    try {
        await assetManager.loadAssets();
        console.log('Assets loaded!');
        UIElements.loadingText.classList.add('hidden');
        UIElements.startGameBtn.disabled = false;
        cacheNeedsRedraw = true;
        drawPreview();
    } catch (error) {
        console.error('Failed to load assets:', error);
        UIElements.loadingText.textContent = 'Fehler beim Laden der Grafiken.';
        UIElements.startGameBtn.disabled = true;
    }
}

init();