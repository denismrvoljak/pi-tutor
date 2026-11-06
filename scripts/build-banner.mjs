// Builds assets/banner-{dark,light}.svg from one layout and the Catppuccin palette.
// Run: pnpm banner. Edit THEMES to restyle both banners at once.
import { writeFileSync } from "node:fs";

// Catppuccin Mocha (dark) and Latte (light): https://catppuccin.com/palette
const CATPPUCCIN = {
  mocha: {
    rosewater: "#f5e0dc", red: "#f38ba8", peach: "#fab387", yellow: "#f9e2af", green: "#a6e3a1", mauve: "#cba6f7",
    text: "#cdd6f4", subtext0: "#a6adc8", overlay0: "#6c7086", surface2: "#585b70", surface1: "#45475a",
    surface0: "#313244", base: "#1e1e2e", mantle: "#181825", crust: "#11111b",
  },
  latte: {
    rosewater: "#dc8a78", red: "#d20f39", peach: "#fe640b", yellow: "#df8e1d", green: "#40a02b", mauve: "#8839ef",
    text: "#4c4f69", subtext1: "#5c5f77", subtext0: "#6c6f85", overlay0: "#9ca0b0", surface1: "#bcc0cc",
    surface0: "#ccd0da", base: "#eff1f5", mantle: "#e6e9ef", crust: "#dce0e8",
  },
};

// Design tokens: the banner only uses these names, never raw colors.
const token = (c, owl) => ({
  bg1: c.base, bg2: c.crust, panel: c.mantle, panelEdge: c.surface0, dots: c.text,
  fg: c.text, muted: c.subtext0, footer: c.overlay0, line: c.surface1,
  brand: c.peach, hint: c.green, prompt: c.mauve, lights: [c.red, c.yellow, c.green],
  ...owl,
});
const THEMES = {
  dark: token(CATPPUCCIN.mocha, {
    owl: CATPPUCCIN.mocha.surface2, wing: CATPPUCCIN.mocha.surface1, belly: CATPPUCCIN.mocha.rosewater,
    owlEdge: CATPPUCCIN.mocha.text, eye: CATPPUCCIN.mocha.text, pupil: CATPPUCCIN.mocha.crust, glow: 0.14,
  }),
  light: token(CATPPUCCIN.latte, {
    owl: CATPPUCCIN.latte.subtext1, wing: CATPPUCCIN.latte.text, belly: CATPPUCCIN.latte.rosewater,
    owlEdge: CATPPUCCIN.latte.text, eye: CATPPUCCIN.latte.base, pupil: CATPPUCCIN.latte.text, glow: 0.1,
  }),
};

const MONO = "'SF Mono','Menlo','Consolas',monospace";

const blink = (r) =>
  `<animate attributeName="ry" values="${r};${r};1.5;${r}" keyTimes="0;0.93;0.96;1" dur="6s" repeatCount="indefinite"/>`;

