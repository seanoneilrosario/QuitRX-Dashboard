import Link from "next/link";

import style from "../../components/dashboard.module.css";

import {
  getAttributes,
  type Attribute,
} from "../../../lib/quitmed-retail-admin/attributes/client";

function typeLabel(type: Attribute["type"]) {
  switch (type) {
    case "MULTI_SELECT":
      return "Multi-select";
    case "SELECT":
      return "Select";
    case "BOOLEAN":
      return "Boolean";
    case "NUMBER":
      return "Number";
    case "TEXT":
      return "Text";
    default:
      return type;
  }
}

export default async function MetafieldsPage() {
  let attributes: Attribute[] = [];

  try {
    attributes = await getAttributes();
  } catch (error) {
    console.error(
      "[MetafieldsPage] Failed to load metafields:",
      error,
    );
  }

  return (
    <div>
      <header className={style.pageHeader}>
        <div>
          <p className={style.eyebrow}>QUITRX OPERATIONS</p>
          <h1>Filters</h1>
          <p>
            Create custom product fields and manage the values
            available to your products and filters.
          </p>
        </div>

        <Link
          href="/dashboard/metafields/create"
          className={style.primary}
        >
          + Add Product Filter
        </Link>
      </header>

      <section className={style.card}>
        <div className={style.cardTitle}>
          <div>
            <h2>Product metafields</h2>
            <p>
              {attributes.length} metafield
              {attributes.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {attributes.length === 0 ? (
          <p>No metafields have been created yet.</p>
        ) : (
          <div className={style.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Values</th>
                  <th>Filterable</th>
                  <th>Searchable</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {attributes.map((attribute) => (
                  <tr key={attribute.id}>
                    <td>
                      <strong>{attribute.name}</strong>
                      <small>{attribute.slug}</small>
                    </td>

                    <td>
                      {typeLabel(attribute.type)}
                    </td>

                    <td>
                      {attribute.values.length}
                    </td>

                    <td>
                      {attribute.filterable
                        ? "Yes"
                        : "No"}
                    </td>

                    <td>
                      {attribute.searchable
                        ? "Yes"
                        : "No"}
                    </td>

                    <td>
                      {attribute.active
                        ? "Active"
                        : "Inactive"}
                    </td>

                    <td>
                      <Link
                        href={`/dashboard/metafields/edit?id=${encodeURIComponent(
                          attribute.id,
                        )}`}
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}