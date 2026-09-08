import { retailRequest, safeRetailAll } from "@/lib/quithero-admin";
import { bundleComponentResponse, type BundleComponent } from "@/lib/product-bundles";
import BundleEditor, { type BundleProduct, type BundleVariant } from "./bundle-editor";
import BundleVariantPicker from "./bundle-variant-picker";
import styles from "./dashboard.module.css";

export default async function BundlesPage({ variantId }: { variantId: string }) {
  // Keep these reads sequential so opening this page does not burst through the
  // QuitHero API's per-client rate limit.
  const bundleProductResult = await safeRetailAll("/products?tags=bundle");
  const productResult = await safeRetailAll("/products");
  const variantResult = await safeRetailAll("/product-variants");
  const products: BundleProduct[] = productResult.data.flatMap((product) => typeof product.id === "string" ? [{
    id: product.id,
    label: typeof product.name === "string" && product.name ? product.name : product.id,
  }] : []);
  const bundleProductIds = new Set(bundleProductResult.data.flatMap((product) => typeof product.id === "string" ? [product.id] : []));
  const bundleProducts = products.filter((product) => bundleProductIds.has(product.id));
  const productNames = new Map(products.map((product) => [product.id, product.label]));
  const variants: BundleVariant[] = variantResult.data.flatMap((v) => typeof v.id === "string" && typeof v.productId === "string" ? [{
    id: v.id, productId: v.productId,
    label: typeof v.name === "string" && v.name ? v.name : typeof v.sku === "string" && v.sku ? v.sku : v.id,
    sku: typeof v.sku === "string" ? v.sku : "",
    productLabel: productNames.get(v.productId) ?? v.productId,
  }] : []);
  const selectedParent = variants.find((variant) => variant.id === variantId && bundleProductIds.has(variant.productId));
  const groupVariants = selectedParent ? variants.filter((variant) => variant.productId === selectedParent.productId) : [];
  const error = bundleProductResult.error ?? productResult.error ?? variantResult.error;
  const groups: Array<{ parent: BundleVariant; components: BundleComponent[]; error?: string }> = [];
  if (!error) {
    for (const parent of groupVariants) {
      try {
        const response = await retailRequest<unknown>(`/products/${encodeURIComponent(parent.productId)}/variants/${encodeURIComponent(parent.id)}/bundle`);
        groups.push({ parent, components: bundleComponentResponse(response, parent.id) });
      } catch (cause) {
        groups.push({ parent, components: [], error: cause instanceof Error ? cause.message : "Unable to load bundle group." });
      }
    }
  }
  return <>
    <header className={styles.pageHeader}><div><p className={styles.eyebrow}>QuitRX operations</p><h1>Bundles</h1><p>Configure the fixed products and quantities included in each bundle group.</p></div></header>
    <BundleVariantPicker key={variantId} products={bundleProducts} variants={variants} variantId={variantId} disabled={Boolean(bundleProductResult.error ?? productResult.error ?? variantResult.error)}/>
    {error ? <p role="alert" className={styles.notice}>{error} Reload this page to try again.</p> : groups.length ? groups.map((group, index) => group.error ? <p key={group.parent.id} role="alert" className={styles.notice}>Group {index + 1} ({group.parent.label}): {group.error}</p> : <BundleEditor key={group.parent.id} parent={group.parent} groupNumber={index + 1} products={products} variants={variants} bundleProductIds={[...bundleProductIds]} initial={group.components}/>) : <p className={styles.notice}>{variantId ? "The selected bundle product has no groups." : bundleProducts.length ? "Select a bundle product to configure all of its fixed groups." : "No products tagged bundle are available."}</p>}
  </>;
}
