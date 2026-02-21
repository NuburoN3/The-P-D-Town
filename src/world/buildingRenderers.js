// ============================================================================
// BUILDING RENDERERS - Isolated building visuals by type
// ============================================================================

import { createBuildingRendererRegistry } from "./buildings/rendererRegistry.js";

export const BUILDING_TYPES = {
  DOJO: "DOJO",
  HOUSE: "HOUSE",
  SHOP: "SHOP",
  BAR: "BAR",
  CHURCH: "CHURCH",
  PEN: "PEN",
  SHRINE: "SHRINE",
  FOUNTAIN: "FOUNTAIN"
};

let buildingRenderers = null;

export function initializeBuildingRenderers(ctx, tileSize) {
  buildingRenderers = createBuildingRendererRegistry(ctx, tileSize);
}

export function beginBuildingRenderFrame() {
  if (!buildingRenderers) return;
  for (const renderer of Object.values(buildingRenderers)) {
    if (renderer && typeof renderer.beginFrame === "function") {
      renderer.beginFrame();
    }
  }
}

export function renderBuildingTile(building, x, y, tileX, tileY) {
  if (!buildingRenderers) return false;
  const renderer = buildingRenderers[building.type];
  if (!renderer) return false;

  const isTopRow = tileY === building.y;
  const isBottomRow = tileY === building.y + building.height - 1;
  const isLeftCol = tileX === building.x;
  const isRightCol = tileX === building.x + building.width - 1;

  renderer.renderTile(x, y, tileX, tileY, isTopRow, isBottomRow, isLeftCol, isRightCol, building);
  return true;
}
