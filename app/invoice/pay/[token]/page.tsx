import type { Metadata } from "next";
import {
  getPublicInvoice,
  PublicInvoiceError,
  type PublicInvoice,
} from "@/lib/quitmed-retail-admin/invoices/public-client";
import PaymentButton from "./payment-button";
import styles from "./invoice-payment.module.css";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Invoice payment",
  robots: { index: false, follow: false, noarchive: true, nocache: true },
};

const payableStatuses = new Set(["UNPAID", "PARTIALLY_PAID"]);

function money(value: string | number, currencyCode: string) {
  const amount = typeof value === "number" ? value : Number(value);
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: currencyCode || "AUD",
  }).format(Number.isFinite(amount) ? amount : 0);
}

function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? value
    : new Intl.DateTimeFormat("en-AU", { dateStyle: "long" }).format(parsed);
}

function Brand() {
  return (
    <div className={styles.brand} aria-label="QuitRX">
      <span aria-hidden="true">Q</span>
      <strong>QuitRX</strong>
    </div>
  );
}

function InvoiceDetails({ invoice }: { invoice: PublicInvoice }) {
  const rows = [
    ["Subtotal", invoice.subtotal],
    ["Discount", invoice.discountTotal],
    ["Shipping fee", invoice.shippingTotal],
    ["GST", invoice.taxTotal],
  ] as const;

  return (
    <>
      <div className={styles.invoiceMeta}>
        <div>
          <span>Invoice number</span>
          <strong>{invoice.invoiceNumber}</strong>
        </div>
        <div>
          <span>Order number</span>
          <strong>{invoice.orderNumber}</strong>
        </div>
        <div>
          <span>Invoice date</span>
          <strong>{date(invoice.invoiceDate)}</strong>
        </div>
        <div>
          <span>Payment status</span>
          <strong
            className={`${styles.status} ${styles[`status${invoice.paymentStatus.replaceAll("_", "")}`] ?? ""}`}
          >
            {invoice.paymentStatus.replaceAll("_", " ")}
          </strong>
        </div>
      </div>

      <div className={styles.amounts}>
        {rows.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{money(value, invoice.currencyCode)}</strong>
          </div>
        ))}
        <div className={styles.total}>
          <span>Total amount</span>
          <strong>{money(invoice.total, invoice.currencyCode)}</strong>
        </div>
        <div>
          <span>Amount already paid</span>
          <strong>{money(invoice.amountPaid, invoice.currencyCode)}</strong>
        </div>
        <div className={styles.outstanding}>
          <span>Outstanding balance</span>
          <strong>
            {money(invoice.outstandingBalance, invoice.currencyCode)}
          </strong>
        </div>
      </div>
    </>
  );
}

export default async function InvoicePaymentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let invoice: PublicInvoice;

  try {
    invoice = await getPublicInvoice(token);
  } catch (error) {
    const message =
      error instanceof PublicInvoiceError
        ? error.message
        : "We could not load this invoice. Please try again shortly.";

    return (
      <main className={styles.page}>
        <section className={styles.errorCard}>
          <Brand />
          <div className={styles.errorIcon} aria-hidden="true">
            !
          </div>
          <h1>Invoice unavailable</h1>
          <p>{message}</p>
          <p>
            Please use the latest link from your invoice email or contact QuitRX
            support.
          </p>
        </section>
      </main>
    );
  }

  const isPaid =
    invoice.paymentStatus === "PAID" || Number(invoice.outstandingBalance) <= 0;
  const isPending = invoice.paymentStatus === "PENDING";
  const canPay =
    !isPaid &&
    !isPending &&
    (payableStatuses.has(invoice.paymentStatus) ||
      ((invoice.paymentStatus === "FAILED" ||
        invoice.paymentStatus === "CANCELLED") &&
        invoice.canRetryPayment === true));

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <Brand />
          <span>Secure invoice payment</span>
        </header>

        <section className={styles.card}>
          <div className={styles.heading}>
            <div>
              <p>Invoice</p>
              <h1>Payment details</h1>
            </div>
            <span className={styles.currency}>{invoice.currencyCode}</span>
          </div>

          <InvoiceDetails invoice={invoice} />

          {isPaid && (
            <div className={styles.success} role="status">
              <strong>Payment complete</strong>
              <span>
                This invoice has been paid in full. No further payment is
                required.
              </span>
            </div>
          )}

          {isPending && (
            <div className={styles.pending} role="status">
              <strong>Payment is being verified</strong>
              <span>
                Please wait while QuitRX confirms the transaction. Do not submit
                another payment.
              </span>
            </div>
          )}

          {canPay && <PaymentButton token={token} />}

          {!canPay && !isPaid && !isPending && (
            <div className={styles.pending} role="status">
              <strong>Payment is currently unavailable</strong>
              <span>Please contact QuitRX support before trying again.</span>
            </div>
          )}
        </section>

        <footer className={styles.support}>
          <strong>Need help with this invoice?</strong>
          <span>
            Contact {invoice.companyName || "QuitRX"}
            {invoice.supportEmail ? (
              <>
                {" "}
                at{" "}
                <a href={`mailto:${invoice.supportEmail}`}>
                  {invoice.supportEmail}
                </a>
              </>
            ) : null}
            {invoice.supportPhone ? (
              <>
                {" "}
                or{" "}
                <a href={`tel:${invoice.supportPhone}`}>
                  {invoice.supportPhone}
                </a>
              </>
            ) : null}
            .
          </span>
        </footer>
      </div>
    </main>
  );
}
