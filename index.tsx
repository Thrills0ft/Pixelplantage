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

const TILE_TYPE = {
    WATER: 0,
    GRASS: 1,
    FOREST: 2,
    MOUNTAIN: 3,
    ROCK: 4,
    TILLED_SOIL: 5,
    FARMHOUSE: 6,
};

type PlantStatus = 'alive' | 'withered' | 'drowned';

interface Plant {
    type: string;
    growthStage: number;
    daysGrown: number;
    moisture: number;
    status: PlantStatus;
}

const PLANT_DATA = {
    carrot: { name: 'Karotte', price: 5, sell: 15, stages: 3, growthTime: 3 },
    tomato: { name: 'Tomate', price: 10, sell: 30, stages: 4, growthTime: 5 },
    sunflower: { name: 'Sonnenblume', price: 15, sell: 50, stages: 3, growthTime: 4 },
};

// --- SVG ASSETS (Base64 encoded) ---
const svgToB64 = (svg: string) => `data:image/svg+xml;base64,${btoa(svg)}`;

const assetSources: { [key: string]: string } = {
    grass: svgToB64('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill="#78c258"/><path d="M0 24 q 12 -12 24 0 t 24 0" fill="none" stroke="#8ad268" stroke-width="2"/><path d="M0 48 q 12 -12 24 0 t 24 0" fill="none" stroke="#8ad268" stroke-width="2"/></svg>'),
    tilled_soil: svgToB64('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill="#a17a58"/><path d="M0 12 H 48 M0 24 H 48 M0 36 H 48" fill="none" stroke="#8a6a4c" stroke-width="3"/></svg>'),
    water: svgToB64('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill="#4f8be2"/></svg>'),
    farmhouse: svgToB64('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><path d="M0 48 H 96 V 96 H 0 Z" fill="#d2b48c" stroke="#a0522d" stroke-width="2"/><path d="M-5 52 L 48 8 L 101 52 Z" fill="#8b4513" stroke="#5a2d0c" stroke-width="2"/><rect x="36" y="60" width="24" height="36" fill="#a0522d"/><rect x="12" y="55" width="20" height="20" fill="#add8e6" stroke="#fff" stroke-width="2"/><rect x="64" y="55" width="20" height="20" fill="#add8e6" stroke="#fff" stroke-width="2"/></svg>'),
    tree1: svgToB64('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect x="20" y="28" width="8" height="20" fill="#6d4c41"/><path d="M 24,4 A 20 20 0 0 1 24,44 A 20 20 0 0 1 24,4" fill="#4caf50"/><path d="M 12,18 A 12 12 0 0 1 12,42" fill="#388e3c"/></svg>'),
    tree2: svgToB64('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect x="22" y="30" width="6" height="18" fill="#8d6e63"/><path d="M 25 10 C 10 15, 10 35, 25 40 Z" fill="#2e7d32"/><path d="M 23 10 C 38 15, 38 35, 23 40 Z" fill="#558b2f"/></svg>'),
    rock1: svgToB64('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M5 43 C 2 30, 15 20, 25 22 C 45 25, 45 43, 45 43 Z" fill="#9e9e9e" stroke="#616161" stroke-width="1.5"/><path d="M25 22 C 20 30, 25 43, 25 43" fill="none" stroke="#616161" stroke-width="1"/></svg>'),
    rock2: svgToB64('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M8 43 C 5 35, 20 33, 22 35 C 25 38, 15 43, 8 43 Z" fill="#bdbdbd" stroke="#757575" stroke-width="1.5"/><path d="M20 43 C 18 30, 30 25, 40 28 C 50 32, 45 43, 20 43 Z" fill="#9e9e9e" stroke="#616161" stroke-width="1.5"/></svg>'),
    sun_icon: svgToB64('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="10" fill="#FFD700"/><line x1="24" y1="6" x2="24" y2="12" stroke="#FFD700" stroke-width="4" stroke-linecap="round"/><line x1="24" y1="36" x2="24" y2="42" stroke="#FFD700" stroke-width="4" stroke-linecap="round"/><line x1="6" y1="24" x2="12" y2="24" stroke="#FFD700" stroke-width="4" stroke-linecap="round"/><line x1="36" y1="24" x2="42" y2="24" stroke="#FFD700" stroke-width="4" stroke-linecap="round"/><line x1="10" y1="10" x2="14" y2="14" stroke="#FFD700" stroke-width="4" stroke-linecap="round"/><line x1="34" y1="34" x2="38" y2="38" stroke="#FFD700" stroke-width="4" stroke-linecap="round"/><line x1="10" y1="38" x2="14" y2="34" stroke="#FFD700" stroke-width="4" stroke-linecap="round"/><line x1="34" y1="14" x2="38" y2="10" stroke="#FFD700" stroke-width="4" stroke-linecap="round"/></svg>'),
    raindrop_icon: svgToB64('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 8 C16 20 16 32 24 40 C32 32 32 20 24 8 Z" fill="#3498db"/></svg>'),
    carrot_0: svgToB64('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M20 40 L 24 35 L 28 40" fill="none" stroke="#2e7d32" stroke-width="2" stroke-linecap="round"/></svg>'),
    carrot_1: svgToB64('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 42 V 30" stroke="#ff9800" stroke-width="3" stroke-linecap="round"/><path d="M20 32 L 24 28 L 28 32 M 16 38 L 24 32 L 32 38" fill="none" stroke="#2e7d32" stroke-width="3" stroke-linecap="round"/></svg>'),
    carrot_2: svgToB64('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 44 V 32" stroke="#ff9800" stroke-width="5" stroke-linecap="round"/><path d="M20 32 L 24 22 L 28 32 M 14 38 L 24 28 L 34 38" fill="none" stroke="#2e7d32" stroke-width="4" stroke-linecap="round"/></svg>'),
    carrot_3: svgToB64('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 46 V 34" stroke="#ff9800" stroke-width="7" stroke-linecap="round"/><path d="M20 32 L 24 18 L 28 32 M 14 38 L 24 24 L 34 38" fill="none" stroke="#2e7d32" stroke-width="5" stroke-linecap="round"/></svg>'),
    tomato_0: svgToB64('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 40 v -5" stroke="#388e3c" stroke-width="2" stroke-linecap="round"/></svg>'),
    tomato_1: svgToB64('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 42 v -15" stroke="#388e3c" stroke-width="3" stroke-linecap="round"/></svg>'),
    tomato_2: svgToB64('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 42 v -20" stroke="#388e3c" stroke-width="3" stroke-linecap="round"/><circle cx="20" cy="32" r="4" fill="#d32f2f"/></svg>'),
    tomato_3: svgToB64('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 42 v -25" stroke="#388e3c" stroke-width="3" stroke-linecap="round"/><circle cx="28" cy="25" r="5" fill="#d32f2f"/><circle cx="20" cy="34" r="5" fill="#d32f2f"/></svg>'),
    tomato_4: svgToB64('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 42 v -28" stroke="#388e3c" stroke-width="3" stroke-linecap="round"/><circle cx="20" cy="35" r="6" fill="#d32f2f"/><circle cx="28" cy="26" r="6" fill="#d32f2f"/><circle cx="22" cy="18" r="6" fill="#d32f2f"/></svg>'),
    sunflower_0: svgToB64('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 40 v -5" stroke="#4caf50" stroke-width="3" stroke-linecap="round"/></svg>'),
    sunflower_1: svgToB64('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 42 v -20" stroke="#4caf50" stroke-width="4" stroke-linecap="round"/></svg>'),
    sunflower_2: svgToB64('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 42 v -25" stroke="#4caf50" stroke-width="4" stroke-linecap="round"/><circle cx="24" cy="15" r="10" fill="#ffc107"/><circle cx="24" cy="15" r="5" fill="#795548"/></svg>'),
    sunflower_3: svgToB64('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" transform="rotate(15 24 24)"><path d="M24 42 v -25" stroke="#4caf50" stroke-width="5" stroke-linecap="round"/><g transform="translate(24, 17)"><path d="M 0 -15 L 5 -5 L 15 0 L 5 5 L 0 15 L -5 5 L -15 0 L -5 -5 Z" fill="#ffc107"/><path d="M 0 -10 L 10 0 L 0 10 L -10 0 Z" fill="#ffeb3b" transform="rotate(45)"/></g><circle cx="24" cy="17" r="6" fill="#795548"/></svg>'),
};


