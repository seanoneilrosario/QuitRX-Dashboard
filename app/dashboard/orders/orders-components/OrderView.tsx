import Link from "next/link";

import type { Order } from "../../../../lib/quitmed-retail-admin/orders/client";

import style from "../../../components/dashboard.module.css";
import OrderDeleteButton from "./OrderDeleteButton";

function displayValue(value: unknown, fallback = "—") {
  if (value === null || value === undefined) {
    return fallback;
  }

  const text = String(value).trim();

  return text || fallback;
}

function displayMoney(
  value: string | number | null | undefined,
  currency = "AUD",
) {
  if (value === null || value === undefined) {
    return "—";
  }

  const amount = Number(value);

  if (Number.isNaN(amount)) {
    return "—";
  }

  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
  }).format(amount);
}

function displayDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function statusLabel(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function customerName(order: Order) {
  const firstName = order.customer?.firstName ?? "";
  const lastName = order.customer?.lastName ?? "";

  const name = `${firstName} ${lastName}`.trim();

  return name || "Guest customer";
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={style.customerDetailRow}>
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

export default function OrderView({
  order,
}: {
  order: Order;
}) {
  const itemQuantity = order.items.reduce(
    (total, item) => total + item.quantity,
    0,
  );

  return (
    <>
      <div
        className={`${style.pageHeader} ${style.customerPageHeader}`}
      >
        <div>
          <div className={style.eyebrow}>
            QUITRX OPERATIONS
          </div>

          <div className={style.customerHeaderLine} />

          <h1>{displayValue(order.orderNumber)}</h1>

          <p>
            {customerName(order)} ·{" "}
            {displayValue(order.customer?.email)}
          </p>
        </div>

        <div className={style.customerHeaderActions}>
          <Link
            href="/dashboard/orders"
            className={style.secondary}
          >
            ← Back to orders
          </Link>
          <OrderDeleteButton orderId={order.id} />
        </div>
      </div>

      <div
        className={`${style.detailGrid} ${style.customerDetailGrid}`}
      >
        <section
          className={`${style.card} ${style.customerCard}`}
        >
          <h2>Order information</h2>

          <div>
            <DetailRow label="Order ID">
              {displayValue(order.id)}
            </DetailRow>

            <DetailRow label="Order number">
              {displayValue(order.orderNumber)}
            </DetailRow>

            <DetailRow label="Source">
              {displayValue(order.source)}
            </DetailRow>

            <DetailRow label="Source order ID">
              {displayValue(order.sourceOrderId)}
            </DetailRow>

            <DetailRow label="Order status">
              {statusLabel(order.status)}
            </DetailRow>

            <DetailRow label="Payment status">
              {statusLabel(order.paymentStatus)}
            </DetailRow>

            <DetailRow label="Fulfillment status">
              {statusLabel(order.fulfillmentStatus)}
            </DetailRow>

            <DetailRow label="Shipment status">
              {statusLabel(order.shipmentStatus)}
            </DetailRow>

            <DetailRow label="Created">
              {displayDate(order.createdAt)}
            </DetailRow>

            <DetailRow label="Updated">
              {displayDate(order.updatedAt)}
            </DetailRow>
          </div>
        </section>

        <section
          className={`${style.card} ${style.customerCard}`}
        >
          <h2>Customer</h2>

          <div>
            <DetailRow label="Name">
              {customerName(order)}
            </DetailRow>

            <DetailRow label="Email">
              {displayValue(order.customer?.email)}
            </DetailRow>

            <DetailRow label="Customer ID">
              {displayValue(order.customerId)}
            </DetailRow>
          </div>
        </section>
      </div>

      <section
        className={`${style.card} ${style.customerCard}`}
      >
        <h2>Items</h2>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>
                  Product
                </th>

                <th style={{ textAlign: "left" }}>
                  Variant
                </th>

                <th style={{ textAlign: "left" }}>
                  SKU
                </th>

                <th style={{ textAlign: "right" }}>
                  Quantity
                </th>

                <th style={{ textAlign: "right" }}>
                  Unit price
                </th>

                <th style={{ textAlign: "right" }}>
                  Total
                </th>
              </tr>
            </thead>

            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {displayValue(item.productName)}
                  </td>

                  <td>
                    {displayValue(item.variantName)}
                  </td>

                  <td>
                    {displayValue(item.sku)}
                  </td>

                  <td style={{ textAlign: "right" }}>
                    {item.quantity}
                  </td>

                  <td style={{ textAlign: "right" }}>
                    {displayMoney(
                      item.unitPrice,
                      order.currencyCode,
                    )}
                  </td>

                  <td style={{ textAlign: "right" }}>
                    {displayMoney(
                      item.total,
                      order.currencyCode,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <DetailRow label="Total items">
            {itemQuantity}
          </DetailRow>
        </div>
      </section>

      <div
        className={`${style.detailGrid} ${style.customerDetailGrid}`}
      >
        <section
          className={`${style.card} ${style.customerCard}`}
        >
          <h2>Billing address</h2>

          <div>
            <DetailRow label="Name">
              {[
                order.billingFirstName,
                order.billingLastName,
              ]
                .filter(Boolean)
                .join(" ") || "—"}
            </DetailRow>

            <DetailRow label="Company">
              {displayValue(order.billingCompany)}
            </DetailRow>

            <DetailRow label="Address">
              {displayValue(order.billingAddress1)}
            </DetailRow>

            <DetailRow label="Address 2">
              {displayValue(order.billingAddress2)}
            </DetailRow>

            <DetailRow label="City">
              {displayValue(order.billingCity)}
            </DetailRow>

            <DetailRow label="Province">
              {displayValue(order.billingProvince)}
            </DetailRow>

            <DetailRow label="Country">
              {displayValue(order.billingCountry)}
            </DetailRow>

            <DetailRow label="Postcode">
              {displayValue(order.billingZip)}
            </DetailRow>

            <DetailRow label="Phone">
              {displayValue(order.billingPhone)}
            </DetailRow>
          </div>
        </section>

        <section
          className={`${style.card} ${style.customerCard}`}
        >
          <h2>Shipping address</h2>

          <div>
            <DetailRow label="Name">
              {[
                order.shippingFirstName,
                order.shippingLastName,
              ]
                .filter(Boolean)
                .join(" ") || "—"}
            </DetailRow>

            <DetailRow label="Company">
              {displayValue(order.shippingCompany)}
            </DetailRow>

            <DetailRow label="Address">
              {displayValue(order.shippingAddress1)}
            </DetailRow>

            <DetailRow label="Address 2">
              {displayValue(order.shippingAddress2)}
            </DetailRow>

            <DetailRow label="City">
              {displayValue(order.shippingCity)}
            </DetailRow>

            <DetailRow label="Province">
              {displayValue(order.shippingProvince)}
            </DetailRow>

            <DetailRow label="Country">
              {displayValue(order.shippingCountry)}
            </DetailRow>

            <DetailRow label="Postcode">
              {displayValue(order.shippingZip)}
            </DetailRow>

            <DetailRow label="Phone">
              {displayValue(order.shippingPhone)}
            </DetailRow>
          </div>
        </section>
      </div>

      <section
        className={`${style.card} ${style.customerCard}`}
      >
        <h2>Financials</h2>

        <div>
          <DetailRow label="Currency">
            {displayValue(order.currencyCode)}
          </DetailRow>

          <DetailRow label="Subtotal">
            {displayMoney(
              order.subtotal,
              order.currencyCode,
            )}
          </DetailRow>

          <DetailRow label="Discount">
            {displayMoney(
              order.discountTotal,
              order.currencyCode,
            )}
          </DetailRow>

          <DetailRow label="Shipping">
            {displayMoney(
              order.shippingTotal,
              order.currencyCode,
            )}
          </DetailRow>

          <DetailRow label="Shipping method">
            {displayValue(order.shippingMethod)}
          </DetailRow>

          <DetailRow label="Tax">
            {displayMoney(
              order.taxTotal,
              order.currencyCode,
            )}
          </DetailRow>

          <DetailRow label="Total">
            {displayMoney(
              order.total,
              order.currencyCode,
            )}
          </DetailRow>
        </div>
      </section>

      <section
        className={`${style.card} ${style.customerCard}`}
      >
        <h2>Integration references</h2>

        <div>
          <DetailRow label="Qoblex invoice ID">
            {displayValue(order.qoblexInvoiceId)}
          </DetailRow>

          <DetailRow label="Starshipit order ID">
            {displayValue(order.starshipitOrderId)}
          </DetailRow>
        </div>
      </section>
    </>
  );
}