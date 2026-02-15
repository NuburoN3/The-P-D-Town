export const FOUNTAIN_TILE_KIND = Object.freeze({
  OUTER_RING: "outerRing",
  INNER_BASIN_EDGE: "innerBasinEdge",
  CENTER_PLINTH: "centerPlinth",
  WATER: "water"
});

function toLocal(building, tileX, tileY) {
  if (!building) return null;
  const localX = tileX - building.x;
  const localY = tileY - building.y;
  if (
    localX < 0 ||
    localY < 0 ||
    localX >= building.width ||
    localY >= building.height
  ) {
    return null;
  }
  return { localX, localY };
}

function isInRange(value, min, max) {
  return value >= min && value <= max;
}

export function isFountainAccessTile(building, tileX, tileY) {
  const local = toLocal(building, tileX, tileY);
  if (!local) return false;

  const { localX, localY } = local;
  const centerX = Math.floor(building.width / 2);
  const centerY = Math.floor(building.height / 2);
  const laneHalfWidth = 1;

  const verticalLane = isInRange(localX, centerX - laneHalfWidth, centerX + laneHalfWidth);
  const horizontalLane = isInRange(localY, centerY - laneHalfWidth, centerY + laneHalfWidth);

  const northGate = verticalLane && (localY === 0 || localY === 1);
  const southGate = verticalLane && (localY === building.height - 1 || localY === building.height - 2);
  const westGate = horizontalLane && (localX === 0 || localX === 1);
  const eastGate = horizontalLane && (localX === building.width - 1 || localX === building.width - 2);

  return northGate || southGate || westGate || eastGate;
}

export function classifyFountainTile(building, tileX, tileY) {
  const local = toLocal(building, tileX, tileY);
  if (!local) return null;
  const { localX, localY } = local;

  const onOuterRing =
    localX === 0 ||
    localY === 0 ||
    localX === building.width - 1 ||
    localY === building.height - 1;
  if (onOuterRing) return FOUNTAIN_TILE_KIND.OUTER_RING;

  const onInnerBasinEdge =
    localX === 1 ||
    localX === building.width - 2 ||
    localY === 1 ||
    localY === building.height - 2;
  if (onInnerBasinEdge) return FOUNTAIN_TILE_KIND.INNER_BASIN_EDGE;

  const centerX = Math.floor(building.width / 2);
  const centerY = Math.floor(building.height / 2);
  const onCenterPlinth =
    localX >= centerX - 1 &&
    localX <= centerX + 1 &&
    localY >= centerY - 1 &&
    localY <= centerY + 1;
  if (onCenterPlinth) return FOUNTAIN_TILE_KIND.CENTER_PLINTH;

  return FOUNTAIN_TILE_KIND.WATER;
}

export function isFountainWaterTile(building, tileX, tileY) {
  return classifyFountainTile(building, tileX, tileY) === FOUNTAIN_TILE_KIND.WATER;
}

export function isFountainSolidTile(building, tileX, tileY) {
  const kind = classifyFountainTile(building, tileX, tileY);
  if (isFountainAccessTile(building, tileX, tileY)) return false;
  return (
    kind === FOUNTAIN_TILE_KIND.OUTER_RING ||
    kind === FOUNTAIN_TILE_KIND.INNER_BASIN_EDGE ||
    kind === FOUNTAIN_TILE_KIND.CENTER_PLINTH
  );
}
