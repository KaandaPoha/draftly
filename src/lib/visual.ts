/**
 * Visual generation — real, deterministic image output.
 *
 * Draftly renders each draft's artboard spec into an actual SVG image that can
 * be downloaded, opened, and handed to a designer or a print shop. This is
 * genuinely generated artwork (computed from the idea, brand palette and
 * platform), not a stored placeholder — but it is *designed* artwork, not a
 * diffusion-model image. The UI says so plainly.
 *
 * SVG is used because it needs no runtime, no key, no network, and no client
 * JavaScript: the browser renders it directly, and it is trivially exportable.
 */

import type { ArtboardSpec } from "./generate";

export const ARTBOARD_DIMENSIONS: Record<ArtboardSpec["aspect"], { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
  landscape: { w: 1600, h: 900 },
};

const escapeXml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/** Break a headline into lines that fit the artboard. */
function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > maxChars && line) {
      lines.push(line.trim());
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = (line + " " + word).trim();
    }
  }
  if (lines.length < maxLines && line) lines.push(line.trim());
  return lines.slice(0, maxLines);
}

function motifMarkup(
  motif: ArtboardSpec["motif"],
  w: number,
  h: number,
  accent: string,
  accent2: string
): string {
  switch (motif) {
    case "circles":
      return `
  <circle cx="${w * 0.86}" cy="${h * 0.16}" r="${h * 0.30}" fill="${accent}" opacity="0.16"/>
  <circle cx="${w * 0.78}" cy="${h * 0.28}" r="${h * 0.17}" fill="${accent2}" opacity="0.18"/>
  <circle cx="${w * 0.10}" cy="${h * 0.94}" r="${h * 0.22}" fill="${accent2}" opacity="0.10"/>`;

    case "grid": {
      const step = Math.round(w / 18);
      let lines = "";
      for (let x = step; x < w; x += step) {
        lines += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="${accent}" stroke-width="1" opacity="0.10"/>`;
      }
      for (let y = step; y < h; y += step) {
        lines += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${accent}" stroke-width="1" opacity="0.10"/>`;
      }
      return lines;
    }

    case "waves": {
      let paths = "";
      for (let i = 0; i < 4; i++) {
        const y = h * (0.62 + i * 0.08);
        paths += `<path d="M0 ${y} C ${w * 0.3} ${y - h * 0.10}, ${w * 0.6} ${y + h * 0.10}, ${w} ${y - h * 0.04}"
          fill="none" stroke="${i % 2 ? accent2 : accent}" stroke-width="${6 - i}" opacity="0.28"/>`;
      }
      return paths;
    }

    case "burst":
    default: {
      let rays = "";
      const cx = w * 0.82;
      const cy = h * 0.22;
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const x1 = cx + Math.cos(angle) * h * 0.10;
        const y1 = cy + Math.sin(angle) * h * 0.10;
        const x2 = cx + Math.cos(angle) * h * 0.34;
        const y2 = cy + Math.sin(angle) * h * 0.34;
        rays += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${i % 2 ? accent2 : accent}" stroke-width="7" opacity="0.22"/>`;
      }
      return rays;
    }
  }
}

/**
 * Render the artboard spec to a standalone SVG document.
 * Deterministic: the same spec always produces the same image.
 */
