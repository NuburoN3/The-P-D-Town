// ============================================================================
// MAP UTILITIES - Reusable map-painting primitives for town content authors
// ============================================================================

import { TILE_TYPES } from "../core/constants.js";

/**
 * Create a 2-D tile map filled with a single tile type.
 */
export function createFilledMap(width, height, fillType) {
    return Array.from({ length: height }, () => Array.from({ length: width }, () => fillType));
}

/**
 * Create an interior room with walls on every border tile.
 * Most interior maps are just this + a few decorations.
 */
export function createWalledInterior(width, height, floor = TILE_TYPES.INTERIOR_FLOOR) {
    const map = createFilledMap(width, height, floor);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
                map[y][x] = TILE_TYPES.WALL;
            }
        }
    }
    return map;
}

/**
 * Paint a multi-segment path (of type PATH) between a series of waypoints.
 * `width` controls the thickness of the stroke in tiles.
 */
export function paintPath(map, points, width = 1) {
    const radius = Math.max(0, Math.floor(width / 2));
    for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), 1);

        for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const x = Math.round(a.x + (b.x - a.x) * t);
            const y = Math.round(a.y + (b.y - a.y) * t);

            for (let oy = -radius; oy <= radius; oy++) {
                for (let ox = -radius; ox <= radius; ox++) {
                    const tx = x + ox;
                    const ty = y + oy;
                    if (ty < 0 || ty >= map.length) continue;
                    if (tx < 0 || tx >= map[0].length) continue;
                    map[ty][tx] = TILE_TYPES.PATH;
                }
            }
        }
    }
}

/**
 * Fill a rectangular region of the map with a given tile type.
 */
export function paintRect(map, x, y, width, height, type) {
    for (let ty = y; ty < y + height; ty++) {
        if (ty < 0 || ty >= map.length) continue;
        for (let tx = x; tx < x + width; tx++) {
            if (tx < 0 || tx >= map[0].length) continue;
            map[ty][tx] = type;
        }
    }
}

/**
 * Set individual tile positions to a given tile type.
 * Each point is an [x, y] tuple.
 */
export function paintPoints(map, points, type) {
    for (const [x, y] of points) {
        if (y < 0 || y >= map.length) continue;
        if (x < 0 || x >= map[0].length) continue;
        map[y][x] = type;
    }
}
