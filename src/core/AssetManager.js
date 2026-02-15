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

export function createDefaultAssetManager() {
  const assets = new AssetManager();
  assets.loadManifest(DEFAULT_SPRITE_MANIFEST);
  return assets;
}
