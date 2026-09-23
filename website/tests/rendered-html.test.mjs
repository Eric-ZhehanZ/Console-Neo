// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE and NOTICE for terms.

import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html", host: "localhost" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Console Neo site", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Console Neo<\/title>/i);
  assert.match(html, /模拟联合国会议控制台/);
  assert.match(html, /\/ui\/controller-list-zh\.html/);
  assert.match(html, /\/ui\/projector-list-zh\.html/);
  assert.match(html, /Liu Xiaoyi/);
  assert.match(html, /Pan Ruizhe/);
  assert.match(html, /\/licenses\/INHERITED-MIT\.txt/);
});

test("ships real UI snapshots for every feature in both languages", async () => {
  const content = await readFile(new URL("../app/content.ts", import.meta.url), "utf8");
  const snapshots = [...content.matchAll(/(?:controller|cast): "([a-z-]+)"/g)].map((match) => match[1]);
  assert.ok(snapshots.length >= 7);

  const files = new Set(await readdir(new URL("../public/ui/", import.meta.url)));
  for(const name of snapshots)
    for(const lang of ["zh", "en"])
      assert.ok(files.has(`${name}-${lang}.html`), `missing ui/${name}-${lang}.html`);
  assert.ok(files.has("controller.css"));
  assert.ok(files.has("projector.css"));

  const sample = await readFile(new URL("../public/ui/controller-list-en.html", import.meta.url), "utf8");
  assert.doesNotMatch(sample, /<script/i);
  assert.match(sample, /\/ui\/controller\.css/);
});

test("keeps bilingual guides, attribution, and assets self-contained", async () => {
  const [content, page, css, inheritedLicense, rootLicense, apacheLicense, apacheSource, notice] = await Promise.all([
    readFile(new URL("../app/content.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../public/licenses/INHERITED-MIT.txt", import.meta.url), "utf8"),
    readFile(new URL("../../LICENSE", import.meta.url), "utf8"),
    readFile(new URL("../public/licenses/APACHE-2.0.txt", import.meta.url), "utf8"),
    readFile(new URL("../node_modules/aria-query/LICENSE", import.meta.url), "utf8"),
    readFile(new URL("../public/NOTICE.txt", import.meta.url), "utf8"),
  ]);

  for(const id of ["start", "sessions", "meeting", "collaboration", "reference", "data", "troubleshooting"])
    assert.match(content, new RegExp(`id: "${id}"`));
  assert.match(page, /console-neo-site-lang/);
  assert.match(css, /prefers-reduced-motion/);
  assert.equal(inheritedLicense, rootLicense);
  assert.equal(apacheLicense, apacheSource);
  assert.match(notice, /Copyright 2015 Google Inc\./);
  assert.match(notice, /Material Icons/);
  assert.match(notice, /public\/ui\/assets/);

  await Promise.all([
    access(new URL("../public/icon.png", import.meta.url)),
    access(new URL("../public/apple-icon.png", import.meta.url)),
    access(new URL("../public/favicon.ico", import.meta.url)),
    access(new URL("../public/og.png", import.meta.url)),
    access(new URL("../public/ui/assets/Roboto-Light.woff2", import.meta.url)),
    access(new URL("../public/ui/assets/material.woff2", import.meta.url)),
    access(new URL("../public/licenses/INHERITED-MIT.txt", import.meta.url)),
    access(new URL("../public/NOTICE.txt", import.meta.url)),
  ]);
});
