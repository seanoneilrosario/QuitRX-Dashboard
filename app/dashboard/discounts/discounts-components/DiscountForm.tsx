
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import styles from "./discounts.module.css";

import type {
  BuyXGetYBenefit,
  Discount,
  DiscountMethod,
  DiscountPayload,
  DiscountScope,
} from "@/lib/quitmed-retail-admin/discounts/types";

import {
  createDiscountAction,
  updateDiscountAction,
} from "@/lib/quitmed-retail-admin/discounts/discount-actions";

import {
  searchDiscountProductOptionsAction,
  searchDiscountVariantOptionsAction,
} from "@/lib/quitmed-retail-admin/discounts/product-actions";

import type {
  EligibilityOption,
} from "@/lib/quitmed-retail-admin/discounts/eligibility-actions";
import ProductPicker, { ProductOption } from "./ProductPicker";
import CustomerPicker from "./CustomerPicker";
import SegmentPicker from "./SegmentPicker";


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
};

function datetimeLocalValue(value?: string | null): string {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  );

  return localDate.toISOString().slice(0, 16);
}

function relationIds(
  items?: Array<{
    productId?: string;
    variantId?: string;
    customerId?: string;
    segmentId?: string;
  }>,
  key?: "productId" | "variantId" | "customerId" | "segmentId",
): string[] {
  if (!items || !key) return [];

  return Array.from(
    new Set(
      items
        .map((item) => item[key])
        .filter((id): id is string => Boolean(id)),
    ),
  );
}

function parseIds(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,;]/)
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  );
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

function initialProductOptions(
  discount?: Discount,
): ProductOption[] {
  const options = new Map<string, ProductOption>();

  for (const item of discount?.products ?? []) {
    const id = item.productId ?? item.product?.id;

    if (!id) continue;

    const label =
      item.product?.name ??
      item.product?.title ??
      item.name ??
      `Product ${id}`;

    options.set(id, { id, label });
  }

  for (const item of discount?.productAssignments ?? []) {
    if (!options.has(item.productId)) {
      options.set(item.productId, {
        id: item.productId,
        label: `Product ${item.productId}`,
      });
    }
  }

  return Array.from(options.values());
}

function mergeProductOptions(
  current: ProductOption[],
  incoming: ProductOption[],
): ProductOption[] {
  const options = new Map<string, ProductOption>();

  for (const item of [...current, ...incoming]) {
    options.set(item.id, item);
  }

  return Array.from(options.values());
}

function productIdsForRole(
  discount: Discount | undefined,
  role: "APPLIES_TO" | "BUY_X" | "GET_Y",
): string[] {
  const assignments = [
    ...(discount?.products ?? []),
    ...(discount?.productAssignments ?? []),
  ];

  return Array.from(
    new Set(
      assignments
        .filter((item) => (item.role ?? "APPLIES_TO") === role)
        .map((item) => item.productId)
        .filter((id): id is string => Boolean(id)),
    ),
  );
}

function variantAssignmentsForRole(
  discount: Discount | undefined,
  role: "APPLIES_TO" | "BUY_X" | "GET_Y",
): string[] {
  const assignments = [
    ...(discount?.variants ?? []),
    ...(discount?.variantAssignments ?? []),
  ] as unknown as Array<Record<string, unknown>>;

  return Array.from(
    new Set(
      assignments
        .filter(
          (item) => (item.role ?? "APPLIES_TO") === role,
        )
        .map((item) => {
          if (typeof item.variantId === "string") {
            return item.variantId;
          }

          const variant = item.variant;

          if (
            variant &&
            typeof variant === "object" &&
            "id" in variant &&
            typeof variant.id === "string"
          ) {
            return variant.id;
          }

          return "";
        })
        .filter(Boolean),
    ),
  );
}

function initialVariantOptions(
  discount?: Discount,
): ProductOption[] {
  const assignments = [
    ...(discount?.variants ?? []),
    ...(discount?.variantAssignments ?? []),
  ] as unknown as Array<Record<string, unknown>>;

  const options = new Map<string, ProductOption>();

  for (const assignment of assignments) {
    const variant =
      assignment.variant &&
      typeof assignment.variant === "object"
        ? (assignment.variant as Record<string, unknown>)
        : {};

    const product =
      variant.product &&
      typeof variant.product === "object"
        ? (variant.product as Record<string, unknown>)
        : {};

    const id =
      typeof assignment.variantId === "string"
        ? assignment.variantId
        : typeof variant.id === "string"
          ? variant.id
          : "";

    if (!id) continue;

    const productName =
      typeof product.name === "string"
        ? product.name
        : "";

    const variantName =
      typeof variant.name === "string"
        ? variant.name
        : `Variant ${id}`;

    const sku =
      typeof variant.sku === "string"
        ? variant.sku
        : "";

    options.set(id, {
      id,
      label: [
        productName,
        variantName,
        sku ? `SKU: ${sku}` : "",
      ]
        .filter(Boolean)
        .join(" — "),
    });
  }

  return Array.from(options.values());
}

