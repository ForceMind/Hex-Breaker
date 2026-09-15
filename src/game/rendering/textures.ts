import Phaser from 'phaser';
import { TILE_SIZE } from '../../core/config';
import type { ItemType } from '../../core/types';

/**
 * Every sprite is drawn with the Graphics API and cached as a white texture;
 * colour comes from setTint(). Tint multiplies, so areas painted grey bake in
 * as a darker shade of whatever colour the sprite is tinted with — the same
 * "grey base + white face" trick Arrow Flow uses for its coin icon. Tile
 * stacks are baked per thickness level (1..8) so a tile renders as one Image
 * stack instead of 8 live layers. Everything is generated at 2x for crispness.
 */
export const TEX = {
  player: 'hb-player',
  shieldRing: 'hb-shield-ring',
  bullet: 'hb-bullet',
  laserBolt: 'hb-laser-bolt',
  itemBox: 'hb-item-box',
  bomb: 'hb-bomb',
  boomerang: 'hb-boomerang',
  heart: 'hb-heart',
  particle: 'hb-particle',
  spark: 'hb-spark',
  ring: 'hb-ring',
  softCircle: 'hb-soft-circle',
  tileHighlight: 'hb-tile-highlight',
  tileGlow: 'hb-tile-glow',
  vignette: 'hb-vignette',
  glyphWeapon: 'hb-glyph-weapon',
  glyphBomb: 'hb-glyph-bomb',
  glyphShield: 'hb-glyph-shield',
  glyphMagnet: 'hb-glyph-magnet',
  glyphBuff: 'hb-glyph-buff',
  glyphStar: 'hb-glyph-star',
} as const;

/** Texture key for a tile with `thickness` stacked layers (clamped 1..8). */
export function tileTexture(thickness: number): string {
  const n = Math.max(1, Math.min(8, Math.round(thickness)));
  return `hb-tile-${n}`;
}

/** White-silhouette glyph shown on an item box, one per item family. */
export function itemGlyph(type: ItemType): string {
  switch (type) {
    case 'uzi':
    case 'shotgun':
    case 'laser':
    case 'spread':
    case 'doublebullets':
    case 'piercing':
    case 'bigbullets':
      return TEX.glyphWeapon;
    case 'bomb':
    case 'bigbomb':
    case 'diagonalbomb':
    case 'horizontalbomb':
    case 'linebomb':
      return TEX.glyphBomb;
    case 'shield':
    case 'shieldbooster':
      return TEX.glyphShield;
    case 'boomerang':
      return TEX.boomerang;
    case 'magnet':
      return TEX.glyphMagnet;
    case 'speedboost':
    case 'rapidfire':
    case 'weaponduration':
      return TEX.glyphBuff;
    case 'extralife':
      return TEX.heart;
  }
}

