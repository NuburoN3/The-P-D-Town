// ============================================================================
// BUILDING RENDERERS - Isolated building visuals by type
// ============================================================================

export const BUILDING_TYPES = {
  DOJO: "DOJO",
  HOUSE: "HOUSE",
  SHOP: "SHOP",
  BAR: "BAR",
  SHRINE: "SHRINE"
};

let buildingRenderers = null;

export function initializeBuildingRenderers(ctx, tileSize) {
  buildingRenderers = {
    DOJO: {
      renderTile(x, y, tileX, tileY, isTopRow, isBottomRow, isLeftCol, isRightCol) {
        const roofDarkRed = "#8b2020";
        const roofBrightRed = "#d32f2f";
        const roofHighlight = "#ff6b6b";
        const woodDark = "#5d4037";
        const woodMid = "#795548";
        const wallLight = "#e8d5c4";
        const shadowColor = "#3e2723";
        const goldAccent = "#ffd700";
        const goldDark = "#daa520";
        const windowColor = "#87ceeb";

        ctx.fillStyle = wallLight;
        ctx.fillRect(x, y, tileSize, tileSize);

        ctx.fillStyle = "rgba(184, 149, 106, 0.4)";
        ctx.fillRect(x, y + 20, tileSize, 12);

        ctx.strokeStyle = "rgba(139, 69, 19, 0.15)";
        ctx.lineWidth = 1;
        for (let i = 0; i < tileSize; i += 4) {
          ctx.beginPath();
          ctx.moveTo(x, y + i);
          ctx.lineTo(x + tileSize, y + i);
          ctx.stroke();
        }

        if (isTopRow) {
          ctx.fillStyle = roofDarkRed;
          ctx.fillRect(x - 2, y - 2, tileSize + 4, 12);

          ctx.fillStyle = roofBrightRed;
          ctx.fillRect(x, y, tileSize, 9);

          ctx.fillStyle = roofHighlight;
          ctx.fillRect(x + 2, y + 1, tileSize - 4, 3);

          ctx.fillStyle = roofDarkRed;
          ctx.fillRect(x + 1, y + 5, tileSize - 2, 2);

          for (let i = 0; i < tileSize; i += 4) {
            ctx.fillStyle = roofDarkRed;
            ctx.fillRect(x + i, y + 7, 3, 2);
          }

          ctx.fillStyle = goldDark;
          ctx.fillRect(x, y + 9, tileSize, 2);

          if (isLeftCol) {
            ctx.fillStyle = goldAccent;
            ctx.beginPath();
            ctx.arc(x + 4, y + 5, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = goldDark;
            ctx.beginPath();
            ctx.arc(x + 4, y + 5, 1, 0, Math.PI * 2);
            ctx.fill();
          }
          if (isRightCol) {
            ctx.fillStyle = goldAccent;
            ctx.beginPath();
            ctx.arc(x + tileSize - 4, y + 5, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = goldDark;
            ctx.beginPath();
            ctx.arc(x + tileSize - 4, y + 5, 1, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        if (isLeftCol) {
          ctx.fillStyle = woodDark;
          ctx.fillRect(x + 1, y + 10, 5, tileSize - 10);
          ctx.fillStyle = woodMid;
          ctx.fillRect(x + 2, y + 10, 3, tileSize - 10);

          ctx.fillStyle = "rgba(0,0,0,0.3)";
          ctx.fillRect(x + 1, y + 10, 2, tileSize - 10);
          ctx.fillStyle = "rgba(255,255,255,0.2)";
          ctx.fillRect(x + 4, y + 10, 1, tileSize - 10);
        }

        if (isRightCol) {
          ctx.fillStyle = woodDark;
          ctx.fillRect(x + tileSize - 6, y + 10, 5, tileSize - 10);
          ctx.fillStyle = woodMid;
          ctx.fillRect(x + tileSize - 5, y + 10, 3, tileSize - 10);

          ctx.fillStyle = "rgba(0,0,0,0.3)";
          ctx.fillRect(x + tileSize - 6, y + 10, 2, tileSize - 10);
          ctx.fillStyle = "rgba(255,255,255,0.2)";
          ctx.fillRect(x + tileSize - 3, y + 10, 1, tileSize - 10);
        }

        if (!isTopRow && !isBottomRow) {
          ctx.fillStyle = woodDark;
          ctx.fillRect(x, y + 12, tileSize, 2);
          ctx.fillStyle = "rgba(0,0,0,0.3)";
          ctx.fillRect(x, y + 12, tileSize, 1);
          ctx.fillStyle = "rgba(255,255,255,0.1)";
          ctx.fillRect(x, y + 13, tileSize, 1);

          ctx.fillStyle = woodDark;
          ctx.fillRect(x, y + 22, tileSize, 2);
          ctx.fillStyle = "rgba(0,0,0,0.3)";
          ctx.fillRect(x, y + 22, tileSize, 1);
          ctx.fillStyle = "rgba(255,255,255,0.1)";
          ctx.fillRect(x, y + 23, tileSize, 1);
        }

        if (!isTopRow && !isBottomRow && !isLeftCol && !isRightCol) {
          ctx.fillStyle = woodDark;
          ctx.fillRect(x + 8, y + 14, 16, 10);

          ctx.fillStyle = windowColor;
          ctx.fillRect(x + 10, y + 16, 6, 6);
          ctx.fillRect(x + 18, y + 16, 6, 6);

          ctx.fillStyle = "rgba(255,255,255,0.4)";
          ctx.fillRect(x + 11, y + 17, 2, 2);
          ctx.fillRect(x + 19, y + 17, 2, 2);

          ctx.strokeStyle = woodDark;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + 16, y + 16);
          ctx.lineTo(x + 16, y + 22);
          ctx.stroke();
        }

        if (isBottomRow && !isLeftCol && !isRightCol) {
          ctx.fillStyle = woodDark;
          ctx.fillRect(x + 6, y + 12, 20, 20);

          ctx.fillStyle = "#6d4c41";
          ctx.fillRect(x + 8, y + 14, 8, 16);
          ctx.fillRect(x + 18, y + 14, 8, 16);

          ctx.fillStyle = "#4caf50";
          ctx.fillRect(x + 9, y + 15, 2, 14);
          ctx.fillRect(x + 19, y + 15, 2, 14);

          ctx.fillStyle = goldAccent;
          ctx.beginPath();
          ctx.arc(x + 12, y + 22, 1.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x + 22, y + 22, 1.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = goldDark;
          ctx.beginPath();
          ctx.arc(x + 12, y + 22, 0.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x + 22, y + 22, 0.8, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.strokeStyle = shadowColor;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, tileSize, tileSize);

        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x + 1, y + 1, tileSize - 2, tileSize - 2);

        if (isTopRow && isLeftCol) {
          ctx.fillStyle = goldAccent;
          ctx.fillRect(x + 2, y + 4, 4, 4);
          ctx.fillStyle = goldDark;
          ctx.fillRect(x + 3, y + 5, 2, 2);
        }

        if (isTopRow && isRightCol) {
          ctx.fillStyle = goldAccent;
          ctx.fillRect(x + tileSize - 6, y + 4, 4, 4);
          ctx.fillStyle = goldDark;
          ctx.fillRect(x + tileSize - 5, y + 5, 2, 2);
        }
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

        // BAR sign board
        if (isTopRow && !isLeftCol && !isRightCol) {
          ctx.fillStyle = "#2f1f18";
          ctx.fillRect(x + 5, y + 12, 22, 8);
          ctx.strokeStyle = trim;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 5.5, y + 12.5, 21, 7);

          // tiny pixel letters B A R
          ctx.fillStyle = "#f5d88e";
          // B
          ctx.fillRect(x + 8, y + 14, 1, 4);
          ctx.fillRect(x + 9, y + 14, 1, 1);
          ctx.fillRect(x + 9, y + 16, 1, 1);
          ctx.fillRect(x + 9, y + 17, 1, 1);
          // A
          ctx.fillRect(x + 13, y + 14, 1, 4);
          ctx.fillRect(x + 14, y + 14, 1, 1);
          ctx.fillRect(x + 15, y + 14, 1, 4);
          ctx.fillRect(x + 14, y + 16, 1, 1);
          // R
          ctx.fillRect(x + 19, y + 14, 1, 4);
          ctx.fillRect(x + 20, y + 14, 1, 1);
          ctx.fillRect(x + 20, y + 16, 1, 1);
          ctx.fillRect(x + 20, y + 17, 1, 1);
          ctx.fillRect(x + 21, y + 18, 1, 1);
        }
      }
    },
    SHRINE: {
      renderTile(x, y) {
        ctx.fillStyle = "#8b6f47";
        ctx.fillRect(x, y, tileSize, tileSize);
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

  renderer.renderTile(x, y, tileX, tileY, isTopRow, isBottomRow, isLeftCol, isRightCol);
  return true;
}
