import { drawEntityShadow } from "./uiPrimitives.js";

function drawPlayer(ctx, state, getHandstandSprite, tileSize, spriteFrameWidth, spriteFrameHeight, spriteFramesPerRow) {
  const { player, cam } = state;
  if (!player.sprite || !player.sprite.width || !player.sprite.height) return;
  const now = performance.now();
  const defeatSequence = state.playerDefeatSequence;
  const isDefeatFallActive = Boolean(
    defeatSequence?.active &&
    (defeatSequence.phase === "fall" || defeatSequence.phase === "fadeOut")
  );

  const targetHeight = tileSize * player.desiredHeightTiles;
  const scale = targetHeight / spriteFrameHeight;
  const drawWidth = spriteFrameWidth * scale;
  const drawHeight = spriteFrameHeight * scale;
  const drawX = Math.round(player.x - cam.x - (drawWidth - tileSize) / 2);
  const drawY = Math.round(player.y - cam.y - (drawHeight - tileSize));

  drawEntityShadow(ctx, drawX, drawY, drawWidth, drawHeight, "rgba(0,0,0,0.22)");
  ctx.save();
  if (player.invulnerableUntil > now && Math.floor(now / 90) % 2 === 0) {
    ctx.globalAlpha = 0.45;
  }

  if (player.isTraining) {
    const handSprite = getHandstandSprite() || player.sprite;
    const frame = player.handstandFrame || 0;
    const sx = frame * spriteFrameWidth;
    const sy = 0;
    ctx.drawImage(
      handSprite,
      sx,
      sy,
      spriteFrameWidth,
      spriteFrameHeight,
      drawX,
      drawY,
      drawWidth,
      drawHeight
    );
    ctx.restore();
    return;
  }

  const directionToRow = {
    down: 0,
    left: 1,
    right: 2,
    up: 3
  };
  const row = directionToRow[player.dir] ?? 0;
  const frame = player.walking ? player.animFrame : 1;
  const sx = frame * spriteFrameWidth;
  const sy = row * spriteFrameHeight;
  const defeatFallProgress = isDefeatFallActive
    ? Math.max(0, Math.min(1, defeatSequence.fallProgress || 0))
    : 0;

  if (isDefeatFallActive) {
    const pivotX = drawX + drawWidth / 2;
    const pivotY = drawY + drawHeight - 2;
    const maxFallAngle = Math.PI * 0.44;
    const fallAngle = -maxFallAngle * defeatFallProgress;

    ctx.save();
    ctx.translate(pivotX, pivotY);
    ctx.rotate(fallAngle);
    ctx.translate(-pivotX, -pivotY);
    ctx.drawImage(
      player.sprite,
      sx,
      sy,
      spriteFrameWidth,
      spriteFrameHeight,
      drawX,
      drawY,
      drawWidth,
      drawHeight
    );
    ctx.restore();
    ctx.restore();
    return;
  }

  ctx.drawImage(
    player.sprite,
    sx,
    sy,
    spriteFrameWidth,
    spriteFrameHeight,
    drawX,
    drawY,
    drawWidth,
    drawHeight
  );
  ctx.restore();
}

function drawNPCSprite(ctx, npc, drawX, drawY, drawWidth, drawHeight) {
  const frameWidth = Number.isFinite(npc.spriteFrameWidth) && npc.spriteFrameWidth > 0
    ? npc.spriteFrameWidth
    : null;
  const frameHeight = Number.isFinite(npc.spriteFrameHeight) && npc.spriteFrameHeight > 0
    ? npc.spriteFrameHeight
    : null;
  const framesPerRow = Number.isFinite(npc.spriteFramesPerRow) && npc.spriteFramesPerRow > 0
    ? Math.floor(npc.spriteFramesPerRow)
    : null;

  if (frameWidth && frameHeight && framesPerRow) {
    const directionToRow = {
      down: 0,
      left: 1,
      right: 2,
      up: 3
    };
    const row = directionToRow[npc.dir] ?? 0;
    const frame = Math.min(1, framesPerRow - 1);
    const sx = frame * frameWidth;
    const sy = row * frameHeight;
    ctx.drawImage(
      npc.sprite,
      sx,
      sy,
      frameWidth,
      frameHeight,
      drawX,
      drawY,
      drawWidth,
      drawHeight
    );
    return;
  }

  ctx.save();
  if (npc.dir === "left") {
    ctx.translate(drawX + drawWidth / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(drawX + drawWidth / 2), 0);
  }
  ctx.drawImage(npc.sprite, drawX, drawY, drawWidth, drawHeight);
  ctx.restore();
}

