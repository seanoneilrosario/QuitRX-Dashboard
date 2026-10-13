"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

type DashboardBackLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

export default function DashboardBackLink({
  href,
  className,
  children,
}: DashboardBackLinkProps) {
  const router = useRouter();

  function handleClick(
    event: MouseEvent<HTMLAnchorElement>,
  ) {
    // Preserve normal browser behavior for modified clicks.
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();

    let sameOriginReferrer = false;

    try {
      sameOriginReferrer =
        Boolean(document.referrer) &&
        new URL(document.referrer).origin ===
          window.location.origin;
    } catch {
      sameOriginReferrer = false;
    }

    if (sameOriginReferrer) {
      // Return to the existing listing history entry.
      router.back();
    } else {
      // Direct entry or unavailable history: use the saved URL.
      router.replace(href);
    }
  }

  return (
    <Link
      href={href}
      className={className}
      onClick={handleClick}
    >
      {children}
    </Link>
  );
}