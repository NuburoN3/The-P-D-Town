// ============================================================================
// ASSET MANAGER - Instance-based sprite loading and retrieval
// ============================================================================

export class AssetManager {
  constructor() {
    this.sprites = {};
  }

  loadSprite(name, src) {
    const img = new Image();
    img.src = src;
    this.sprites[name] = img;
    return img;
  }

  loadManifest(manifest) {
    for (const [name, src] of Object.entries(manifest)) {
      this.loadSprite(name, src);
    }
  }

  getSprite(name) {
    return this.sprites[name] || null;
  }
}

export const DEFAULT_SPRITE_MANIFEST = {
  mr_hanami: "assets/sprites/mr_hanami.png",
  protagonist: "assets/sprites/protagonist.png",
  protagonist_handstand: "assets/sprites/protagonist_handstand.png"
};

function createBartenderSpriteDataUrl() {
  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  ctx.clearRect(0, 0, 32, 32);

  // shoes
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(10, 28, 4, 3);
  ctx.fillRect(18, 28, 4, 3);

  // trousers
  ctx.fillStyle = "#2a2f38";
  ctx.fillRect(10, 21, 12, 8);

  // shirt sleeves and hands
  ctx.fillStyle = "#f2efe6";
  ctx.fillRect(8, 14, 2, 8);
  ctx.fillRect(22, 14, 2, 8);
  ctx.fillStyle = "#dfb38f";
  ctx.fillRect(8, 20, 2, 2);
  ctx.fillRect(22, 20, 2, 2);

  // shirt
  ctx.fillStyle = "#f4f3ee";
  ctx.fillRect(10, 12, 12, 10);

  // vest
  ctx.fillStyle = "#23272f";
  ctx.fillRect(10, 13, 3, 9);
  ctx.fillRect(19, 13, 3, 9);
  ctx.fillRect(13, 16, 6, 6);

  // apron accent
  ctx.fillStyle = "#e6e0d3";
  ctx.fillRect(13, 20, 6, 7);
  ctx.fillStyle = "#cbc2ae";
  ctx.fillRect(13, 23, 6, 1);

  // bow tie
  ctx.fillStyle = "#8e2f2f";
  ctx.fillRect(14, 14, 4, 2);
  ctx.fillRect(15, 15, 2, 1);

  // neck
  ctx.fillStyle = "#dfb38f";
  ctx.fillRect(14, 11, 4, 2);

  // head
  ctx.fillStyle = "#e7bd99";
  ctx.fillRect(11, 5, 10, 8);

  // hair
  ctx.fillStyle = "#3b2b22";
  ctx.fillRect(10, 4, 12, 3);
  ctx.fillRect(10, 6, 2, 2);
  ctx.fillRect(20, 6, 2, 2);

  // eyes
  ctx.fillStyle = "#1f1f1f";
  ctx.fillRect(13, 8, 1, 1);
  ctx.fillRect(17, 8, 1, 1);

  // subtle smile
  ctx.fillStyle = "#9e5d52";
  ctx.fillRect(14, 10, 3, 1);

  return canvas.toDataURL("image/png");
}

export function createDefaultAssetManager() {
  const assets = new AssetManager();
  assets.loadManifest(DEFAULT_SPRITE_MANIFEST);

  const bartenderSprite = createBartenderSpriteDataUrl();
  assets.loadSprite("bartender_mika", bartenderSprite || DEFAULT_SPRITE_MANIFEST.mr_hanami);

  return assets;
}
