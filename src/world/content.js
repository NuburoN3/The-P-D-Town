// ============================================================================
// CONTENT - Aggregates all town modules into the unified GAME_CONTENT export
// ============================================================================
//
// To add a new town:
//   1. Create src/world/towns/<townName>.js exporting a town object
//   2. Import it below and add the key to `towns`
// ============================================================================

import { hanamiTown } from "./towns/hanamiTown.js";

export const GAME_CONTENT = {
  training: {
    completedPrompt: "Challenge complete. Speak to Mr. Hanami.",
    acceptedDialogue: "Your challenge is upstairs. Defeat three opponents.",
    postCompleteDialogue: [
      "Excellent.",
      "You passed my upstairs challenge. Your discipline is ready for the next lesson.",
      "There is more happening in this town than I have told you.",
      "I am getting old. In time, I will ask you to face a threat I once trusted."
    ],
    nextChallengeQuestion: "Are you ready for your next challenge?",
    enduranceAcceptedDialogue: "To your left there is a mat, I'd like you to practise your endurance on it. Come see me after you level up your endurance.",
    enduranceLockedPrompt: "Speak to Mr. Hanami to begin your next challenge.",
    enduranceInProgressDialogue: "Use the mat to practise your endurance. Come see me after you level up your endurance.",
    enduranceCompleteDialogue: "Excellent work. My next challenge awaits down the southern path. Follow that path and your fear will be destroyed. Meet me down there when you are ready.",
    membershipCardGiveDialogue: "Here, take this",
    membershipCardItemName: "Dojo Membership Card",
    membershipCardUnlockMessage: "Received: Dojo Membership Card",
    declineDialogue: "Come speak to me when you are ready.",
    itemName: "Training Headband",
    itemUnlockMessage: "Challenge accepted: Defeat 3 upstairs opponents",
    itemReceivedMessage: "Challenge accepted. Defeat three upstairs opponents!"
  },
  towns: {
    hanamiTown
  }
};
