import { retailRequest, safeRetailAll } from "@/lib/quithero-admin";
import { bundleComponents, type BundleComponent } from "@/lib/product-bundles";
import BundleEditor, { type BundleVariant } from "./bundle-editor";
import BundleVariantPicker from "./bundle-variant-picker";
import styles from "./dashboard.module.css";

export default async function BundlesPage({ variantId }: { variantId: string }) {
  const result = await safeRetailAll("/product-variants");
  const variants: BundleVariant[] = result.data.flatMap((v) => typeof v.id === "string" && typeof v.productId === "string" ? [{
    id: v.id, productId: v.productId,
    label: [v.name || v.id, v.sku].filter(Boolean).join(" · "),
  }] : []);
  const parent = variants.find((v) => v.id === variantId);
  let error = result.error;
  let components: BundleComponent[] = [];
  if (!error && parent) {
    try {
      const response = await retailRequest<unknown>(`/products/${encodeURIComponent(parent.productId)}/variants/${encodeURIComponent(parent.id)}/bundle`);
      const data = response && typeof response === "object" && !Array.isArray(response) && "data" in response ? response.data : response;
      components = bundleComponents(data, parent.id);
    } catch (cause) { error = cause instanceof Error ? cause.message : "Unable to load bundle."; }
  } else if (!error && variantId) error = "The selected variant was not found.";
  return <>
    <header className={styles.pageHeader}><div><p className={styles.eyebrow}>QuitRX operations</p><h1>Bundles</h1><p>Manage the component variants and quantities included in a product bundle.</p></div></header>
    <BundleVariantPicker key={variantId} variants={variants} variantId={variantId} disabled={Boolean(result.error)}/>
    {error ? <p role="alert" className={styles.notice}>{error} Reload this page to try again.</p> : parent ? <BundleEditor key={parent.id} parent={parent} variants={variants} initial={components}/> : <p className={styles.notice}>{variants.length ? "Select a variant to create or edit its bundle." : "Create a product variant before setting up a bundle."}</p>}
  </>;
}
