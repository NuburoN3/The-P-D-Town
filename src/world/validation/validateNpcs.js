import { inBounds, isInteger } from "./utils.js";

export function validateNpcs(town, townPath, errors) {
  if (!Array.isArray(town.npcs)) return;

  for (let i = 0; i < town.npcs.length; i++) {
    const npc = town.npcs[i];
    const npcPath = `${townPath}.npcs[${i}]`;
    if (!npc || typeof npc !== "object") {
      errors.push(`${npcPath} must be an object.`);
      continue;
    }

    if (typeof npc.areaId !== "string" || !town.areas[npc.areaId]) {
      errors.push(`${npcPath}.areaId must reference an existing area.`);
      continue;
    }

    if (!isInteger(npc.x) || !isInteger(npc.y)) {
      errors.push(`${npcPath}.x and .y must be integers.`);
      continue;
    }

    const area = town.areas[npc.areaId];
    if (!inBounds(npc.x, npc.y, area.width, area.height)) {
      errors.push(`${npcPath} is out of bounds for area '${npc.areaId}'.`);
    }

    if (typeof npc.name !== "string" || npc.name.length === 0) {
      errors.push(`${npcPath}.name must be a non-empty string.`);
    }

    if (typeof npc.spriteName !== "string" || npc.spriteName.length === 0) {
      errors.push(`${npcPath}.spriteName must be a non-empty string.`);
    }

    const dialogueIsValid =
      typeof npc.dialogue === "string" ||
      (Array.isArray(npc.dialogue) && npc.dialogue.every((line) => typeof line === "string"));
    if (!dialogueIsValid) {
      errors.push(`${npcPath}.dialogue must be a string or array of strings.`);
    }

    if (npc.minigameId != null && (typeof npc.minigameId !== "string" || npc.minigameId.length === 0)) {
      errors.push(`${npcPath}.minigameId must be a non-empty string when provided.`);
    }

    const minigameTextFields = [
      "minigamePrompt",
      "minigameDeclineDialogue",
      "minigameWinDialogue",
      "minigameLoseDialogue"
    ];

    for (const field of minigameTextFields) {
      if (npc[field] != null && typeof npc[field] !== "string") {
        errors.push(`${npcPath}.${field} must be a string when provided.`);
      }
    }
  }
}
