export function normalizeRichText(
  value: unknown,
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/<meta\b[^>]*charset[^>]*>/gi, "")
    .replace(/\u00a0/g, " ")
    .replace(/<p>\s*(?:<br\s*\/?>\s*)*<\/p>/gi, "")
    .replace(/\r\n|\r/g, "\n")
    .replace(/>\s+</g, "><")
    .trim();
}