function hasProductOrVariantAssignments(
  discount?: Discount,
): boolean {
  return Boolean(
    (discount?.products?.length ?? 0) > 0 ||
      (discount?.variants?.length ?? 0) > 0 ||
      (discount?.productAssignments?.length ?? 0) > 0 ||
      (discount?.variantAssignments?.length ?? 0) > 0,
  );
}

function getObject(
  value: unknown,
): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") return undefined;

  return value as Record<string, unknown>;
}

function getString(
  value: unknown,
): string | undefined {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : undefined;
}

function initialEligibilityOptions(
  items: unknown,
  kind: "customer" | "segment",
): EligibilityOption[] {
  if (!Array.isArray(items)) return [];

  const options = new Map<string, EligibilityOption>();

  for (const value of items) {
    const item = getObject(value);

    if (!item) continue;

    const relatedRecord = getObject(item[kind]);

    const id =
      getString(item[kind === "customer" ? "customerId" : "segmentId"]) ??
      getString(relatedRecord?.id);

    if (!id) continue;

    let label: string;

    if (kind === "customer") {
      const firstName = getString(relatedRecord?.firstName);
      const lastName = getString(relatedRecord?.lastName);
      const email = getString(relatedRecord?.email);

      const fullName = [firstName, lastName]
        .filter(Boolean)
        .join(" ");

      label = fullName
        ? email
          ? `${fullName} (${email})`
          : fullName
        : email ?? `Customer ${id}`;
    } else {
      label =
        getString(relatedRecord?.name) ??
        `Segment ${id}`;
    }

    options.set(id, { id, label });
  }

  return Array.from(options.values());
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
    maxDiscountAmount:
      discount?.maxDiscountAmount == null
        ? ""
        : String(discount.maxDiscountAmount),
    minSubtotal:
      discount?.minSubtotal == null
        ? ""
        : String(discount.minSubtotal),
    minQuantity:
      discount?.minQuantity == null
        ? ""
        : String(discount.minQuantity),
    startsAt: datetimeLocalValue(discount?.startsAt),
    endsAt: datetimeLocalValue(discount?.endsAt),
    usageLimit:
      discount?.usageLimit == null
        ? ""
        : String(discount.usageLimit),
    perCustomerUsageLimit:
      discount?.perCustomerUsageLimit == null
        ? ""
        : String(discount.perCustomerUsageLimit),
    buyQuantity:
      discount?.buyQuantity == null
        ? ""
        : String(discount.buyQuantity),
    getQuantity:
      discount?.getQuantity == null
        ? ""
        : String(discount.getQuantity),
    getDiscountType: discount?.getDiscountType ?? "FREE",
    getDiscountValue:
      discount?.getDiscountValue == null
        ? ""
        : String(discount.getDiscountValue),
    priority:
      discount?.priority == null
        ? "0"
        : String(discount.priority),
    combineWithProductDiscounts:
      discount?.combineWithProductDiscounts ?? false,
    combineWithOrderDiscounts:
      discount?.combineWithOrderDiscounts ?? false,
    combineWithShippingDiscounts:
      discount?.combineWithShippingDiscounts ?? false,
  };
}

