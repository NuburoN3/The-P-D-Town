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
  protagonist_handstand: "assets/sprites/protagonist_handstand.png",
  trainingHeadband: "assets/sprites/TrainingHeadband.png",
  dojoMembership: "assets/sprites/DojoMembership.png"
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

function createBarPatronSpriteDataUrl({
  shirt = "#6f8bb5",
  jacket = "#2e3b52",
  hair = "#3a2921",
  skin = "#ddb189",
  pants = "#2a2f3a",
  accent = "#d3e2ff"
} = {}) {
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
  ctx.fillStyle = "#1c1c1c";
  ctx.fillRect(10, 28, 4, 3);
  ctx.fillRect(18, 28, 4, 3);

  // pants
  ctx.fillStyle = pants;
  ctx.fillRect(10, 21, 12, 8);

  // shirt and sleeves
  ctx.fillStyle = shirt;
  ctx.fillRect(10, 12, 12, 10);
  ctx.fillRect(8, 14, 2, 8);
  ctx.fillRect(22, 14, 2, 8);

  // jacket
  ctx.fillStyle = jacket;
  ctx.fillRect(10, 13, 3, 9);
  ctx.fillRect(19, 13, 3, 9);

  // collar / accessory
  ctx.fillStyle = accent;
  ctx.fillRect(14, 14, 4, 2);

  // neck and hands
  ctx.fillStyle = skin;
  ctx.fillRect(14, 11, 4, 2);
  ctx.fillRect(8, 20, 2, 2);
  ctx.fillRect(22, 20, 2, 2);

  // head
  ctx.fillStyle = skin;
  ctx.fillRect(11, 5, 10, 8);

  // hair
  ctx.fillStyle = hair;
  ctx.fillRect(10, 4, 12, 3);
  ctx.fillRect(10, 6, 2, 2);
  ctx.fillRect(20, 6, 2, 2);

  // eyes
  ctx.fillStyle = "#1f1f1f";
  ctx.fillRect(13, 8, 1, 1);
  ctx.fillRect(17, 8, 1, 1);

  // subtle smile
  ctx.fillStyle = "#8b564a";
  ctx.fillRect(14, 10, 3, 1);

  return canvas.toDataURL("image/png");
}

function createHorseSpriteDataUrl() {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = "#6e4b33";
  ctx.fillRect(7, 14, 18, 10);
  ctx.fillRect(21, 10, 7, 9);
  ctx.fillStyle = "#553725";
  ctx.fillRect(23, 7, 3, 4);
  ctx.fillRect(26, 8, 2, 3);
  ctx.fillStyle = "#312621";
  ctx.fillRect(8, 24, 3, 7);
  ctx.fillRect(13, 24, 3, 7);
  ctx.fillRect(19, 24, 3, 7);
  ctx.fillRect(23, 24, 3, 7);
  ctx.fillStyle = "#2a1d18";
  ctx.fillRect(6, 15, 2, 6);
  ctx.fillStyle = "#f0e2c2";
  ctx.fillRect(24, 13, 2, 2);
  ctx.fillStyle = "#101010";
  ctx.fillRect(25, 11, 1, 1);
  return canvas.toDataURL("image/png");
}

function createCowSpriteDataUrl() {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = "#f2f0ea";
  ctx.fillRect(7, 14, 18, 10);
  ctx.fillRect(21, 11, 7, 8);
  ctx.fillStyle = "#3d3b3a";
  ctx.fillRect(9, 16, 4, 3);
  ctx.fillRect(17, 18, 5, 4);
  ctx.fillRect(23, 12, 3, 2);
  ctx.fillStyle = "#d8b39a";
  ctx.fillRect(24, 16, 3, 2);
  ctx.fillStyle = "#2f2d2b";
  ctx.fillRect(8, 24, 3, 7);
  ctx.fillRect(13, 24, 3, 7);
  ctx.fillRect(19, 24, 3, 7);
  ctx.fillRect(23, 24, 3, 7);
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(25, 13, 1, 1);
  return canvas.toDataURL("image/png");
}

