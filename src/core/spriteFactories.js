function createPixelCanvasContext() {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  return { canvas, ctx };
}

export function createBartenderSpriteDataUrl() {
  const surface = createPixelCanvasContext();
  if (!surface) return null;
  const { canvas, ctx } = surface;

  ctx.clearRect(0, 0, 32, 32);

  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(10, 28, 4, 3);
  ctx.fillRect(18, 28, 4, 3);

  ctx.fillStyle = "#2a2f38";
  ctx.fillRect(10, 21, 12, 8);

  ctx.fillStyle = "#f2efe6";
  ctx.fillRect(8, 14, 2, 8);
  ctx.fillRect(22, 14, 2, 8);
  ctx.fillStyle = "#dfb38f";
  ctx.fillRect(8, 20, 2, 2);
  ctx.fillRect(22, 20, 2, 2);

  ctx.fillStyle = "#f4f3ee";
  ctx.fillRect(10, 12, 12, 10);

  ctx.fillStyle = "#23272f";
  ctx.fillRect(10, 13, 3, 9);
  ctx.fillRect(19, 13, 3, 9);
  ctx.fillRect(13, 16, 6, 6);

  ctx.fillStyle = "#e6e0d3";
  ctx.fillRect(13, 20, 6, 7);
  ctx.fillStyle = "#cbc2ae";
  ctx.fillRect(13, 23, 6, 1);

  ctx.fillStyle = "#8e2f2f";
  ctx.fillRect(14, 14, 4, 2);
  ctx.fillRect(15, 15, 2, 1);

  ctx.fillStyle = "#dfb38f";
  ctx.fillRect(14, 11, 4, 2);

  ctx.fillStyle = "#e7bd99";
  ctx.fillRect(11, 5, 10, 8);

  ctx.fillStyle = "#3b2b22";
  ctx.fillRect(10, 4, 12, 3);
  ctx.fillRect(10, 6, 2, 2);
  ctx.fillRect(20, 6, 2, 2);

  ctx.fillStyle = "#1f1f1f";
  ctx.fillRect(13, 8, 1, 1);
  ctx.fillRect(17, 8, 1, 1);

  ctx.fillStyle = "#9e5d52";
  ctx.fillRect(14, 10, 3, 1);

  return canvas.toDataURL("image/png");
}

export function createBarPatronSpriteDataUrl({
  shirt = "#6f8bb5",
  jacket = "#2e3b52",
  hair = "#3a2921",
  skin = "#ddb189",
  pants = "#2a2f3a",
  accent = "#d3e2ff"
} = {}) {
  const surface = createPixelCanvasContext();
  if (!surface) return null;
  const { canvas, ctx } = surface;

  ctx.clearRect(0, 0, 32, 32);

  ctx.fillStyle = "#1c1c1c";
  ctx.fillRect(10, 28, 4, 3);
  ctx.fillRect(18, 28, 4, 3);

  ctx.fillStyle = pants;
  ctx.fillRect(10, 21, 12, 8);

  ctx.fillStyle = shirt;
  ctx.fillRect(10, 12, 12, 10);
  ctx.fillRect(8, 14, 2, 8);
  ctx.fillRect(22, 14, 2, 8);

  ctx.fillStyle = jacket;
  ctx.fillRect(10, 13, 3, 9);
  ctx.fillRect(19, 13, 3, 9);

  ctx.fillStyle = accent;
  ctx.fillRect(14, 14, 4, 2);

  ctx.fillStyle = skin;
  ctx.fillRect(14, 11, 4, 2);
  ctx.fillRect(8, 20, 2, 2);
  ctx.fillRect(22, 20, 2, 2);

  ctx.fillStyle = skin;
  ctx.fillRect(11, 5, 10, 8);

  ctx.fillStyle = hair;
  ctx.fillRect(10, 4, 12, 3);
  ctx.fillRect(10, 6, 2, 2);
  ctx.fillRect(20, 6, 2, 2);

  ctx.fillStyle = "#1f1f1f";
  ctx.fillRect(13, 8, 1, 1);
  ctx.fillRect(17, 8, 1, 1);

  ctx.fillStyle = "#8b564a";
  ctx.fillRect(14, 10, 3, 1);

  return canvas.toDataURL("image/png");
}

