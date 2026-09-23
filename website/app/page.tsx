// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE and NOTICE for terms.

"use client";

import { useEffect, useMemo, useState } from "react";
import { features, guides, ui, type Lang, type Localized } from "./content";
import { UiFrame } from "./ui-frame";

const CONTROLLER = { width: 1280, height: 800 };
const CAST = { width: 1600, height: 900 };

function Icon({ children }: { children: string }) {
  return <i className="material-icons" aria-hidden="true">{children}</i>;
}

export default function Home() {
  const [lang, setLang] = useState<Lang>("zh");
  const [activeGuide, setActiveGuide] = useState(guides[0].id);
  const [query, setQuery] = useState("");
  const t = (value: Localized) => value[lang];

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("lang");
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem("console-neo-site-lang");
    } catch {}
    const next: Lang = requested === "en" || requested === "zh"
      ? requested
      : stored === "en" || stored === "zh"
        ? stored
        : window.navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
    const guideId = window.location.hash.startsWith("#guide-") ? window.location.hash.slice(7) : "";
    const timer = window.setTimeout(() => {
      setLang(next);
      if(guides.some((guide) => guide.id === guideId)) setActiveGuide(guideId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("console-neo-site-lang", lang);
    } catch {}
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);

  const visibleGuides = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if(!needle) return guides;
    return guides.filter((guide) => [
      guide.title.zh, guide.title.en, guide.summary.zh, guide.summary.en,
      ...guide.sections.flatMap((section) => [
        section.title.zh, section.title.en, section.intro?.zh ?? "", section.intro?.en ?? "",
        ...(section.items ?? []).flatMap((item) => [item.zh, item.en]),
      ]),
    ].join(" ").toLocaleLowerCase().includes(needle));
  }, [query]);

  const guide = guides.find((item) => item.id === activeGuide) ?? guides[0];

  const selectGuide = (id: string) => {
    setActiveGuide(id);
    window.history.replaceState(null, "", `#guide-${id}`);
  };

  const changeLanguage = (next: Lang) => {
    setLang(next);
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.history.replaceState(null, "", url);
  };

  return (
    <>
      <header className="site-header">
        <a className="brand" href="#top">
          {/* eslint-disable-next-line @next/next/no-img-element -- a fixed-size icon; the optimizer needs a Cloudflare Images binding */}
          <img src="/icon-128.png" alt="" width={28} height={28} />
          <span>Console Neo</span>
        </a>
        <nav>
          <a href="#features">{t(ui.features)}</a>
          <a href="#guides">{t(ui.guides)}</a>
          <span className="lang-switch">
            <button className={lang === "zh" ? "active" : ""} onClick={() => changeLanguage("zh")} lang="zh-CN">中文</button>
            <span className="sep">·</span>
            <button className={lang === "en" ? "active" : ""} onClick={() => changeLanguage("en")} lang="en">English</button>
          </span>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          {/* eslint-disable-next-line @next/next/no-img-element -- see the header icon */}
          <img className="hero-icon" src="/icon-256.png" alt="" width={112} height={112} />
          <h1>Console Neo</h1>
          <p className="tagline">{t(ui.tagline)}</p>
          <p className="lede">{t(ui.lede)}</p>
          <p className="platform">{t(ui.platform)}</p>
        </section>

        <section className="features" id="features">
          {features.map((feature) => (
            <article className={`feature${feature.cast ? "" : " single"}`} id={feature.id} key={feature.id}>
              <div className="feature-text">
                <h2>{t(feature.title)}</h2>
                <p>{t(feature.body)}</p>
              </div>
              <div className="feature-shots">
                <figure className="shot shot-controller">
                  <UiFrame
                    src={`/ui/${feature.controller}-${lang}.html`}
                    {...CONTROLLER}
                    label={`${t(feature.title)} · ${t(ui.controller)}`}
                  />
                  <figcaption>{t(ui.controller)}</figcaption>
                </figure>
                {feature.cast && (
                  <figure className="shot shot-cast">
                    <UiFrame
                      src={`/ui/${feature.cast}-${lang}.html`}
                      {...CAST}
                      label={`${t(feature.title)} · ${t(ui.cast)}`}
                    />
                    <figcaption>{t(ui.cast)}</figcaption>
                  </figure>
                )}
              </div>
            </article>
          ))}
        </section>

        <section className="guides" id="guides">
          <div className="watermark-clip" aria-hidden="true"><Icon>menu_book</Icon></div>
          <h2>{t(ui.guides)}</h2>
          <div className="guides-shell">
            <aside>
              <label className="search">
                <Icon>search</Icon>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t(ui.search)}
                  aria-label={t(ui.search)}
                />
              </label>
              <div className="list">
                {visibleGuides.map((item) => (
                  <button
                    key={item.id}
                    className={`list-item clickable${item.id === guide.id ? " active" : ""}`}
                    onClick={() => selectGuide(item.id)}
                  >
                    <span className="list-item-indicator" />
                    <span className="list-item-content">
                      <strong>{t(item.title)}</strong>
                      <small>{t(item.summary)}</small>
                    </span>
                  </button>
                ))}
                {visibleGuides.length === 0 && <p className="empty-hint">{t(ui.noResults)}</p>}
              </div>
            </aside>

            <article className="guide" key={`${guide.id}-${lang}`}>
              <h3>{t(guide.title)}</h3>
              {guide.sections.map((section) => (
                <section key={section.title.en}>
                  <h4>{t(section.title)}</h4>
                  {section.intro && <p>{t(section.intro)}</p>}
                  {section.items && (
                    <ul className={`list${section.caution ? " caution" : ""}`}>
                      {section.items.map((item) => (
                        <li className="list-item" key={item.en}>
                          <span className="list-item-indicator" />
                          <span className="list-item-content">{t(item)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </article>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <p>{t(ui.lineage)}</p>
        <p>
          <a href="/licenses/INHERITED-MIT.txt">{t(ui.license)}</a>
          <span className="sep">·</span>
          <a href="/NOTICE.txt">{t(ui.notices)}</a>
        </p>
      </footer>
    </>
  );
}