function createChickenSpriteDataUrl() {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = "#f4ead3";
  ctx.fillRect(11, 14, 10, 8);
  ctx.fillStyle = "#dfd1b0";
  ctx.fillRect(19, 12, 5, 6);
  ctx.fillStyle = "#d6453a";
  ctx.fillRect(20, 10, 2, 2);
  ctx.fillRect(22, 10, 1, 2);
  ctx.fillStyle = "#d09a3a";
  ctx.fillRect(23, 15, 2, 1);
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(21, 13, 1, 1);
  ctx.fillStyle = "#aa7e34";
  ctx.fillRect(13, 22, 1, 5);
  ctx.fillRect(17, 22, 1, 5);
  return canvas.toDataURL("image/png");
}

function createDogSpriteDataUrl() {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = "#8c6a4f";
  ctx.fillRect(8, 15, 15, 8); // torso
  ctx.fillRect(20, 11, 8, 8); // head
  ctx.fillStyle = "#70523d";
  ctx.fillRect(22, 8, 3, 4); // ear
  ctx.fillRect(25, 9, 2, 3); // ear tip
  ctx.fillStyle = "#f3e0c7";
  ctx.fillRect(22, 14, 4, 3); // muzzle
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(24, 13, 1, 1); // eye
  ctx.fillRect(25, 15, 1, 1); // nose
  ctx.fillStyle = "#5a4333";
  ctx.fillRect(9, 23, 3, 7); // legs
  ctx.fillRect(14, 23, 3, 7);
  ctx.fillRect(19, 23, 3, 7);
  ctx.fillStyle = "#6a4d39";
  ctx.fillRect(6, 14, 2, 6); // tail
  ctx.fillStyle = "#c63a4a";
  ctx.fillRect(17, 14, 3, 1); // collar

  return canvas.toDataURL("image/png");
}