function drawNPCPlaceholder(ctx, nx, ny, colors) {
  ctx.fillStyle = colors.NPC_BODY;
  ctx.fillRect(nx + 6, ny + 8, 20, 20);
  ctx.fillStyle = colors.NPC_FACE;
  ctx.fillRect(nx + 10, ny + 4, 12, 8);
  ctx.fillStyle = colors.NPC_LEGS;
  ctx.fillRect(nx + 10, ny + 26, 6, 6);
  ctx.fillRect(nx + 16, ny + 26, 6, 6);
}

function drawNPCs(ctx, state, canvas, tileSize, colors) {
  const { currentAreaId, npcs, cam } = state;

  for (const npc of npcs) {
    if (npc.world !== currentAreaId) continue;

    const nx = npc.x - cam.x;
    const ny = npc.y - cam.y;

    if (nx > -npc.width && ny > -npc.height && nx < canvas.width && ny < canvas.height) {
      if (npc.sprite && npc.sprite.width && npc.sprite.height) {
        let drawWidth;
        let drawHeight;
        let drawX;
        let drawY;

        const frameHeight = Number.isFinite(npc.spriteFrameHeight) && npc.spriteFrameHeight > 0
          ? npc.spriteFrameHeight
          : npc.sprite.height;
        const frameWidth = Number.isFinite(npc.spriteFrameWidth) && npc.spriteFrameWidth > 0
          ? npc.spriteFrameWidth
          : npc.sprite.width;

        if (npc.desiredHeightTiles) {
          const targetHeight = tileSize * npc.desiredHeightTiles;
          const scale = targetHeight / frameHeight;
          drawWidth = frameWidth * scale;
          drawHeight = frameHeight * scale;
          drawX = Math.round(npc.x - cam.x - (drawWidth - tileSize) / 2);
          drawY = Math.round(npc.y - cam.y - (drawHeight - tileSize));
        } else {
          drawWidth = npc.spriteWidth || tileSize;
          drawHeight = npc.spriteHeight || tileSize;
          drawX = Math.round(npc.x - cam.x - (drawWidth - tileSize) / 2);
          drawY = Math.round(npc.y - cam.y - (drawHeight - tileSize));
        }

        drawEntityShadow(ctx, drawX, drawY, drawWidth, drawHeight, colors.GROUND_SHADOW);
        drawNPCSprite(ctx, npc, drawX, drawY, drawWidth, drawHeight);
      } else {
        drawNPCPlaceholder(ctx, nx, ny, colors);
      }
    }
  }
}

function drawEnemyPlaceholder(ctx, enemy, ex, ey, tileSize) {
  const base = enemy.state === "attackWindup"
    ? "#bb4a4a"
    : enemy.state === "hitStun"
      ? "#9b7ea6"
      : "#705765";
  const trim = enemy.state === "attackWindup" ? "#ffd0a0" : "#d7bbc5";

  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(ex + 16, ey + tileSize - 4, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = base;
  ctx.fillRect(ex + 7, ey + 8, 18, 17);
  ctx.fillStyle = trim;
  ctx.fillRect(ex + 10, ey + 11, 12, 4);
  ctx.fillStyle = "#f1e0d0";
  ctx.fillRect(ex + 11, ey + 17, 10, 5);
  ctx.fillStyle = "#2a2327";
  ctx.fillRect(ex + 12, ey + 18, 1, 1);
  ctx.fillRect(ex + 19, ey + 18, 1, 1);
  ctx.fillStyle = "#3e2529";
  ctx.fillRect(ex + 9, ey + 24, 6, 5);
  ctx.fillRect(ex + 17, ey + 24, 6, 5);

  ctx.fillStyle = "#50323d";
  ctx.beginPath();
  ctx.moveTo(ex + 12, ey + 8);
  ctx.lineTo(ex + 15, ey + 3);
  ctx.lineTo(ex + 17, ey + 8);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(ex + 18, ey + 8);
  ctx.lineTo(ex + 21, ey + 3);
  ctx.lineTo(ex + 23, ey + 8);
  ctx.closePath();
  ctx.fill();
}

function drawEnemyHealthBar(ctx, enemy, ex, ey, tileSize) {
  if (enemy.hp >= enemy.maxHp) return;
  const ratio = Math.max(0, Math.min(1, enemy.hp / Math.max(1, enemy.maxHp)));
  const barW = tileSize - 4;
  const barH = 4;
  const barX = ex + 2;
  const barY = ey - 8;
  ctx.fillStyle = "rgba(10, 10, 14, 0.8)";
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = ratio > 0.5 ? "#7ad080" : ratio > 0.25 ? "#ddb95f" : "#d36a6a";
  ctx.fillRect(barX, barY, barW * ratio, barH);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);
}

