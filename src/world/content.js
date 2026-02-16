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
    itemReceivedMessage: "Challenge accepted. Defeat three upstairs opponents!",
    rumorQuest: {
      clueGroups: [
        {
          key: "rumorCluePiazza",
          npcIds: ["cloudWatcherMina", "cloudWatcherJun", "piazzaKeiko", "piazzaDaichi"],
          lines: [
            "Piazza witnesses confirm the northern sky changed abruptly.",
            "This was a sudden shift, not a slow weather pattern."
          ]
        },
        {
          key: "rumorClueChapel",
          npcIds: ["priestMiki", "chapelSisterAgnes", "kyokaiAcolyteMara"],
          lines: [
            "Chapel witnesses confirm unusual bell timing that same night.",
            "The disturbance followed a clear sequence, not random panic."
          ]
        },
        {
          key: "rumorClueBar",
          npcIds: ["barGuestTomo", "mikaBartender", "barPatronRiku", "barPatronAya", "barPatronKenji"],
          lines: [
            "Bar regulars report the same north-road courier timeline.",
            "Independent witnesses now align on the order of events."
          ]
        }
      ]
    },
    bogQuest: {
      targetKills: 3,
      startPromptLines: [
        "You made it. This is Bogland, where old training grounds rot into mire.",
        "I need proof you can hold discipline in decay, not just in clean halls.",
        "Will you clear three corrupted bog stalkers for me?"
      ],
      acceptedLines: [
        "Good. Keep your stance grounded and your breathing slow.",
        "Defeat three bog stalkers, then report to me here."
      ],
      declinedLines: [
        "Then observe the swamp first.",
        "When your resolve is steady, ask me again."
      ],
      progressTemplate: "Bog trial progress: {kills}/{target}.",
      completeNotice: "Bog trial complete. Report to Mr. Hanami.",
      reportLines: [
        "Well done. You kept your center in the foulest part of this region.",
        "Taiko will test more than your strength when he returns.",
        "There is a truth about him I have withheld. You will hear it when the final trial begins."
      ],
      repeatLines: [
        "Your Bogland trial is complete.",
        "Return to town and continue sharpening your discipline."
      ]
    },
    endgameLore: {
      taikoReveal: "In the final chapter, Taiko is revealed as Mr. Hanami's son."
    }
  },
  towns: {
    hanamiTown
  }
};
