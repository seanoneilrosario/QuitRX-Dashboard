import Link from "next/link";
import styles from "../discounts-components/discounts.module.css";
import { Discount, DiscountRelation } from "@/lib/quitmed-retail-admin/discounts/types";
import { getDiscount } from "@/lib/quitmed-retail-admin/discounts/client";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ id?: string }> | { id?: string };
};

function display(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function methodLabel(discount: Discount): string {
  switch (discount.method) {
    case "PERCENTAGE": return `${display(discount.value)}%`;
    case "FIXED_AMOUNT": return `Fixed amount: ${display(discount.value)}`;
    case "BUY_X_GET_Y": return `Buy ${display(discount.buyQuantity)}, get ${display(discount.getQuantity)} (${display(discount.getDiscountType)})`;
    case "FREE_SHIPPING": return "Free shipping";
  }
}

function relationLabel(relation: DiscountRelation, kind: "product" | "variant" | "customer" | "segment"): string {
  if (kind === "product") return relation.product?.title ?? relation.product?.name ?? relation.name ?? relation.productId ?? "Product";
  if (kind === "variant") return relation.variant?.name ?? relation.variant?.sku ?? relation.variantId ?? "Variant";
  if (kind === "customer") {
    const fullName = [relation.customer?.firstName, relation.customer?.lastName].filter(Boolean).join(" ");
    return fullName || relation.customer?.email || relation.customerId || "Customer";
  }
  return relation.segment?.name ?? relation.segmentId ?? "Segment";
}

function Detail({ label, value }: { label: string; value: string | number | boolean | null | undefined }) {
  return <div className={styles.detailItem}><p className={styles.detailLabel}>{label}</p><p className={styles.detailValue}>{display(value)}</p></div>;
}

export default async function ViewDiscountPage({ searchParams }: PageProps) {
  const params = await Promise.resolve(searchParams);
  const id = params.id?.trim();

  if (!id) {
    return (
      <main className={styles.page}>
        <div className={styles.error}>A discount ID is required to view a discount.</div>
        <Link className={styles.secondaryButton} href="/dashboard/discounts">Back to discounts</Link>
      </main>
    );
  }

  let discount: Discount | null = null;
  let errorMessage: string | null = null;
  try {
    discount = await getDiscount(id);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unable to load this discount.";
  }

  if (!discount) {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Discounts</p>
            <h1 className={styles.title}>Discount details</h1>
          </div>
          <Link className={styles.secondaryButton} href="/dashboard/discounts">Back to discounts</Link>
        </header>
        <div className={styles.error} role="alert">{errorMessage ?? "Discount not found."}</div>
      </main>
    );
  }

  const relationSections: Array<{ title: string; items: DiscountRelation[]; kind: "product" | "variant" | "customer" | "segment" }> = [
    { title: "Products", items: discount.products ?? [], kind: "product" },
    { title: "Variants", items: discount.variants ?? [], kind: "variant" },
    { title: "Selected customers", items: discount.customers ?? [], kind: "customer" },
    { title: "Customer segments", items: discount.segments ?? [], kind: "segment" },
  ];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Discounts / Details</p>
          <h1 className={styles.title}>{discount.name}</h1>
          <p className={styles.subtitle}>{discount.description || "No description provided."}</p>
        </div>
        <div className={styles.actions}>
          <Link className={styles.secondaryButton} href="/dashboard/discounts">Back to discounts</Link>
          <Link className={styles.button} href={`/dashboard/discounts/edit?id=${encodeURIComponent(discount.id)}`}>Edit discount</Link>
        </div>
      </header>

      <section className={styles.panel} style={{ padding: 22, marginBottom: 20 }}>
        <div className={styles.actions} style={{ marginBottom: 18 }}>
          <span className={`${styles.badge} ${discount.isActive ? styles.activeBadge : styles.inactiveBadge}`}>{discount.isActive ? "Active" : "Inactive"}</span>
          <span className={styles.codeText}>{discount.isAutomatic ? "Automatic" : display(discount.code)}</span>
        </div>
        <div className={styles.detailGrid}>
          <Detail label="Method" value={methodLabel(discount)} />
          <Detail label="Scope" value={discount.scope} />
          <Detail label="Code" value={discount.code} />
          <Detail label="Priority" value={discount.priority} />
          <Detail label="Usage count" value={discount.usageCount} />
          <Detail label="Usage limit" value={discount.usageLimit} />
          <Detail label="Minimum subtotal" value={discount.minSubtotal} />
          <Detail label="Minimum quantity" value={discount.minQuantity} />
          <Detail label="Maximum discount amount" value={discount.maxDiscountAmount} />
          <Detail label="Per-customer limit" value={discount.perCustomerUsageLimit} />
          <Detail label="Starts at" value={formatDate(discount.startsAt)} />
          <Detail label="Ends at" value={formatDate(discount.endsAt)} />
          <Detail label="Created" value={formatDate(discount.createdAt)} />
          <Detail label="Last updated" value={formatDate(discount.updatedAt)} />
        </div>
      </section>

      <section className={styles.panel} style={{ padding: 22, marginBottom: 20 }}>
        <h2 className={styles.sectionTitle}>Combination rules</h2>
        <p className={styles.sectionDescription}>These settings determine which discount scopes may combine. The backend remains the source of truth.</p>
        <div className={styles.detailGrid}>
          <Detail label="Combine with product discounts" value={discount.combineWithProductDiscounts} />
          <Detail label="Combine with order discounts" value={discount.combineWithOrderDiscounts} />
          <Detail label="Combine with shipping discounts" value={discount.combineWithShippingDiscounts} />
        </div>
      </section>

      <section className={styles.panel} style={{ padding: 22 }}>
        <h2 className={styles.sectionTitle}>Eligibility and product assignments</h2>
        <p className={styles.sectionDescription}>Assigned records returned by the discount API.</p>
        <div className={styles.formGrid}>
          {relationSections.map((section) => (
            <div className={styles.field} key={section.title}>
              <span className={styles.label}>{section.title} ({section.items.length})</span>
              {section.items.length ? (
                <div className={styles.relationList}>
                  {section.items.map((item, index) => (
                    <span className={styles.relationTag} key={item.id ?? `${section.title}-${index}`}>
                      {relationLabel(item, section.kind)}
                    </span>
                  ))}
                </div>
              ) : <span className={styles.muted}>No assignments</span>}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
