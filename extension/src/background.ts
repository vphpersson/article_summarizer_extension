import { buildPrompt } from "./prompt";
import type { Provenance } from "./provenance";

const GEMINI_URL = "https://gemini.google.com/app";

// Swedish vs English detection via stopword counts, with å/ä/ö as an
// extra Swedish signal. Ties (e.g. empty or non-matching text) fall
// back to English.
const svStopwords = new Set([
  "och", "att", "det", "som", "är", "på", "för", "med", "inte", "av",
  "den", "till", "har", "om", "ett", "han", "hon", "vi", "man", "kan",
  "ska", "också", "eller", "när", "från", "sig", "efter", "nu", "mot",
  "enligt", "sina", "vara", "hade", "här", "över",
]);
const enStopwords = new Set([
  "the", "and", "of", "to", "in", "is", "that", "it", "for", "was",
  "with", "as", "on", "at", "by", "this", "have", "from", "are", "be",
  "or", "an", "but", "not", "they", "which", "has", "will", "would",
  "their", "been", "were", "its", "also",
]);

function detectLanguage(text: string): "en" | "sv" {
  const sample = text.slice(0, 4000).toLowerCase();
  let sv = 0;
  let en = 0;
  for (const word of sample.match(/[a-zåäö]+/g) ?? []) {
    if (svStopwords.has(word)) sv++;
    else if (enStopwords.has(word)) en++;
  }
  sv += (sample.match(/[åäö]/g)?.length ?? 0) / 5;
  return sv > en ? "sv" : "en";
}

browser.browserAction.setBadgeBackgroundColor({ color: "#d7301f" });

function flashErrorBadge(): void {
  browser.browserAction.setBadgeText({ text: "!" });
  setTimeout(() => browser.browserAction.setBadgeText({ text: "" }), 4000);
}

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // navigator.clipboard can be unavailable in background pages on
    // some Firefox versions — fall back to execCommand.
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    if (!ok) throw new Error("Clipboard copy failed.");
  }
}

// Tabs where extraction was started from the toolbar button. The sidebar
// injects the same content script, and its messages reach this listener
// too — only act on extractions we initiated.
const pendingTabs = new Set<number>();

// The provenance of the article each Gemini tab was opened for, handed to the
// injected content script when it asks. Keyed by tab because the conversation
// has no address of its own until the first message is sent.
const provenanceByTab = new Map<number, Provenance>();

function injectSourceMetaWhenLoaded(tabId: number): void {
  const onUpdated = async (
    updatedTabId: number,
    changeInfo: browser.tabs._OnUpdatedChangeInfo,
  ) => {
    if (updatedTabId !== tabId || changeInfo.status !== "complete") return;
    browser.tabs.onUpdated.removeListener(onUpdated);

    try {
      await browser.tabs.executeScript(tabId, {
        file: "/content/inject_source.js",
      });
    } catch (err) {
      // The tags are a convenience for the highlighter; failing to write them
      // must not disturb the summary the tab was opened for.
      console.error("Article Summarizer:", err);
    }
  };

  browser.tabs.onUpdated.addListener(onUpdated);
}

browser.tabs.onRemoved.addListener((tabId) => {
  provenanceByTab.delete(tabId);
  pendingTabs.delete(tabId);
});

async function summarize(
  text: string,
  language: "en" | "sv",
  provenance?: Provenance,
): Promise<void> {
  await copyToClipboard(buildPrompt(language, text, provenance));

  const tab = await browser.tabs.create({ url: GEMINI_URL });
  if (tab.id === undefined || !provenance) return;

  provenanceByTab.set(tab.id, provenance);
  injectSourceMetaWhenLoaded(tab.id);
}

browser.browserAction.onClicked.addListener(async (tab) => {
  if (tab.id === undefined) return;
  pendingTabs.add(tab.id);
  try {
    await browser.tabs.executeScript(tab.id, { file: "/content/extract.js" });
  } catch (err) {
    pendingTabs.delete(tab.id);
    console.error("Article Summarizer:", err);
    flashErrorBadge();
  }
});

interface Message {
  type: string;
  text?: string;
  error?: string;
  provenance?: Provenance;
  language?: "en" | "sv";
}

browser.runtime.onMessage.addListener(
  (message: Message, sender: browser.runtime.MessageSender) => {
    // Sent by the sidebar, which has no tab of its own: it builds nothing and
    // opens nothing itself, so that both entry points produce the same prompt.
    if (message.type === "summarize") {
      const text = message.text ?? "";
      if (!text) return;
      return summarize(
        text,
        message.language ?? detectLanguage(text),
        message.provenance,
      );
    }

    const tabId = sender.tab?.id;
    if (tabId === undefined) return;

    if (message.type === "request-source-provenance")
      return Promise.resolve(provenanceByTab.get(tabId));

    if (!pendingTabs.has(tabId)) return;
    pendingTabs.delete(tabId);

    if (message.type !== "extracted-content" || !message.text) {
      console.error("Article Summarizer:", message.error ?? "No content extracted.");
      flashErrorBadge();
      return;
    }

    summarize(
      message.text,
      detectLanguage(message.text),
      message.provenance,
    ).catch((err) => {
      console.error("Article Summarizer:", err);
      flashErrorBadge();
    });
  },
);
