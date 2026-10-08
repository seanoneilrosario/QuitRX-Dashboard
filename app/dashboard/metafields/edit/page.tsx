import Link from "next/link";
import { notFound } from "next/navigation";

import style from "../../../components/dashboard.module.css";

import { getAttribute } from "../../../../lib/quitmed-retail-admin/attributes/client";
import EditMetafield from "../metafield-components/EditMetafield";

type EditMetafieldPageProps = {
  searchParams: Promise<{
    id?: string;
  }>;
};

export default async function EditMetafieldPage({
  searchParams,
}: EditMetafieldPageProps) {
  const params = await searchParams;

  if (!params.id) {
    notFound();
  }

  let attribute;

  try {
    attribute = await getAttribute(params.id);
  } catch (error) {
    console.error(
      "[EditMetafieldPage] Failed to load metafield:",
      error,
    );

    notFound();
  }

  return (
    <>
      <div className={style.pageHeader}>
        <div>
          <div className={style.eyebrow}>
            QUITRX OPERATIONS
          </div>

          <h1>Edit metafield</h1>

          <p>
            Update the metafield definition and
            storefront behaviour.
          </p>
        </div>

        <Link
          href="/dashboard/metafields"
          className={style.secondary}
        >
          Back to metafields
        </Link>
      </div>

      <EditMetafield attribute={attribute} />
    </>
  );
}