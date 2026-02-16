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
