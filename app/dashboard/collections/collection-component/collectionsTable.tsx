import Link from "next/link";

import Table from "@/app/components/table";
import styles from "@/app/components/dashboard.module.css";
import { RetailRecord } from "@/lib/quitmed-retail-admin/collections/client";

function text(value: unknown, fallback = "—") {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : fallback;
}

function collectionType(value: unknown) {
  const type = text(value, "MANUAL");

  return type === "DYNAMIC" ? "Dynamic" : "Manual";
}

type CollectionsTableProps = {
  data: RetailRecord[];
};

export default function CollectionsTable({
  data,
}: CollectionsTableProps) {
  return (
    <Table
      heads={[
        "Collection",
        "Slug",
        "Type",
        "Match",
        "Products",
        "Actions",
      ]}
    >
      {data.map((item, index) => {
        const collectionId = text(item.id, "");

        return (
          <tr
            key={
              collectionId ||
              `collection-${index}`
            }
          >
            <td>
              <div className={styles.collectionCell}>
                {typeof item.image === "string" &&
                item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className={styles.collectionThumbnail}
                    src={item.image}
                    alt=""
                  />
                ) : null}

                <div>
                  <strong>
                    {text(
                      item.name,
                      "Unnamed collection",
                    )}
                  </strong>

                  <small>
                    {collectionType(item.type)}
                  </small>
                </div>
              </div>
            </td>

            <td>{text(item.slug)}</td>

            <td>{collectionType(item.type)}</td>

            <td>{text(item.match)}</td>

            <td>{text(item.productCount, "0")}</td>

            <td>
              <div className={styles.actions}>
                {collectionId ? (
                  <>
                    <Link
                      href={`/dashboard/collections/view?id=${encodeURIComponent(
                        collectionId,
                      )}`}
                    >
                      View
                    </Link>

                    <Link
                      href={`/dashboard/collections/edit?id=${encodeURIComponent(
                        collectionId,
                      )}`}
                    >
                      Edit
                    </Link>
                  </>
                ) : null}
              </div>
            </td>
          </tr>
        );
      })}
    </Table>
  );
}