export function createHorseSpriteDataUrl() {
  const surface = createPixelCanvasContext();
  if (!surface) return null;
  const { canvas, ctx } = surface;

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

export function createCowSpriteDataUrl() {
  const surface = createPixelCanvasContext();
  if (!surface) return null;
  const { canvas, ctx } = surface;

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

export function createChickenSpriteDataUrl() {
  const surface = createPixelCanvasContext();
  if (!surface) return null;
  const { canvas, ctx } = surface;

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

export function createDogSpriteDataUrl() {
  const surface = createPixelCanvasContext();
  if (!surface) return null;
  const { canvas, ctx } = surface;

  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = "#8c6a4f";
  ctx.fillRect(8, 15, 15, 8);
  ctx.fillRect(20, 11, 8, 8);
  ctx.fillStyle = "#70523d";
  ctx.fillRect(22, 8, 3, 4);
  ctx.fillRect(25, 9, 2, 3);
  ctx.fillStyle = "#f3e0c7";
  ctx.fillRect(22, 14, 4, 3);
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(24, 13, 1, 1);
  ctx.fillRect(25, 15, 1, 1);
  ctx.fillStyle = "#5a4333";
  ctx.fillRect(9, 23, 3, 7);
  ctx.fillRect(14, 23, 3, 7);
  ctx.fillRect(19, 23, 3, 7);
  ctx.fillStyle = "#6a4d39";
  ctx.fillRect(6, 14, 2, 6);
  ctx.fillStyle = "#c63a4a";
  ctx.fillRect(17, 14, 3, 1);
  return canvas.toDataURL("image/png");
}

export const BAR_PATRON_VARIANTS = Object.freeze([
  {
    id: "bar_patron_riku",
    options: {
      shirt: "#5d7ca8", jacket: "#28364d", hair: "#2e211a", skin: "#d9af8b", pants: "#2a3038", accent: "#b6d8ff"
    }
  },
  {
    id: "bar_patron_aya",
    options: {
      shirt: "#9d5a7d", jacket: "#45263a", hair: "#4a2f24", skin: "#e5b997", pants: "#2f2531", accent: "#ffd1ec"
    }
  },
  {
    id: "bar_patron_kenji",
    options: {
      shirt: "#6a8f63", jacket: "#2f4a33", hair: "#3a2b24", skin: "#d8af8c", pants: "#25332c", accent: "#d3f1c8"
    }
  },
  {
    id: "dojo_student_yori",
    options: {
      shirt: "#6982aa", jacket: "#2a3854", hair: "#2f2420", skin: "#e0b691", pants: "#1f2b42", accent: "#d4e6ff"
    }
  },
  {
    id: "dojo_caretaker_ume",
    options: {
      shirt: "#8a6a8f", jacket: "#4a3552", hair: "#4b372e", skin: "#dcb190", pants: "#322a36", accent: "#ebd7f3"
    }
  },
  {
    id: "dojo_observer_rei",
    options: {
      shirt: "#5f8c87", jacket: "#2f4f4a", hair: "#2f2623", skin: "#e2b996", pants: "#223936", accent: "#c3efe8"
    }
  },
  {
    id: "townsfolk_keiko",
    options: {
      shirt: "#b76f7f", jacket: "#6a3e4a", hair: "#3a2721", skin: "#edc7a7", pants: "#3e2d38", accent: "#ffdce7"
    }
  },
  {
    id: "townsfolk_daichi",
    options: {
      shirt: "#739170", jacket: "#3b4f39", hair: "#30231f", skin: "#dbb28d", pants: "#2a3326", accent: "#d4f1ce"
    }
  },
  {
    id: "cloudwatch_mina",
    options: {
      shirt: "#7d739b", jacket: "#453f5f", hair: "#2f292b", skin: "#e7be9b", pants: "#302a3d", accent: "#d9d0ff"
    }
  },
  {
    id: "cloudwatch_jun",
    options: {
      shirt: "#8f7a62", jacket: "#534939", hair: "#2d2722", skin: "#ddb48f", pants: "#322b24", accent: "#f2dfc7"
    }
  },
  {
    id: "sister_agnes",
    options: {
      shirt: "#d9dbe1", jacket: "#3f4655", hair: "#20242f", skin: "#ebc5a8", pants: "#2b3340", accent: "#f9f9ff"
    }
  },
  {
    id: "groundskeeper_luis",
    options: {
      shirt: "#8f845e", jacket: "#4e482f", hair: "#3a2a20", skin: "#ddb28e", pants: "#353124", accent: "#efe2b8"
    }
  },
  {
    id: "priest_miki",
    options: {
      shirt: "#ece8dd", jacket: "#2f2f35", hair: "#2a211e", skin: "#deb08d", pants: "#25252b", accent: "#f6f1e4"
    }
  },
  {
    id: "farmer_elias",
    options: {
      shirt: "#6e9a5a", jacket: "#3d5e2f", hair: "#5a402e", skin: "#e0b58f", pants: "#2f4025", accent: "#d8f2bf"
    }
  },
  {
    id: "bar_guest_tomo",
    options: {
      shirt: "#708cb3", jacket: "#354a6b", hair: "#2f2320", skin: "#ddb18d", pants: "#2a3650", accent: "#cde3ff"
    }
  }
]);

export function createGeneratedSpriteEntries(fallbackHuman) {
  const entries = [];

  entries.push(["bartender_mika", createBartenderSpriteDataUrl() || fallbackHuman]);

  for (const variant of BAR_PATRON_VARIANTS) {
    entries.push([
      variant.id,
      createBarPatronSpriteDataUrl(variant.options) || fallbackHuman
    ]);
  }

  entries.push(["farm_horse", createHorseSpriteDataUrl() || fallbackHuman]);
  entries.push(["farm_cow", createCowSpriteDataUrl() || fallbackHuman]);
  entries.push(["farm_chicken", createChickenSpriteDataUrl() || fallbackHuman]);
  entries.push(["town_dog", createDogSpriteDataUrl() || fallbackHuman]);

  return entries;
}