// Flat owl with glasses, centred on (x, y); about 180 wide and 210 tall at s = 1.
function owl(t, x, y, s, { animate = true, edge = 5 } = {}) {
  const b = animate ? blink : () => "";
  const stroke = `stroke="${t.owlEdge}" stroke-width="${edge}" stroke-linejoin="round"`;
  const glasses = edge
    ? `<g fill="none" stroke="${t.brand}" stroke-width="5"><circle cx="-34" cy="-46" r="33"/><circle cx="34" cy="-46" r="33"/></g>`
    : "";
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <path d="M-78 -20 Q-112 30 -70 78 Q-74 30 -58 -10 Z" fill="${t.wing}" ${stroke}/>
    <path d="M78 -20 Q112 30 70 78 Q74 30 58 -10 Z" fill="${t.wing}" ${stroke}/>
    <path d="M-76 -78 L-58 -128 L-24 -96 Q0 -104 24 -96 L58 -128 L76 -78 Q90 -32 76 14 Q60 72 0 76 Q-60 72 -76 14 Q-90 -32 -76 -78 Z" fill="${t.owl}" ${stroke}/>
    <ellipse cx="0" cy="34" rx="44" ry="36" fill="${t.belly}"/>
    <path d="M-22 22 l8 8 l8 -8 M6 22 l8 8 l8 -8 M-8 42 l8 8 l8 -8" fill="none" stroke="${t.pupil}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.45"/>
    <ellipse cx="-34" cy="-46" rx="27" ry="27" fill="${t.eye}">${b(27)}</ellipse>
    <ellipse cx="34" cy="-46" rx="27" ry="27" fill="${t.eye}">${b(27)}</ellipse>
    <ellipse cx="-30" cy="-44" rx="11" ry="11" fill="${t.pupil}">${b(11)}</ellipse>
    <ellipse cx="38" cy="-44" rx="11" ry="11" fill="${t.pupil}">${b(11)}</ellipse>
    ${glasses}
    <path d="M-8 -16 L8 -16 L0 0 Z" fill="${t.brand}" stroke="${t.brand}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M-22 76 l-4 10 M-14 76 v10 M14 76 v10 M22 76 l4 10" stroke="${t.brand}" stroke-width="5" stroke-linecap="round"/>
  </g>`;
}

const text = (x, y, size, fill, body, extra = "") =>
  `<text x="${x}" y="${y}" font-family="${MONO}" font-size="${size}" fill="${fill}" ${extra}>${body}</text>`;

function banner(t) {
  const [tx, ty, tw, th] = [740, 52, 444, 272];
  const session = [
    [t.prompt, `&#10095; <tspan fill="${t.fg}">/tutor:hint loops</tspan>`],
    [t.muted, ""],
    [t.hint, "Hint 1 of 3"],
    [t.muted, "Print i inside the loop."],
    [t.muted, "What is its value on the"],
    [t.muted, "last pass? Try it first."],
  ]
    .map(([fill, body], i) => text(tx + 26, ty + 70 + i * 27, 18, fill, body))
    .join("\n  ");
  const lights = t.lights.map((c, i) => `<circle cx="${tx + 24 + i * 20}" cy="${ty + 24}" r="6" fill="${c}"/>`).join("");
  const pulse = `<animate attributeName="opacity" values="1;0.25;1" dur="1.6s" repeatCount="indefinite"/>`;

  return `<svg width="1280" height="400" viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="oh-my-tutor: hints before solutions, learning that remembers">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1280" y2="400" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${t.bg1}"/><stop offset="1" stop-color="${t.bg2}"/>
    </linearGradient>
    <radialGradient id="glow" cx="16%" cy="45%" r="55%">
      <stop offset="0" stop-color="${t.brand}" stop-opacity="${t.glow}"/><stop offset="100%" stop-color="${t.brand}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="1.4" cy="1.4" r="1.4" fill="${t.dots}"/></pattern>
  </defs>
  <rect width="1280" height="400" fill="url(#bg)"/>
  <rect width="1280" height="400" fill="url(#glow)"/>
  <rect width="1280" height="400" fill="url(#dots)" opacity="0.05"/>

  ${owl(t, 190, 186, 0.86)}
  <line x1="88" y1="268" x2="292" y2="268" stroke="${t.brand}" stroke-width="4" stroke-linecap="round"/>
  ${text(330, 166, 58, t.fg, `oh-my-<tspan fill="${t.brand}">tutor</tspan>`, 'font-weight="700" letter-spacing="-1"')}
  ${text(333, 206, 17, t.muted, "HINTS BEFORE SOLUTIONS", 'letter-spacing="2.5"')}
  ${text(333, 234, 17, t.muted, "LEARNING THAT REMEMBERS", 'letter-spacing="2.5"')}

  <rect x="${tx}" y="${ty}" width="${tw}" height="${th}" rx="14" fill="${t.panel}" stroke="${t.panelEdge}" stroke-width="1.5"/>
  ${lights}
  ${session}
  <line x1="${tx}" y1="${ty + th - 46}" x2="${tx + tw}" y2="${ty + th - 46}" stroke="${t.panelEdge}" stroke-width="1.5"/>
  <circle cx="${tx + 30}" cy="${ty + th - 23}" r="5" fill="${t.brand}">${pulse}</circle>
  ${owl(t, tx + 56, ty + th - 21, 0.11, { animate: false, edge: 0 })}
  ${text(tx + 74, ty + th - 17, 16, t.muted, `tutor: <tspan fill="${t.fg}" font-weight="700">ON</tspan>`)}

  ${text(1184, 372, 15, t.footer, "pi install npm:oh-my-tutor  &#183;  /plugin install tutor@oh-my-tutor", 'text-anchor="end"')}
</svg>
`;
}

for (const [name, t] of Object.entries(THEMES)) {
  writeFileSync(new URL(`../assets/banner-${name}.svg`, import.meta.url), banner(t));
}
