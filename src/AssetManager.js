// ============================================================================
// ASSET MANAGER - Centralized sprite loading and retrieval
// ============================================================================

export const AssetManager = {
  sprites: {},
  
  loadSprite(name, src) {
    const img = new Image();
    img.src = src;
    this.sprites[name] = img;
    return img;
  },
  
  getSprite(name) {
    return this.sprites[name] || null;
  }
};

// Load all sprites upfront
export function initializeAssets() {
  AssetManager.loadSprite('mr_hanami', 'mr_hanami.png');
  AssetManager.loadSprite('protagonist', 'protagonist.png');
  AssetManager.loadSprite('protagonist_handstand', 'protagonist_handstand.png');
}
