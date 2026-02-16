import { AREA_KINDS, GAME_STATES } from "../core/constants.js";
import { clamp, lerp } from "../core/mathUtils.js";

export function createMovementSystem({
  keys,
  getActionPressed = null,
  tileSize,
  spriteFramesPerRow,
  cameraZoom,
  musicManager,
  walkSoundIntervalMs = 300
}) {
  let lastWalkSoundTime = 0;

  // clamp and lerp imported from ../core/mathUtils.js

  function getCameraLookAhead(player) {
    if (!player.walking) {
      return { x: 0, y: 0 };
    }

    const lookAhead = tileSize * 0.38;
    if (player.dir === "left") return { x: -lookAhead, y: 0 };
    if (player.dir === "right") return { x: lookAhead, y: 0 };
    if (player.dir === "up") return { x: 0, y: -lookAhead };
    return { x: 0, y: lookAhead };
  }

  function updatePlayerMovement({
    player,
    currentMap,
    currentMapW,
    currentMapH,
    npcs,
    currentAreaId,
    dtScale = 1
  }, {
    collides,
    collidesWithNPC,
    doorFromCollision,
    beginDoorSequence
  }) {
    const isPressed = (action, legacyKeys = []) => {
      if (typeof getActionPressed === "function") {
        return Boolean(getActionPressed(action));
      }
      return legacyKeys.some((key) => Boolean(keys[key]));
    };

    let dx = 0;
    let dy = 0;

    if (isPressed("moveUp", ["w", "arrowup"])) {
      dy -= player.speed * dtScale;
      player.dir = "up";
    }
    if (isPressed("moveDown", ["s", "arrowdown"])) {
      dy += player.speed * dtScale;
      player.dir = "down";
    }
    if (isPressed("moveLeft", ["a", "arrowleft"])) {
      dx -= player.speed * dtScale;
      player.dir = "left";
    }
    if (isPressed("moveRight", ["d", "arrowright"])) {
      dx += player.speed * dtScale;
      player.dir = "right";
    }

    player.walking = dx !== 0 || dy !== 0;

    if (player.walking) {
      const now = performance.now();
      if (now - lastWalkSoundTime > walkSoundIntervalMs) {
        musicManager.playSfx("walking");
        lastWalkSoundTime = now;
      }
    }

    if (dx !== 0 && dy !== 0) {
      const s = Math.SQRT1_2;
      dx *= s;
      dy *= s;
    }

    const nx = player.x + dx;
    const ny = player.y + dy;

    if (!collides(nx, player.y, currentMap, currentMapW, currentMapH) &&
      !collidesWithNPC(nx, player.y, npcs, currentAreaId)) {
      player.x = nx;
    } else if (dx !== 0) {
      const doorTile = doorFromCollision(nx, player.y, currentMap, currentMapW, currentMapH);
      if (doorTile) {
        beginDoorSequence(doorTile);
      } else {
        musicManager.playSfx("collision");
      }
    }

    if (!collides(player.x, ny, currentMap, currentMapW, currentMapH) &&
      !collidesWithNPC(player.x, ny, npcs, currentAreaId)) {
      player.y = ny;
    } else if (dy !== 0) {
      const doorTile = doorFromCollision(player.x, ny, currentMap, currentMapW, currentMapH);
      if (doorTile) {
        beginDoorSequence(doorTile);
      } else {
        musicManager.playSfx("collision");
      }
    }

    if (player.walking) {
      player.frame = (player.frame + 1) % 24;
    }
  }

  function updateDoorEntry({ player, doorSequence, dtScale = 1 }, setGameState) {
    player.walking = true;
    player.frame = (player.frame + 1) % 24;

    if (doorSequence.frame < doorSequence.stepFrames) {
      player.x += doorSequence.stepDx * dtScale;
      player.y += doorSequence.stepDy * dtScale;
      doorSequence.frame++;
    } else {
      setGameState(GAME_STATES.TRANSITION);
    }
  }

  function updateTransition({ player, doorSequence, dtScale = 1 }, {
    setArea,
    setGameState,
    getCurrentAreaKind
  }) {
    player.walking = false;
    const fadeStep = (Number.isFinite(doorSequence.fadeStep) ? doorSequence.fadeStep : 20) * dtScale;

    if (doorSequence.transitionPhase === "out") {
      doorSequence.fadeRadius += fadeStep;
      if (doorSequence.fadeRadius >= doorSequence.maxFadeRadius) {
        doorSequence.fadeRadius = doorSequence.maxFadeRadius;
        setArea(doorSequence.targetTownId, doorSequence.targetAreaId);
        player.x = doorSequence.targetX;
        player.y = doorSequence.targetY;
        player.dir = doorSequence.targetDir;
        doorSequence.transitionPhase = "in";
      }
      return;
    }

    doorSequence.fadeRadius -= fadeStep;
    if (doorSequence.fadeRadius <= 0) {
      doorSequence.fadeRadius = 0;
      doorSequence.active = false;
      setGameState(
        getCurrentAreaKind() === AREA_KINDS.OVERWORLD
          ? GAME_STATES.OVERWORLD
          : GAME_STATES.INTERIOR
      );
    }
  }

  function updatePlayerAnimation(player) {
    if (player.isTraining) {
      player.handstandAnimTimer += 1;
      if (player.handstandAnimTimer >= 10) {
        player.handstandAnimTimer = 0;
        player.handstandFrame = (player.handstandFrame + 1) % spriteFramesPerRow;
      }
      player.animTimer = 0;
      player.animFrame = 1;
      return;
    }

    if (player.walking) {
      player.animTimer += 1;
      if (player.animTimer >= 8) {
        player.animTimer = 0;
        player.animFrame = (player.animFrame + 1) % spriteFramesPerRow;
      }
    } else {
      player.animTimer = 0;
      player.animFrame = 1;
    }
  }

  function updateCamera({ cam, player, currentMapW, currentMapH, canvas, gameState }) {
    const worldW = currentMapW * tileSize;
    const worldH = currentMapH * tileSize;
    const visibleW = canvas.width / cameraZoom;
    const visibleH = canvas.height / cameraZoom;
    const halfVisibleW = visibleW / 2;
    const halfVisibleH = visibleH / 2;

    const minX = Math.min(0, worldW - visibleW);
    const maxX = Math.max(0, worldW - visibleW);
    const minY = Math.min(0, worldH - visibleH);
    const maxY = Math.max(0, worldH - visibleH);

    const lookAhead = getCameraLookAhead(player);
    const targetX = clamp(player.x + lookAhead.x - halfVisibleW, minX, maxX);
    const targetY = clamp(player.y + lookAhead.y - halfVisibleH, minY, maxY);

    if (!cam.initialized) {
      cam.x = targetX;
      cam.y = targetY;
      cam.initialized = true;
      return;
    }

    const snapDistance = tileSize * 8;
    if (Math.abs(targetX - cam.x) > snapDistance || Math.abs(targetY - cam.y) > snapDistance) {
      cam.x = targetX;
      cam.y = targetY;
      return;
    }

    const smoothing = gameState === GAME_STATES.TRANSITION
      ? 0.32
      : player.walking
        ? 0.18
        : 0.12;

    cam.x = clamp(lerp(cam.x, targetX, smoothing), minX, maxX);
    cam.y = clamp(lerp(cam.y, targetY, smoothing), minY, maxY);

    if (Math.abs(cam.x - targetX) < 0.05) cam.x = targetX;
    if (Math.abs(cam.y - targetY) < 0.05) cam.y = targetY;
  }

  return {
    updatePlayerMovement,
    updateDoorEntry,
    updateTransition,
    updatePlayerAnimation,
    updateCamera
  };
}
