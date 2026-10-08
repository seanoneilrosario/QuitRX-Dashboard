import Link from "next/link";
import { notFound } from "next/navigation";

import style from "../../../components/dashboard.module.css";

import { retailRequest } from "../../../../lib/quitmed-retail-admin/collections/client";
import ProductEdit from "../products-component/ProductEdit";

type ProductEditPageProps = {
  searchParams: Promise<{
    id?: string;
  }>;
};

type RetailRecord = Record<string, unknown>;

async function getProduct(id: string) {
  return retailRequest<{
    data: RetailRecord;
  }>(
    `/products/${encodeURIComponent(id)}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );
}

async function getAttributes() {
  return retailRequest<RetailRecord[]>(
    "/attributes",
    {
      method: "GET",
      cache: "no-store",
    },
  );
}

async function getProductAttributes(id: string) {
  return retailRequest<RetailRecord[]>(
    `/products/${encodeURIComponent(id)}/attributes`,
    {
      method: "GET",
      cache: "no-store",
    },
  );
}

async function getTags() {
  return retailRequest<unknown>(
    "/tags?page=1&limit=100",
    {
      method: "GET",
      cache: "no-store",
    },
  );
}

function getRecords(value: unknown): RetailRecord[] {
  if (Array.isArray(value)) {
    return value as RetailRecord[];
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const record = value as RetailRecord;

    if (Array.isArray(record.data)) {
      return record.data as RetailRecord[];
    }
  }

  return [];
}

export default async function ProductEditPage({
  searchParams,
}: ProductEditPageProps) {
  const params = await searchParams;

  if (!params.id) {
    notFound();
  }

  try {
    const [
      productResponse,
      attributes,
      productAttributes,
      tagsResponse,
    ] = await Promise.all([
      getProduct(params.id),
      getAttributes(),
      getProductAttributes(params.id),
      getTags(),
    ]);

    const product = productResponse.data;

    return (
      <>
        <div className={style.pageHeader}>
          <div>
            <div className={style.eyebrow}>
              PRODUCT
            </div>

            <h1>
            Edit product: <span className={style.prodTitle}>{String(product.name ?? "Unnamed product")}</span>
            </h1>

            <p>
            Update product descriptions,
            tags and metafields.
            </p>
          </div>

          <Link
            href="/dashboard/products"
            className={style.secondary}
          >
            Back to products
          </Link>
        </div>

        <ProductEdit
          product={product}
          attributes={attributes}
          productAttributes={productAttributes}
          tags={getRecords(tagsResponse)}
        />
      </>
    );
  } catch (error) {
    console.error(
      "[ProductEditPage] Failed to load product:",
      error,
    );

    notFound();
  }
}