import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
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

test("server-renders the Console Neo product site", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Console Neo — MUN Meeting Console<\/title>/i);
  assert.match(html, /Console Neo/);
  assert.match(html, /让每一项议程/);
  assert.match(html, /用户指南/);
  assert.match(html, /MIT License/);
  assert.match(html, /Copyright \(c\) 2016 Liu Xiaoyi/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|SkeletonPreview/i);
});

test("keeps bilingual guides, attribution, and assets self-contained", async () => {
  const [page, layout, css, packageJson, inheritedLicense, rootLicense,
    apacheLicense, apacheSource, notice] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../public/licenses/INHERITED-MIT.txt", import.meta.url), "utf8"),
    readFile(new URL("../../LICENSE", import.meta.url), "utf8"),
    readFile(new URL("../public/licenses/APACHE-2.0.txt", import.meta.url), "utf8"),
    readFile(new URL("../node_modules/aria-query/LICENSE", import.meta.url), "utf8"),
    readFile(new URL("../public/NOTICE.txt", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Run the room/);
  assert.match(page, /让每一项议程/);
  assert.match(page, /id: "start"/);
  assert.match(page, /id: "session"/);
  assert.match(page, /id: "meeting"/);
  assert.match(page, /id: "collaboration"/);
  assert.match(page, /id: "reference"/);
  assert.match(page, /id: "data"/);
  assert.match(page, /id: "troubleshooting"/);
  assert.match(page, /id: "faq"/);
  assert.match(page, /console-neo-site-lang/);
  assert.match(page, /IntersectionObserver/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(layout, /og\.png/);
  assert.doesNotMatch(layout, /\bauthors\s*:/);
  assert.match(packageJson, /"name": "console-neo-product-site"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton|drizzle/);
  assert.equal(inheritedLicense, rootLicense);
  assert.equal(apacheLicense, apacheSource);
  assert.match(notice, /Copyright 2015 Google Inc\./);
  assert.match(notice, /Material Icons/);
  assert.match(notice, /No public license is granted/);

  await Promise.all([
    access(new URL("../public/icon.png", import.meta.url)),
    access(new URL("../public/og.png", import.meta.url)),
    access(new URL("../public/fonts/Roboto-Light.ttf", import.meta.url)),
    access(new URL("../public/licenses/INHERITED-MIT.txt", import.meta.url)),
    access(new URL("../public/licenses/APACHE-2.0.txt", import.meta.url)),
    access(new URL("../public/NOTICE.txt", import.meta.url)),
  ]);
  await assert.rejects(access(new URL("../public/LICENSE.txt", import.meta.url)));
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});
