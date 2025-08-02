/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// --- CONFIG ---
export const TILE_SIZE = 48;
export const MAP_WIDTH = 50;
export const MAP_HEIGHT = 50;
export const DAY_DURATION_MS = 10000;
export const LAND_COST = 100;
export const TAX_PER_TILE = 0.25;
export const MAX_WATER = 999;

export const TILE_TYPE = {
    WATER: 0,
    GRASS: 1,
    FOREST: 2,
    MOUNTAIN: 3,
    ROCK: 4,
    TILLED_SOIL: 5,
    FARMHOUSE: 6,
};

export type PlantStatus = 'alive' | 'withered' | 'drowned' | 'ripe';

export interface Plant {
    type: string;
    growthStage: number;
    moisture: number;
    status: PlantStatus;
}

export interface PlantData {
    name: string;
    price: number;
    sell: number;
    growthTime: number;
    waterNeed: number;
    scoreRequirement: number;
}

export const PLANT_DATA: { [key: string]: PlantData } = {
    sunflower: { name: 'Sonnenblume', price: 5, sell: 15, growthTime: 5, waterNeed: 0.5, scoreRequirement: 0 },
    carrot: { name: 'Karotte', price: 10, sell: 30, growthTime: 10, waterNeed: 1, scoreRequirement: 0 },
    tomato: { name: 'Tomate', price: 15, sell: 45, growthTime: 15, waterNeed: 2, scoreRequirement: 0 },
    strawberry: { name: 'Erdbeere', price: 20, sell: 65, growthTime: 17, waterNeed: 2.5, scoreRequirement: 250 },
    pumpkin: { name: 'Kürbis', price: 25, sell: 80, growthTime: 20, waterNeed: 3, scoreRequirement: 500 },
};
