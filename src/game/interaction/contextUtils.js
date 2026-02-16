import { normalizeTownProgress } from "../progression/progressDefaults.js";

export function playerTilePosition(player, tileSize) {
  return {
    x: Math.floor((player.x + tileSize / 2) / tileSize),
    y: Math.floor((player.y + tileSize / 2) / tileSize)
  };
}

export function getTownProgress(gameFlags, townId) {
  const raw = gameFlags.townProgress[townId];
  const normalized = normalizeTownProgress(raw);
  gameFlags.townProgress[townId] = normalized;
  return normalized;
}