// --- GAME STATE ---
let gameState: {
    map: number[][];
    plants: {[key: string]: Plant};
    player: { money: number; ownedTiles: string[]; water: number; };
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
        ownedTiles: [],
        water: 100,
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
            const promise = new Promise<void>((resolve) => {
                const img = new Image();
                this.assets[key] = img;
                img.onload = () => resolve();
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

    // Assign new map to gameState so subsequent logic works correctly
    gameState.map = map;

    let placed = false;
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
    gameState.time.animationFrame = (gameState.time.animationFrame + deltaTime * 0.01) % 1000;

    gameState.time.timeOfDay += deltaTime;
    if (gameState.time.timeOfDay >= DAY_DURATION_MS) {
        gameState.time.timeOfDay = 0;
        gameState.time.day++;
        updatePlants();
        updateUI();
    }
}

// --- RENDERING PIPELINE ---
function drawWaterTransitions(ctx: CanvasRenderingContext2D) {
    const grassColor = "#78c258";
    const waterColor = "#4f8be2";

    ctx.fillStyle = grassColor;
    const r = TILE_SIZE / 2;

    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (isWater(x, y)) continue;

            const wx = x * TILE_SIZE;
            const wy = y * TILE_SIZE;

            const n = isWater(x, y - 1);
            const s = isWater(x, y + 1);
            const w = isWater(x - 1, y);
            const e = isWater(x + 1, y);

            const nw = isWater(x - 1, y - 1);
            const ne = isWater(x + 1, y - 1);
            const sw = isWater(x - 1, y + 1);
            const se = isWater(x + 1, y + 1);

            // Inner corners (cut out from land)
            if (n && w && !nw) {
                ctx.fillStyle = waterColor;
                ctx.beginPath();
                ctx.moveTo(wx, wy);
                ctx.arc(wx, wy, r, 0, Math.PI / 2);
                ctx.closePath();
                ctx.fill();
            }
            if (n && e && !ne) {
                ctx.fillStyle = waterColor;
                ctx.beginPath();
                ctx.moveTo(wx + TILE_SIZE, wy);
                ctx.arc(wx + TILE_SIZE, wy, r, Math.PI / 2, Math.PI);
                ctx.closePath();
                ctx.fill();
            }
            if (s && w && !sw) {
                ctx.fillStyle = waterColor;
                ctx.beginPath();
                ctx.moveTo(wx, wy + TILE_SIZE);
                ctx.arc(wx, wy + TILE_SIZE, r, -Math.PI / 2, 0);
                ctx.closePath();
                ctx.fill();
            }
            if (s && e && !se) {
                ctx.fillStyle = waterColor;
                ctx.beginPath();
                ctx.moveTo(wx + TILE_SIZE, wy + TILE_SIZE);
                ctx.arc(wx + TILE_SIZE, wy + TILE_SIZE, r, Math.PI, Math.PI * 1.5);
                ctx.closePath();
                ctx.fill();
            }
             ctx.fillStyle = grassColor;
        }
    }
     for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (!isWater(x, y)) continue;

            const wx = x * TILE_SIZE;
            const wy = y * TILE_SIZE;

            // Outer corners (add to land)
            const n_land = !isWater(x, y-1);
            const w_land = !isWater(x-1, y);
            const nw_land = !isWater(x-1,y-1);
            if(n_land && w_land && nw_land) {
                 ctx.beginPath();
                 ctx.moveTo(wx, wy);
                 ctx.arc(wx, wy, r, Math.PI, -Math.PI/2, false);
                 ctx.closePath();
                 ctx.fill();
            }
            const e_land = !isWater(x+1, y);
            const ne_land = !isWater(x+1,y-1);
             if(n_land && e_land && ne_land) {
                 ctx.beginPath();
                 ctx.moveTo(wx+TILE_SIZE, wy);
                 ctx.arc(wx+TILE_SIZE, wy, r, -Math.PI/2, -Math.PI, true);
                 ctx.closePath();
                 ctx.fill();
            }
            const s_land = !isWater(x, y+1);
            const sw_land = !isWater(x-1,y+1);
             if(s_land && w_land && sw_land) {
                 ctx.beginPath();
                 ctx.moveTo(wx, wy+TILE_SIZE);
                 ctx.arc(wx, wy+TILE_SIZE, r, Math.PI/2, Math.PI, false);
                 ctx.closePath();
                 ctx.fill();
            }
             const se_land = !isWater(x+1,y+1);
             if(s_land && e_land && se_land) {
                 ctx.beginPath();
                 ctx.moveTo(wx+TILE_SIZE, wy+TILE_SIZE);
                 ctx.arc(wx+TILE_SIZE, wy+TILE_SIZE, r, 0, Math.PI/2, true);
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

    if (plant.status === 'alive') {
        sprite = assetManager.assets[`${plant.type}_${plant.growthStage}`];
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

    const barWidth = TILE_SIZE * 0.8;
    const barHeight = 5;
    const barX = x * TILE_SIZE + (TILE_SIZE - barWidth) / 2;
    const barY = y * TILE_SIZE + 3;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    const moisturePercent = plant.moisture / 10;
    const fillWidth = barWidth * moisturePercent;
    let barColor = '#3498db';
    if (plant.status !== 'alive') barColor = '#e74c3c';
    else if (plant.moisture < 4 || plant.moisture > 7) barColor = '#f1c40f';
    ctx.fillStyle = barColor;
    ctx.fillRect(barX, barY, fillWidth, barHeight);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
}


function updateUI() {
    UIElements.info.day.textContent = `Tag: ${gameState.time.day}`;
    UIElements.info.money.textContent = `💰 ${gameState.player.money} G`;
    UIElements.info.water.textContent = `💧 ${gameState.player.water} / 100`;
}

let notificationTimeout: number;
function showNotification(message: string) {
    clearTimeout(notificationTimeout);
    UIElements.notification.textContent = message;
    UIElements.notification.classList.remove('hidden');
    UIElements.notification.style.animation = 'none';
    void UIElements.notification.offsetHeight;
    UIElements.notification.style.animation = ''; 
    notificationTimeout = window.setTimeout(() => {
        UIElements.notification.classList.add('hidden');
    }, 2900);
}

// --- PLANT LOGIC ---
function updatePlants() {
    for (const key in gameState.plants) {
        const plant = gameState.plants[key];
        const plantData = PLANT_DATA[plant.type];
        const [x, y] = key.split(',').map(Number);
        
        if (plant.status !== 'alive') continue;

        plant.moisture = Math.max(0, plant.moisture - 1);

        if (plant.moisture <= 0) {
            plant.status = 'withered';
            showNotification(`${plantData.name} ist verdorrt!`);
            continue;
        }
        if (plant.moisture >= 10) {
            plant.status = 'drowned';
            showNotification(`${plantData.name} ist ertrunken!`);
            continue;
        }

        if (plant.moisture >= 4 && plant.moisture <= 7) {
            if (plant.growthStage < plantData.stages) {
                plant.daysGrown++;
                if (plant.daysGrown >= plantData.growthTime / plantData.stages) {
                    plant.growthStage++;
                    plant.daysGrown = 0;
                }
            }
        }
        
        if (plant.growthStage >= plantData.stages) {
            gameState.player.money += plantData.sell;
            showNotification(`+${plantData.sell} G für ${plantData.name}`);
            delete gameState.plants[key];
            gameState.map[y][x] = TILE_TYPE.GRASS;
            cacheNeedsRedraw = true;
        }
    }
}


// --- UI & INPUT ---
const UIElements = {
    startScreen: document.getElementById('start-screen'),
    loadingText: document.getElementById('loading-text'),
    startGameBtn: document.getElementById('start-game-btn') as HTMLButtonElement,
    gameUI: document.getElementById('game-ui'),
    info: {
        day: document.getElementById('day-display'),
        money: document.getElementById('money-display'),
        water: document.getElementById('water-display'),
    },
    toolbar: document.getElementById('toolbar'),
    seedSelector: {
        container: document.getElementById('seed-selector'),
        options: document.getElementById('seed-options'),
        closeButton: document.getElementById('close-seed-selector'),
    },
    waterPurchaseModal: {
        container: document.getElementById('water-purchase-modal'),
        fillBtn: document.getElementById('fill-water-btn') as HTMLButtonElement,
        buyAmountBtn: document.getElementById('buy-water-amount-btn') as HTMLButtonElement,
        closeBtn: document.getElementById('close-water-modal-btn') as HTMLButtonElement,
        amountInput: document.getElementById('water-amount-input') as HTMLInputElement,
        currentWater: document.getElementById('modal-water-level'),
    },
    notification: document.getElementById('notification'),
};

function populateSeedSelector() {
    UIElements.seedSelector.options.innerHTML = '';
    for (const key in PLANT_DATA) {
        const plant = PLANT_DATA[key];
        const option = document.createElement('div');
        option.className = 'seed-option';
        option.dataset.seed = key;
        option.innerHTML = `<span>${plant.name}</span><span>${plant.price} G</span>`;
        UIElements.seedSelector.options.appendChild(option);
    }
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
                 const growthProgress = Math.floor((plant.growthStage / plantData.stages) * 100);
                 let moistureText = 'Optimal';
                 if (plant.status === 'withered') moistureText = 'Verdorrt';
                 else if (plant.status === 'drowned') moistureText = 'Ertrunken';
                 else if (plant.moisture < 4) moistureText = 'Trocken';
                 else if (plant.moisture > 7) moistureText = 'Nass';
                 showNotification(`${plantData.name}: ${growthProgress}% / Feuchtigkeit: ${moistureText}`);
            } else if (isOwned && tileType === TILE_TYPE.TILLED_SOIL) {
                gameState.plantingCoords = { x, y };
                UIElements.seedSelector.container.classList.remove('hidden');
            } else if (isOwned && tileType === TILE_TYPE.GRASS) {
                showNotification('Wiese erst pflügen');
            } else if (tileType === TILE_TYPE.GRASS && !isOwned) {
                showNotification(`Land kaufen für ${LAND_COST} G.`);
            }
            break;
        case 'hoe':
            if (isOwned && tileType === TILE_TYPE.GRASS) {
                if (plant) delete gameState.plants[tileKey];
                gameState.map[y][x] = TILE_TYPE.TILLED_SOIL;
                showNotification('Feld urbar gemacht.');
                cacheNeedsRedraw = true;
            } else if (plant && plant.status !== 'alive') {
                delete gameState.plants[tileKey];
                gameState.map[y][x] = TILE_TYPE.TILLED_SOIL;
                showNotification('Feld urbar gemacht.');
                cacheNeedsRedraw = true;
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
                showNotification(`Befeuchtet. Feuchtigkeit: ${plant.moisture}/10`);
                if(plant.moisture >= 10) {
                    plant.status = 'drowned';
                    showNotification(`${PLANT_DATA[plant.type].name} ist ertrunken!`);
                }
             }
            break;
        case 'buy_land':
            if (isWater(x,y)) {
                showWaterPurchaseModal();
                return;
            }
            if (isOwned) {
                // Do nothing, player already owns this.
            } else if (tileType !== TILE_TYPE.GRASS) {
                showNotification(`Du kannst nur Grasland kaufen.`);
            } else if (isShoreline(x, y)) {
                showNotification(`Ufergrundstücke können nicht gekauft werden.`);
            } else if (!isAdjacentToOwnedOrFarmhouse(x,y)) {
                showNotification(`Muss an dein Land oder das Farmhaus angrenzen.`);
            } else if (gameState.player.money < LAND_COST) {
                showNotification(`Nicht genug Geld!`);
            } else {
                gameState.player.money -= LAND_COST;
                gameState.player.ownedTiles.push(tileKey);
                updateUI();
                showNotification(`Glückwunsch, du hast neues Land`);
            }
            break;
    }
}

