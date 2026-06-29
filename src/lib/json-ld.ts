// Safely serialize a JSON-LD object for injection into a <script> tag via
// dangerouslySetInnerHTML. JSON.stringify does NOT escape "<", so a "</script>"
// sequence in any string field would break out of the script element. Escaping
// "<" to its < form keeps the JSON valid while making such a breakout
// impossible — the standard hardening for inline JSON-LD.
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}