function octagonPoints(cx: number, cy: number, r: number): Phaser.Geom.Point[] {
  const pts: Phaser.Geom.Point[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI * 2) / 8;
    pts.push(new Phaser.Geom.Point(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return pts;
}

/**
 * Upper slice of the octagon (~top 45%), inset a little so it stays inside
 * the face stroke — the glaze flake.
 */
function octagonHighlightPoints(cx: number, cy: number, r: number): Phaser.Geom.Point[] {
  const rr = r * 0.86;
  const cutY = cy - r * 0.02;
  return [
    new Phaser.Geom.Point(cx, cy - rr),
    new Phaser.Geom.Point(cx + rr * Math.SQRT1_2, cy - rr * Math.SQRT1_2),
    new Phaser.Geom.Point(cx + rr * 0.94, cutY),
    new Phaser.Geom.Point(cx - rr * 0.94, cutY),
    new Phaser.Geom.Point(cx - rr * Math.SQRT1_2, cy - rr * Math.SQRT1_2),
  ];
}

function starPoints(cx: number, cy: number, outer: number, inner: number, points = 5): Phaser.Geom.Point[] {
  const pts: Phaser.Geom.Point[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    pts.push(new Phaser.Geom.Point(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return pts;
}

export function ensureTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEX.player)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const white = 0xffffff;

  const make = (key: string, w: number, h: number, draw: () => void): void => {
    g.clear();
    draw();
    g.generateTexture(key, w, h);
  };

  // Tile stacks, baked at 2x: grey under-layers step up-left (tint turns them
  // into a darker shade of the tile colour = thickness), the top face stays
  // pure white (full-saturation tint) and gets a baked glaze flake over its
  // upper ~45%. Stroke is a thin soft grey (2px at 1x, 4px here).
  for (let n = 1; n <= 8; n++) {
    const size = TILE_SIZE * 2 + 16;
    make(tileTexture(n), size, size, () => {
      const c = size / 2;
      const r = TILE_SIZE; // 2x radius of a 50px tile
      for (let layer = n - 1; layer >= 1; layer--) {
        const depth = layer * 6; // 3px per layer at 1x
        const lx = c - depth * 0.3;
        const ly = c - depth * 0.3;
        g.fillStyle(0x8a8a8a, 1);
        g.fillPoints(octagonPoints(lx, ly, r), true);
        g.lineStyle(4, 0x555555, 0.45);
        g.strokePoints(octagonPoints(lx, ly, r), true);
      }
      g.fillStyle(white, 1);
      g.fillPoints(octagonPoints(c, c, r), true);
      g.lineStyle(4, 0x555555, 0.45);
      g.strokePoints(octagonPoints(c, c, r), true);
      g.fillStyle(white, 0.4);
      g.fillPoints(octagonHighlightPoints(c, c, r), true);
    });
  }

  const tileSize = TILE_SIZE * 2 + 16;
  make(TEX.tileHighlight, tileSize, tileSize, () => {
    g.fillStyle(white, 0.4);
    g.fillPoints(octagonHighlightPoints(tileSize / 2, tileSize / 2, TILE_SIZE), true);
  });

  // Faked radial glow: three nested octagons, each ring inset (0.35/0.5/1).
  make(TEX.tileGlow, 176, 176, () => {
    g.fillStyle(white, 0.35);
    g.fillPoints(octagonPoints(88, 88, 80), true);
    g.fillStyle(white, 0.5);
    g.fillPoints(octagonPoints(88, 88, 64), true);
    g.fillStyle(white, 1);
    g.fillPoints(octagonPoints(88, 88, 46), true);
  });

  // Screen-edge damage vignette: concentric frames fading towards the centre.
  make(TEX.vignette, 256, 256, () => {
    const steps = 6;
    const w = 256 / (steps * 2);
    for (let i = 0; i < steps; i++) {
      const inset = i * w + w / 2;
      g.lineStyle(w, 0xd23434, 0.55 * (1 - i / steps));
      g.strokeRect(inset, inset, 256 - inset * 2, 256 - inset * 2);
    }
  });

  // Player: rounded body. The untouched pure-white top reads as glaze once
  // tinted; mid-body and the bottom band are painted grey so they come out as
  // progressively darker shades of the tint colour. Side grooves = nozzles.
  make(TEX.player, 96, 96, () => {
    g.fillStyle(white, 1);
    g.fillRoundedRect(4, 4, 88, 88, 20);
    g.fillStyle(0xe2e2e2, 1);
    g.fillRoundedRect(4, 36, 88, 56, { tl: 0, tr: 0, bl: 20, br: 20 });
    g.fillStyle(0x8a8a8a, 1);
    g.fillRoundedRect(4, 68, 88, 24, { tl: 0, tr: 0, bl: 20, br: 20 });
    g.fillStyle(0x9a9a9a, 1);
    g.fillRoundedRect(11, 48, 11, 24, 5);
    g.fillRoundedRect(74, 48, 11, 24, 5);
    g.fillStyle(white, 0.35);
    g.fillRoundedRect(12, 9, 72, 24, { tl: 12, tr: 12, bl: 8, br: 8 });
  });

  make(TEX.shieldRing, 128, 128, () => {
    g.lineStyle(8, white, 1);
    g.strokeCircle(64, 64, 56);
  });

  // Bullet: upright capsule (round-headed stub) with a brighter pure-white
  // core — the grey shell tints to the bullet colour, the core stays bright.
  make(TEX.bullet, 32, 32, () => {
    g.fillStyle(0xdcdcdc, 1);
    g.fillRoundedRect(4, 1, 24, 30, 12);
    g.fillStyle(white, 1);
    g.fillCircle(16, 11, 5);
  });

  // Laser bolt: long bar with a bright core line.
  make(TEX.laserBolt, 16, 64, () => {
    g.fillStyle(0xdcdcdc, 1);
    g.fillRoundedRect(0, 0, 16, 64, 8);
    g.fillStyle(white, 1);
    g.fillRoundedRect(4, 6, 8, 52, 4);
  });

  // Item box: big radius, lower half greyed so the top reads as a baked
  // highlight after tinting, thin soft dark stroke.
  make(TEX.itemBox, 64, 64, () => {
    g.fillStyle(white, 1);
    g.fillRoundedRect(0, 0, 64, 64, 16);
    g.fillStyle(0xd8d8d8, 1);
    g.fillRoundedRect(0, 28, 64, 36, { tl: 0, tr: 0, bl: 16, br: 16 });
    g.lineStyle(2, 0x000000, 0.12);
    g.strokeRoundedRect(1, 1, 62, 62, 15);
  });

  make(TEX.bomb, 48, 48, () => {
    g.fillStyle(white, 1);
    g.fillCircle(24, 26, 20);
    g.fillStyle(0xdddddd, 1);
    g.fillRoundedRect(18, 2, 12, 8, 3);
  });

  make(TEX.boomerang, 64, 64, () => {
    g.fillStyle(white, 1);
    g.fillPoints(
      [
        new Phaser.Geom.Point(4, 26),
        new Phaser.Geom.Point(16, 32),
        new Phaser.Geom.Point(32, 12),
        new Phaser.Geom.Point(48, 32),
        new Phaser.Geom.Point(60, 26),
        new Phaser.Geom.Point(52, 34),
        new Phaser.Geom.Point(46, 52),
        new Phaser.Geom.Point(32, 42),
        new Phaser.Geom.Point(18, 52),
        new Phaser.Geom.Point(12, 34),
      ],
      true,
    );
  });

  make(TEX.heart, 64, 64, () => {
    g.fillStyle(white, 1);
    g.fillCircle(20, 24, 14);
    g.fillCircle(44, 24, 14);
    g.fillTriangle(6, 30, 58, 30, 32, 58);
  });

  make(TEX.particle, 32, 32, () => {
    g.fillStyle(white, 1);
    g.fillCircle(16, 16, 14);
  });

  make(TEX.spark, 32, 32, () => {
    g.fillStyle(white, 1);
    g.fillPoints([new Phaser.Geom.Point(16, 0), new Phaser.Geom.Point(24, 16), new Phaser.Geom.Point(16, 32), new Phaser.Geom.Point(8, 16)], true);
  });

  make(TEX.ring, 256, 256, () => {
    g.lineStyle(14, white, 1);
    g.strokeCircle(128, 128, 112);
  });

  make(TEX.softCircle, 256, 256, () => {
    for (let i = 8; i >= 1; i--) {
      g.fillStyle(white, 0.09);
      g.fillCircle(128, 128, i * 16);
    }
  });

  // --- item glyphs (white silhouettes on a 96px canvas) ---------------------
  make(TEX.glyphWeapon, 96, 96, () => {
    g.fillStyle(white, 1);
    // warhead + body
    g.fillTriangle(48, 8, 30, 42, 66, 42);
    g.fillRoundedRect(33, 42, 30, 32, 6);
    // fins
    g.fillTriangle(33, 62, 20, 84, 37, 74);
    g.fillTriangle(63, 62, 76, 84, 59, 74);
  });

  make(TEX.glyphBomb, 96, 96, () => {
    g.fillStyle(white, 1);
    g.fillCircle(46, 58, 28);
    // fuse: cap + curved wick + spark dot
    g.fillRoundedRect(38, 22, 16, 12, 4);
    g.lineStyle(7, white, 1);
    g.beginPath();
    g.arc(62, 22, 12, Math.PI * 0.5, Math.PI * 1.3, false);
    g.strokePath();
    g.fillCircle(70, 14, 5);
  });

  make(TEX.glyphShield, 96, 96, () => {
    g.fillStyle(white, 1);
    g.fillPoints(
      [
        new Phaser.Geom.Point(48, 8),
        new Phaser.Geom.Point(80, 20),
        new Phaser.Geom.Point(80, 46),
        new Phaser.Geom.Point(72, 66),
        new Phaser.Geom.Point(48, 88),
        new Phaser.Geom.Point(24, 66),
        new Phaser.Geom.Point(16, 46),
        new Phaser.Geom.Point(16, 20),
      ],
      true,
    );
  });

  make(TEX.glyphMagnet, 96, 96, () => {
    g.fillStyle(white, 1);
    // U opening upwards
    g.fillRoundedRect(18, 18, 18, 48, 6);
    g.fillRoundedRect(60, 18, 18, 48, 6);
    g.fillRoundedRect(18, 54, 60, 20, 8);
    // pole caps
    g.fillStyle(0xbbbbbb, 1);
    g.fillRect(18, 18, 18, 12);
    g.fillRect(60, 18, 18, 12);
  });

  make(TEX.glyphBuff, 96, 96, () => {
    g.fillStyle(white, 1);
    // double chevron up
    g.fillTriangle(48, 12, 22, 40, 74, 40);
    g.fillTriangle(48, 44, 22, 72, 74, 72);
  });

  make(TEX.glyphStar, 96, 96, () => {
    g.fillStyle(white, 1);
    g.fillPoints(starPoints(48, 50, 40, 18), true);
  });

  g.destroy();
}