// --- WATER PURCHASE ---
function showWaterPurchaseModal() {
    const { player } = gameState;
    const spaceLeft = 100 - player.water;
    const canAfford = player.money;
    const maxAmount = Math.min(spaceLeft, canAfford);

    if (maxAmount <= 0) {
        showNotification(player.water >= 100 ? "Dein Wassertank ist voll." : "Du hast kein Geld, um Wasser zu kaufen.");
        return;
    }

    UIElements.waterPurchaseModal.amountInput.max = String(maxAmount);
    UIElements.waterPurchaseModal.amountInput.value = String(Math.min(10, maxAmount));
    UIElements.waterPurchaseModal.currentWater.textContent = `${player.water} / 100`;
    UIElements.waterPurchaseModal.container.classList.remove('hidden');
}

function hideWaterPurchaseModal() {
    UIElements.waterPurchaseModal.container.classList.add('hidden');
}

function handleWaterPurchase(amountToBuy: number) {
    const cost = amountToBuy;
    const { player } = gameState;

    if (amountToBuy <= 0) return;

    if (player.water + amountToBuy > 100) {
        showNotification("Dein Wassertank ist nicht so groß.");
        return;
    }

    if (player.money < cost) {
        showNotification("Nicht genug Geld!");
        return;
    }

    player.money -= cost;
    player.water += amountToBuy;

    showNotification(`${amountToBuy} Wasser für ${cost} G gekauft.`);
    updateUI();
    hideWaterPurchaseModal();
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
    
    document.getElementById('generate-map-btn').addEventListener('click', generateMap);
    
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
        const target = (e.target as Element).closest<HTMLElement>('.seed-option');
        if (!target || !target.dataset.seed || !gameState.plantingCoords) return;
        const seedType = target.dataset.seed;
        const seedData = PLANT_DATA[seedType];
        
        if(gameState.player.money >= seedData.price) {
            gameState.player.money -= seedData.price;
            const {x, y} = gameState.plantingCoords;
            gameState.plants[`${x},${y}`] = { type: seedType, growthStage: 0, daysGrown: 0, moisture: 4, status: 'alive' };
            gameState.map[y][x] = TILE_TYPE.TILLED_SOIL;
            updateUI();
            cacheNeedsRedraw = true;
        } else {
            showNotification(`Nicht genug Geld für ${seedData.name}!`);
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
    UIElements.waterPurchaseModal.fillBtn.addEventListener('click', () => {
        const amountNeeded = 100 - gameState.player.water;
        const amountToBuy = Math.min(amountNeeded, gameState.player.money);
        handleWaterPurchase(amountToBuy);
    });
    UIElements.waterPurchaseModal.buyAmountBtn.addEventListener('click', () => {
        const amountToBuy = parseInt(UIElements.waterPurchaseModal.amountInput.value, 10);
        handleWaterPurchase(amountToBuy);
    });

    populateSeedSelector();
    generateMap();
    updateActiveTool('hand');

    await assetManager.loadAssets();
    console.log('Assets loaded!');
    UIElements.loadingText.classList.add('hidden');
    UIElements.startGameBtn.disabled = false;
    cacheNeedsRedraw = true;
    drawPreview();
}

init();