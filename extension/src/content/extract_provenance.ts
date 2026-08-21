import {extractPublishedDate} from "@altshiftab/utils/browser/published_date";

import type {Provenance} from "../provenance";

// The canonical link is preferred over location.href: it is the address the
// publisher considers the article's own, without the tracking parameters a
// shared link tends to carry.
function extractUrl(): string {
  const candidates = [
    document
      .querySelector<HTMLLinkElement>('link[rel="canonical"]')
      ?.getAttribute("href"),
    document
      .querySelector('meta[property="og:url"]')
      ?.getAttribute("content"),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate, location.href);
      if (url.protocol === "http:" || url.protocol === "https:")
        return url.href;
    } catch {
      // Not a usable URL — fall through to the next candidate.
    }
  }

  return location.href;
}

function extractSiteName(): string {
  const metaSiteName = document
    .querySelector('meta[property="og:site_name"]')
    ?.getAttribute("content")
    ?.trim();
  if (metaSiteName) return metaSiteName;

  const applicationName = document
    .querySelector('meta[name="application-name"]')
    ?.getAttribute("content")
    ?.trim();
  if (applicationName) return applicationName;

  return location.hostname.replace(/^www\./, "");
}

export function extractProvenance(title: string): Provenance {
  const url = extractUrl();
  return {
    url,
    title: title.trim() || document.title.trim(),
    siteName: extractSiteName(),
    // The address is passed as the canonical one, that being what the date, if
    // it comes from the address at all, should be read from.
    publishedAt: extractPublishedDate(document, url),
  };
}
