import { retailRequest, safeRetailAll } from "@/lib/quithero-admin";
import { bundleComponentResponse, type BundleComponent } from "@/lib/product-bundles";
import BundleEditor, { type BundleProduct, type BundleVariant } from "./bundle-editor";
import BundleVariantPicker from "./bundle-variant-picker";
import styles from "./dashboard.module.css";

export default async function BundlesPage({ variantId }: { variantId: string }) {
  const [productResult, variantResult] = await Promise.all([safeRetailAll("/products"), safeRetailAll("/product-variants")]);
  const products: BundleProduct[] = productResult.data.flatMap((product) => typeof product.id === "string" ? [{
    id: product.id,
    label: typeof product.name === "string" && product.name ? product.name : product.id,
  }] : []);
  const productNames = new Map(products.map((product) => [product.id, product.label]));
  const variants: BundleVariant[] = variantResult.data.flatMap((v) => typeof v.id === "string" && typeof v.productId === "string" ? [{
    id: v.id, productId: v.productId,
    label: [v.name || v.id, v.sku].filter(Boolean).join(" · "),
    productLabel: productNames.get(v.productId) ?? v.productId,
  }] : []);
  const parent = variants.find((v) => v.id === variantId);
  let error = productResult.error ?? variantResult.error;
  let components: BundleComponent[] = [];
  if (!error && parent) {
    try {
      const response = await retailRequest<unknown>(`/products/${encodeURIComponent(parent.productId)}/variants/${encodeURIComponent(parent.id)}/bundle`);
      components = bundleComponentResponse(response, parent.id);
    } catch (cause) { error = cause instanceof Error ? cause.message : "Unable to load bundle."; }
  } else if (!error && variantId) error = "The selected variant was not found.";
  return <>
    <header className={styles.pageHeader}><div><p className={styles.eyebrow}>QuitRX operations</p><h1>Bundles</h1><p>Manage the component variants and quantities included in a product bundle.</p></div></header>
    <BundleVariantPicker key={variantId} products={products} variants={variants} variantId={variantId} disabled={Boolean(productResult.error ?? variantResult.error)}/>
    {error ? <p role="alert" className={styles.notice}>{error} Reload this page to try again.</p> : parent ? <BundleEditor key={parent.id} parent={parent} products={products} variants={variants} initial={components}/> : <p className={styles.notice}>{variants.length ? "Select a product and bundle variant to create or edit its bundle." : "Create a product variant before setting up a bundle."}</p>}
  </>;
}
