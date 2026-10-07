import { notFound } from "next/navigation";

import { getProductBundle } from "../../../../lib/quitmed-retail-admin/bundles/client";
import BundleEditor from "../bundles-component/BundleEditor";

type PageProps = {
  searchParams: Promise<{
    id?: string;
  }>;
};

export default async function BundleEditPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const variantId = params.id;

  if (!variantId) {
    notFound();
  }

  let bundle;

  try {
    bundle = await getProductBundle(variantId);
    console.log(bundle)
  } catch (error) {
    console.error("[bundle-edit] failed to load bundle", error);
    notFound();
  }

  return <BundleEditor bundle={bundle} />;
}