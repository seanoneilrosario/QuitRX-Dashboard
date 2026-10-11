"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "./discounts.module.css";
import { BuyXGetYBenefit, Discount, DiscountMethod, DiscountPayload, DiscountScope } from "@/lib/quitmed-retail-admin/discounts/types";
import { createDiscountAction, updateDiscountAction } from "@/lib/quitmed-retail-admin/discounts/discount-actions";

type Props = {
  mode: "create" | "edit";
  initialDiscount?: Discount;
};

type FormState = {
  name: string;
  description: string;
  code: string;
  isAutomatic: boolean;
  isActive: boolean;
  method: DiscountMethod;
  scope: DiscountScope;
  value: string;
  maxDiscountAmount: string;
  minSubtotal: string;
  minQuantity: string;
  startsAt: string;
  endsAt: string;
  usageLimit: string;
  perCustomerUsageLimit: string;
  buyQuantity: string;
  getQuantity: string;
  getDiscountType: BuyXGetYBenefit;
  getDiscountValue: string;
  priority: string;
  combineWithProductDiscounts: boolean;
  combineWithOrderDiscounts: boolean;
  combineWithShippingDiscounts: boolean;
  productIds: string;
  variantIds: string;
  customerIds: string;
  segmentIds: string;
};

function datetimeLocalValue(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function relationIds(items?: Array<{ productId?: string; variantId?: string; customerId?: string; segmentId?: string }>, key?: "productId" | "variantId" | "customerId" | "segmentId"): string {
  if (!items || !key) return "";
  return items.map((item) => item[key]).filter((id): id is string => Boolean(id)).join("\n");
}

function initialState(discount?: Discount): FormState {
  return {
    name: discount?.name ?? "",
    description: discount?.description ?? "",
    code: discount?.code ?? "",
    isAutomatic: discount?.isAutomatic ?? true,
    isActive: discount?.isActive ?? false,
    method: discount?.method ?? "PERCENTAGE",
    scope: discount?.scope ?? "ORDER",
    value: discount?.value == null ? "" : String(discount.value),
    maxDiscountAmount: discount?.maxDiscountAmount == null ? "" : String(discount.maxDiscountAmount),
    minSubtotal: discount?.minSubtotal == null ? "" : String(discount.minSubtotal),
    minQuantity: discount?.minQuantity == null ? "" : String(discount.minQuantity),
    startsAt: datetimeLocalValue(discount?.startsAt),
    endsAt: datetimeLocalValue(discount?.endsAt),
    usageLimit: discount?.usageLimit == null ? "" : String(discount.usageLimit),
    perCustomerUsageLimit: discount?.perCustomerUsageLimit == null ? "" : String(discount.perCustomerUsageLimit),
    buyQuantity: discount?.buyQuantity == null ? "" : String(discount.buyQuantity),
    getQuantity: discount?.getQuantity == null ? "" : String(discount.getQuantity),
    getDiscountType: discount?.getDiscountType ?? "FREE",
    getDiscountValue: discount?.getDiscountValue == null ? "" : String(discount.getDiscountValue),
    priority: discount?.priority == null ? "0" : String(discount.priority),
    combineWithProductDiscounts: discount?.combineWithProductDiscounts ?? false,
    combineWithOrderDiscounts: discount?.combineWithOrderDiscounts ?? false,
    combineWithShippingDiscounts: discount?.combineWithShippingDiscounts ?? false,
    productIds: relationIds(discount?.products, "productId"),
    variantIds: relationIds(discount?.variants, "variantId"),
    customerIds: relationIds(discount?.customers, "customerId"),
    segmentIds: relationIds(discount?.segments, "segmentId"),
  };
}

function parseIds(value: string): string[] {
  return Array.from(new Set(value.split(/[\n,;]/).map((part) => part.trim()).filter(Boolean)));
}

function optionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalInteger(value: string): number | null {
  const parsed = optionalNumber(value);
  return parsed === null ? null : Math.trunc(parsed);
}

export default function DiscountForm({ mode, initialDiscount }: Props) {
  const [form, setForm] = useState<FormState>(() => initialState(initialDiscount));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const isBuyXGetY = form.method === "BUY_X_GET_Y";
  const isFreeShipping = form.method === "FREE_SHIPPING";
  const numericValueLabel = useMemo(() => {
    if (form.method === "PERCENTAGE") return "Discount percentage";
    if (form.method === "FIXED_AMOUNT") return "Fixed discount amount";
    if (form.method === "BUY_X_GET_Y") return "Not used for Buy X Get Y";
    return "Not used for free shipping";
  }, [form.method]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleMethodChange(method: DiscountMethod) {
    setForm((current) => ({
      ...current,
      method,
      scope: method === "FREE_SHIPPING" ? "SHIPPING" : method === "BUY_X_GET_Y" ? "PRODUCT" : current.scope,
    }));
  }

  function buildPayload(): DiscountPayload {
    const payload: DiscountPayload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      code: form.code.trim() || null,
      isAutomatic: form.isAutomatic,
      isActive: form.isActive,
      method: form.method,
      scope: form.scope,
      value: isBuyXGetY || isFreeShipping ? null : optionalNumber(form.value),
      maxDiscountAmount: optionalNumber(form.maxDiscountAmount),
      minSubtotal: optionalNumber(form.minSubtotal),
      minQuantity: optionalInteger(form.minQuantity),
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      usageLimit: optionalInteger(form.usageLimit),
      perCustomerUsageLimit: optionalInteger(form.perCustomerUsageLimit),
      buyQuantity: isBuyXGetY ? optionalInteger(form.buyQuantity) : null,
      getQuantity: isBuyXGetY ? optionalInteger(form.getQuantity) : null,
      getDiscountType: isBuyXGetY ? form.getDiscountType : null,
      getDiscountValue: isBuyXGetY && form.getDiscountType !== "FREE" ? optionalNumber(form.getDiscountValue) : null,
      priority: optionalInteger(form.priority) ?? 0,
      combineWithProductDiscounts: form.combineWithProductDiscounts,
      combineWithOrderDiscounts: form.combineWithOrderDiscounts,
      combineWithShippingDiscounts: form.combineWithShippingDiscounts,
      productIds: parseIds(form.productIds),
      variantIds: parseIds(form.variantIds),
      customerIds: parseIds(form.customerIds),
      segmentIds: parseIds(form.segmentIds),
    };

    if (form.isAutomatic) payload.code = null;
    return payload;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError("Enter a discount name.");
      return;
    }
    if (!form.isAutomatic && !form.code.trim()) {
      setError("Enter a discount code, or enable automatic discount.");
      return;
    }
    if (form.method === "PERCENTAGE") {
      const percentage = Number(form.value);
      if (!form.value.trim() || !Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
        setError("Percentage must be greater than 0 and no more than 100.");
        return;
      }
    }
    if (form.method === "FIXED_AMOUNT") {
      const amount = Number(form.value);
      if (!form.value.trim() || !Number.isFinite(amount) || amount <= 0) {
        setError("Enter a fixed discount amount greater than zero.");
        return;
      }
    }
    if (isBuyXGetY && (Number(form.buyQuantity) < 1 || Number(form.getQuantity) < 1)) {
      setError("Buy quantity and get quantity must both be at least 1.");
      return;
    }

    let payload: DiscountPayload;
    try {
      payload = buildPayload();
    } catch {
      setError("Check the start and end date values.");
      return;
    }

    startTransition(async () => {
      const result = mode === "create"
        ? await createDiscountAction(payload)
        : await updateDiscountAction(initialDiscount!.id, payload);

      if (!result.success) {
        setError(result.message ?? `Unable to ${mode} discount.`);
        return;
      }

      const id = result.data?.id ?? initialDiscount?.id;
      if (id) {
        router.push(`/dashboard/discounts/view?id=${encodeURIComponent(id)}`);
        router.refresh();
      } else {
        router.push("/dashboard/discounts");
        router.refresh();
      }
    });
  }

  return (
    <form className={`${styles.panel} ${styles.formPanel}`} onSubmit={handleSubmit}>
      {error && <div className={styles.error} role="alert">{error}</div>}

      <section className={styles.formSection}>
        <h2 className={styles.sectionTitle}>Discount details</h2>
        <p className={styles.sectionDescription}>Choose how this promotion is named, redeemed and calculated.</p>
        <div className={styles.formGrid}>
          <div className={`${styles.field} ${styles.fullWidth}`}>
            <label className={styles.label} htmlFor="discount-name">Discount name *</label>
            <input id="discount-name" className={styles.input} value={form.name} maxLength={120} required onChange={(event) => setField("name", event.target.value)} />
          </div>
          <div className={`${styles.field} ${styles.fullWidth}`}>
            <label className={styles.label} htmlFor="discount-description">Description</label>
            <textarea id="discount-description" className={styles.textarea} value={form.description} onChange={(event) => setField("description", event.target.value)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="discount-method">Discount method *</label>
            <select id="discount-method" className={styles.select} value={form.method} onChange={(event) => handleMethodChange(event.target.value as DiscountMethod)}>
              <option value="PERCENTAGE">Percentage</option>
              <option value="FIXED_AMOUNT">Fixed amount</option>
              <option value="BUY_X_GET_Y">Buy X Get Y</option>
              <option value="FREE_SHIPPING">Free shipping</option>
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="discount-scope">Discount scope *</label>
            <select id="discount-scope" className={styles.select} value={form.scope} onChange={(event) => setField("scope", event.target.value as DiscountScope)}>
              <option value="ORDER">Order</option>
              <option value="PRODUCT">Product</option>
              <option value="SHIPPING">Shipping</option>
            </select>
            <span className={styles.help}>Free shipping normally uses Shipping scope; Buy X Get Y normally uses Product scope.</span>
          </div>
          {!isBuyXGetY && !isFreeShipping && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="discount-value">{numericValueLabel} *</label>
              <input id="discount-value" className={styles.input} type="number" min="0.01" step="0.01" value={form.value} required onChange={(event) => setField("value", event.target.value)} />
              {form.method === "PERCENTAGE" && <span className={styles.help}>Enter a percentage from 0 to 100.</span>}
            </div>
          )}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="discount-max">Maximum discount amount</label>
            <input id="discount-max" className={styles.input} type="number" min="0" step="0.01" value={form.maxDiscountAmount} onChange={(event) => setField("maxDiscountAmount", event.target.value)} />
          </div>
          {isBuyXGetY && (
            <>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="buy-quantity">Buy quantity *</label>
                <input id="buy-quantity" className={styles.input} type="number" min="1" step="1" value={form.buyQuantity} required onChange={(event) => setField("buyQuantity", event.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="get-quantity">Get quantity *</label>
                <input id="get-quantity" className={styles.input} type="number" min="1" step="1" value={form.getQuantity} required onChange={(event) => setField("getQuantity", event.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="get-discount-type">Benefit on Get items *</label>
                <select id="get-discount-type" className={styles.select} value={form.getDiscountType} onChange={(event) => setField("getDiscountType", event.target.value as BuyXGetYBenefit)}>
                  <option value="FREE">Free</option>
                  <option value="PERCENTAGE">Percentage off</option>
                  <option value="FIXED_AMOUNT">Fixed amount off</option>
                </select>
              </div>
              {form.getDiscountType !== "FREE" && (
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="get-discount-value">Get-item discount value *</label>
                  <input id="get-discount-value" className={styles.input} type="number" min="0.01" step="0.01" value={form.getDiscountValue} required onChange={(event) => setField("getDiscountValue", event.target.value)} />
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section className={styles.formSection}>
        <h2 className={styles.sectionTitle}>Eligibility and limits</h2>
        <p className={styles.sectionDescription}>Leave assignment fields blank to use no restriction for that category. Enter IDs on separate lines or separated by commas.</p>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="discount-code">Discount code</label>
            <input id="discount-code" className={styles.input} value={form.code} disabled={form.isAutomatic} placeholder="e.g. WELCOME10" onChange={(event) => setField("code", event.target.value.toUpperCase().replace(/\s/g, ""))} />
            <span className={styles.help}>Automatic discounts do not send a code to the API.</span>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="discount-priority">Priority</label>
            <input id="discount-priority" className={styles.input} type="number" step="1" value={form.priority} onChange={(event) => setField("priority", event.target.value)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="minimum-subtotal">Minimum subtotal</label>
            <input id="minimum-subtotal" className={styles.input} type="number" min="0" step="0.01" value={form.minSubtotal} onChange={(event) => setField("minSubtotal", event.target.value)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="minimum-quantity">Minimum quantity</label>
            <input id="minimum-quantity" className={styles.input} type="number" min="0" step="1" value={form.minQuantity} onChange={(event) => setField("minQuantity", event.target.value)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="usage-limit">Total usage limit</label>
            <input id="usage-limit" className={styles.input} type="number" min="0" step="1" value={form.usageLimit} onChange={(event) => setField("usageLimit", event.target.value)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="per-customer-limit">Usage limit per customer</label>
            <input id="per-customer-limit" className={styles.input} type="number" min="0" step="1" value={form.perCustomerUsageLimit} onChange={(event) => setField("perCustomerUsageLimit", event.target.value)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="starts-at">Starts at</label>
            <input id="starts-at" className={styles.input} type="datetime-local" value={form.startsAt} onChange={(event) => setField("startsAt", event.target.value)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="ends-at">Ends at</label>
            <input id="ends-at" className={styles.input} type="datetime-local" value={form.endsAt} onChange={(event) => setField("endsAt", event.target.value)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="products">Product IDs</label>
            <textarea id="products" className={styles.textarea} value={form.productIds} placeholder="One product ID per line" onChange={(event) => setField("productIds", event.target.value)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="variants">Variant IDs</label>
            <textarea id="variants" className={styles.textarea} value={form.variantIds} placeholder="One variant ID per line" onChange={(event) => setField("variantIds", event.target.value)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="customers">Customer IDs</label>
            <textarea id="customers" className={styles.textarea} value={form.customerIds} placeholder="One customer ID per line" onChange={(event) => setField("customerIds", event.target.value)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="segments">Customer segment IDs</label>
            <textarea id="segments" className={styles.textarea} value={form.segmentIds} placeholder="One segment ID per line" onChange={(event) => setField("segmentIds", event.target.value)} />
            <span className={styles.help}>Segment restrictions are sent as segmentIds; the backend decides eligibility.</span>
          </div>
        </div>
      </section>

      <section className={styles.formSection}>
        <h2 className={styles.sectionTitle}>Status and combinations</h2>
        <p className={styles.sectionDescription}>Only enable combinations when the business rules allow both discounts to combine.</p>
        <div className={styles.checkboxGrid}>
          <label className={styles.checkboxRow}>
            <input type="checkbox" checked={form.isAutomatic} onChange={(event) => setField("isAutomatic", event.target.checked)} />
            <span><strong>Automatic discount</strong><br />Apply without customers entering a code.</span>
          </label>
          <label className={styles.checkboxRow}>
            <input type="checkbox" checked={form.isActive} onChange={(event) => setField("isActive", event.target.checked)} />
            <span><strong>Active</strong><br />Allow this discount to be considered by checkout.</span>
          </label>
          <label className={styles.checkboxRow}>
            <input type="checkbox" checked={form.combineWithProductDiscounts} onChange={(event) => setField("combineWithProductDiscounts", event.target.checked)} />
            <span>Can combine with product discounts</span>
          </label>
          <label className={styles.checkboxRow}>
            <input type="checkbox" checked={form.combineWithOrderDiscounts} onChange={(event) => setField("combineWithOrderDiscounts", event.target.checked)} />
            <span>Can combine with order discounts</span>
          </label>
          <label className={styles.checkboxRow}>
            <input type="checkbox" checked={form.combineWithShippingDiscounts} onChange={(event) => setField("combineWithShippingDiscounts", event.target.checked)} />
            <span>Can combine with shipping discounts</span>
          </label>
        </div>
      </section>

      <div className={styles.formFooter}>
        <Link className={styles.secondaryButton} href="/dashboard/discounts">Cancel</Link>
        <button className={styles.button} type="submit" disabled={isPending}>
          {isPending ? "Saving…" : mode === "create" ? "Create discount" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
