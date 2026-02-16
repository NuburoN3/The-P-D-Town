// ============================================================================
// BUILDING RENDERERS - Isolated building visuals by type
// ============================================================================

import { classifyFountainTile, FOUNTAIN_TILE_KIND } from "./fountainGeometry.js";

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
  buildingRenderers = {
    DOJO: {
      renderTile(x, y, tileX, tileY, isTopRow, isBottomRow, isLeftCol, isRightCol, building) {
        const localX = tileX - building.x;
        const center = Math.floor(building.width / 2);
        const leftEntranceCol = Math.max(0, center - 1);
        const rightEntranceCol = center;
        const isEntranceColumn = localX === leftEntranceCol || localX === rightEntranceCol;

        const roofEdge = "#521814";
        const roofMid = "#7e2922";
        const roofLight = "#b74a3a";
        const roofShadow = "rgba(16,10,8,0.5)";
        const wallWoodDark = "#4b311f";
        const wallWoodMid = "#69452d";
        const wallWoodLight = "#8a5f3f";
        const trimGold = "#b58f53";
        const signBg = "#3f291c";
        const shojiPaper = "#e8dec4";

        // Low, wide wooden wall body.
        ctx.fillStyle = wallWoodDark;
        ctx.fillRect(x, y, tileSize, tileSize);
        ctx.fillStyle = wallWoodMid;
        ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);

        // Horizontal beam pattern (no brick/plaster style).
        for (let py = 4; py < tileSize - 3; py += 6) {
          ctx.fillStyle = py % 12 === 4 ? wallWoodLight : wallWoodMid;
          ctx.fillRect(x + 1, y + py, tileSize - 2, 1);
        }

        // Temple roof drawn once: 2 tiles tall, 1 tile overhang on each side.
        // Keep silhouette flatter so the dojo reads grounded and wide.
        if (isTopRow && isLeftCol) {
          const roofX = x - tileSize;
          const roofTop = y - tileSize * 2;
          const roofW = (building.width + 2) * tileSize;

          // Lower roof mass reaches wall top so it doesn't float.
          ctx.fillStyle = roofMid;
          ctx.fillRect(roofX + 8, roofTop + 38, roofW - 16, 20);
          ctx.fillStyle = roofEdge;
          ctx.fillRect(roofX, roofTop + 48, roofW, 16);

          // Upper slope and ridge highlight.
          ctx.fillStyle = roofEdge;
          ctx.fillRect(roofX + 14, roofTop + 28, roofW - 28, 10);
          ctx.fillStyle = roofMid;
          ctx.fillRect(roofX + 20, roofTop + 22, roofW - 40, 8);
          ctx.fillStyle = roofLight;
          ctx.fillRect(roofX + 26, roofTop + 24, roofW - 52, 3);

          // Slight curved slope hint using side wedges.
          ctx.fillStyle = roofEdge;
          ctx.beginPath();
          ctx.moveTo(roofX, roofTop + 48);
          ctx.lineTo(roofX + 14, roofTop + 36);
          ctx.lineTo(roofX + 14, roofTop + 62);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(roofX + roofW, roofTop + 48);
          ctx.lineTo(roofX + roofW - 14, roofTop + 36);
          ctx.lineTo(roofX + roofW - 14, roofTop + 62);
          ctx.closePath();
          ctx.fill();
        }

        // Dark shadow line under roof eaves.
        if (isTopRow) {
          ctx.fillStyle = roofShadow;
          ctx.fillRect(x, y, tileSize, 4);
        }

        // Strong corner/segment pillars.
        if (isLeftCol) {
          ctx.fillStyle = wallWoodDark;
          ctx.fillRect(x + 1, y + 10, 4, tileSize - 10);
        }
        if (isRightCol) {
          ctx.fillStyle = wallWoodDark;
          ctx.fillRect(x + tileSize - 5, y + 10, 4, tileSize - 10);
        }

        // Shoji wall section (replaces normal windows).
        if (!isTopRow && !isBottomRow && !isLeftCol && !isRightCol) {
          ctx.fillStyle = wallWoodDark;
          ctx.fillRect(x + 5, y + 13, 22, 11);
          ctx.fillStyle = shojiPaper;
          ctx.fillRect(x + 7, y + 15, 18, 7);
          ctx.fillStyle = "rgba(72,46,31,0.45)";
          ctx.fillRect(x + 13, y + 15, 1, 7);
          ctx.fillRect(x + 19, y + 15, 1, 7);
        }

        // Hanging dojo sign/banner above entrance.
        if (!isTopRow && !isBottomRow && isEntranceColumn) {
          ctx.fillStyle = "#eadfc5";
          ctx.fillRect(x + 6, y + 13, 20, 7);
          ctx.fillStyle = "rgba(70,44,29,0.24)";
          ctx.fillRect(x + 12, y + 13, 1, 7);
          ctx.fillRect(x + 19, y + 13, 1, 7);
          ctx.fillStyle = signBg;
          ctx.fillRect(x + 11, y + 21, 10, 6);
          ctx.strokeStyle = trimGold;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 11.5, y + 21.5, 9, 5);
        }

        if (isBottomRow) {
          // Wall base above front engawa.
          ctx.fillStyle = wallWoodDark;
          ctx.fillRect(x, y + 24, tileSize, 2);

          if (isEntranceColumn) {
            // Wide sliding entrance framing (actual DOOR tile visuals are handled in TileSystem).
            ctx.fillStyle = "#4f3424";
            ctx.fillRect(x + 4, y + 10, 24, 14);
            ctx.fillStyle = "#6f4a34";
            ctx.fillRect(x + 6, y + 12, 20, 10);
          } else {
            ctx.fillStyle = wallWoodDark;
            ctx.fillRect(x + 8, y + 12, 16, 12);
          }
        }

        ctx.strokeStyle = "rgba(43, 25, 16, 0.95)";
        ctx.lineWidth = 1.25;
        ctx.strokeRect(x, y, tileSize, tileSize);
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
      }
    },
    HOUSE: {
      renderTile(x, y) {
        ctx.fillStyle = "#a1887f";
        ctx.fillRect(x, y, tileSize, tileSize);
      }
    },
    SHOP: {
      renderTile(x, y) {
        ctx.fillStyle = "#9b7d6f";
        ctx.fillRect(x, y, tileSize, tileSize);
      }
    },
    BAR: {
      renderTile(x, y, tileX, tileY, isTopRow, isBottomRow, isLeftCol, isRightCol) {
        const roofDark = "#3e1f19";
        const roofLight = "#704034";
        const awningDark = "#7a3032";
        const awningLight = "#d8c29a";
        const wallBase = "#b48a61";
        const wallShade = "#8f6a48";
        const woodDark = "#4f3121";
        const woodMid = "#6d432b";
        const windowGlow = "#f8c977";
        const trim = "#e0be74";

        ctx.fillStyle = wallBase;
        ctx.fillRect(x, y, tileSize, tileSize);

        if (isTopRow) {
          ctx.fillStyle = roofDark;
          ctx.fillRect(x - 2, y - 2, tileSize + 4, 12);
          ctx.fillStyle = roofLight;
          ctx.fillRect(x, y, tileSize, 7);
          ctx.fillStyle = trim;
          ctx.fillRect(x + 1, y + 7, tileSize - 2, 2);

          // striped awning edge
          for (let i = 0; i < tileSize; i += 4) {
            ctx.fillStyle = (i / 4) % 2 === 0 ? awningDark : awningLight;
            ctx.fillRect(x + i, y + 9, 4, 3);
          }
        }

        ctx.fillStyle = wallShade;
        ctx.fillRect(x, y + tileSize - 5, tileSize, 5);

        if (isLeftCol) {
          ctx.fillStyle = woodDark;
          ctx.fillRect(x + 1, y + 10, 4, tileSize - 10);
        }
        if (isRightCol) {
          ctx.fillStyle = woodDark;
          ctx.fillRect(x + tileSize - 5, y + 10, 4, tileSize - 10);
        }

        if (!isTopRow && !isBottomRow && !isLeftCol && !isRightCol) {
          ctx.fillStyle = woodMid;
          ctx.fillRect(x + 7, y + 13, 18, 12);
          ctx.fillStyle = woodDark;
          ctx.fillRect(x + 8, y + 14, 16, 10);
          ctx.fillStyle = windowGlow;
          ctx.fillRect(x + 10, y + 16, 12, 6);
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.fillRect(x + 11, y + 17, 3, 2);
          ctx.fillRect(x + 17, y + 18, 2, 1);
        }

        if (isBottomRow && !isLeftCol && !isRightCol) {
          ctx.fillStyle = woodDark;
          ctx.fillRect(x + 7, y + 10, 18, 22);
          ctx.fillStyle = "#7f553a";
          ctx.fillRect(x + 9, y + 12, 14, 18);
          ctx.fillStyle = "#9d6a48";
          ctx.fillRect(x + 12, y + 13, 1, 15);
          ctx.fillRect(x + 19, y + 13, 1, 15);
          ctx.fillStyle = trim;
          ctx.fillRect(x + 17, y + 21, 2, 2);
        }

        // SAKABA sign board
        if (isTopRow && !isLeftCol && !isRightCol) {
          ctx.fillStyle = "#2f1f18";
          ctx.fillRect(x + 5, y + 12, 22, 8);
          ctx.strokeStyle = trim;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 5.5, y + 12.5, 21, 7);
          ctx.fillStyle = "#f5d88e";
          ctx.font = "bold 5px monospace";
          ctx.textBaseline = "top";
          ctx.fillText("SAKABA", x + 6, y + 14);
        }
      }
    },
    CHURCH: {
      renderTile(x, y, tileX, tileY, isTopRow, isBottomRow, isLeftCol, isRightCol, building) {
        const localX = tileX - building.x;
        const centerX = Math.floor(building.width / 2);
        const stoneDark = "#6b6f7c";
        const stoneMid = "#8f96a6";
        const stoneLight = "#b7bfd1";
        const trimGold = "#d4c28e";
        const roofDark = "#4f2121";
        const roofMid = "#7f3a3a";

        ctx.fillStyle = stoneDark;
        ctx.fillRect(x, y, tileSize, tileSize);
        ctx.fillStyle = stoneMid;
        ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);

        if (isTopRow) {
          ctx.fillStyle = roofDark;
          ctx.fillRect(x - 1, y, tileSize + 2, 8);
          ctx.fillStyle = roofMid;
          ctx.fillRect(x + 1, y + 1, tileSize - 2, 4);
        }

        if (!isTopRow && !isBottomRow && !isLeftCol && !isRightCol) {
          ctx.fillStyle = "#3e2f3a";
          ctx.fillRect(x + 10, y + 10, 12, 14);
          ctx.fillStyle = "#9dd4ef";
          ctx.fillRect(x + 12, y + 12, 8, 9);
          ctx.fillStyle = "rgba(255,255,255,0.28)";
          ctx.fillRect(x + 15, y + 12, 1, 9);
          ctx.fillRect(x + 12, y + 16, 8, 1);
        }

        if (isBottomRow && localX === centerX) {
          ctx.fillStyle = "#4b3429";
          ctx.fillRect(x + 8, y + 9, 16, 23);
          ctx.fillStyle = "#6d4a37";
          ctx.fillRect(x + 10, y + 11, 12, 19);
          ctx.fillStyle = trimGold;
          ctx.fillRect(x + 15, y + 11, 1, 19);
        }

        if (isTopRow && localX === centerX) {
          ctx.fillStyle = trimGold;
          ctx.fillRect(x + 14, y - 11, 4, 14);
          ctx.fillRect(x + 11, y - 8, 10, 3);
        }

        ctx.fillStyle = stoneLight;
        ctx.fillRect(x + 2, y + 2, tileSize - 4, 1);
        ctx.strokeStyle = "rgba(28,32,46,0.4)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, tileSize - 1, tileSize - 1);
      }
    },
    PEN: {
      renderTile(x, y, tileX, tileY, isTopRow, isBottomRow, isLeftCol, isRightCol, building) {
        const localX = tileX - building.x;
        const gateCenter = Math.floor(building.width / 2);
        const isGateTile =
          isBottomRow &&
          (localX === gateCenter || (building.width % 2 === 0 && localX === gateCenter - 1));
        const onFence = (isTopRow || isBottomRow || isLeftCol || isRightCol) && !isGateTile;

        const dirtDark = "#7d6040";
        const dirtLight = "#9b7a55";
        const fenceDark = "#6a482f";
        const fenceLight = "#9b734f";

        ctx.fillStyle = dirtDark;
        ctx.fillRect(x, y, tileSize, tileSize);
        ctx.fillStyle = dirtLight;
        ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);

        if (onFence) {
          ctx.fillStyle = fenceDark;
          if (isTopRow || isBottomRow) {
            ctx.fillRect(x, y + (isTopRow ? 2 : tileSize - 5), tileSize, 3);
          }
          if (isLeftCol || isRightCol) {
            ctx.fillRect(x + (isLeftCol ? 2 : tileSize - 5), y, 3, tileSize);
          }
          ctx.fillStyle = fenceLight;
          for (let i = 5; i < tileSize - 4; i += 6) {
            ctx.fillRect(x + i, y + 1, 2, tileSize - 2);
          }
        } else if (isGateTile) {
          ctx.fillStyle = "#c8a37a";
          ctx.fillRect(x + 8, y + tileSize - 6, 16, 4);
        } else {
          ctx.fillStyle = "rgba(198, 165, 99, 0.34)";
          ctx.fillRect(x + 7, y + 9, 3, 2);
          ctx.fillRect(x + 14, y + 15, 4, 2);
          ctx.fillRect(x + 21, y + 11, 3, 2);
        }

        ctx.strokeStyle = "rgba(42,30,18,0.35)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, tileSize - 1, tileSize - 1);
      }
    },
    SHRINE: {
      renderTile(x, y) {
        ctx.fillStyle = "#8b6f47";
        ctx.fillRect(x, y, tileSize, tileSize);
      }
    },
    FOUNTAIN: {
      renderTile(x, y, tileX, tileY, isTopRow, isBottomRow, isLeftCol, isRightCol, building) {
        const localX = tileX - building.x;
        const localY = tileY - building.y;

        const stoneDark = "#6e7d8b";
        const stoneMid = "#8ea0b0";
        const stoneLight = "#b4c5d2";
        const waterDeep = "#2d7da6";
        const waterMid = "#49a3ca";
        const waterLight = "#8fd8f0";

        const tileKind = classifyFountainTile(building, tileX, tileY);

        if (tileKind === FOUNTAIN_TILE_KIND.OUTER_RING) {
          ctx.fillStyle = stoneDark;
          ctx.fillRect(x, y, tileSize, tileSize);
          ctx.fillStyle = stoneLight;
          ctx.fillRect(x + 2, y + 2, tileSize - 4, 2);
          ctx.fillStyle = "rgba(0,0,0,0.18)";
          ctx.fillRect(x + 2, y + tileSize - 4, tileSize - 4, 2);
        } else if (tileKind === FOUNTAIN_TILE_KIND.CENTER_PLINTH) {
          ctx.fillStyle = stoneMid;
          ctx.fillRect(x, y, tileSize, tileSize);
          ctx.fillStyle = stoneLight;
          ctx.fillRect(x + 4, y + 4, tileSize - 8, tileSize - 8);
          ctx.fillStyle = "rgba(0,0,0,0.2)";
          ctx.fillRect(x + 4, y + tileSize - 8, tileSize - 8, 2);
        } else if (tileKind === FOUNTAIN_TILE_KIND.INNER_BASIN_EDGE) {
          ctx.fillStyle = stoneMid;
          ctx.fillRect(x, y, tileSize, tileSize);
          ctx.fillStyle = "rgba(255,255,255,0.2)";
          ctx.fillRect(x + 2, y + 2, tileSize - 4, 2);
        } else {
          const waterGradient = ctx.createLinearGradient(x, y, x, y + tileSize);
          waterGradient.addColorStop(0, waterLight);
          waterGradient.addColorStop(0.55, waterMid);
          waterGradient.addColorStop(1, waterDeep);
          ctx.fillStyle = waterGradient;
          ctx.fillRect(x, y, tileSize, tileSize);

          ctx.fillStyle = "rgba(255,255,255,0.22)";
          ctx.fillRect(x + 6, y + 6, 6, 1);
          ctx.fillRect(x + 16, y + 12, 7, 1);
          ctx.fillRect(x + 10, y + 20, 5, 1);
        }

        // Center statue and spray nozzles
        const center = Math.floor(building.width / 2);
        if (localX === center && localY === center) {
          ctx.fillStyle = stoneDark;
          ctx.fillRect(x + 13, y + 7, 6, 16);
          ctx.fillStyle = stoneLight;
          ctx.fillRect(x + 14, y + 8, 4, 13);

          ctx.fillStyle = "#dff7ff";
          ctx.fillRect(x + 15, y + 4, 2, 2);
          ctx.fillRect(x + 15, y + 2, 2, 1);
        }

        if (
          (localX === center && (localY === center - 2 || localY === center + 2)) ||
          (localY === center && (localX === center - 2 || localX === center + 2))
        ) {
          ctx.fillStyle = "#eefcff";
          ctx.fillRect(x + 14, y + 10, 4, 3);
          ctx.fillStyle = "rgba(255,255,255,0.55)";
          ctx.fillRect(x + 15, y + 8, 2, 2);
        }

        ctx.strokeStyle = "rgba(20,35,45,0.35)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, tileSize - 1, tileSize - 1);
      }
    }
  };
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
