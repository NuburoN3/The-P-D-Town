import { drawEntityShadow } from "./uiPrimitives.js";

function drawPlayer(
  ctx,
  state,
  getHandstandSprite,
  getEquippedTrainingHeadbandSprite,
  tileSize,
  spriteFrameWidth,
  spriteFrameHeight,
  spriteFramesPerRow
) {
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
  const hasTrainingHeadbandEquipped = state.playerEquipment?.head === "Training Headband";
  const equippedHeadbandSprite = hasTrainingHeadbandEquipped
    ? getEquippedTrainingHeadbandSprite?.()
    : null;
  const shouldDrawEquippedHeadband = Boolean(
    equippedHeadbandSprite &&
    equippedHeadbandSprite.width &&
    equippedHeadbandSprite.height
  );
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
    if (shouldDrawEquippedHeadband) {
      ctx.drawImage(
        equippedHeadbandSprite,
        sx,
        sy,
        spriteFrameWidth,
        spriteFrameHeight,
        drawX,
        drawY,
        drawWidth,
        drawHeight
      );
    }
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
  if (shouldDrawEquippedHeadband) {
    ctx.drawImage(
      equippedHeadbandSprite,
      sx,
      sy,
      spriteFrameWidth,
      spriteFrameHeight,
      drawX,
      drawY,
      drawWidth,
      drawHeight
    );
  }
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

function drawNpcOwBubble(ctx, npc, drawX, drawY, drawWidth) {
  const text = typeof npc.hitBubbleText === "string" && npc.hitBubbleText.length > 0
    ? npc.hitBubbleText
    : "Ow!";
  ctx.save();
  ctx.font = "bold 12px Georgia";
  const previousAlign = ctx.textAlign;
  const previousBaseline = ctx.textBaseline;
  const paddingX = 7;
  const bubbleW = Math.ceil(ctx.measureText(text).width) + paddingX * 2;
  const bubbleH = 20;
  const bubbleX = Math.round(drawX + drawWidth / 2 - bubbleW / 2);
  const bubbleY = Math.round(drawY - 30);
  ctx.fillStyle = "rgba(255, 252, 241, 0.95)";
  ctx.fillRect(bubbleX, bubbleY, bubbleW, bubbleH);
  ctx.strokeStyle = "rgba(73, 51, 30, 0.85)";
  ctx.lineWidth = 1;
  ctx.strokeRect(bubbleX + 0.5, bubbleY + 0.5, bubbleW - 1, bubbleH - 1);
  ctx.beginPath();
  ctx.moveTo(bubbleX + bubbleW / 2 - 4, bubbleY + bubbleH);
  ctx.lineTo(bubbleX + bubbleW / 2 + 4, bubbleY + bubbleH);
  ctx.lineTo(Math.round(drawX + drawWidth / 2), bubbleY + bubbleH + 5);
  ctx.closePath();
  ctx.fillStyle = "rgba(255, 252, 241, 0.95)";
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#3a2919";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, Math.round(bubbleX + bubbleW / 2), Math.round(bubbleY + bubbleH / 2));
  ctx.textAlign = previousAlign;
  ctx.textBaseline = previousBaseline;
  ctx.restore();
}

function drawNPCs(ctx, state, canvas, tileSize, colors, owBubbleQueue = null) {
  const { currentAreaId, npcs, cam } = state;
  const now = performance.now();

  for (const npc of npcs) {
    if (npc.world !== currentAreaId) continue;

    let shakeX = 0;
    let shakeY = 0;
    const shakeUntil = Number.isFinite(npc.hitShakeUntil) ? npc.hitShakeUntil : 0;
    if (now < shakeUntil) {
      const t = (shakeUntil - now) / 220;
      const amp = 1.1 + Math.max(0, t) * 1.8;
      shakeX = Math.sin(now * 0.09 + npc.x * 0.01) * amp;
      shakeY = Math.cos(now * 0.11 + npc.y * 0.01) * amp * 0.45;
    }

    const nx = npc.x - cam.x + shakeX;
    const ny = npc.y - cam.y + shakeY;

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
          drawX = Math.round(npc.x - cam.x - (drawWidth - tileSize) / 2 + shakeX);
          drawY = Math.round(npc.y - cam.y - (drawHeight - tileSize) + shakeY);
        } else {
          drawWidth = npc.spriteWidth || tileSize;
          drawHeight = npc.spriteHeight || tileSize;
          drawX = Math.round(npc.x - cam.x - (drawWidth - tileSize) / 2 + shakeX);
          drawY = Math.round(npc.y - cam.y - (drawHeight - tileSize) + shakeY);
        }

        drawEntityShadow(ctx, drawX, drawY, drawWidth, drawHeight, colors.GROUND_SHADOW);
        drawNPCSprite(ctx, npc, drawX, drawY, drawWidth, drawHeight);
        if (now < (Number.isFinite(npc.hitBubbleUntil) ? npc.hitBubbleUntil : 0)) {
          if (Array.isArray(owBubbleQueue)) {
            owBubbleQueue.push({ npc, drawX, drawY, drawWidth });
          } else {
            drawNpcOwBubble(ctx, npc, drawX, drawY, drawWidth);
          }
        }
      } else {
        drawNPCPlaceholder(ctx, nx, ny, colors);
        if (now < (Number.isFinite(npc.hitBubbleUntil) ? npc.hitBubbleUntil : 0)) {
          if (Array.isArray(owBubbleQueue)) {
            owBubbleQueue.push({ npc, drawX: nx, drawY: ny, drawWidth: npc.width || tileSize });
          } else {
            drawNpcOwBubble(ctx, npc, nx, ny, npc.width || tileSize);
          }
        }
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

      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const countdown = Math.max(0, Math.ceil(remaining / 120));
      ctx.fillStyle = "rgba(255, 242, 198, 0.96)";
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 2;
      ctx.strokeText(String(countdown), centerX, ey - 8);
      ctx.fillText(String(countdown), centerX, ey - 8);
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
    }

    drawEnemyHealthBar(ctx, enemy, ex, ey, tileSize);
  }
}

