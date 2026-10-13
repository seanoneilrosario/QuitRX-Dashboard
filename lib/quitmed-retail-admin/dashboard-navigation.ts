export function safeDashboardReturnTo(
  value: unknown,
  fallback: string,
): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const candidate = value.trim();

  // Only allow internal dashboard destinations.
  if (
    !candidate.startsWith("/dashboard/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\")
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(
      candidate,
      "https://dashboard.invalid",
    );

    if (parsed.origin !== "https://dashboard.invalid") {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}