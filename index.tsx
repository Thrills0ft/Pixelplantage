/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { createNoise2D } from './utils.ts';
import {
    TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, DAY_DURATION_MS, LAND_COST,
    TAX_PER_TILE, MAX_WATER, TILE_TYPE, PLANT_DATA
} from './config.ts';
import type { Plant, PlantData, PlantStatus } from './config.ts';
import { assetSources } from './assets.ts';

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
