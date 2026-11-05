// Animated pixel owl for the tutor-mode indicator, shared by Pi and Claude Code.
// Each text row draws two pixel rows with half blocks, so the 8x6 sprite takes 3 lines.

const PALETTE: Record<string, number> = {
  b: 94, // brown feathers (ANSI 256)
  l: 223, // light belly and eyelids
  w: 231, // eye white
  k: 16, // pupil
  o: 208, // beak and feet
};

// Pupils look right, right, left, left, then the owl blinks.
const EYES = ["bwkbbwkb", "bwkbbwkb", "bkwbbkwb", "bkwbbkwb", "bllbbllb"];

export const OWL_FRAME_COUNT = EYES.length;

function spriteRows(frame: number): string[] {
  return ["b......b", "bbbbbbbb", EYES[frame % EYES.length]!, "bbboobbb", "bllllllb", ".o....o."];
}

function cell(top: number | undefined, bottom: number | undefined): string {
  if (top === undefined && bottom === undefined) return " ";
  if (top === undefined) return `\x1b[38;5;${bottom}m▄\x1b[0m`;
  if (bottom === undefined) return `\x1b[38;5;${top}m▀\x1b[0m`;
  return `\x1b[38;5;${top};48;5;${bottom}m▀\x1b[0m`;
}

/** Returns 3 terminal lines: the owl frame, with one label line to the right of each owl row. */
export function renderOwl(frame: number, labels: readonly string[] = []): string[] {
  const rows = spriteRows(frame);
  const lines: string[] = [];
  for (let i = 0; i < rows.length; i += 2) {
    const top = rows[i]!;
    const bottom = rows[i + 1]!;
    const owl = [...top].map((pixel, x) => cell(PALETTE[pixel], PALETTE[bottom[x]!])).join("");
    const label = labels[i / 2];
    lines.push(label ? `${owl}  ${label}` : owl);
  }
  return lines;
}

export const OWL_LABELS = ["", "\x1b[1mtutor mode\x1b[0m", "\x1b[2mhints before solutions\x1b[0m"];
