export class DialogueSystem {
  constructor({ ctx, canvas, ui }) {
    this.ctx = ctx;
    this.canvas = canvas;
    this.ui = ui;

    this.name = "";
    this.lines = [];
    this.index = 0;
    this.endAction = null;
    this.visibleCharacters = 0;
    this.textStartTime = 0;

    this.choiceState = {
      active: false,
      options: ["Yes", "No"],
      selected: 0,
      onConfirm: null
    };
  }

  isActive() {
    return this.lines.length > 0;
  }

  currentLine() {
    return this.isActive() ? this.lines[this.index] || "" : "";
  }

  currentVisibleLength() {
    return this.currentLine().replace(/\n/g, "").length;
  }

  updateVisibleCharacters() {
    const elapsedSeconds = Math.max(0, (performance.now() - this.textStartTime) / 1000);
    this.visibleCharacters = Math.min(
      this.currentVisibleLength(),
      Math.floor(elapsedSeconds * this.ui.CHARACTERS_PER_SECOND)
    );
    return this.visibleCharacters;
  }

  show(name, textOrLines, endAction = null) {
    this.name = (name || "").trim();
    const sourceLines = Array.isArray(textOrLines) ? textOrLines : [textOrLines];

    this.ctx.save();
    this.ctx.font = "20px monospace";

    const textMaxWidth = this.canvas.width - 80;
    const lineSpacing = this.ui.LINE_SPACING;
    const boxHeight = this.ui.TEXT_BOX_HEIGHT;
    const boxY = this.canvas.height - boxHeight - 20;
    const dialogueTextStartY = this.name ? boxY + 66 : boxY + 52;
    const maxBaselineY = boxY + boxHeight - 8;
    const maxLinesPerPage = Math.max(
      1,
      Math.floor((maxBaselineY - dialogueTextStartY) / lineSpacing) + 1
    );

    const pagedDialogue = [];
    for (const entry of sourceLines) {
      const wrapped = this.wrapText(String(entry ?? ""), textMaxWidth);
      for (let i = 0; i < wrapped.length; i += maxLinesPerPage) {
        const pageLines = wrapped.slice(i, i + maxLinesPerPage);
        pagedDialogue.push(pageLines.join("\n"));
      }
    }

    this.lines = pagedDialogue;
    this.ctx.restore();
    this.index = 0;
    this.endAction = endAction;
    this.closeChoice();
    this.resetAnimation();
  }

  openYesNoChoice(onConfirm) {
    this.choiceState.active = true;
    this.choiceState.selected = 0;
    this.choiceState.onConfirm = onConfirm;
  }

  confirmChoice() {
    if (!this.choiceState.active) return;
    const selectedOption = this.choiceState.options[this.choiceState.selected];
    const onConfirm = this.choiceState.onConfirm;
    this.closeChoice();
    if (onConfirm) onConfirm(selectedOption);
  }

  advance() {
    if (!this.isActive() || this.choiceState.active) return;
    this.updateVisibleCharacters();

    if (this.visibleCharacters < this.currentVisibleLength()) {
      this.visibleCharacters = this.currentVisibleLength();
      return;
    }

    if (this.index < this.lines.length - 1) {
      this.index++;
      this.resetAnimation();
    } else if (this.endAction) {
      const endAction = this.endAction;
      this.endAction = null;
      endAction();
    } else {
      this.close();
    }
  }

  close() {
    this.name = "";
    this.lines = [];
    this.index = 0;
    this.endAction = null;
    this.visibleCharacters = 0;
    this.textStartTime = 0;
    this.closeChoice();
  }

  closeChoice() {
    this.choiceState.active = false;
    this.choiceState.selected = 0;
    this.choiceState.onConfirm = null;
  }

  resetAnimation() {
    this.visibleCharacters = 0;
    this.textStartTime = performance.now();
  }

  wrapText(text, maxWidth) {
    const words = (text || "").split(/\s+/).filter(Boolean);
    if (words.length === 0) return [""];

    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const testLine = `${currentLine} ${word}`;
      if (this.ctx.measureText(testLine).width <= maxWidth) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }

    lines.push(currentLine);
    return lines;
  }
}
