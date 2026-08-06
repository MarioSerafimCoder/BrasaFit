import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

test("iPhone home-screen icons are opaque, square and full bleed", async () => {
  for (const filename of ["apple-touch-icon.png", "apple-touch-icon-precomposed.png"]) {
    const path = fileURLToPath(new URL(`../public/${filename}`, import.meta.url));
    const metadata = await sharp(path).metadata();
    const { data, info } = await sharp(path).raw().toBuffer({ resolveWithObject: true });

    assert.equal(metadata.width, 180);
    assert.equal(metadata.height, 180);
    assert.equal(metadata.hasAlpha, false);
    assert.equal(info.channels, 3);
    assert.deepEqual([...data.subarray(0, 3)], [255, 98, 0]);
  }

  assert.deepEqual(
    await readFile(new URL("../public/apple-touch-icon.png", import.meta.url)),
    await readFile(new URL("../public/apple-touch-icon-precomposed.png", import.meta.url)),
  );
});
