"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getBundleProducts,
  getBundleProductsCatalog,
  getBundleVariants,
  getBundleConfiguration,
} from "@/app/dashboard/actions";
import BundleEditor, {
  type BundleProduct,
  type BundleVariant,
} from "./bundle-editor";
import BundleVariantPicker from "./bundle-variant-picker";
import styles from "./dashboard.module.css";
import { useState } from "react";

export default function BundlesPage({
  variantId,
}: {
  variantId: string;
}) {
  const [selectedVariantId, setSelectedVariantId] =
    useState(variantId);
  const bundleProductQuery = useQuery({
    queryKey: ["bundle-products"],
    queryFn: async () => {
      console.log("🟣 TANSTACK QUERY FN RUNNING: BUNDLE PRODUCTS");
      return getBundleProducts();
    },
    staleTime: 30_000,
  });

  const productQuery = useQuery({
    queryKey: ["bundle-product-catalog"],
    queryFn: async () => {
      console.log(
        "🟣 TANSTACK QUERY FN RUNNING: BUNDLE PRODUCT CATALOG",
      );
      return getBundleProductsCatalog();
    },
    enabled: !bundleProductQuery.isPending,
    staleTime: 30_000,
  });

  const variantQuery = useQuery({
    queryKey: ["bundle-variants"],
    queryFn: async () => {
      console.log("🟣 TANSTACK QUERY FN RUNNING: BUNDLE VARIANTS");
      return getBundleVariants();
    },
    enabled: !productQuery.isPending,
    staleTime: 30_000,
  });

  const products: BundleProduct[] =
    productQuery.data?.data.flatMap((product) =>
      typeof product.id === "string"
        ? [
            {
              id: product.id,
              label:
                typeof product.name === "string" &&
                product.name
                  ? product.name
                  : product.id,
            },
          ]
        : [],
    ) ?? [];

  const bundleProductIds = new Set(
    bundleProductQuery.data?.data.flatMap((product) =>
      typeof product.id === "string"
        ? [product.id]
        : [],
    ) ?? [],
  );

  const bundleProducts = products.filter((product) =>
    bundleProductIds.has(product.id),
  );

  const productNames = new Map(
    products.map((product) => [
      product.id,
      product.label,
    ]),
  );

  const variants: BundleVariant[] =
    variantQuery.data?.data.flatMap((variant) =>
      typeof variant.id === "string" &&
      typeof variant.productId === "string"
        ? [
            {
              id: variant.id,
              productId: variant.productId,
              label:
                typeof variant.name === "string" &&
                variant.name
                  ? variant.name
                  : typeof variant.sku === "string" &&
                      variant.sku
                    ? variant.sku
                    : variant.id,
              sku:
                typeof variant.sku === "string"
                  ? variant.sku
                  : "",
              productLabel:
                productNames.get(variant.productId) ??
                variant.productId,
            },
          ]
        : [],
    ) ?? [];

  const parent = variants.find(
    (variant) =>
      variant.id === selectedVariantId &&
      bundleProductIds.has(variant.productId),
  );

  const bundleProductError =
    bundleProductQuery.error instanceof Error
      ? bundleProductQuery.error.message
      : undefined;

  const productError =
    productQuery.error instanceof Error
      ? productQuery.error.message
      : undefined;

  const variantError =
    variantQuery.error instanceof Error
      ? variantQuery.error.message
      : undefined;

  const error =
    bundleProductError ??
    productError ??
    variantError;

  const configurationQuery = useQuery({
    queryKey: [
      "bundle-configuration",
      {
        productId: parent?.productId ?? "",
        variantId: parent?.id ?? "",
      },
    ],
    queryFn: async () =>
      getBundleConfiguration(
        parent!.productId,
        parent!.id,
      ),
    enabled: Boolean(parent),
    staleTime: 30_000,
  });

  const configurationError =
    configurationQuery.error instanceof Error
      ? configurationQuery.error.message
      : configurationQuery.data?.error;

  const isLoadingCatalog =
    bundleProductQuery.isPending ||
    productQuery.isPending ||
    variantQuery.isPending;

  const isLoadingConfiguration =
    configurationQuery.isPending ||
    configurationQuery.isFetching;

  const isLoading =
    isLoadingCatalog ||
    isLoadingConfiguration;

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>
            QuitRX operations
          </p>

          <h1>Bundles</h1>

          <p>
            Configure the fixed products and quantities
            included in each bundle group.
          </p>
        </div>
      </header>

      {isLoadingCatalog ? (
        <div
          className={styles.customerLoading}
          aria-live="polite"
          aria-busy="true"
        >
          <div className={styles.customerSpinner} />
          <span>Loading bundles…</span>
        </div>
      ) : (
        <>
          <BundleVariantPicker
            products={bundleProducts}
            variants={variants}
            variantId={selectedVariantId}
            disabled={Boolean(error)}
            onVariantChange={setSelectedVariantId}
          />

          {error ? (
            <p
              role="alert"
              className={styles.notice}
            >
              {error}
            </p>
          ) : configurationError ? (
            <p
              role="alert"
              className={styles.notice}
            >
              {configurationError}
            </p>
          ) : isLoadingConfiguration ? (
            <div
              className={styles.customerLoading}
              aria-live="polite"
              aria-busy="true"
            >
              <div className={styles.customerSpinner} />
              <span>Loading bundle group…</span>
            </div>
          ) : parent && configurationQuery.data ? (
            <BundleEditor
              key={parent.id}
              parent={parent}
              groupNumber={
                variants
                  .filter(
                    (variant) =>
                      variant.productId ===
                      parent.productId,
                  )
                  .findIndex(
                    (variant) =>
                      variant.id === parent.id,
                  ) + 1
              }
              products={products}
              variants={variants}
              bundleProductIds={[
                ...bundleProductIds,
              ]}
              initial={
                configurationQuery.data.data
              }
            />
          ) : (
            <p className={styles.notice}>
              {variantId
                ? "The selected bundle group was not found. Choose another bundle product and group."
                : bundleProducts.length
                  ? "Select a bundle product and group to configure its choices."
                  : "No products tagged bundle are available."}
            </p>
          )}
        </>
      )}
    </>
  );
}