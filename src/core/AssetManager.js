import { createGeneratedSpriteEntries } from "./spriteFactories.js";
import { ASSET_KEYS, ASSET_PATHS } from "./constants.js";

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

  hasSprite(name) {
    return Object.prototype.hasOwnProperty.call(this.sprites, name);
  }
}

export const DEFAULT_SPRITE_MANIFEST = {
  mr_hanami: "assets/sprites/mr_hanami.png",
  protagonist: "assets/sprites/protagonist.png",
  protagonist_handstand: "assets/sprites/protagonist_handstand.png",
  trainingHeadband: "assets/sprites/TrainingHeadband.png",
  dojoMembership: "assets/sprites/DojoMembership.png",
  [ASSET_KEYS.TITLE_HERO_IMAGE]: ASSET_PATHS.TITLE_HERO_IMAGE
};

export function createDefaultAssetManager() {
  const assets = new AssetManager();
  assets.loadManifest(DEFAULT_SPRITE_MANIFEST);

  const fallbackHuman = DEFAULT_SPRITE_MANIFEST.mr_hanami;
  const generatedEntries = createGeneratedSpriteEntries(fallbackHuman);
  for (const [name, src] of generatedEntries) {
    assets.loadSprite(name, src);
  }

  assets.loadSprite("innkeeper_pat", "assets/sprites/pat.png");
  return assets;
}
