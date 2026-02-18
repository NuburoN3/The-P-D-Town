export function findClosestInteractableNpc({
  npcs,
  currentAreaId,
  playerCenterX,
  playerCenterY,
  interactReach
}) {
  let closestNpc = null;
  let closestNpcDistance = Number.POSITIVE_INFINITY;

  for (const npc of npcs) {
    if (npc.world !== currentAreaId) continue;

    const npcCenterX = npc.x + npc.width / 2;
    const npcCenterY = npc.y + npc.height / 2;
    const dx = Math.abs(playerCenterX - npcCenterX);
    const dy = Math.abs(playerCenterY - npcCenterY);
    const bartenderReachBonus = npc.interactReachBonus || 0;
    const reachX = interactReach;
    const reachY = interactReach + bartenderReachBonus;

    if (dx <= reachX && dy <= reachY) {
      const distance = Math.hypot(playerCenterX - npcCenterX, playerCenterY - npcCenterY);
      if (distance < closestNpcDistance) {
        closestNpc = npc;
        closestNpcDistance = distance;
      }
    }
  }

  return closestNpc;
}

export function orientNpcTowardPlayer(npc, playerCenterX, playerCenterY) {
  const npcCenterX = npc.x + npc.width / 2;
  const npcCenterY = npc.y + npc.height / 2;
  const relativeX = playerCenterX - npcCenterX;
  const relativeY = playerCenterY - npcCenterY;

  if (Math.abs(relativeX) >= Math.abs(relativeY)) {
    npc.dir = relativeX < 0 ? "left" : "right";
  } else {
    npc.dir = relativeY < 0 ? "up" : "down";
  }
}

export function findNearbySignpost({
  player,
  tileSize,
  inset,
  currentMap,
  currentMapW,
  currentMapH,
  readSignpost
}) {
  const left = Math.floor((player.x + inset) / tileSize) - 1;
  const right = Math.floor((player.x + tileSize - inset) / tileSize) + 1;
  const top = Math.floor((player.y + inset) / tileSize) - 1;
  const bottom = Math.floor((player.y + tileSize - inset) / tileSize) + 1;

  for (let ty = top; ty <= bottom; ty++) {
    if (ty < 0 || ty >= currentMapH) continue;
    for (let tx = left; tx <= right; tx++) {
      if (tx < 0 || tx >= currentMapW) continue;
      if (!currentMap[ty]) continue;

      const text = readSignpost(tx, ty);
      if (text) {
        return { tx, ty, text };
      }
    }
  }

  return null;
}

export function findClosestInteractableLeftover({
  leftovers,
  currentTownId,
  currentAreaId,
  playerCenterX,
  playerCenterY,
  interactReach
}) {
  if (!Array.isArray(leftovers) || leftovers.length === 0) return null;

  const hasLoot = (leftover) => {
    const silver = Number.isFinite(leftover?.silver) ? leftover.silver : 0;
    const gold = Number.isFinite(leftover?.gold) ? leftover.gold : 0;
    const items = Array.isArray(leftover?.items) ? leftover.items : [];
    return gold > 0 || silver > 0 || items.length > 0;
  };

  let closest = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const leftover of leftovers) {
    if (!leftover) continue;
    if (leftover.depleted || !hasLoot(leftover)) continue;
    if (leftover.townId !== currentTownId || leftover.areaId !== currentAreaId) continue;
    const lx = Number.isFinite(leftover.x) ? leftover.x : 0;
    const ly = Number.isFinite(leftover.y) ? leftover.y : 0;
    const dx = Math.abs(playerCenterX - lx);
    const dy = Math.abs(playerCenterY - ly);
    if (dx > interactReach || dy > interactReach) continue;
    const distance = Math.hypot(playerCenterX - lx, playerCenterY - ly);
    if (distance < closestDistance) {
      closest = leftover;
      closestDistance = distance;
    }
  }
  return closest;
}
