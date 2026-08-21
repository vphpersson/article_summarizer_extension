export interface Provenance {
  url: string;
  title: string;
  siteName: string;
  publishedAt: string;
}

// The block the highlighter extension parses back out of the Gemini
// conversation. It leads the prompt so that it sits at the very start of the
// user turn, which is the only place the parser trusts it: an article body that
// happens to contain the same lines cannot then pass itself off as the source.
export function formatProvenanceBlock(provenance: Provenance): string {
  const lines: string[] = [];

  const source = provenance.siteName
    ? `${provenance.title} — ${provenance.siteName}`
    : provenance.title;
  if (source) lines.push(`Source: ${source}`);
  if (provenance.url) lines.push(`URL: ${provenance.url}`);
  if (provenance.publishedAt) lines.push(`Published: ${provenance.publishedAt}`);

  return lines.join("\n");
}
