import type { Provenance } from "../provenance";

// The same cascade the highlighter extension runs over an article page. It is
// duplicated rather than shared because the two extensions ship separately;
// the highlighter's copy is the canonical one.
const metaSelectors = [
  'meta[property="article:published_time"]',
  'meta[property="og:article:published_time"]',
  'meta[itemprop="datePublished"]',
  'meta[name="datePublished"]',
  'meta[name="date"]',
  'meta[name="DC.date"]',
  'meta[name="DC.date.issued"]',
  'meta[name="pubdate"]',
  'meta[name="publish_date"]',
  'meta[name="sailthru.date"]',
  // Al Jazeera's spelling, the reverse of Schema.org's.
  'meta[name="publishedDate"]',
  'meta[property="article:modified_time"]',
  'meta[name="lastDate"]',
];

const timeSelectors = [
  'time[itemprop="datePublished"]',
  "time[pubdate]",
  'time[class*="publish"]',
  "time[datetime]",
];

function toIsoString(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return isNaN(date.getTime()) ? "" : date.toISOString();
}

function fromMeta(): string {
  for (const selector of metaSelectors) {
    const iso = toIsoString(
      document.querySelector(selector)?.getAttribute("content"),
    );
    if (iso) return iso;
  }
  return "";
}

function fromJsonLd(): string {
  for (const script of document.querySelectorAll(
    'script[type="application/ld+json"]',
  )) {
    let data: unknown;
    try {
      data = JSON.parse(script.textContent || "");
    } catch {
      continue;
    }

    for (const item of Array.isArray(data) ? data : [data]) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, any>;
      const entries = record["@graph"] ? [record, ...record["@graph"]] : [record];
      for (const entry of entries) {
        const iso = toIsoString(entry?.datePublished || entry?.dateCreated);
        if (iso) return iso;
      }
    }
  }
  return "";
}

function fromTimeElements(): string {
  for (const selector of timeSelectors) {
    for (const element of document.querySelectorAll(selector)) {
      const iso = toIsoString(element.getAttribute("datetime"));
      if (iso) return iso;
    }
  }
  return "";
}

function fromUrlPath(): string {
  // A single-digit month or day, as Al Jazeera writes them (/2026/6/9/), padded
  // so the date still parses.
  const match = location.pathname.match(/\/(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\/|$)/);
  if (!match) return "";
  return toIsoString(
    `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`,
  );
}

function extractPublishedAt(): string {
  return fromMeta() || fromJsonLd() || fromTimeElements() || fromUrlPath();
}

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
  return {
    url: extractUrl(),
    title: title.trim() || document.title.trim(),
    siteName: extractSiteName(),
    publishedAt: extractPublishedAt(),
  };
}