export default function DiscountForm({
  mode,
  initialDiscount,
}: Props) {
  const [form, setForm] = useState<FormState>(() =>
    initialState(initialDiscount),
  );

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Product search and selection state.
  const [productOptions, setProductOptions] = useState<ProductOption[]>(
    [],
  );

  const [knownProductOptions, setKnownProductOptions] = useState<
    ProductOption[]
  >(() => initialProductOptions(initialDiscount));

  const [productSearch, setProductSearch] = useState("");
  const [productPage, setProductPage] = useState(1);
  const [productHasMore, setProductHasMore] = useState(false);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productOptionsError, setProductOptionsError] = useState<
    string | null
  >(null);

  const [variantOptions, setVariantOptions] =
    useState<ProductOption[]>([]);

  const [knownVariantOptions, setKnownVariantOptions] =
    useState<ProductOption[]>(() =>
      initialVariantOptions(initialDiscount),
    );

  const [variantSearch, setVariantSearch] = useState("");
  const [variantPage, setVariantPage] = useState(1);
  const [variantHasMore, setVariantHasMore] = useState(false);

  const [loadingMoreVariants, setLoadingMoreVariants] =
    useState(false);

  const [variantsLoading, setVariantsLoading] =
    useState(true);

  const [variantOptionsError, setVariantOptionsError] =
    useState<string | null>(null);

  const [selectedVariantIds, setSelectedVariantIds] =
    useState<string[]>(() =>
      variantAssignmentsForRole(initialDiscount, "APPLIES_TO"),
    );

  const [selectedBuyVariantIds, setSelectedBuyVariantIds] =
    useState<string[]>(() =>
      variantAssignmentsForRole(initialDiscount, "BUY_X"),
    );

  const [selectedGetVariantIds, setSelectedGetVariantIds] =
    useState<string[]>(() =>
      variantAssignmentsForRole(initialDiscount, "GET_Y"),
    );

  const [targetingMode, setTargetingMode] = useState<
    "PRODUCTS" | "VARIANTS"
  >(() => {
    const hasProducts =
      (initialDiscount?.products?.length ?? 0) > 0 ||
      (initialDiscount?.productAssignments?.length ?? 0) > 0;

    const hasVariants =
      (initialDiscount?.variants?.length ?? 0) > 0 ||
      (initialDiscount?.variantAssignments?.length ?? 0) > 0;

    if (hasProducts && !hasVariants) return "PRODUCTS";

    return "VARIANTS";
  });

  const selectableVariantOptions = useMemo(
    () => mergeProductOptions(knownVariantOptions, variantOptions),
    [knownVariantOptions, variantOptions],
  );

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(
    () => productIdsForRole(initialDiscount, "APPLIES_TO"),
  );

  const [selectedBuyProductIds, setSelectedBuyProductIds] = useState<
    string[]
  >(() => productIdsForRole(initialDiscount, "BUY_X"));

  const [selectedGetProductIds, setSelectedGetProductIds] = useState<
    string[]
  >(() => productIdsForRole(initialDiscount, "GET_Y"));

  const [applyToAllProducts, setApplyToAllProducts] = useState(
    () => !hasProductOrVariantAssignments(initialDiscount),
  );

  // Customer and segment selections use ID arrays, not text fields.
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>(
    () => relationIds(initialDiscount?.customers, "customerId"),
  );

  const [selectedSegmentIds, setSelectedSegmentIds] = useState<string[]>(
    () => relationIds(initialDiscount?.segments, "segmentId"),
  );

  const router = useRouter();

  const isBuyXGetY = form.method === "BUY_X_GET_Y";
  const isFreeShipping = form.method === "FREE_SHIPPING";

  const initialCustomerOptions = useMemo(
    () =>
      initialEligibilityOptions(
        initialDiscount?.customers,
        "customer",
      ),
    [initialDiscount],
  );

  const initialSegmentOptions = useMemo(
    () =>
      initialEligibilityOptions(
        initialDiscount?.segments,
        "segment",
      ),
    [initialDiscount],
  );

  const numericValueLabel = useMemo(() => {
    if (form.method === "PERCENTAGE") return "Discount percentage";
    if (form.method === "FIXED_AMOUNT") return "Fixed discount amount";
    if (form.method === "BUY_X_GET_Y") {
      return "Not used for Buy X Get Y";
    }

    return "Not used for free shipping";
  }, [form.method]);

  // Search products on the server, returning one page at a time.
  useEffect(() => {
    let cancelled = false;

    setProductsLoading(true);
    setProductOptionsError(null);

    const timer = window.setTimeout(async () => {
      try {
        const result = await searchDiscountProductOptionsAction(
          productSearch,
          1,
        );

        if (cancelled) return;

        if (!result.success) {
          setProductOptionsError(
            result.message ?? "Unable to load products.",
          );
          setProductOptions([]);
          setProductHasMore(false);
          return;
        }

        setProductOptions(result.data);

        setKnownProductOptions((current) =>
          mergeProductOptions(current, result.data),
        );

        setProductPage(result.page);
        setProductHasMore(result.hasMore);
      } catch (requestError) {
        if (!cancelled) {
          setProductOptionsError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load products.",
          );

          setProductOptions([]);
          setProductHasMore(false);
        }
      } finally {
        if (!cancelled) {
          setProductsLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [productSearch]);

  useEffect(() => {
    let cancelled = false;

    setVariantsLoading(true);
    setVariantOptionsError(null);

    const timer = window.setTimeout(async () => {
      try {
        const result = await searchDiscountVariantOptionsAction(
          variantSearch,
          1,
        );

        if (cancelled) return;

        if (!result.success) {
          setVariantOptionsError(
            result.message ?? "Unable to load variants.",
          );

          setVariantOptions([]);
          setVariantHasMore(false);
          return;
        }

        setVariantOptions(result.data);

        setKnownVariantOptions((current) =>
          mergeProductOptions(current, result.data),
        );

        setVariantPage(result.page);
        setVariantHasMore(result.hasMore);
      } catch (error) {
        if (!cancelled) {
          setVariantOptionsError(
            error instanceof Error
              ? error.message
              : "Unable to load variants.",
          );

          setVariantOptions([]);
          setVariantHasMore(false);
        }
      } finally {
        if (!cancelled) {
          setVariantsLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [variantSearch]);

  async function loadMoreVariants() {
    if (!variantHasMore || loadingMoreVariants) return;

    setLoadingMoreVariants(true);
    setVariantOptionsError(null);

    try {
      const result = await searchDiscountVariantOptionsAction(
        variantSearch,
        variantPage + 1,
      );

      if (!result.success) {
        setVariantOptionsError(
          result.message ?? "Unable to load more variants.",
        );
        return;
      }

      setVariantOptions((current) =>
        mergeProductOptions(current, result.data),
      );

      setKnownVariantOptions((current) =>
        mergeProductOptions(current, result.data),
      );

      setVariantPage(result.page);
      setVariantHasMore(result.hasMore);
    } catch (error) {
      setVariantOptionsError(
        error instanceof Error
          ? error.message
          : "Unable to load more variants.",
      );
    } finally {
      setLoadingMoreVariants(false);
    }
  }

  async function loadMoreProducts() {
    if (
      !productHasMore ||
      loadingMoreProducts ||
      productsLoading
    ) {
      return;
    }

    setLoadingMoreProducts(true);
    setProductOptionsError(null);

    try {
      const result = await searchDiscountProductOptionsAction(
        productSearch,
        productPage + 1,
      );

      if (!result.success) {
        setProductOptionsError(
          result.message ?? "Unable to load more products.",
        );
        return;
      }

      setProductOptions((current) =>
        mergeProductOptions(current, result.data),
      );

      setKnownProductOptions((current) =>
        mergeProductOptions(current, result.data),
      );

      setProductPage(result.page);
      setProductHasMore(result.hasMore);
    } catch (requestError) {
      setProductOptionsError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load more products.",
      );
    } finally {
      setLoadingMoreProducts(false);
    }
  }

  function setField<K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleMethodChange(method: DiscountMethod) {
    setForm((current) => ({
      ...current,
      method,
      scope:
        method === "FREE_SHIPPING"
          ? "SHIPPING"
          : method === "BUY_X_GET_Y"
            ? "PRODUCT"
            : current.scope,
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

      value:
        isBuyXGetY || isFreeShipping
          ? null
          : optionalNumber(form.value),

      maxDiscountAmount: optionalNumber(form.maxDiscountAmount),
      minSubtotal: optionalNumber(form.minSubtotal),
      minQuantity: optionalInteger(form.minQuantity),

      startsAt: form.startsAt
        ? new Date(form.startsAt).toISOString()
        : null,

      endsAt: form.endsAt
        ? new Date(form.endsAt).toISOString()
        : null,

      usageLimit: optionalInteger(form.usageLimit),
      perCustomerUsageLimit: optionalInteger(
        form.perCustomerUsageLimit,
      ),

      buyQuantity: isBuyXGetY
        ? optionalInteger(form.buyQuantity)
        : null,

      getQuantity: isBuyXGetY
        ? optionalInteger(form.getQuantity)
        : null,

      getDiscountType: isBuyXGetY
        ? form.getDiscountType
        : null,

      getDiscountValue:
        isBuyXGetY && form.getDiscountType !== "FREE"
          ? optionalNumber(form.getDiscountValue)
          : null,

      priority: optionalInteger(form.priority) ?? 0,

      combineWithProductDiscounts:
        form.combineWithProductDiscounts,

      combineWithOrderDiscounts:
        form.combineWithOrderDiscounts,

      combineWithShippingDiscounts:
        form.combineWithShippingDiscounts,

      customerIds: selectedCustomerIds,
      segmentIds: selectedSegmentIds,
    };

    if (form.isAutomatic) {
      payload.code = null;
    }

    if (form.scope === "PRODUCT") {
      if (isBuyXGetY) {
        if (targetingMode === "VARIANTS") {
          payload.productAssignments = [];

          payload.variantAssignments = [
            ...selectedBuyVariantIds.map((variantId) => ({
              variantId,
              role: "BUY_X" as const,
            })),
            ...selectedGetVariantIds.map((variantId) => ({
              variantId,
              role: "GET_Y" as const,
            })),
          ];
        } else {
          payload.productAssignments = [
            ...selectedBuyProductIds.map((productId) => ({
              productId,
              role: "BUY_X" as const,
            })),
            ...selectedGetProductIds.map((productId) => ({
              productId,
              role: "GET_Y" as const,
            })),
          ];

          payload.variantAssignments = [];
        }
      } else if (targetingMode === "VARIANTS") {
        payload.productAssignments = [];

        payload.variantAssignments = applyToAllProducts
          ? []
          : selectedVariantIds.map((variantId) => ({
              variantId,
              role: "APPLIES_TO" as const,
            }));
      } else {
        payload.productAssignments = applyToAllProducts
          ? []
          : selectedProductIds.map((productId) => ({
              productId,
              role: "APPLIES_TO" as const,
            }));

        payload.variantAssignments = [];
      }
    }

    return payload;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError("Enter a discount name.");
      return;
    }

    if (!form.isAutomatic && !form.code.trim()) {
      setError(
        "Enter a discount code, or enable automatic discount.",
      );
      return;
    }

    if (form.method === "PERCENTAGE") {
      const percentage = Number(form.value);

      if (
        !form.value.trim() ||
        !Number.isFinite(percentage) ||
        percentage <= 0 ||
        percentage > 100
      ) {
        setError(
          "Percentage must be greater than 0 and no more than 100.",
        );
        return;
      }
    }

    if (form.method === "FIXED_AMOUNT") {
      const amount = Number(form.value);

      if (
        !form.value.trim() ||
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        setError(
          "Enter a fixed discount amount greater than zero.",
        );
        return;
      }
    }

    if (
      isBuyXGetY &&
      (
        !form.buyQuantity.trim() ||
        !form.getQuantity.trim() ||
        Number(form.buyQuantity) < 1 ||
        Number(form.getQuantity) < 1
      )
    ) {
      setError(
        "Buy quantity and get quantity must both be at least 1.",
      );
      return;
    }

    if (
      isBuyXGetY &&
      form.getDiscountType !== "FREE"
    ) {
      const benefitValue = Number(form.getDiscountValue);

      if (
        !form.getDiscountValue.trim() ||
        !Number.isFinite(benefitValue) ||
        benefitValue <= 0
      ) {
        setError(
          "Enter a Get-item discount value greater than zero.",
        );
        return;
      }

      if (
        form.getDiscountType === "PERCENTAGE" &&
        benefitValue > 100
      ) {
        setError(
          "The Get-item percentage cannot exceed 100.",
        );
        return;
      }
    }

    if (form.scope === "PRODUCT") {
      if (targetingMode === "VARIANTS") {
        if (variantsLoading) {
          setError("Wait for the variant list to finish loading.");
          return;
        }

        if (variantOptionsError) {
          setError(
            "Variants could not be loaded. Refresh the page and try again.",
          );
          return;
        }
      } else {
        if (productsLoading) {
          setError("Wait for the product list to finish loading.");
          return;
        }

        if (productOptionsError) {
          setError(
            "Products could not be loaded. Refresh the page and try again.",
          );
          return;
        }
      }

      if (isBuyXGetY) {
        const buySelection =
          targetingMode === "VARIANTS"
            ? selectedBuyVariantIds
            : selectedBuyProductIds;

        const getSelection =
          targetingMode === "VARIANTS"
            ? selectedGetVariantIds
            : selectedGetProductIds;

        if (buySelection.length === 0) {
          setError(
            targetingMode === "VARIANTS"
              ? "Select at least one Buy variant."
              : "Select at least one Buy product.",
          );
          return;
        }

        if (getSelection.length === 0) {
          setError(
            targetingMode === "VARIANTS"
              ? "Select at least one Get variant."
              : "Select at least one Get product.",
          );
          return;
        }
      } else if (!applyToAllProducts) {
        const selection =
          targetingMode === "VARIANTS"
            ? selectedVariantIds
            : selectedProductIds;

        if (selection.length === 0) {
          setError(
            targetingMode === "VARIANTS"
              ? "Select at least one variant, or enable Apply to all products."
              : "Select at least one product, or enable Apply to all products.",
          );
          return;
        }
      }
    }

    let payload: DiscountPayload;

    try {
      payload = buildPayload();
    } catch {
      setError("Check the start and end date values.");
      return;
    }

    setIsSaving(true);

    try {
      const result =
        mode === "create"
          ? await createDiscountAction(payload)
          : await updateDiscountAction(
              initialDiscount!.id,
              payload,
            );

      if (!result.success) {
        setError(
          result.message ?? `Unable to ${mode} discount.`,
        );
        return;
      }

      router.replace("/dashboard/discounts");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : `Unable to ${mode} discount.`,
      );
    } finally {
      setIsSaving(false);
    }
  }

  const productControlsDisabled = isSaving;

  return (
    <form
      className={`${styles.panel} ${styles.formPanel}`}
      onSubmit={handleSubmit}
    >
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {/* Discount details */}
      <section className={styles.formSection}>
        <h2 className={styles.sectionTitle}>
          Discount details
        </h2>

        <p className={styles.sectionDescription}>
          Choose how this promotion is named, redeemed and calculated.
        </p>

        <div className={styles.formGrid}>
          <div className={`${styles.field} ${styles.fullWidth}`}>
            <label
              className={styles.label}
              htmlFor="discount-name"
            >
              Discount name *
            </label>

            <input
              id="discount-name"
              className={styles.input}
              value={form.name}
              maxLength={120}
              required
              onChange={(event) =>
                setField("name", event.target.value)
              }
            />
          </div>

          <div className={`${styles.field} ${styles.fullWidth}`}>
            <label
              className={styles.label}
              htmlFor="discount-description"
            >
              Description
            </label>

            <textarea
              id="discount-description"
              className={styles.textarea}
              value={form.description}
              onChange={(event) =>
                setField("description", event.target.value)
              }
            />
          </div>

          <div className={styles.field}>
            <label
              className={styles.label}
              htmlFor="discount-method"
            >
              Discount method *
            </label>

            <select
              id="discount-method"
              className={styles.select}
              value={form.method}
              onChange={(event) =>
                handleMethodChange(
                  event.target.value as DiscountMethod,
                )
              }
            >
              <option value="PERCENTAGE">Percentage</option>
              <option value="FIXED_AMOUNT">Fixed amount</option>
              <option value="BUY_X_GET_Y">Buy X Get Y</option>
              <option value="FREE_SHIPPING">Free shipping</option>
            </select>
          </div>

          <div className={styles.field}>
            <label
              className={styles.label}
              htmlFor="discount-scope"
            >
              Discount scope *
            </label>

            <select
              id="discount-scope"
              className={styles.select}
              value={form.scope}
              onChange={(event) =>
                setField(
                  "scope",
                  event.target.value as DiscountScope,
                )
              }
            >
              <option value="ORDER">Order</option>
              <option value="PRODUCT">Product</option>
              <option value="SHIPPING">Shipping</option>
            </select>

            <span className={styles.help}>
              Free shipping normally uses Shipping scope; Buy X Get Y
              normally uses Product scope.
            </span>
          </div>

          {!isBuyXGetY && !isFreeShipping && (
            <div className={styles.field}>
              <label
                className={styles.label}
                htmlFor="discount-value"
              >
                {numericValueLabel} *
              </label>

              <input
                id="discount-value"
                className={styles.input}
                type="number"
                min="0.01"
                step="0.01"
                value={form.value}
                required
                onChange={(event) =>
                  setField("value", event.target.value)
                }
              />

              {form.method === "PERCENTAGE" && (
                <span className={styles.help}>
                  Enter a percentage from 0 to 100.
                </span>
              )}
            </div>
          )}

          <div className={styles.field}>
            <label
              className={styles.label}
              htmlFor="discount-max"
            >
              Maximum discount amount
            </label>

            <input
              id="discount-max"
              className={styles.input}
              type="number"
              min="0"
              step="0.01"
              value={form.maxDiscountAmount}
              onChange={(event) =>
                setField("maxDiscountAmount", event.target.value)
              }
            />
          </div>

          {isBuyXGetY && (
            <>
              <div className={styles.field}>
                <label
                  className={styles.label}
                  htmlFor="buy-quantity"
                >
                  Buy quantity *
                </label>

                <input
                  id="buy-quantity"
                  className={styles.input}
                  type="number"
                  min="1"
                  step="1"
                  value={form.buyQuantity}
                  required
                  onChange={(event) =>
                    setField("buyQuantity", event.target.value)
                  }
                />
              </div>

              <div className={styles.field}>
                <label
                  className={styles.label}
                  htmlFor="get-quantity"
                >
                  Get quantity *
                </label>

                <input
                  id="get-quantity"
                  className={styles.input}
                  type="number"
                  min="1"
                  step="1"
                  value={form.getQuantity}
                  required
                  onChange={(event) =>
                    setField("getQuantity", event.target.value)
                  }
                />
              </div>

              <div className={styles.field}>
                <label
                  className={styles.label}
                  htmlFor="get-discount-type"
                >
                  Benefit on Get items *
                </label>

                <select
                  id="get-discount-type"
                  className={styles.select}
                  value={form.getDiscountType}
                  onChange={(event) =>
                    setField(
                      "getDiscountType",
                      event.target.value as BuyXGetYBenefit,
                    )
                  }
                >
                  <option value="FREE">Free</option>
                  <option value="PERCENTAGE">Percentage off</option>
                  <option value="FIXED_AMOUNT">Fixed amount off</option>
                </select>
              </div>

              {form.getDiscountType !== "FREE" && (
                <div className={styles.field}>
                  <label
                    className={styles.label}
                    htmlFor="get-discount-value"
                  >
                    Get-item discount value *
                  </label>

                  <input
                    id="get-discount-value"
                    className={styles.input}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.getDiscountValue}
                    required
                    onChange={(event) =>
                      setField(
                        "getDiscountValue",
                        event.target.value,
                      )
                    }
                  />
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Product eligibility */}
      {form.scope === "PRODUCT" && (
        <section className={styles.formSection}>
          <h2 className={styles.sectionTitle}>
            Product eligibility
          </h2>

          <p className={styles.sectionDescription}>
            Choose whether this discount targets entire products or specific variants.
          </p>

          <div className={styles.formGrid}>
            <label className={styles.checkboxRow}>
              <input
                type="radio"
                name="discount-targeting-mode"
                checked={targetingMode === "VARIANTS"}
                disabled={productControlsDisabled}
                onChange={() => {
                  setTargetingMode("VARIANTS");
                  setApplyToAllProducts(false);
                }}
              />
              <span>
                <strong>Specific variants</strong>
                <br />
                Select individual product variants for this discount.
              </span>
            </label>

            <label className={styles.checkboxRow}>
              <input
                type="radio"
                name="discount-targeting-mode"
                checked={targetingMode === "PRODUCTS"}
                disabled={productControlsDisabled}
                onChange={() => {
                  setTargetingMode("PRODUCTS");
                  setApplyToAllProducts(false);
                }}
              />
              <span>
                <strong>Entire products</strong>
                <br />
                Select products instead of individual variants.
              </span>
            </label>
          </div>

          {targetingMode === "VARIANTS" && (
            <>
              {variantsLoading && (
                <p className={styles.help}>Loading variants…</p>
              )}

              {variantOptionsError && (
                <div className={styles.error} role="alert">
                  {variantOptionsError}
                </div>
              )}
            </>
          )}

          {targetingMode === "PRODUCTS" && (
            <>
              {productsLoading && (
                <p className={styles.help}>Loading products…</p>
              )}

              {productOptionsError && (
                <div className={styles.error} role="alert">
                  {productOptionsError}
                </div>
              )}
            </>
          )}

          {!isBuyXGetY && (
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={applyToAllProducts}
                disabled={productControlsDisabled}
                onChange={(event) => {
                  const checked = event.target.checked;

                  setApplyToAllProducts(checked);

                  if (checked) {
                    setSelectedProductIds([]);
                    setSelectedVariantIds([]);
                  }
                }}
              />

              <span>
                <strong>Apply to all products</strong>
                <br />
                When enabled, no specific product or variant restriction is applied.
              </span>
            </label>
          )}

          {/* Regular percentage and fixed discounts */}
          {!isBuyXGetY &&
            !applyToAllProducts &&
            targetingMode === "VARIANTS" && (
              <ProductPicker
                id="discount-variants"
                label="Eligible variants"
                selectedIds={selectedVariantIds}
                options={variantOptions}
                knownOptions={selectableVariantOptions}
                search={variantSearch}
                onSearchChange={setVariantSearch}
                disabled={productControlsDisabled}
                isLoading={variantsLoading}
                hasMore={variantHasMore}
                loadingMore={loadingMoreVariants}
                error={variantOptionsError}
                onLoadMore={loadMoreVariants}
                onChange={setSelectedVariantIds}
              />
            )}

          {!isBuyXGetY &&
            !applyToAllProducts &&
            targetingMode === "PRODUCTS" && (
              <ProductPicker
                id="discount-products"
                label="Eligible products"
                selectedIds={selectedProductIds}
                options={productOptions}
                knownOptions={knownProductOptions}
                search={productSearch}
                onSearchChange={setProductSearch}
                disabled={productControlsDisabled}
                isLoading={productsLoading}
                hasMore={productHasMore}
                loadingMore={loadingMoreProducts}
                error={productOptionsError}
                onLoadMore={loadMoreProducts}
                onChange={setSelectedProductIds}
              />
            )}

          {/* Buy X Get Y targeting specific variants */}
          {isBuyXGetY && targetingMode === "VARIANTS" && (
            <>
              <ProductPicker
                id="buy-variants"
                label="Buy variants"
                selectedIds={selectedBuyVariantIds}
                options={variantOptions}
                knownOptions={selectableVariantOptions}
                search={variantSearch}
                onSearchChange={setVariantSearch}
                disabled={productControlsDisabled}
                isLoading={variantsLoading}
                hasMore={variantHasMore}
                loadingMore={loadingMoreVariants}
                error={variantOptionsError}
                onLoadMore={loadMoreVariants}
                onChange={setSelectedBuyVariantIds}
              />

              <ProductPicker
                id="get-variants"
                label="Get variants"
                selectedIds={selectedGetVariantIds}
                options={variantOptions}
                knownOptions={selectableVariantOptions}
                search={variantSearch}
                onSearchChange={setVariantSearch}
                disabled={productControlsDisabled}
                isLoading={variantsLoading}
                hasMore={variantHasMore}
                loadingMore={loadingMoreVariants}
                error={variantOptionsError}
                onLoadMore={loadMoreVariants}
                onChange={setSelectedGetVariantIds}
              />
            </>
          )}

          {/* Buy X Get Y targeting entire products */}
          {isBuyXGetY && targetingMode === "PRODUCTS" && (
            <>
              <ProductPicker
                id="buy-products"
                label="Buy products"
                selectedIds={selectedBuyProductIds}
                options={productOptions}
                knownOptions={knownProductOptions}
                search={productSearch}
                onSearchChange={setProductSearch}
                disabled={productControlsDisabled}
                isLoading={productsLoading}
                hasMore={productHasMore}
                loadingMore={loadingMoreProducts}
                error={productOptionsError}
                onLoadMore={loadMoreProducts}
                onChange={setSelectedBuyProductIds}
              />

              <ProductPicker
                id="get-products"
                label="Get products"
                selectedIds={selectedGetProductIds}
                options={productOptions}
                knownOptions={knownProductOptions}
                search={productSearch}
                onSearchChange={setProductSearch}
                disabled={productControlsDisabled}
                isLoading={productsLoading}
                hasMore={productHasMore}
                loadingMore={loadingMoreProducts}
                error={productOptionsError}
                onLoadMore={loadMoreProducts}
                onChange={setSelectedGetProductIds}
              />
            </>
          )}

          <p className={styles.help}>
            Saving a product-scope discount replaces its existing product and
            variant assignments with the selections above.
          </p>
        </section>
      )}

      {/* Eligibility and limits */}
      <section className={styles.formSection}>
        <h2 className={styles.sectionTitle}>
          Eligibility and limits
        </h2>

        <p className={styles.sectionDescription}>
          Configure the discount code, eligible customers and segments,
          dates, and usage limits.
        </p>

        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label
              className={styles.label}
              htmlFor="discount-code"
            >
              Discount code
            </label>

            <input
              id="discount-code"
              className={styles.input}
              value={form.code}
              disabled={form.isAutomatic}
              placeholder="e.g. WELCOME10"
              onChange={(event) =>
                setField(
                  "code",
                  event.target.value.toUpperCase().replace(/\s/g, ""),
                )
              }
            />

            <span className={styles.help}>
              Automatic discounts do not send a code to the API.
            </span>
          </div>

          <div className={styles.field}>
            <label
              className={styles.label}
              htmlFor="discount-priority"
            >
              Priority
            </label>

            <input
              id="discount-priority"
              className={styles.input}
              type="number"
              step="1"
              value={form.priority}
              onChange={(event) =>
                setField("priority", event.target.value)
              }
            />
          </div>

          <div className={styles.field}>
            <label
              className={styles.label}
              htmlFor="minimum-subtotal"
            >
              Minimum subtotal
            </label>

            <input
              id="minimum-subtotal"
              className={styles.input}
              type="number"
              min="0"
              step="0.01"
              value={form.minSubtotal}
              onChange={(event) =>
                setField("minSubtotal", event.target.value)
              }
            />
          </div>

          <div className={styles.field}>
            <label
              className={styles.label}
              htmlFor="minimum-quantity"
            >
              Minimum quantity
            </label>

            <input
              id="minimum-quantity"
              className={styles.input}
              type="number"
              min="1"
              step="1"
              value={form.minQuantity}
              onChange={(event) =>
                setField("minQuantity", event.target.value)
              }
            />
          </div>

          <div className={styles.field}>
            <label
              className={styles.label}
              htmlFor="usage-limit"
            >
              Total usage limit
            </label>

            <input
              id="usage-limit"
              className={styles.input}
              type="number"
              min="1"
              step="1"
              value={form.usageLimit}
              onChange={(event) =>
                setField("usageLimit", event.target.value)
              }
            />
          </div>

          <div className={styles.field}>
            <label
              className={styles.label}
              htmlFor="per-customer-limit"
            >
              Usage limit per customer
            </label>

            <input
              id="per-customer-limit"
              className={styles.input}
              type="number"
              min="1"
              step="1"
              value={form.perCustomerUsageLimit}
              onChange={(event) =>
                setField(
                  "perCustomerUsageLimit",
                  event.target.value,
                )
              }
            />
          </div>

          <div className={styles.field}>
            <label
              className={styles.label}
              htmlFor="starts-at"
            >
              Starts at
            </label>

            <input
              id="starts-at"
              className={styles.input}
              type="datetime-local"
              value={form.startsAt}
              onChange={(event) =>
                setField("startsAt", event.target.value)
              }
            />
          </div>

          <div className={styles.field}>
            <label
              className={styles.label}
              htmlFor="ends-at"
            >
              Ends at
            </label>

            <input
              id="ends-at"
              className={styles.input}
              type="datetime-local"
              value={form.endsAt}
              onChange={(event) =>
                setField("endsAt", event.target.value)
              }
            />
          </div>
        </div>

        <CustomerPicker
          selectedIds={selectedCustomerIds}
          onChange={setSelectedCustomerIds}
          initialOptions={initialCustomerOptions}
          disabled={isSaving}
        />

        <SegmentPicker
          selectedIds={selectedSegmentIds}
          onChange={setSelectedSegmentIds}
          initialOptions={initialSegmentOptions}
          disabled={isSaving}
        />

        <p className={styles.help}>
          Leave both customer and segment selections empty to avoid
          restricting eligibility by those assignments. The backend
          remains responsible for evaluating discount eligibility.
        </p>
      </section>

      {/* Status and combinations */}
      <section className={styles.formSection}>
        <h2 className={styles.sectionTitle}>
          Status and combinations
        </h2>

        <p className={styles.sectionDescription}>
          Only enable combinations when both discounts should be allowed
          to combine.
        </p>

        <div className={styles.checkboxGrid}>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={form.isAutomatic}
              onChange={(event) =>
                setField("isAutomatic", event.target.checked)
              }
            />

            <span>
              <strong>Automatic discount</strong>
              <br />
              Apply without customers entering a code.
            </span>
          </label>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) =>
                setField("isActive", event.target.checked)
              }
            />

            <span>
              <strong>Active</strong>
              <br />
              Allow this discount to be considered by checkout.
            </span>
          </label>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={form.combineWithProductDiscounts}
              onChange={(event) =>
                setField(
                  "combineWithProductDiscounts",
                  event.target.checked,
                )
              }
            />

            <span>Can combine with product discounts</span>
          </label>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={form.combineWithOrderDiscounts}
              onChange={(event) =>
                setField(
                  "combineWithOrderDiscounts",
                  event.target.checked,
                )
              }
            />

            <span>Can combine with order discounts</span>
          </label>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={form.combineWithShippingDiscounts}
              onChange={(event) =>
                setField(
                  "combineWithShippingDiscounts",
                  event.target.checked,
                )
              }
            />

            <span>Can combine with shipping discounts</span>
          </label>
        </div>
      </section>

      {/* Actions */}
      <div className={styles.formFooter}>
        <Link
          className={styles.secondaryButton}
          href="/dashboard/discounts"
        >
          Cancel
        </Link>

        <button
          className={styles.button}
          type="submit"
          disabled={isSaving}
        >
          {isSaving
            ? "Saving…"
            : mode === "create"
              ? "Create discount"
              : "Save changes"}
        </button>
      </div>
    </form>
  );
}
