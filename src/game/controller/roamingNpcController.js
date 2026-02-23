export function createRoamingNpcController({ state, collision }) {
  const ANIMAL_FLEE_REACTION_RADIUS_TILES = 2;
  const ANIMAL_FLEE_MIN_STEP_TILES = 1.1;
  const ANIMAL_FLEE_MAX_STEP_TILES = 2.2;
  const ANIMAL_FLEE_SPEED_MULTIPLIER = 2.2;

  function rectsOverlap(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  function collidesWithBlockingNpc(nx, ny, npc, currentAreaId) {
    const probe = {
      x: nx + 5,
      y: ny + 5,
      width: Math.max(1, npc.width - 10),
      height: Math.max(1, npc.height - 10)
    };

    for (const other of state.npcs) {
      if (!other || other === npc || other.world !== currentAreaId) continue;
      if (other.blocking === false) continue;
      const otherRect = {
        x: other.x + 5,
        y: other.y + 5,
        width: Math.max(1, other.width - 10),
        height: Math.max(1, other.height - 10)
      };
      if (rectsOverlap(probe, otherRect)) return true;
    }

    return false;
  }

  function collidesWithPlayer(nx, ny, npc, currentX = null, currentY = null) {
    const playerWidth = Number.isFinite(state.player.width) ? state.player.width : (npc.width || 32);
    const playerHeight = Number.isFinite(state.player.height) ? state.player.height : (npc.height || 32);
    const npcRect = {
      x: nx + 5,
      y: ny + 5,
      width: Math.max(1, npc.width - 10),
      height: Math.max(1, npc.height - 10)
    };
    const playerRect = {
      x: state.player.x + 5,
      y: state.player.y + 5,
      width: Math.max(1, playerWidth - 10),
      height: Math.max(1, playerHeight - 10)
    };
    if (!rectsOverlap(npcRect, playerRect)) return false;

    if (Number.isFinite(currentX) && Number.isFinite(currentY)) {
      const currentNpcRect = {
        x: currentX + 5,
        y: currentY + 5,
        width: Math.max(1, npc.width - 10),
        height: Math.max(1, npc.height - 10)
      };
      const overlapsCurrent = rectsOverlap(currentNpcRect, playerRect);
      if (overlapsCurrent) {
        const playerCenterX = playerRect.x + playerRect.width * 0.5;
        const playerCenterY = playerRect.y + playerRect.height * 0.5;
        const currentCenterX = currentNpcRect.x + currentNpcRect.width * 0.5;
        const currentCenterY = currentNpcRect.y + currentNpcRect.height * 0.5;
        const nextCenterX = npcRect.x + npcRect.width * 0.5;
        const nextCenterY = npcRect.y + npcRect.height * 0.5;
        const currentDistSq = (currentCenterX - playerCenterX) ** 2 + (currentCenterY - playerCenterY) ** 2;
        const nextDistSq = (nextCenterX - playerCenterX) ** 2 + (nextCenterY - playerCenterY) ** 2;
        // If currently overlapping player, allow movement that increases separation.
        if (nextDistSq > currentDistSq + 0.01) return false;
      }
    }
    return true;
  }

  function isRoamPositionBlocked(npc, nx, ny, currentAreaId, currentMap, currentMapW, currentMapH) {
    if (collision.collidesAt(nx, ny, currentMap, currentMapW, currentMapH)) return true;
    if (collidesWithBlockingNpc(nx, ny, npc, currentAreaId)) return true;
    if (collidesWithPlayer(nx, ny, npc, npc.x, npc.y)) return true;
    return false;
  }

  function pickRoamTarget(npc, now, currentAreaId, currentMap, currentMapW, currentMapH) {
    const tileSize = Math.max(1, npc.width || 32);
    const radiusTiles = Number.isFinite(npc.wanderRadiusTiles)
      ? Math.max(1, Math.floor(npc.wanderRadiusTiles))
      : 3;
    const attempts = 14;

    for (let i = 0; i < attempts; i++) {
      const offsetX = Math.floor(Math.random() * (radiusTiles * 2 + 1)) - radiusTiles;
      const offsetY = Math.floor(Math.random() * (radiusTiles * 2 + 1)) - radiusTiles;
      if (offsetX === 0 && offsetY === 0) continue;

      const tx = npc.roamHomeX + offsetX * tileSize;
      const ty = npc.roamHomeY + offsetY * tileSize;
      if (isRoamPositionBlocked(npc, tx, ty, currentAreaId, currentMap, currentMapW, currentMapH)) continue;

      npc.roamTargetX = tx;
      npc.roamTargetY = ty;
      npc.roamRetargetAt = now + 2400 + Math.random() * 2000;
      return;
    }

    npc.roamTargetX = null;
    npc.roamTargetY = null;
    npc.roamIdleUntil = now + 450 + Math.random() * 700;
  }

  function maybeSetAnimalFleeTarget(npc, now, currentAreaId, currentMap, currentMapW, currentMapH) {
    if (!npc || !npc.obeyAnimal || npc.isPlayerPet) return false;

    const tileSize = Math.max(1, npc.width || 32);
    const reactionRadius = ANIMAL_FLEE_REACTION_RADIUS_TILES * tileSize;
    const npcCenterX = npc.x + (Number.isFinite(npc.width) ? npc.width : tileSize) * 0.5;
    const npcCenterY = npc.y + (Number.isFinite(npc.height) ? npc.height : tileSize) * 0.5;
    const playerCenterX = state.player.x + (Number.isFinite(state.player.width) ? state.player.width : tileSize) * 0.5;
    const playerCenterY = state.player.y + (Number.isFinite(state.player.height) ? state.player.height : tileSize) * 0.5;
    const dx = npcCenterX - playerCenterX;
    const dy = npcCenterY - playerCenterY;
    const distSq = dx * dx + dy * dy;
    if (distSq > reactionRadius * reactionRadius) return false;

    const fleeCooldownUntil = Number.isFinite(npc.fleeRetargetAt) ? npc.fleeRetargetAt : 0;
    if (now < fleeCooldownUntil && Number.isFinite(npc.roamTargetX) && Number.isFinite(npc.roamTargetY)) {
      return true;
    }

    const baseLen = Math.max(0.001, Math.hypot(dx, dy));
    const baseDirX = dx / baseLen;
    const baseDirY = dy / baseLen;
    const attempts = 10;
    for (let i = 0; i < attempts; i++) {
      const jitter = (Math.random() - 0.5) * (Math.PI * 0.8);
      const cosA = Math.cos(jitter);
      const sinA = Math.sin(jitter);
      const dirX = baseDirX * cosA - baseDirY * sinA;
      const dirY = baseDirX * sinA + baseDirY * cosA;
      const stepTiles = ANIMAL_FLEE_MIN_STEP_TILES
        + Math.random() * (ANIMAL_FLEE_MAX_STEP_TILES - ANIMAL_FLEE_MIN_STEP_TILES);
      const tx = npc.x + dirX * tileSize * stepTiles;
      const ty = npc.y + dirY * tileSize * stepTiles;
      if (isRoamPositionBlocked(npc, tx, ty, currentAreaId, currentMap, currentMapW, currentMapH)) continue;
      npc.roamTargetX = tx;
      npc.roamTargetY = ty;
      npc.roamRetargetAt = now + 380 + Math.random() * 280;
      npc.roamIdleUntil = 0;
      npc.fleeRetargetAt = now + 220 + Math.random() * 160;
      return true;
    }

    npc.fleeRetargetAt = now + 180;
    return true;
  }

  function updateRoamingNPCs(now, dtScale = 1) {
    const currentAreaId = state.getCurrentAreaId();
    const currentMap = state.getCurrentMap();
    const currentMapW = state.getCurrentMapW();
    const currentMapH = state.getCurrentMapH();

    for (const npc of state.npcs) {
      if (!npc || !npc.canRoam || npc.world !== currentAreaId) continue;

      if (!Number.isFinite(npc.roamHomeX) || !Number.isFinite(npc.roamHomeY)) {
        npc.roamHomeX = npc.x;
        npc.roamHomeY = npc.y;
        npc.roamIdleUntil = now + 300 + Math.random() * 600;
      }

      const reactingToPlayer = maybeSetAnimalFleeTarget(
        npc,
        now,
        currentAreaId,
        currentMap,
        currentMapW,
        currentMapH
      );
      if (!reactingToPlayer && Number.isFinite(npc.roamIdleUntil) && now < npc.roamIdleUntil) continue;

      if (
        !Number.isFinite(npc.roamTargetX) ||
        !Number.isFinite(npc.roamTargetY) ||
        (Number.isFinite(npc.roamRetargetAt) && now >= npc.roamRetargetAt)
      ) {
        if (reactingToPlayer) {
          maybeSetAnimalFleeTarget(
            npc,
            now,
            currentAreaId,
            currentMap,
            currentMapW,
            currentMapH
          );
        } else {
          pickRoamTarget(npc, now, currentAreaId, currentMap, currentMapW, currentMapH);
        }
      }

      if (!Number.isFinite(npc.roamTargetX) || !Number.isFinite(npc.roamTargetY)) continue;

      const dx = npc.roamTargetX - npc.x;
      const dy = npc.roamTargetY - npc.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= 0.001) {
        npc.x = npc.roamTargetX;
        npc.y = npc.roamTargetY;
        npc.roamTargetX = null;
        npc.roamTargetY = null;
        npc.roamIdleUntil = now + 280 + Math.random() * 520;
        continue;
      }

      const baseSpeedPx = Number.isFinite(npc.wanderSpeed) ? Math.max(0.3, npc.wanderSpeed) : 0.9;
      const speedPx = reactingToPlayer && npc.obeyAnimal
        ? baseSpeedPx * ANIMAL_FLEE_SPEED_MULTIPLIER
        : baseSpeedPx;
      const step = Math.min(distance, speedPx * dtScale);
      const vx = (dx / distance) * step;
      const vy = (dy / distance) * step;

      let moved = false;
      const nx = npc.x + vx;
      if (!isRoamPositionBlocked(npc, nx, npc.y, currentAreaId, currentMap, currentMapW, currentMapH)) {
        npc.x = nx;
        moved = true;
      }

      const ny = npc.y + vy;
      if (!isRoamPositionBlocked(npc, npc.x, ny, currentAreaId, currentMap, currentMapW, currentMapH)) {
        npc.y = ny;
        moved = true;
      }

      if (!moved) {
        npc.roamTargetX = null;
        npc.roamTargetY = null;
        npc.roamIdleUntil = now + 260 + Math.random() * 480;
        continue;
      }

      if (Math.abs(vx) >= Math.abs(vy)) {
        npc.dir = vx >= 0 ? "right" : "left";
      } else {
        npc.dir = vy >= 0 ? "down" : "up";
      }
    }
  }

  return { updateRoamingNPCs };
}