function drawEnemies(ctx, state, canvas, tileSize) {
  const { currentAreaId, enemies, cam } = state;
  if (!Array.isArray(enemies) || enemies.length === 0) return;

  for (const enemy of enemies) {
    if (!enemy || enemy.dead || enemy.world !== currentAreaId) continue;

    const ex = Math.round(enemy.x - cam.x);
    const ey = Math.round(enemy.y - cam.y);
    if (ex > canvas.width || ey > canvas.height || ex < -tileSize || ey < -tileSize) continue;

    if (enemy.sprite && enemy.sprite.width && enemy.sprite.height) {
      ctx.drawImage(enemy.sprite, ex, ey, tileSize, tileSize);
    } else {
      drawEnemyPlaceholder(ctx, enemy, ex, ey, tileSize);
    }

    if (enemy.state === "attackWindup") {
      const now = performance.now();
      const totalWindup = Math.max(1, enemy.attackWindupMs || 1);
      const remaining = Math.max(0, (enemy.attackStrikeAt || now) - now);
      const windupProgress = Math.max(0, Math.min(1, 1 - remaining / totalWindup));
      const centerX = ex + tileSize / 2;
      const centerY = ey + tileSize / 2;

      let facingAngle = Math.PI * 0.5;
      if (enemy.dir === "up") facingAngle = -Math.PI * 0.5;
      else if (enemy.dir === "left") facingAngle = Math.PI;
      else if (enemy.dir === "right") facingAngle = 0;

      const arcWidth = Math.PI * 0.55;
      ctx.fillStyle = `rgba(255, 138, 108, ${0.12 + windupProgress * 0.2})`;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, tileSize * (0.9 + windupProgress * 0.22), facingAngle - arcWidth, facingAngle + arcWidth);
      ctx.closePath();
      ctx.fill();

      const pulse = 0.5 + Math.sin(now * 0.02) * 0.5;
      ctx.strokeStyle = `rgba(255, 154, 120, ${0.35 + pulse * 0.4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, tileSize * (0.56 + windupProgress * 0.14), 0, Math.PI * 2);
      ctx.stroke();

      const ringProgressStart = -Math.PI * 0.5;
      const ringProgressEnd = ringProgressStart + Math.PI * 2 * windupProgress;
      ctx.strokeStyle = "rgba(255, 232, 173, 0.92)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, tileSize * 0.68, ringProgressStart, ringProgressEnd);
      ctx.stroke();
    }

    drawEnemyHealthBar(ctx, enemy, ex, ey, tileSize);
  }
}

export function drawEntitiesLayer({
  ctx,
  state,
  canvas,
  tileSize,
  colors,
  getHandstandSprite,
  spriteFrameWidth,
  spriteFrameHeight,
  spriteFramesPerRow
}) {
  drawNPCs(ctx, state, canvas, tileSize, colors);
  drawEnemies(ctx, state, canvas, tileSize);
  drawPlayer(
    ctx,
    state,
    getHandstandSprite,
    tileSize,
    spriteFrameWidth,
    spriteFrameHeight,
    spriteFramesPerRow
  );
}
