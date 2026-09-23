// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE and NOTICE for terms.

"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  REPO, downloads, extras, features, guides, ui,
  type Lang, type Localized,
} from "./content";
import sizes from "./ui-sizes.json";
import { UiFrame } from "./ui-frame";

function Icon({ children }: { children: string }) {
  return <i className="material-icons" aria-hidden="true">{children}</i>;
}

/* Guide text with the app's own controls inline (see the token list in content.ts) */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\[[a-z]+:[^\]]+\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = /^\[([a-z]+):([^\]]+)\]$/.exec(part);
        if(!match) return <Fragment key={i}>{part}</Fragment>;
        const [, kind, arg] = match;
        if(kind === "icon")
          return <i key={i} className="material-icons ui-icon" aria-label={arg}>{arg}</i>;
        if(kind === "fab")
          return <span key={i} className="ui-fab" aria-label={arg}><i className="material-icons">{arg}</i></span>;
        if(kind === "btn") {
          const [label, icon] = arg.split("|");
          return <span key={i} className="ui-btn">{icon && <i className="material-icons">{icon}</i>}{label}</span>;
        }
        if(kind === "key") return <kbd key={i}>{arg}</kbd>;
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

export default function Home() {
  const [lang, setLang] = useState<Lang>("zh");
  const [platform, setPlatform] = useState<"mac" | "win">("mac");
  const [activeGuide, setActiveGuide] = useState(guides[0].id);
  const [query, setQuery] = useState("");
  const [brandShown, setBrandShown] = useState(false);
  const heroIcon = useRef<HTMLImageElement>(null);
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
    const isWindows = /Windows/i.test(window.navigator.userAgent);
    const timer = window.setTimeout(() => {
      setLang(next);
      setPlatform(isWindows ? "win" : "mac");
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

  // The header's name and icon appear once the hero's large icon has scrolled away
  useEffect(() => {
    const icon = heroIcon.current;
    if(!icon) return;
    const observer = new IntersectionObserver(([entry]) => setBrandShown(!entry.isIntersecting),
      { rootMargin: "-64px 0px 0px 0px" });
    observer.observe(icon);
    return () => observer.disconnect();
  }, []);

  const visibleGuides = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if(!needle) return guides;
    return guides.filter((guide) => [
      guide.title.zh, guide.title.en, guide.summary.zh, guide.summary.en,
      ...(guide.steps ?? []).flatMap((step) => [step.text.zh, step.text.en]),
      ...(guide.sections ?? []).flatMap((section) => [
        section.title.zh, section.title.en, section.intro?.zh ?? "", section.intro?.en ?? "",
        ...(section.items ?? []).flatMap((item) => [item.zh, item.en]),
      ]),
    ].join(" ").toLocaleLowerCase().includes(needle));
  }, [query]);

  const guide = guides.find((item) => item.id === activeGuide) ?? guides[0];

  const selectGuide = (id: string) => {
    setActiveGuide(id);
    window.history.replaceState(null, "", `#guide-${id}`);
    document.getElementById("guide-top")?.scrollIntoView({ block: "start" });
  };

  const changeLanguage = (next: Lang) => {
    setLang(next);
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.history.replaceState(null, "", url);
  };

  const order = platform === "win" ? (["win", "mac"] as const) : (["mac", "win"] as const);

  return (
    <>
      <header className="site-header">
        <a className={`brand${brandShown ? " shown" : ""}`} href="#top" aria-hidden={!brandShown} tabIndex={brandShown ? 0 : -1}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a fixed-size icon; the optimizer needs a Cloudflare Images binding */}
          <img src="/icon-128.png" alt="" width={28} height={28} />
          <span>Console Neo</span>
        </a>
        <nav>
          <a href="#features">{t(ui.features)}</a>
          <a href="#guides">{t(ui.guides)}</a>
          <a href={REPO}>{t(ui.source)}</a>
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
          <img ref={heroIcon} className="hero-icon" src="/icon-256.png" alt="" width={128} height={128} />
          <h1>Console Neo</h1>
          <p className="tagline">{t(ui.tagline)}</p>
          <p className="lede">{t(ui.lede)}</p>
          <div className="downloads">
            {order.map((key, i) => (
              <a key={key} className={`download${i === 0 ? " primary" : ""}`} href={downloads[key].href}>
                <Icon>file_download</Icon>
                <span>
                  <strong>{t(downloads[key].label)}</strong>
                  <small>{t(downloads[key].detail)}</small>
                </span>
              </a>
            ))}
          </div>
          <p className="release">{t(ui.release)}</p>
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
                    {...sizes.controller}
                    label={`${t(feature.title)} · ${t(ui.controller)}`}
                  />
                  <figcaption>{t(ui.controller)}</figcaption>
                </figure>
                {feature.cast && (
                  <figure className="shot shot-cast">
                    <UiFrame
                      src={`/ui/${feature.cast}-${lang}.html`}
                      {...sizes.cast}
                      label={`${t(feature.title)} · ${t(ui.cast)}`}
                    />
                    <figcaption>{t(ui.cast)}</figcaption>
                  </figure>
                )}
              </div>
            </article>
          ))}

          <div className="extras">
            <h2>{t(ui.moreTitle)}</h2>
            <ul>
              {extras.map((item) => (
                <li key={item.icon}><Icon>{item.icon}</Icon><span>{t(item.label)}</span></li>
              ))}
            </ul>
          </div>
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

            <article className="guide" id="guide-top" key={`${guide.id}-${lang}`}>
              <h3>{t(guide.title)}</h3>
              {guide.steps && (
                <ol className="steps">
                  {guide.steps.map((step, i) => (
                    <li key={step.text.en}>
                      <span className="step-number">{i + 1}</span>
                      <div className="step-body">
                        <p><Rich text={t(step.text)} /></p>
                        {step.shot && (
                          // eslint-disable-next-line @next/next/no-img-element -- static screenshots, sized by the browser
                          <img
                            className={`step-shot${step.shot.startsWith("cast-") ? " cast" : ""}`}
                            src={`/guides/${step.shot}-${lang}.webp`}
                            alt=""
                            loading="lazy"
                            width={step.shot.startsWith("cast-") ? sizes.cast.width : sizes.controller.width}
                            height={step.shot.startsWith("cast-") ? sizes.cast.height : sizes.controller.height}
                          />
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {guide.sections?.map((section) => (
                <section key={section.title.en}>
                  <h4>{t(section.title)}</h4>
                  {section.intro && <p><Rich text={t(section.intro)} /></p>}
                  {section.items && (
                    <ul className={`list${section.caution ? " caution" : ""}`}>
                      {section.items.map((item) => (
                        <li className="list-item" key={item.en}>
                          <span className="list-item-indicator" />
                          <span className="list-item-content"><Rich text={t(item)} /></span>
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
        <p>{t(ui.freeSoftware)}</p>
        <p>
          {t(ui.commercial)} <a href="mailto:contact@consoleneo.com">contact@consoleneo.com</a>
          {lang === "zh" ? "。" : "."}
        </p>
        <p>{t(ui.lineage)}</p>
        <p>
          <a href={REPO}>{t(ui.source)}</a>
          <span className="sep">·</span>
          <a href="/licenses/AGPL-3.0.txt">{t(ui.license)}</a>
          <span className="sep">·</span>
          <a href="/NOTICE.txt">{t(ui.notices)}</a>
          <span className="sep">·</span>
          <a href="/licenses/INHERITED-MIT.txt">MIT</a>
        </p>
        <p>
          {t(ui.feedback)} <a href="mailto:feedback@consoleneo.com">feedback@consoleneo.com</a>
          <span className="sep">·</span>
          {t(ui.partnerships)} <a href="mailto:contact@consoleneo.com">contact@consoleneo.com</a>
        </p>
      </footer>
    </>
  );
}
