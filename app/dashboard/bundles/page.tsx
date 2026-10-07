import Link from "next/link";

import style from "../../components/dashboard.module.css";
import {
  retailRequest,
} from "@/lib/quitmed-retail-admin/collections/client";

type Bundle = {
  id: string;
  name: string;
  sku: string;
  price: string | number;
  product?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  bundleDropdowns?: Array<{
    id: string;
    position: number;
    name: string;
    options?: Array<{
      id: string;
      componentVariant?: {
        id: string;
        name: string;
        sku: string;
        price: string | number;
        product?: {
          id: string;
          name: string;
          slug: string;
        } | null;
      } | null;
    }>;
  }>;
};

type BundlesResponse =
  | Bundle[]
  | {
      data?: Bundle[];
      count?: number;
      pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    };

function getBundles(
  response: BundlesResponse,
): Bundle[] {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response.data)) {
    return response.data;
  }

  return [];
}

function displayPrice(
  price: string | number | null | undefined,
): string {
  const value = Number(price);

  if (!Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(value);
}

function getOptionCount(
  bundle: Bundle,
): number {
  return (
    bundle.bundleDropdowns?.reduce(
      (total, dropdown) =>
        total + (dropdown.options?.length ?? 0),
      0,
    ) ?? 0
  );
}

export default async function BundlesPage() {
  const response =
    await retailRequest<BundlesResponse>(
      "/products/bundles?fields=id,name,sku,price&productFields=id,name",
      {
        method: "GET",
        cache: "no-store",
      },
    );

  const bundles = getBundles(response);

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
            className={style.customerHeaderLine}
          />

          <h1>Bundles</h1>

          <p>
            Manage your product bundles and
            their component selections.
          </p>
        </div>

        <div
          className={style.customerHeaderActions}
        >
          <Link
            href="/dashboard/bundles/create"
            className={style.primary}
          >
            Create bundle
          </Link>
        </div>
      </div>

      <section className={style.card}>
        <div className={style.addressHeader}>
          <div>
            <h2>All bundles</h2>

            <p>
              {bundles.length === 0
                ? "No bundles found"
                : `${bundles.length} bundle${
                    bundles.length === 1
                      ? ""
                      : "s"
                  }`}
            </p>
          </div>
        </div>

        {bundles.length === 0 ? (
          <div className={style.addressEmpty}>
            <span>
              There are no product bundles yet.
            </span>

            <Link
              href="/dashboard/bundles/create"
              className={style.secondary}
            >
              Create bundle
            </Link>
          </div>
        ) : (
          <div className={style.addressList}>
            {bundles.map((bundle) => {
              const dropdownCount =
                bundle.bundleDropdowns
                  ?.length ?? 0;

              const optionCount =
                getOptionCount(bundle);

              return (
                <div
                  key={bundle.id}
                  className={style.addressCard}
                >
                  <div
                    className={
                      style.addressCardHeader
                    }
                  >
                    <div>
                      <strong>
                        {bundle.name}
                      </strong>

                      <div
                        className={
                          style.customerAddressPhone
                        }
                      >
                        SKU: {bundle.sku}
                      </div>
                    </div>

                    <strong>
                      {displayPrice(
                        bundle.price,
                      )}
                    </strong>
                  </div>

                  <div
                    className={
                      style.customerAddressText
                    }
                  >
                    <div>
                      Product:{" "}
                      {bundle.product?.name ??
                        "—"}
                    </div>

                    <div>
                      Selections:{" "}
                      {dropdownCount}
                    </div>

                    <div>
                      Options:{" "}
                      {optionCount}
                    </div>
                  </div>

                  <div
                    className={
                      style.customerHeaderActions
                    }
                  >
                    <Link
                      href={`/dashboard/bundles/view?id=${encodeURIComponent(
                        bundle.id,
                      )}`}
                      className={
                        style.secondary
                      }
                    >
                      View
                    </Link>

                    <Link
                      href={`/dashboard/bundles/edit?id=${encodeURIComponent(
                        bundle.id,
                      )}`}
                      className={style.primary}
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}