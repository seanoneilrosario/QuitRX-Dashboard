import Link from "next/link";
import styles from "../discounts-components/discounts.module.css";
import { Discount } from "@/lib/quitmed-retail-admin/discounts/types";
import { getDiscount } from "@/lib/quitmed-retail-admin/discounts/client";
import DiscountForm from "../discounts-components/DiscountForm";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ id?: string }> | { id?: string };
};

export default async function EditDiscountPage({ searchParams }: PageProps) {
  const params = await Promise.resolve(searchParams);
  const id = params.id?.trim();

  if (!id) {
    return (
      <main className={styles.page}>
        <div className={styles.error}>A discount ID is required to edit a discount.</div>
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

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Discounts</p>
          <h1 className={styles.title}>Edit discount</h1>
          <p className={styles.subtitle}>Update promotion settings and customer eligibility.</p>
        </div>
        <Link className={styles.secondaryButton} href={discount ? `/dashboard/discounts/view?id=${encodeURIComponent(discount.id)}` : "/dashboard/discounts"}>Cancel</Link>
      </header>
      {errorMessage ? (
        <div className={styles.error} role="alert">Could not load this discount: {errorMessage}</div>
      ) : discount ? (
        <DiscountForm mode="edit" initialDiscount={discount} />
      ) : (
        <div className={styles.error}>Discount not found.</div>
      )}
    </main>
  );
}
