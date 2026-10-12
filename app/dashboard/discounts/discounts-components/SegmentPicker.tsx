
"use client";

import SearchableEligibilityPicker from "./SearchableEligibilityPicker";
import type { EligibilityOption } from "@/lib/quitmed-retail-admin/discounts/eligibility-actions";

type Props = {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  initialOptions?: EligibilityOption[];
  disabled?: boolean;
};

export default function SegmentPicker({
  selectedIds,
  onChange,
  initialOptions = [],
  disabled = false,
}: Props) {
  return (
    <SearchableEligibilityPicker
      kind="segment"
      label="Eligible customer segments"
      selectedIds={selectedIds}
      onChange={onChange}
      initialOptions={initialOptions}
      disabled={disabled}
    />
  );
}
