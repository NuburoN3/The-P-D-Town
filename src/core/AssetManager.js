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
  mrHanamiDialogueOpen: "assets/sprites/MrHanamiDialogue_Open.png",
  mrHanamiDialogueClosed: "assets/sprites/MrHanamiDialogue_Closed.png",
  protagonistStartScene: "assets/sprites/ProtagonistStartScene.png",
  protagonist: "assets/sprites/protagonist.png",
  protagonist_handstand: "assets/sprites/protagonist_handstand.png",
  trainingHeadband: "assets/sprites/TrainingHeadband.png",
  equipTrainingHeadband: "assets/sprites/Equip_TrainingHeadband.png",
  leftovers: "assets/sprites/Leftovers.png",
  silverCoins: "assets/sprites/SilverCoins.png",
  dojoMembership: "assets/sprites/DojoMembership.png",
  kendoStick: "assets/sprites/Kendo_Stick.png",
  insideDojoBackWall: "assets/sprites/Inside_Dojo_Back_wall.png",
  insideDojoSideWall: "assets/sprites/Inside_Dojo_Side_Wall.png",
  insideDojoExitWall: "assets/sprites/Dojo Exit wall.png",
  possum: "assets/sprites/Possum.png",
  obey: "assets/sprites/Obey.png",
  bonk: "assets/sprites/Bonk.png",
  ogre64: "assets/sprites/Ogre-64x64.png",
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
