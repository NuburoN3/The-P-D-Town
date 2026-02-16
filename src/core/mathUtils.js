// ============================================================================
// MATH UTILITIES — shared helpers used across multiple game systems
// ============================================================================

/**
 * Clamp a value between min and max.
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation from start to end by factor t.
 */
export function lerp(start, end, t) {
    return start + (end - start) * t;
}

/**
 * Euclidean distance between two 2D points.
 */
export function distance(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
}

/**
 * Deterministic hash returning a value in [0, 1).
 * Useful for pseudo-random but repeatable per-tile decoration.
 */
export function hash01(seed) {
    const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return value - Math.floor(value);
}
/**
 * Check if point (px, py) is inside rectangle (x, y, w, h).
 */
export function pointInRect(px, py, x, y, w, h) {
    return px >= x && px <= x + w && py >= y && py <= y + h;
}
