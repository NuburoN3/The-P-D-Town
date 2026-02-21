let fountainSprite = null;
let fountainSpriteLoaded = false;
let processedFountainSprite = null;
let processedFountainSourceWidth = 0;
let processedFountainSourceHeight = 0;
let fountainAlphaData = null;
let fountainAlphaWidth = 0;
let fountainAlphaHeight = 0;

function isSpriteReady(sprite) {
  return Boolean(sprite && (sprite.width > 0 || sprite.complete));
}

function getFountainSprite() {
  if (fountainSpriteLoaded) return fountainSprite;
  fountainSpriteLoaded = true;
  if (typeof Image === "undefined") return null;
  const img = new Image();
  img.src = "assets/sprites/Fountain.png";
  fountainSprite = img;
  return fountainSprite;
}

function buildProcessedFountainSprite(sprite) {
  if (!isSpriteReady(sprite)) return null;
  if (
    processedFountainSprite &&
    processedFountainSourceWidth === sprite.width &&
    processedFountainSourceHeight === sprite.height
  ) {
    return processedFountainSprite;
  }
  if (typeof document === "undefined") return sprite;
  const canvas = document.createElement("canvas");
  canvas.width = sprite.width;
  canvas.height = sprite.height;
  const drawCtx = canvas.getContext("2d", { willReadFrequently: true });
  if (!drawCtx) return sprite;
  drawCtx.drawImage(sprite, 0, 0);
  const imageData = drawCtx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;

  const sample = (sx, sy) => {
    const x = Math.max(0, Math.min(canvas.width - 1, sx));
    const y = Math.max(0, Math.min(canvas.height - 1, sy));
    const idx = (y * canvas.width + x) * 4;
    return [pixels[idx], pixels[idx + 1], pixels[idx + 2]];
  };

  const edgeSamples = [
    sample(0, 0),
    sample(canvas.width - 1, 0),
    sample(0, canvas.height - 1),
    sample(canvas.width - 1, canvas.height - 1),
    sample(Math.floor(canvas.width * 0.5), 0),
    sample(Math.floor(canvas.width * 0.5), canvas.height - 1),
    sample(0, Math.floor(canvas.height * 0.5)),
    sample(canvas.width - 1, Math.floor(canvas.height * 0.5))
  ];

  let bgR = 0;
  let bgG = 0;
  let bgB = 0;
  for (const [r, g, b] of edgeSamples) {
    bgR += r;
    bgG += g;
    bgB += b;
  }
  bgR /= edgeSamples.length;
  bgG /= edgeSamples.length;
  bgB /= edgeSamples.length;

  const bgThresholdSq = 34 * 34;
  let opaqueCount = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const dr = r - bgR;
    const dg = g - bgG;
    const db = b - bgB;
    const nearBackground = (dr * dr + dg * dg + db * db) <= bgThresholdSq;
    // Key out pixels that match the sampled edge matte color.
    // The fountain source uses a mint/teal studio backdrop, not pure green.
    if (nearBackground) {
      pixels[i + 3] = 0;
    } else if (pixels[i + 3] > 0) {
      opaqueCount += 1;
    }
  }

  const borderStrip = 2;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (
        x < borderStrip ||
        y < borderStrip ||
        x >= canvas.width - borderStrip ||
        y >= canvas.height - borderStrip
      ) {
        const idx = (y * canvas.width + x) * 4 + 3;
        pixels[idx] = 0;
      }
    }
  }

  const totalPixels = canvas.width * canvas.height;
  const opaqueRatio = totalPixels > 0 ? (opaqueCount / totalPixels) : 0;
  // Keep only a minimal bailout for clearly-invalid processing results.
  // High keyed ratios are valid for sprites with large matte backgrounds.
  if (opaqueRatio < 0.08) {
    return sprite;
  }

  drawCtx.putImageData(imageData, 0, 0);
  processedFountainSprite = canvas;
  processedFountainSourceWidth = sprite.width;
  processedFountainSourceHeight = sprite.height;
  return processedFountainSprite;
}

export function getFountainRenderSprite() {
  const sprite = getFountainSprite();
  if (!isSpriteReady(sprite)) return null;
  return buildProcessedFountainSprite(sprite) || sprite;
}

function ensureFountainAlphaData(sprite) {
  if (!isSpriteReady(sprite)) return false;
  if (fountainAlphaData && fountainAlphaWidth === sprite.width && fountainAlphaHeight === sprite.height) {
    return true;
  }
  if (typeof document === "undefined") return false;
  const readCanvas = document.createElement("canvas");
  readCanvas.width = sprite.width;
  readCanvas.height = sprite.height;
  const readCtx = readCanvas.getContext("2d", { willReadFrequently: true });
  if (!readCtx) return false;
  readCtx.drawImage(sprite, 0, 0);
  fountainAlphaData = readCtx.getImageData(0, 0, readCanvas.width, readCanvas.height).data;
  fountainAlphaWidth = readCanvas.width;
  fountainAlphaHeight = readCanvas.height;
  return true;
}

export function isFountainSpriteOpaqueAtWorldPixel({
  building,
  tileSize,
  worldX,
  worldY
}) {
  if (!building || !Number.isFinite(tileSize) || tileSize <= 0) return true;
  const sprite = getFountainRenderSprite();
  if (!isSpriteReady(sprite)) return true;
  const drawWidth = building.width * tileSize;
  const drawHeight = building.height * tileSize;
  if (drawWidth <= 0 || drawHeight <= 0) return true;
  const originX = building.x * tileSize;
  const originY = building.y * tileSize;
  const localX = worldX - originX;
  const localY = worldY - originY;
  if (localX < 0 || localY < 0 || localX >= drawWidth || localY >= drawHeight) return false;
  // Tiles 3+ (1-based height) are visual-only height and should not block movement.
  // Slightly delay collision onset so it lines up with the visible basin lip.
  const depthStartYOffsetRows = 1.8;
  const depthStartY = drawHeight - tileSize * depthStartYOffsetRows;
  if (localY < depthStartY) return false;
  // Bottom depth zone blocks only where the fountain image is actually opaque.
  const sx = Math.max(0, Math.min(sprite.width - 1, Math.floor((localX / drawWidth) * sprite.width)));
  const sy = Math.max(0, Math.min(sprite.height - 1, Math.floor((localY / drawHeight) * sprite.height)));
  if (!ensureFountainAlphaData(sprite)) return true;
  const alpha = fountainAlphaData[(sy * fountainAlphaWidth + sx) * 4 + 3];
  return alpha >= 56;
}
