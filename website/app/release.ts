// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE and NOTICE for terms.

/* The current release. Shared by the page and the Worker's /download redirects */

export const VERSION = "2.0.0-beta.1";
export const REPO = "https://github.com/Eric-ZhehanZ/Console-Neo";
export const RELEASE_PAGE = `${REPO}/releases/tag/v${VERSION}`;

const ASSETS = `${REPO}/releases/download/v${VERSION}`;

export const DOWNLOAD_FILES = {
  mac: `${ASSETS}/Console-Neo-${VERSION}-macos-universal.zip`,
  win: `${ASSETS}/Console-Neo-${VERSION}-windows-x64.zip`,
} as const;

export type Platform = keyof typeof DOWNLOAD_FILES;

// GitHub release downloads are unreliable from mainland China; route them through gh-proxy
export function downloadUrl(platform: Platform, country: string | null | undefined) {
  const url = DOWNLOAD_FILES[platform];
  return country === "CN" ? `https://gh-proxy.com/${url}` : url;
}
