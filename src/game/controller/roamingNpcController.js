export function createRoamingNpcController({ state, collision }) {
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

  function collidesWithPlayer(nx, ny, npc) {
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
    return rectsOverlap(npcRect, playerRect);
  }

  function isRoamPositionBlocked(npc, nx, ny, currentAreaId, currentMap, currentMapW, currentMapH) {
    if (collision.collidesAt(nx, ny, currentMap, currentMapW, currentMapH)) return true;
    if (collidesWithBlockingNpc(nx, ny, npc, currentAreaId)) return true;
    if (collidesWithPlayer(nx, ny, npc)) return true;
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

      if (Number.isFinite(npc.roamIdleUntil) && now < npc.roamIdleUntil) continue;

      if (
        !Number.isFinite(npc.roamTargetX) ||
        !Number.isFinite(npc.roamTargetY) ||
        (Number.isFinite(npc.roamRetargetAt) && now >= npc.roamRetargetAt)
      ) {
        pickRoamTarget(npc, now, currentAreaId, currentMap, currentMapW, currentMapH);
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

      const speedPx = Number.isFinite(npc.wanderSpeed) ? Math.max(0.3, npc.wanderSpeed) : 0.9;
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