export function renderArtboard(spec: ArtboardSpec, brandName: string): string {
  const { w, h } = ARTBOARD_DIMENSIONS[spec.aspect];
  const { bg, surface, fg, accent, accent2 } = spec.palette;

  const isWide = spec.aspect === "landscape";
  const isSplit = spec.layout === "split";

  // Layout geometry
  const pad = Math.round(w * 0.075);
  const contentW = isSplit && !isWide ? Math.round(w * 0.62) : w - pad * 2;
  const maxChars = Math.max(12, Math.round(contentW / (w * 0.042)));
  const headlineLines = wrap(spec.headline, maxChars, 3);
  const typeSize = Math.round(w * (isWide ? 0.052 : 0.070));
  const lineH = Math.round(typeSize * 1.12);

  // Vertically centre the headline block
  const blockH = headlineLines.length * lineH;
  const headTop = Math.round((h - blockH) / 2 - h * 0.04);

  const headlineSvg = headlineLines
    .map(
      (line, i) =>
        `<text x="${pad}" y="${headTop + i * lineH}" font-size="${typeSize}" font-weight="700"
          fill="${fg}" font-family="'Helvetica Neue',Helvetica,Arial,sans-serif"
          letter-spacing="-1">${escapeXml(line)}</text>`
    )
    .join("\n");

  // Accent underline under the final headline line
  const underlineY = headTop + (headlineLines.length - 1) * lineH + Math.round(typeSize * 0.30);
  const underlineW = Math.round(contentW * (isSplit ? 0.36 : 0.28));

  const subSize = Math.round(typeSize * 0.40);
  const ctaSize = Math.round(typeSize * 0.34);

  const subY = underlineY + Math.round(typeSize * 0.85);
  const ctaY = h - pad - Math.round(typeSize * 0.25);

  // Right-hand panel for split layouts
  const panel = isSplit
    ? `<g>
    <rect x="${w - pad - Math.round(w * 0.26)}" y="${pad}" width="${Math.round(w * 0.26)}"
      height="${h - pad * 2}" rx="${Math.round(w * 0.02)}" fill="${surface}" opacity="0.85"/>
    <rect x="${w - pad - Math.round(w * 0.26)}" y="${pad}" width="${Math.round(w * 0.26)}"
      height="6" fill="${accent2}"/>
  </g>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"
  viewBox="0 0 ${w} ${h}" role="img"
  aria-label="${escapeXml(spec.headline)} — ${escapeXml(brandName)} artboard">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg}"/>
      <stop offset="100%" stop-color="${surface}"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accent}"/>
      <stop offset="100%" stop-color="${accent2}"/>
    </linearGradient>
  </defs>

  <rect width="${w}" height="${h}" fill="url(#bg)"/>
${motifMarkup(spec.motif, w, h, accent, accent2)}
${panel}

${headlineSvg}
  <rect x="${pad}" y="${underlineY}" width="${underlineW}" height="8" rx="4" fill="url(#accent)"/>

  <text x="${pad}" y="${subY}" font-size="${subSize}" fill="${fg}" opacity="0.72"
    font-family="'Helvetica Neue',Helvetica,Arial,sans-serif">${escapeXml(spec.subhead)}</text>

  <text x="${pad}" y="${ctaY}" font-size="${ctaSize}" font-weight="600" fill="${accent2}"
    font-family="'Helvetica Neue',Helvetica,Arial,sans-serif"
    letter-spacing="2">${escapeXml(spec.cta.toUpperCase())}</text>

  <text x="${w - pad}" y="${ctaY}" text-anchor="end" font-size="${ctaSize}"
    fill="${fg}" opacity="0.45"
    font-family="'Helvetica Neue',Helvetica,Arial,sans-serif">${escapeXml(brandName)}</text>
</svg>`;
}

/**
 * Render a storyboard to an animated SVG "reel" preview using SMIL.
 *
 * SMIL animation runs natively in the browser with no JavaScript and no video
 * encoding, which matters here: the app's core flows are deliberately
 * no-client-JS. This is a genuine, playing motion preview of the shot plan —
 * not a rendered video file, and the UI labels it as a preview.
 */
