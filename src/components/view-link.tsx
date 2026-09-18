import Link from "next/link";
import { IconChevronRight } from "@tabler/icons-react";

/** Compact row action that opens a detail page. */
export function ViewLink({
  href,
  label = "View details",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link className="ops-view-link" href={href} aria-label={label} title={label}>
      <IconChevronRight size={18} stroke={2.2} aria-hidden="true" />
    </Link>
  );
}
