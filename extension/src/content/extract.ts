import { Readability } from "@mozilla/readability";

function htmlToText(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;

  const blocks = div.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, blockquote");
  return Array.from(blocks)
    .map((el) => el.textContent?.trim())
    .filter(Boolean)
    .join("\n\n");
}

try {
  const clone = document.cloneNode(true) as Document;
  const article = new Readability(clone).parse();

  if (article) {
    let text = htmlToText(article.content);

    // Readability often misses the preamble/ingress — try to recover it
    // from og:description, which news sites typically set to the lead text.
    const ogDesc = document
      .querySelector('meta[property="og:description"]')
      ?.getAttribute("content")
      ?.trim();

    if (ogDesc && !text.includes(ogDesc)) {
      text = ogDesc + "\n\n" + text;
    }

    browser.runtime.sendMessage({
      type: "extracted-content",
      title: article.title,
      text,
    });
  } else {
    browser.runtime.sendMessage({
      type: "extracted-content",
      title: document.title,
      text: document.body.innerText,
    });
  }
} catch (err) {
  browser.runtime.sendMessage({
    type: "extraction-error",
    error: err instanceof Error ? err.message : String(err),
  });
}
