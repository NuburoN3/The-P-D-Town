export function createMovementSystem({
  keys,
  tileSize,
  spriteFramesPerRow,
  cameraZoom,
  musicManager,
  walkSoundIntervalMs = 300
}) {
  let lastWalkSoundTime = 0;

  function updatePlayerMovement({
    player,
    currentMap,
    currentMapW,
    currentMapH,
    npcs,
    currentAreaType
  }, {
    collides,
    collidesWithNPC,
    doorFromCollision,
    beginDoorSequence
  }) {
    let dx = 0;
    let dy = 0;

    if (keys["w"] || keys["arrowup"]) {
      dy -= player.speed;
      player.dir = "up";
    }
    if (keys["s"] || keys["arrowdown"]) {
      dy += player.speed;
      player.dir = "down";
    }
    if (keys["a"] || keys["arrowleft"]) {
      dx -= player.speed;
      player.dir = "left";
    }
    if (keys["d"] || keys["arrowright"]) {
      dx += player.speed;
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
        !collidesWithNPC(nx, player.y, npcs, currentAreaType)) {
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
        !collidesWithNPC(player.x, ny, npcs, currentAreaType)) {
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

  function updateDoorEntry({ player, doorSequence }, setGameState) {
    player.walking = true;
    player.frame = (player.frame + 1) % 24;

    if (doorSequence.frame < doorSequence.stepFrames) {
      player.x += doorSequence.stepDx;
      player.y += doorSequence.stepDy;
      doorSequence.frame++;
    } else {
      setGameState("transition");
    }
  }

  function updateTransition({ player, doorSequence }, {
    setArea,
    setGameState,
    getCurrentAreaType
  }) {
    player.walking = false;

    if (doorSequence.transitionPhase === "out") {
      doorSequence.fadeRadius -= 20;
      if (doorSequence.fadeRadius <= 0) {
        doorSequence.fadeRadius = 0;
        setArea(doorSequence.targetAreaType);
        player.x = doorSequence.targetX;
        player.y = doorSequence.targetY;
        player.dir = doorSequence.targetAreaType === "overworld" ? "down" : "up";
        doorSequence.transitionPhase = "in";
      }
      return;
    }

    doorSequence.fadeRadius += 20;
    if (doorSequence.fadeRadius >= doorSequence.maxFadeRadius) {
      doorSequence.fadeRadius = doorSequence.maxFadeRadius;
      doorSequence.active = false;
      setGameState(getCurrentAreaType() === "overworld" ? "overworld" : "interior");
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

  function updateCamera({ cam, player, currentMapW, currentMapH, canvas }) {
    const worldW = currentMapW * tileSize;
    const worldH = currentMapH * tileSize;
    const visibleW = canvas.width / cameraZoom;
    const visibleH = canvas.height / cameraZoom;
    const halfVisibleW = visibleW / 2;
    const halfVisibleH = visibleH / 2;

    const cx = player.x - halfVisibleW;
    const cy = player.y - halfVisibleH;

    const minX = Math.min(0, worldW - visibleW);
    const maxX = Math.max(0, worldW - visibleW);
    const minY = Math.min(0, worldH - visibleH);
    const maxY = Math.max(0, worldH - visibleH);

    cam.x = Math.max(minX, Math.min(cx, maxX));
    cam.y = Math.max(minY, Math.min(cy, maxY));
  }

  return {
    updatePlayerMovement,
    updateDoorEntry,
    updateTransition,
    updatePlayerAnimation,
    updateCamera
  };
}
