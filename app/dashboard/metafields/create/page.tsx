import Link from "next/link";

import style from "../../../components/dashboard.module.css";
import CreateMetafield from "../metafield-components/CreateMetafield";

export default function CreateMetafieldPage() {
  return (
    <div>
      <header className={style.pageHeader}>
        <div>
          <p className={style.eyebrow}>QUITRX OPERATIONS</p>
          <h1>Create metafield</h1>
          <p>
            Create a custom product field that can be assigned
            to products and used as a storefront filter.
          </p>
        </div>

        <Link
          href="/dashboard/metafields"
          className={style.secondary}
        >
          Back to metafields
        </Link>
      </header>

      <CreateMetafield />
    </div>
  );
}