"use client";

import { useActionState, useMemo, useState } from "react";
import { createOrder } from "../actions";
import { ActionButton } from "./action-controls";
import styles from "./dashboard.module.css";

type Option = { id: string; label: string };
type VariantOption = Option & { price: number; availableStock: number };
type OrderItem = { key: number; variantId: string; quantity: number };

export default function OrderCreateForm({
  customers,
  variants,
}: {
  customers: Option[];
  variants: VariantOption[];
}) {
  const [state, action] = useActionState(createOrder, { message: "", success: false });
  const [shipping, setShipping] = useState(0);
  const [items, setItems] = useState<OrderItem[]>([{ key: 0, variantId: "", quantity: 1 }]);
  const variantsById = useMemo(() => new Map(variants.map((variant) => [variant.id, variant])), [variants]);
  const subtotal = items.reduce((sum, item) => sum + (variantsById.get(item.variantId)?.price ?? 0) * item.quantity, 0);

  function updateItem(key: number, patch: Partial<OrderItem>) {
    setItems((current) => current.map((item) => item.key === key ? { ...item, ...patch } : item));
  }

  return (
    <details className={styles.creator}>
      <summary>+ Create order</summary>
      <form action={action}>
        <input type="hidden" name="items" value={JSON.stringify(items.map(({ variantId, quantity }) => ({ variantId, quantity })))} />
        <div className={styles.inlineForm}>
          <label>
            Customer
            <select name="customerId" required defaultValue="">
              <option value="" disabled>Select a customer</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.label}</option>)}
            </select>
          </label>
          <label>
            Shipping (AUD)
            <input name="shipping" type="number" min="0" step="0.01" required value={shipping} onChange={(event) => setShipping(Number(event.target.value))} />
          </label>
          <div className={styles.orderTotals}>
            <span>Subtotal <strong>{subtotal.toLocaleString("en-AU", { style: "currency", currency: "AUD" })}</strong></span>
            <span>Total <strong>{(subtotal + shipping).toLocaleString("en-AU", { style: "currency", currency: "AUD" })}</strong></span>
          </div>
        </div>
        <div className={styles.orderItems}>
          {items.map((item, index) => {
            const variant = variantsById.get(item.variantId);
            return <div className={styles.orderItem} key={item.key}>
              <label>
                Variant {index + 1}
                <select required value={item.variantId} onChange={(event) => updateItem(item.key, { variantId: event.target.value, quantity: 1 })}>
                  <option value="" disabled>Select a variant</option>
                  {variants.map((option) => <option key={option.id} value={option.id} disabled={option.availableStock <= 0 || items.some((other) => other.key !== item.key && other.variantId === option.id)}>{option.label} — {option.availableStock} available</option>)}
                </select>
              </label>
              <label>
                Quantity
                <input type="number" min="1" max={variant?.availableStock} required value={item.quantity} onChange={(event) => updateItem(item.key, { quantity: Number(event.target.value) })} />
              </label>
              <button type="button" className={styles.orderRemove} disabled={items.length === 1} onClick={() => setItems((current) => current.filter((currentItem) => currentItem.key !== item.key))}>Remove</button>
            </div>;
          })}
        </div>
        <div className={styles.orderActions}>
          <button type="button" className={styles.secondary} onClick={() => setItems((current) => [...current, { key: Math.max(...current.map((item) => item.key)) + 1, variantId: "", quantity: 1 }])}>Add item</button>
          <ActionButton className={styles.primary} pendingLabel="Creating…" disabled={!customers.length || !variants.some((variant) => variant.availableStock > 0)}>Create order</ActionButton>
        </div>
        {state.message && <p role="alert" className={`${styles.collectionFeedback} ${state.success ? styles.success : ""}`}>{state.message}</p>}
      </form>
    </details>
  );
}
