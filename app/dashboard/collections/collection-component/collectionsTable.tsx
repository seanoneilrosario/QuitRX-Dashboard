import Link from "next/link";

import Table from "@/app/components/table";
import styles from "@/app/components/dashboard.module.css";

import type {
  RetailRecord,
} from "@/lib/quitmed-retail-admin/collections/client";

function text(
  value: unknown,
  fallback = "—",
) {
  return typeof value === "string" ||
    typeof value === "number"
    ? String(value)
    : fallback;
}

function collectionType(value: unknown) {
  const type = text(value, "MANUAL");

  return type === "DYNAMIC"
    ? "Dynamic"
    : "Manual";
}

type CollectionsTableProps = {
  data: RetailRecord[];
  returnTo: string;
};

export default function CollectionsTable({
  data,
  returnTo,
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

        const viewHref = collectionId
          ? `/dashboard/collections/view?id=${encodeURIComponent(
              collectionId,
            )}&returnTo=${encodeURIComponent(returnTo)}`
          : "";

        const editHref = collectionId
          ? `/dashboard/collections/edit?id=${encodeURIComponent(
              collectionId,
            )}&returnTo=${encodeURIComponent(returnTo)}`
          : "";

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
                    <Link href={viewHref}>
                      View
                    </Link>

                    <Link href={editHref}>
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