function drawLeftovers(ctx, state, canvas, tileSize) {
  const { leftovers, currentTownId, currentAreaId, cam } = state;
  if (!Array.isArray(leftovers) || leftovers.length === 0) return;
  const leftoversSprite = state?.leftoversSprite;
  const hasSprite = Boolean(leftoversSprite && (leftoversSprite.width > 0 || leftoversSprite.naturalWidth > 0));

  for (const leftover of leftovers) {
    if (!leftover) continue;
    if (leftover.depleted) continue;
    const hasLoot = (Number(leftover.gold) > 0) || (Number(leftover.silver) > 0) || (Array.isArray(leftover.items) && leftover.items.length > 0);
    if (!hasLoot) continue;
    if (leftover.townId !== currentTownId || leftover.areaId !== currentAreaId) continue;

    const worldX = Number.isFinite(leftover.x) ? leftover.x : 0;
    const worldY = Number.isFinite(leftover.y) ? leftover.y : 0;
    const ex = Math.round(worldX - cam.x - tileSize * 0.34);
    const ey = Math.round(worldY - cam.y - tileSize * 0.2);
    const drawSize = Math.max(12, Math.round(tileSize * 0.58));
    if (ex > canvas.width || ey > canvas.height || ex < -drawSize || ey < -drawSize) continue;

    const pulse = 0.5 + Math.sin((performance.now() + worldX * 0.2) * 0.005) * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    ctx.beginPath();
    ctx.ellipse(ex + drawSize * 0.5, ey + drawSize * 0.86, drawSize * 0.34, drawSize * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    if (hasSprite) {
      ctx.globalAlpha = 0.94;
      ctx.drawImage(leftoversSprite, ex, ey, drawSize, drawSize);
    } else {
      ctx.fillStyle = "rgba(241, 233, 217, 0.95)";
      ctx.fillRect(ex + drawSize * 0.39, ey + drawSize * 0.42, drawSize * 0.22, drawSize * 0.3);
      ctx.fillRect(ex + drawSize * 0.28, ey + drawSize * 0.52, drawSize * 0.12, drawSize * 0.08);
      ctx.fillRect(ex + drawSize * 0.6, ey + drawSize * 0.52, drawSize * 0.12, drawSize * 0.08);
      ctx.fillRect(ex + drawSize * 0.42, ey + drawSize * 0.72, drawSize * 0.08, drawSize * 0.2);
      ctx.fillRect(ex + drawSize * 0.5, ey + drawSize * 0.72, drawSize * 0.08, drawSize * 0.2);

      ctx.beginPath();
      ctx.arc(ex + drawSize * 0.5, ey + drawSize * 0.25, drawSize * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(41, 34, 27, 0.82)";
      ctx.fillRect(ex + drawSize * 0.43, ey + drawSize * 0.22, 2, 2);
      ctx.fillRect(ex + drawSize * 0.55, ey + drawSize * 0.22, 2, 2);
    }

    const glowR = drawSize * (0.48 + pulse * 0.08);
    const glow = ctx.createRadialGradient(
      ex + drawSize * 0.5,
      ey + drawSize * 0.5,
      2,
      ex + drawSize * 0.5,
      ey + drawSize * 0.5,
      glowR
    );
    glow.addColorStop(0, "rgba(215, 255, 233, 0.14)");
    glow.addColorStop(1, "rgba(215, 255, 233, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(ex - 6, ey - 6, drawSize + 12, drawSize + 12);
    ctx.restore();
  }
}

function drawPlayerAttackReadability(ctx, state, tileSize) {
  const { player, cam } = state;
  if (!player || player.attackState !== "active") return;

  const now = performance.now();
  const attackEndsAt = Number.isFinite(player.attackActiveUntil) ? player.attackActiveUntil : now;
  const attackStartedAt = Number.isFinite(player.attackActiveAt) ? player.attackActiveAt : now - 1;
  const total = Math.max(1, attackEndsAt - attackStartedAt);
  const t = Math.max(0, Math.min(1, (now - attackStartedAt) / total));

  const cx = player.x - cam.x + tileSize * 0.5;
  const cy = player.y - cam.y + tileSize * 0.5;
  const radius = Number.isFinite(player.attackHitRadius) ? player.attackHitRadius : tileSize * 0.7;

  let facingAngle = Math.PI * 0.5;
  if (player.dir === "up") facingAngle = -Math.PI * 0.5;
  else if (player.dir === "left") facingAngle = Math.PI;
  else if (player.dir === "right") facingAngle = 0;

  const span = Math.PI * 0.62;
  const start = facingAngle - span;
  const end = facingAngle + span;
  ctx.fillStyle = `rgba(255, 228, 166, ${0.12 + (1 - t) * 0.16})`;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, radius + tileSize * 0.28, start, end);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 241, 204, 0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + tileSize * 0.12, start, end);
  ctx.stroke();
}

export function drawEntitiesLayer({
  ctx,
  state,
  canvas,
  tileSize,
  colors,
  getHandstandSprite,
  getEquippedTrainingHeadbandSprite,
  spriteFrameWidth,
  spriteFrameHeight,
  spriteFramesPerRow
}) {
  const owBubbleQueue = [];
  drawNPCs(ctx, state, canvas, tileSize, colors, owBubbleQueue);
  drawEnemies(ctx, state, canvas, tileSize);
  drawLeftovers(ctx, state, canvas, tileSize);
  drawPlayerAttackReadability(ctx, state, tileSize);
  drawPlayer(
    ctx,
    state,
    getHandstandSprite,
    getEquippedTrainingHeadbandSprite,
    tileSize,
    spriteFrameWidth,
    spriteFrameHeight,
    spriteFramesPerRow
  );
  for (const bubble of owBubbleQueue) {
    drawNpcOwBubble(ctx, bubble.npc, bubble.drawX, bubble.drawY, bubble.drawWidth);
  }
}
