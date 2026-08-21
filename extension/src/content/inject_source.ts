import type { Provenance } from "../provenance";

// Written into the Gemini tab so that the highlighter extension can read the
// article's provenance off the conversation without parsing anything. The
// published time deliberately uses the name every article carries: the
// highlighter already looks for it, and needs no change to find it here.
const MARKER_ATTRIBUTE = "data-article-summarizer";

const POLL_INTERVAL_MS = 500;

// A conversation only acquires its own address once the first message is sent,
// so the tab starts on the bare /app path. The first such address seen is the
// conversation the summary was pasted into; navigating on to any other one
// within the same document means the tags no longer describe what is on screen.
const CONVERSATION_PATH_PATTERN = /^\/app\/[^/]+/;

function addMeta(
  keyAttribute: "name" | "property",
  key: string,
  content: string,
): void {
  if (!content) return;

  const meta = document.createElement("meta");
  meta.setAttribute(keyAttribute, key);
  meta.setAttribute("content", content);
  meta.setAttribute(MARKER_ATTRIBUTE, "");
  document.head.append(meta);
}

function removeMeta(): void {
  for (const meta of document.querySelectorAll(`meta[${MARKER_ATTRIBUTE}]`))
    meta.remove();
}

function writeMeta(provenance: Provenance): void {
  addMeta("property", "article:published_time", provenance.publishedAt);
  addMeta("name", "highlighter:source-url", provenance.url);
  addMeta("name", "highlighter:source-title", provenance.title);
  addMeta("name", "highlighter:source-site", provenance.siteName);
}

function watchForConversationChange(): void {
  let pinnedPath: string | null = null;

  const timer = setInterval(() => {
    const path = location.pathname;

    if (pinnedPath === null) {
      if (CONVERSATION_PATH_PATTERN.test(path)) pinnedPath = path;
      return;
    }

    if (path === pinnedPath) return;

    // Another conversation is on screen; the tags describe the previous one.
    removeMeta();
    clearInterval(timer);
  }, POLL_INTERVAL_MS);
}

async function main(): Promise<void> {
  // The script is injected once per tab, but a re-injection must not stack a
  // second set of tags on top of the first.
  if (document.querySelector(`meta[${MARKER_ATTRIBUTE}]`)) return;

  const provenance: Provenance | undefined = await browser.runtime.sendMessage({
    type: "request-source-provenance",
  });
  if (!provenance) return;

  writeMeta(provenance);
  watchForConversationChange();
}

void main();
