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

function pruneInvisible(original: Element, clone: Element): void {
  const origChildren = Array.from(original.children);
  const cloneChildren = Array.from(clone.children);
  for (let i = origChildren.length - 1; i >= 0; i--) {
    const child = origChildren[i];
    // display: contents elements report as not visible (no box) but their
    // children may still render — recurse rather than dropping the subtree.
    if (
      !child.checkVisibility() &&
      getComputedStyle(child).display !== "contents"
    ) {
      cloneChildren[i].remove();
    } else {
      pruneInvisible(child, cloneChildren[i]);
    }
  }
}

function extractHnItem(): { title: string; text: string } | null {
  const titleLink = document.querySelector<HTMLAnchorElement>(".titleline > a");
  if (!titleLink) return null;

  const title = titleLink.textContent?.trim() ?? "";
  const url = titleLink.href;
  const opUser = document.querySelector(".subtext .hnuser")?.textContent?.trim();
  const topText = document.querySelector<HTMLElement>(".toptext")?.innerText.trim();

  const parts: string[] = [title, url];
  if (topText && opUser) parts.push(`${opUser}: ${topText}`);

  for (const row of document.querySelectorAll<HTMLElement>(".comtr")) {
    const user = row.querySelector(".hnuser")?.textContent?.trim();
    const body = row.querySelector<HTMLElement>(".commtext")?.innerText.trim();
    if (user && body) parts.push(`${user}: ${body}`);
  }

  return { title, text: parts.join("\n\n") };
}

function extractLobstersItem(): { title: string; text: string } | null {
  const story = document.querySelector("li.story");
  if (!story) return null;

  const titleLink = story.querySelector<HTMLAnchorElement>(".link a.u-url");
  const title =
    titleLink?.textContent?.trim() ??
    story.querySelector(".link")?.textContent?.trim() ??
    "";
  const url = titleLink?.href;
  const submitter = story
    .querySelector(".byline .u-author")
    ?.textContent?.trim();
  const storyText = story
    .querySelector<HTMLElement>(".story_text")
    ?.innerText.trim();

  const parts: string[] = [title];
  if (url) parts.push(url);
  if (storyText && submitter) parts.push(`${submitter}: ${storyText}`);

  for (const comment of document.querySelectorAll<HTMLElement>(".comment")) {
    const userLink = Array.from(
      comment.querySelectorAll<HTMLAnchorElement>('.byline a[href^="/~"]'),
    ).find((a) => a.textContent?.trim());
    const user = userLink?.textContent?.trim();
    const body = comment
      .querySelector<HTMLElement>(".comment_text")
      ?.innerText.trim();
    if (user && body) parts.push(`${user}: ${body}`);
  }

  return { title, text: parts.join("\n\n") };
}

function extractPoliticoArticle(): { title: string; text: string } | null {
  const title = document.querySelector("h1")?.textContent?.trim() ?? "";
  const lead = document
    .querySelector<HTMLElement>(".hero__excerpt")
    ?.innerText.trim();
  const bodies = document.querySelectorAll<HTMLElement>(".article__content");
  if (!title || bodies.length === 0) return null;

  const parts: string[] = [title];
  if (lead) parts.push(lead);
  for (const body of bodies) {
    const blocks = body.querySelectorAll<HTMLElement>(
      "p, h2, h3, h4, li, blockquote",
    );
    for (const b of blocks) {
      const t = b.innerText.trim();
      if (t) parts.push(t);
    }
  }

  if (parts.length <= 1) return null;
  return { title, text: parts.join("\n\n") };
}

function extractCloudflareBlog(): { title: string; text: string } | null {
  const title = document.querySelector("h1")?.textContent?.trim() ?? "";
  const post = document.querySelector<HTMLElement>(".post-content");
  if (!title || !post) return null;

  const parts: string[] = [title];
  for (const b of post.querySelectorAll<HTMLElement>(
    "p, h2, h3, h4, li, blockquote, pre",
  )) {
    const t = b.innerText.trim();
    if (t) parts.push(t);
  }

  if (parts.length <= 1) return null;
  return { title, text: parts.join("\n\n") };
}

function extract(): { title: string; text: string } {
  if (
    location.hostname === "news.ycombinator.com" &&
    location.pathname === "/item"
  ) {
    const hn = extractHnItem();
    if (hn) return hn;
  }

  if (location.hostname === "lobste.rs" && location.pathname.startsWith("/s/")) {
    const lob = extractLobstersItem();
    if (lob) return lob;
  }

  if (location.hostname.endsWith("politico.eu") || location.hostname.endsWith("politico.com")) {
    const pol = extractPoliticoArticle();
    if (pol) return pol;
  }

  if (location.hostname === "blog.cloudflare.com") {
    const cf = extractCloudflareBlog();
    if (cf) return cf;
  }

  const clone = document.cloneNode(true) as Document;
  if (document.documentElement && clone.documentElement) {
    pruneInvisible(document.documentElement, clone.documentElement);
  }
  const article = new Readability(clone).parse();

  if (!article) {
    return { title: document.title, text: document.body.innerText };
  }

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

  return { title: article.title, text };
}

try {
  const { title, text } = extract();
  browser.runtime.sendMessage({ type: "extracted-content", title, text });
} catch (err) {
  browser.runtime.sendMessage({
    type: "extraction-error",
    error: err instanceof Error ? err.message : String(err),
  });
}
