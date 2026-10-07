import Link from "next/link";
import { notFound } from "next/navigation";

import style from "../../../components/dashboard.module.css";

import {
  getProductBundle,
  type Bundle,
} from "@/lib/quitmed-retail-admin/bundles/client";
import DeleteBundleButton from "../bundles-component/DeleteBundleButton";

type BundleViewPageProps = {
  searchParams: Promise<{
    id?: string;
  }>;
};

function displayValue(
  value: unknown,
  fallback = "—",
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  return String(value);
}

function displayMoney(value: unknown) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "—";
  }

  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(amount);
}

function displayBoolean(value: unknown) {
  return value === true ? "Yes" : "No";
}

function displayDate(value: unknown) {
  if (!value) {
    return "—";
  }

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
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

export default async function BundleViewPage({
  searchParams,
}: BundleViewPageProps) {
  const params = await searchParams;

  if (!params.id) {
    notFound();
  }

  let bundle: Bundle;

  try {
    bundle = await getProductBundle(
      params.id,
    );
  } catch (error) {
    console.error(
      "[BundleViewPage] Failed to load bundle:",
      error,
    );

    notFound();
  }

  console.log(bundle)

  const dropdowns = [
    ...bundle.bundleDropdowns,
  ].sort(
    (a, b) => a.position - b.position,
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

          <div
            className={
              style.customerHeaderLine
            }
          />

          <h1>{bundle.name}</h1>

          <p>
            SKU: {displayValue(bundle.sku)}
          </p>
        </div>

        <div className={style.customerHeaderActions}>
          <Link
            className={style.primary}
            href="/dashboard/bundles"
          >
            ← Back to bundles
          </Link>

          <Link
            href={`/dashboard/bundles/edit?id=${encodeURIComponent(
              bundle.id,
            )}`}
            className={style.primary}
          >
            Edit bundle
          </Link>

          <DeleteBundleButton
            productId={bundle.productId}
            variantId={bundle.id}
          />
        </div>
      </div>

      <div
        className={`${style.detailGrid} ${style.customerDetailGrid}`}
      >
        <section
          className={`${style.card} ${style.customerCard}`}
        >
          <h2>Bundle information</h2>

          <div>
            <DetailRow label="Bundle ID">
              {bundle.id}
            </DetailRow>

            <DetailRow label="SKU">
              {displayValue(bundle.sku)}
            </DetailRow>

            <DetailRow label="Supplier SKU">
              {displayValue(
                bundle.supplierSku,
              )}
            </DetailRow>

            <DetailRow label="Price">
              {displayMoney(bundle.price)}
            </DetailRow>

            <DetailRow label="Cost">
              {displayMoney(bundle.cost)}
            </DetailRow>

            <DetailRow label="Inventory">
              {displayValue(
                bundle.inventory,
                "0",
              )}
            </DetailRow>

            <DetailRow label="Allocated inventory">
              {displayValue(
                bundle.allocatedInventory,
                "0",
              )}
            </DetailRow>

            <DetailRow label="Incoming inventory">
              {displayValue(
                bundle.incomingInventory,
                "0",
              )}
            </DetailRow>

            <DetailRow label="Requires shipping">
              {displayBoolean(
                bundle.requiresShipping,
              )}
            </DetailRow>
          </div>
        </section>

        <section
          className={`${style.card} ${style.customerCard}`}
        >
          <h2>System information</h2>

          <div>
            <DetailRow label="Product ID">
              {bundle.productId}
            </DetailRow>

            <DetailRow label="Source system">
              {displayValue(
                bundle.sourceSystem,
              )}
            </DetailRow>

            <DetailRow label="Source ID">
              {displayValue(
                bundle.sourceId,
              )}
            </DetailRow>

            <DetailRow label="Created">
              {displayDate(
                bundle.createdAt,
              )}
            </DetailRow>

            <DetailRow label="Last updated">
              {displayDate(
                bundle.updatedAt,
              )}
            </DetailRow>

            <DetailRow label="Last synced">
              {displayDate(
                bundle.lastSyncedAt,
              )}
            </DetailRow>
          </div>
        </section>
      </div>

      <section
        className={`${style.card} ${style.customerCard}`}
      >
        <div className={style.addressHeader}>
          <div>
            <h2>Bundle selections</h2>

            <p>
              {dropdowns.length} selection
              {dropdowns.length === 1
                ? ""
                : "s"}
            </p>
          </div>
        </div>

        <div>
          {dropdowns.map((dropdown) => (
            <section
              key={dropdown.id}
              className={style.card}
              style={{
                marginTop: "1rem",
              }}
            >
              <div
                className={
                  style.addressHeader
                }
              >
                <div>
                  <h2>
                    {dropdown.name}
                  </h2>

                  <p>
                    {dropdown.options.length}{" "}
                    option
                    {dropdown.options
                      .length === 1
                      ? ""
                      : "s"}
                  </p>
                </div>
              </div>

              <div>
                {dropdown.options.map(
                  (option) => {
                    const variant =
                      option.componentVariant;

                    const product =
                      variant.product;

                    return (
                      <div
                        key={option.id}
                        className={
                          style.customerDetailRow
                        }
                      >
                        <div>
                          <strong>
                            {displayValue(
                              variant.name,
                            )}
                          </strong>

                          <div>
                            {displayValue(
                              product?.name,
                            )}
                          </div>

                          <small>
                            SKU:{" "}
                            {displayValue(
                              variant.sku,
                            )}
                          </small>
                        </div>

                        <strong>
                          {displayMoney(
                            variant.price,
                          )}
                        </strong>
                      </div>
                    );
                  },
                )}
              </div>
            </section>
          ))}
        </div>
      </section>

      <div
        className={style.customerBackLink}
      >
        <Link href="/dashboard/bundles">
          ← Back to bundles
        </Link>
      </div>
    </>
  );
}