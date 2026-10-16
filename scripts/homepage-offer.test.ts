import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("homepage promotes the October 2026 HSC 2028 offer", async () => {
  const dictionary = JSON.parse(await readFile("messages/bn.json", "utf8")) as {
    home: {
      hero: { classStartVal: string; specialOfferVal: string };
      hsc2028: { subtitle: string; combo: { description: string; regularFee: string; offerFee: string } };
      batches: { sample: Array<{ name: string; mode: string; schedule: string }> };
    };
  };

  assert.equal(dictionary.home.hero.classStartVal, "04 October, 2026");
  assert.match(dictionary.home.hero.specialOfferVal, /31 October.*500 ৳/);
  assert.match(dictionary.home.hsc2028.subtitle, /04 October, 2026/);
  assert.equal(dictionary.home.hsc2028.combo.regularFee, "4,000 ৳");
  assert.equal(dictionary.home.hsc2028.combo.offerFee, "3,500 ৳");
  assert.equal(dictionary.home.batches.sample.some((batch) => /HSC ২০২৭/.test(batch.name)), false);
  assert.equal(dictionary.home.batches.sample.some((batch) => /HSC ২০২৮/.test(batch.name) && batch.mode === "offline" && /04 October, 2026/.test(batch.schedule)), true);
});

test("English install and notification actions live only in the footer", async () => {
  const home = await readFile("components/home/HomeSection.tsx", "utf8");
  const footer = await readFile("components/layout/Footer.tsx", "utf8");
  const actions = await readFile("components/shared/PwaInstallPrompt.tsx", "utf8");

  assert.doesNotMatch(home, /PwaInstallPrompt/);
  assert.match(footer, /<PwaInstallPrompt \/>/);
  assert.doesNotMatch(actions, /<section/);
  assert.match(actions, /Install app/);
  assert.match(actions, /Enable notifications/);
  assert.match(actions, /min-h-12 w-full border-2 border-brand-yellow bg-brand-yellow/);
  assert.match(actions, /min-h-12 w-full border-2 border-white bg-white/);
});

test("combo discount uses a compact split offer layout", async () => {
  const home = await readFile("components/home/HomeSection.tsx", "utf8");

  assert.match(home, /sm:grid-cols-\[0\.9fr_1\.1fr\]/);
  assert.match(home, /রেগুলার ফি/);
  assert.match(home, /প্রতি মাসে সাশ্রয় 500 ৳!/);
  assert.match(home, /dict\.hsc2028\.combo\.regularFee/);
  assert.match(home, /dict\.hsc2028\.combo\.offerFee/);
  assert.match(home, /অফার চলবে 31 October পর্যন্ত/);
  assert.match(home, /ICT FREE/);
});

test("homepage and full batches page both use the curated static batch list", async () => {
  const home = await readFile("components/home/HomeSection.tsx", "utf8");
  const list = await readFile("components/batches/BatchesList.tsx", "utf8");

  assert.doesNotMatch(home, /fetch\("\/api\/public\/batches/);
  assert.match(home, /dict\.batches\.sample\.map/);
  assert.doesNotMatch(list, /fetch\("\/api\/public\/batches/);
  assert.match(list, /dict\.sample\.filter/);
});