export function renderReelPreview(
  shots: Array<{ index: number; timecode: string; shot: string; onScreen: string; voiceover: string }>,
  spec: ArtboardSpec,
  brandName: string
): string {
  const { w, h } = ARTBOARD_DIMENSIONS.portrait;
  const frame = Math.max(2, Math.min(shots.length, 8));
  const perShot = 2.5; // seconds on screen
  const total = perShot * frame;
  const { bg, surface, fg, accent, accent2 } = spec.palette;

  const frames = shots.slice(0, frame).map((s, i) => {
    const begin = i * perShot;

    const overlayLines = wrap(s.onScreen || s.shot, 20, 3);
    const overlaySvg = overlayLines
      .map(
        (line, li) =>
          `<text x="${w / 2}" y="${h * 0.62 + li * 78}" text-anchor="middle" font-size="64"
            font-weight="700" fill="${fg}" font-family="'Helvetica Neue',Helvetica,Arial,sans-serif"
            letter-spacing="-1">${escapeXml(line)}</text>`
      )
      .join("\n");

    const voLines = wrap(s.voiceover && s.voiceover !== "—" ? s.voiceover : "", 42, 2);
    const voSvg = voLines
      .map(
        (line, li) =>
          `<text x="${w / 2}" y="${h * 0.80 + li * 46}" text-anchor="middle" font-size="34"
            fill="${fg}" opacity="0.66"
            font-family="'Helvetica Neue',Helvetica,Arial,sans-serif">${escapeXml(line)}</text>`
      )
      .join("\n");

    return `
  <g>
    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.08;0.92;1"
      begin="${begin}s" dur="${perShot}s" repeatCount="indefinite" fill="freeze"/>
    <rect width="${w}" height="${h}" fill="${i % 2 ? surface : bg}"/>
    <circle cx="${w * (0.2 + (i % 3) * 0.3)}" cy="${h * 0.28}" r="${h * 0.16}"
      fill="${i % 2 ? accent2 : accent}" opacity="0.20"/>
    <rect x="0" y="${h * 0.52}" width="${w}" height="6" fill="url(#accent)"/>
    <text x="${w / 2}" y="${h * 0.46}" text-anchor="middle" font-size="30" font-weight="600"
      fill="${accent2}" letter-spacing="4"
      font-family="'Helvetica Neue',Helvetica,Arial,sans-serif">SHOT ${s.index} · ${escapeXml(s.timecode)}</text>
${overlaySvg}
${voSvg}
  </g>`;
  });

  // Progress bar spanning the whole loop
  const progress = `
  <rect x="0" y="0" width="${w}" height="8" fill="${fg}" opacity="0.15"/>
  <rect x="0" y="0" width="0" height="8" fill="url(#accent)">
    <animate attributeName="width" values="0;${w}" dur="${total}s" repeatCount="indefinite"/>
  </rect>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"
  viewBox="0 0 ${w} ${h}" role="img"
  aria-label="Animated ${frame}-shot preview for ${escapeXml(brandName)}">
  <defs>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accent}"/>
      <stop offset="100%" stop-color="${accent2}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="${bg}"/>
${frames.join("\n")}
${progress}
  <text x="${w / 2}" y="${h - 60}" text-anchor="middle" font-size="26" fill="${fg}" opacity="0.5"
    font-family="'Helvetica Neue',Helvetica,Arial,sans-serif">${escapeXml(brandName)} · animated storyboard preview</text>
</svg>`;
}

/**
 * A rough, honest estimate of what each shot costs to produce.
 * Presenter-led and animated work is real effort, not a magic button — the
 * studio shows this so nobody is surprised in production.
 */
export type ProductionEstimate = {
  crew: string;
  hours: string;
  kit: string[];
  locations: string;
  postNotes: string;
};

export function estimateProduction(
  shots: Array<{ shot: string }>,
  animated: boolean
): ProductionEstimate {
  const hasPeople = shots.some((s) => /person|people|face|hand|talent|presenter|they|user/i.test(s.shot));
  const hasMacro = shots.some((s) => /macro|detail|close-up|texture/i.test(s.shot));

  return {
    crew: hasPeople
      ? "1 director/DP, 1 talent, 1 assistant"
      : "1 director/DP, 1 assistant (no on-camera talent needed)",
    hours: `${Math.max(2, Math.round(shots.length * 0.75))}–${Math.max(4, Math.round(shots.length * 1.5))} hours on set/at desk`,
    kit: [
      "Camera with a fast prime lens",
      hasMacro ? "Macro or close-focus lens" : "Standard zoom",
      "Diffused key light + bounce",
      hasPeople ? "Lavalier or shotgun mic" : "Silent room / no audio capture",
      animated ? "Motion-graphics template set (After Effects / CapCut)" : "Tripod",
    ],
    locations: hasPeople
      ? "One real-world location that matches how the audience actually uses this"
      : "Desk or product table with a controlled backdrop",
    postNotes: animated
      ? "Edit to the beat, burn in captions, export vertical 1080×1920, loop the last frame into the first"
      : "Retouch the hero frame, build 3 aspect ratios from it (1:1, 4:5, 16:9), keep type above 5% of frame height",
  };
}