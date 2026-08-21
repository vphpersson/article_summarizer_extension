import type { Provenance } from "../provenance";

const extractBtn = document.getElementById("extract-btn") as HTMLButtonElement;
const summarizeBtn = document.getElementById("summarize-btn") as HTMLButtonElement;
const contentArea = document.getElementById("content") as HTMLTextAreaElement;
const languageSelect = document.getElementById("language") as HTMLSelectElement;
const statusEl = document.getElementById("status") as HTMLDivElement;

const statusMessages: Record<string, string> = {
  en: "Prompt copied to clipboard. Paste it in Gemini.",
  sv: "Prompten kopierad till urklipp. Klistra in den i Gemini.",
};

// Kept from the last extraction: the text in the box can be edited freely, but
// it still describes the article it was pulled from.
let provenance: Provenance | undefined;

browser.runtime.onMessage.addListener(
  (message: {
    type: string;
    title?: string;
    text?: string;
    error?: string;
    provenance?: Provenance;
  }) => {
    if (message.type === "extracted-content") {
      contentArea.value = message.text || "";
      provenance = message.provenance;
      summarizeBtn.disabled = !message.text;
      statusEl.textContent = message.title
        ? `Extracted: "${message.title}"`
        : "Content extracted.";
    } else if (message.type === "extraction-error") {
      statusEl.textContent = `Error: ${message.error}`;
    }
  },
);

extractBtn.addEventListener("click", async () => {
  statusEl.textContent = "Extracting...";
  contentArea.value = "";
  provenance = undefined;
  summarizeBtn.disabled = true;

  try {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) {
      statusEl.textContent = "No active tab found.";
      return;
    }
    await browser.tabs.executeScript(tab.id, { file: "/content/extract.js" });
  } catch (err) {
    statusEl.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
});

summarizeBtn.addEventListener("click", async () => {
  const text = contentArea.value.trim();
  if (!text) return;

  const language = languageSelect.value as "en" | "sv";

  try {
    // The background builds the prompt and opens the tab, so that this path
    // and the toolbar button hand Gemini the same thing — and so that the
    // source tags are written even though the sidebar closes here.
    await browser.runtime.sendMessage({
      type: "summarize",
      text,
      language,
      provenance,
    });
    statusEl.textContent = statusMessages[language];
    window.close();
  } catch (err) {
    statusEl.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
});

contentArea.addEventListener("input", () => {
  summarizeBtn.disabled = !contentArea.value.trim();
});