export function createDefaultAssetManager() {
  const assets = new AssetManager();
  assets.loadManifest(DEFAULT_SPRITE_MANIFEST);
  const fallbackHuman = DEFAULT_SPRITE_MANIFEST.mr_hanami;

  const bartenderSprite = createBartenderSpriteDataUrl();
  assets.loadSprite("bartender_mika", bartenderSprite || fallbackHuman);

  const rikuSprite = createBarPatronSpriteDataUrl({
    shirt: "#5d7ca8",
    jacket: "#28364d",
    hair: "#2e211a",
    skin: "#d9af8b",
    pants: "#2a3038",
    accent: "#b6d8ff"
  });
  assets.loadSprite("bar_patron_riku", rikuSprite || fallbackHuman);

  const ayaSprite = createBarPatronSpriteDataUrl({
    shirt: "#9d5a7d",
    jacket: "#45263a",
    hair: "#4a2f24",
    skin: "#e5b997",
    pants: "#2f2531",
    accent: "#ffd1ec"
  });
  assets.loadSprite("bar_patron_aya", ayaSprite || fallbackHuman);

  const kenjiSprite = createBarPatronSpriteDataUrl({
    shirt: "#6a8f63",
    jacket: "#2f4a33",
    hair: "#3a2b24",
    skin: "#d8af8c",
    pants: "#25332c",
    accent: "#d3f1c8"
  });
  assets.loadSprite("bar_patron_kenji", kenjiSprite || fallbackHuman);

  const yoriSprite = createBarPatronSpriteDataUrl({
    shirt: "#6982aa",
    jacket: "#2a3854",
    hair: "#2f2420",
    skin: "#e0b691",
    pants: "#1f2b42",
    accent: "#d4e6ff"
  });
  assets.loadSprite("dojo_student_yori", yoriSprite || fallbackHuman);

  const umeSprite = createBarPatronSpriteDataUrl({
    shirt: "#8a6a8f",
    jacket: "#4a3552",
    hair: "#4b372e",
    skin: "#dcb190",
    pants: "#322a36",
    accent: "#ebd7f3"
  });
  assets.loadSprite("dojo_caretaker_ume", umeSprite || fallbackHuman);

  const reiSprite = createBarPatronSpriteDataUrl({
    shirt: "#5f8c87",
    jacket: "#2f4f4a",
    hair: "#2f2623",
    skin: "#e2b996",
    pants: "#223936",
    accent: "#c3efe8"
  });
  assets.loadSprite("dojo_observer_rei", reiSprite || fallbackHuman);

  const keikoSprite = createBarPatronSpriteDataUrl({
    shirt: "#b76f7f",
    jacket: "#6a3e4a",
    hair: "#3a2721",
    skin: "#edc7a7",
    pants: "#3e2d38",
    accent: "#ffdce7"
  });
  assets.loadSprite("townsfolk_keiko", keikoSprite || fallbackHuman);

  const daichiSprite = createBarPatronSpriteDataUrl({
    shirt: "#739170",
    jacket: "#3b4f39",
    hair: "#30231f",
    skin: "#dbb28d",
    pants: "#2a3326",
    accent: "#d4f1ce"
  });
  assets.loadSprite("townsfolk_daichi", daichiSprite || fallbackHuman);

  const minaSprite = createBarPatronSpriteDataUrl({
    shirt: "#7d739b",
    jacket: "#453f5f",
    hair: "#2f292b",
    skin: "#e7be9b",
    pants: "#302a3d",
    accent: "#d9d0ff"
  });
  assets.loadSprite("cloudwatch_mina", minaSprite || fallbackHuman);

  const junSprite = createBarPatronSpriteDataUrl({
    shirt: "#8f7a62",
    jacket: "#534939",
    hair: "#2d2722",
    skin: "#ddb48f",
    pants: "#322b24",
    accent: "#f2dfc7"
  });
  assets.loadSprite("cloudwatch_jun", junSprite || fallbackHuman);

  const sisterSprite = createBarPatronSpriteDataUrl({
    shirt: "#d9dbe1",
    jacket: "#3f4655",
    hair: "#20242f",
    skin: "#ebc5a8",
    pants: "#2b3340",
    accent: "#f9f9ff"
  });
  assets.loadSprite("sister_agnes", sisterSprite || fallbackHuman);

  const groundskeeperSprite = createBarPatronSpriteDataUrl({
    shirt: "#8f845e",
    jacket: "#4e482f",
    hair: "#3a2a20",
    skin: "#ddb28e",
    pants: "#353124",
    accent: "#efe2b8"
  });
  assets.loadSprite("groundskeeper_luis", groundskeeperSprite || fallbackHuman);

  const priestSprite = createBarPatronSpriteDataUrl({
    shirt: "#ece8dd",
    jacket: "#2f2f35",
    hair: "#2a211e",
    skin: "#deb08d",
    pants: "#25252b",
    accent: "#f6f1e4"
  });
  assets.loadSprite("priest_miki", priestSprite || fallbackHuman);

  const patSprite = createBarPatronSpriteDataUrl({
    shirt: "#d6c7ae",
    jacket: "#6b5a49",
    hair: "#c8c2b8",
    skin: "#e3bf9f",
    pants: "#4b4034",
    accent: "#f5e6c8"
  });
  assets.loadSprite("innkeeper_pat", patSprite || fallbackHuman);

  const farmerSprite = createBarPatronSpriteDataUrl({
    shirt: "#6e9a5a",
    jacket: "#3d5e2f",
    hair: "#5a402e",
    skin: "#e0b58f",
    pants: "#2f4025",
    accent: "#d8f2bf"
  });
  assets.loadSprite("farmer_elias", farmerSprite || fallbackHuman);

  const tomoSprite = createBarPatronSpriteDataUrl({
    shirt: "#708cb3",
    jacket: "#354a6b",
    hair: "#2f2320",
    skin: "#ddb18d",
    pants: "#2a3650",
    accent: "#cde3ff"
  });
  assets.loadSprite("bar_guest_tomo", tomoSprite || fallbackHuman);

  const horseSprite = createHorseSpriteDataUrl();
  assets.loadSprite("farm_horse", horseSprite || fallbackHuman);

  const cowSprite = createCowSpriteDataUrl();
  assets.loadSprite("farm_cow", cowSprite || fallbackHuman);

  const chickenSprite = createChickenSpriteDataUrl();
  assets.loadSprite("farm_chicken", chickenSprite || fallbackHuman);

  const dogSprite = createDogSpriteDataUrl();
  assets.loadSprite("town_dog", dogSprite || fallbackHuman);

  return assets;
}
