"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import style from "../../../components/dashboard.module.css";
import type { RetailRecord } from "@/lib/quitmed-retail-admin/collections/client";

import { createCustomerAddressAction, deleteCustomerAction, setDefaultAddressAction } from "../../../../lib/quitmed-retail-admin/customers/customer-actions";

type CustomerViewProps = {
  customer: RetailRecord;
};

function displayValue(input: unknown, fallback = "—"): string {
  if (input === null || input === undefined || input === "") {
    return fallback;
  }

  return String(input);
}

function displayMoney(amount: unknown, currencyCode: unknown): string {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {
    return "—";
  }

  const currency =
    typeof currencyCode === "string" && currencyCode.trim()
      ? currencyCode
      : "AUD";

  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
  }).format(numericAmount);
}

function displayBoolean(input: unknown): string {
  return input === true ? "Yes" : "No";
}

function displayDate(input: unknown): string {
  if (input === null || input === undefined || input === "") {
    return "—";
  }

  const date = new Date(String(input));

  if (Number.isNaN(date.getTime())) {
    return String(input);
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function displayDateTime(input: unknown): string {
  if (input === null || input === undefined || input === "") {
    return "—";
  }

  const date = new Date(String(input));

  if (Number.isNaN(date.getTime())) {
    return String(input);
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function displayTags(tags: unknown): string {
  if (!Array.isArray(tags) || tags.length === 0) {
    return "—";
  }

  return tags.map(String).join(", ");
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className={style.customerDetailRow}>
      {" "}
      <span>{label}</span> <strong>{children}</strong>{" "}
    </div>
  );
}

export default function CustomerView({ customer }: CustomerViewProps) {
  const firstName = displayValue(customer.firstName, "");

  const lastName = displayValue(customer.lastName, "");

  const fullName = `${firstName} ${lastName}`.trim() || "Customer";

  const addresses = Array.isArray(customer.addresses)
    ? (customer.addresses as Array<Record<string, unknown>>)
    : [];

  const [isDeleting, setIsDeleting] = useState(false);

  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [deleteSuccess, setDeleteSuccess] = useState(false);

  const router = useRouter();

  const [isAddingAddress, setIsAddingAddress] =
    useState(false);

  const [
    isAddingAddressSubmitting,
    setIsAddingAddressSubmitting,
  ] = useState(false);

  const [addressError, setAddressError] =
    useState<string | null>(null);

  const [settingDefaultAddress, setSettingDefaultAddress] =
    useState<string | null>(null);

  async function handleSetDefaultAddress(
    addressId: string,
  ) {
    setSettingDefaultAddress(addressId);

    try {
      await setDefaultAddressAction(
        String(customer.id),
        addressId,
      );

      window.location.reload();
    } catch (error) {
      console.error(
        "Failed to set default address:",
        error,
      );

      setAddressError(
        error instanceof Error
          ? error.message
          : "Failed to set default address.",
      );
    } finally {
      setSettingDefaultAddress(null);
    }
  }

  async function handleAddAddress(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setIsAddingAddressSubmitting(true);
    setAddressError(null);

    try {
      const formData = new FormData(
        event.currentTarget,
      );

      await createCustomerAddressAction(
        String(customer.id),
        formData,
      );

      window.location.reload();
    } catch (error) {
      setAddressError(
        error instanceof Error
          ? error.message
          : "Failed to add address.",
      );
    } finally {
      setIsAddingAddressSubmitting(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      "Are you sure you want to delete this customer? This action cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    const result = await deleteCustomerAction(String(customer.id));

    if (!result.success) {
      setDeleteError(result.error ?? "Failed to delete customer.");
      setIsDeleting(false);
      return;
    }

    setDeleteSuccess(true);

    setTimeout(() => {
      router.push("/dashboard/customers");
    }, 1000);
  }

  return (
    <>
      {deleteSuccess && (
        <div className={style.deleteSuccessPopup} role="status">
          Customer deleted successfully.{" "}
        </div>
      )}

      {deleteError && (
        <div className={style.notice} role="alert">
          {deleteError}
        </div>
      )}

      <div className={`${style.pageHeader} ${style.customerPageHeader}`}>
        <div>
          <div className={style.eyebrow}>QUITRX OPERATIONS</div>

          <div className={style.customerHeaderLine} />

          <h1>{fullName}</h1>

          <p>{displayValue(customer.email)}</p>
        </div>

        <div className={style.customerHeaderActions}>
          <Link className={style.primary} href="/dashboard/customers">← Back to customers</Link>

          <button
            type="button"
            className={style.customerDeleteButton}
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete customer"}
          </button>

          <Link
            href={`/dashboard/customers/edit?id=${encodeURIComponent(
              String(customer.id),
            )}`}
            className={style.primary}
          >
            Edit customer
          </Link>
        </div>
      </div>

      {/* Customer information */}
      <div className={`${style.detailGrid} ${style.customerDetailGrid}`}>
        <section className={`${style.card} ${style.customerCard}`}>
          <h2>Customer information</h2>

          <div>
            <DetailRow label="Customer ID">
              {displayValue(customer.id)}
            </DetailRow>

            <DetailRow label="Shopify ID">
              {displayValue(customer.shopifyId)}
            </DetailRow>

            <DetailRow label="First name">
              {displayValue(customer.firstName)}
            </DetailRow>

            <DetailRow label="Last name">
              {displayValue(customer.lastName)}
            </DetailRow>

            <DetailRow label="Email">{displayValue(customer.email)}</DetailRow>

            <DetailRow label="Phone">{displayValue(customer.phone)}</DetailRow>

            <DetailRow label="Birthday">
              {displayDate(customer.birthday)}
            </DetailRow>

            <DetailRow label="Gender">
              {displayValue(customer.gender)}
            </DetailRow>

            <DetailRow label="Account state">
              {displayValue(customer.state)}
            </DetailRow>

            <DetailRow label="Verified email">
              {displayBoolean(customer.verifiedEmail)}
            </DetailRow>

            <DetailRow label="Tax exempt">
              {displayBoolean(customer.taxExempt)}
            </DetailRow>
          </div>
        </section>

        {/* Prescription & purchases */}
        <section className={`${style.card} ${style.customerCard}`}>
          <h2>Prescription & purchases</h2>

          <div>
            <DetailRow label="Total orders">
              {displayValue(customer.numberOfOrders, "0")}
            </DetailRow>

            <DetailRow label="Total spent">
              {displayMoney(customer.totalSpent, customer.currencyCode)}
            </DetailRow>

            <DetailRow label="Currency code">
              {displayValue(customer.currencyCode)}
            </DetailRow>

            <DetailRow label="Consult purchase">
              {displayBoolean(customer.consultPurchase)}
            </DetailRow>

            <DetailRow label="Script ID">
              {displayValue(customer.scriptId)}
            </DetailRow>

            <DetailRow label="Script expiry">
              {displayDate(customer.scriptExpiry)}
            </DetailRow>

            <DetailRow label="Script validity">
              {displayValue(customer.scriptValidity)}
            </DetailRow>

            <DetailRow label="Renewal form">
              {displayValue(customer.renewalForm)}
            </DetailRow>

            <DetailRow label="Script uploaded">
              {displayValue(customer.scriptUploaded)}
            </DetailRow>

            <DetailRow label="Script active">
              {displayBoolean(customer.scriptActive)}
            </DetailRow>
          </div>
        </section>

        {/* Customer fields */}
        <section className={`${style.card} ${style.customerCard}`}>
          <h2>Customer fields</h2>

          <div>
            <DetailRow label="Tags">{displayTags(customer.tags)}</DetailRow>

            <DetailRow label="Vape tag">
              {displayValue(customer.vapeTag)}
            </DetailRow>

            <DetailRow label="Pouch tag">
              {displayValue(customer.pouchTag)}
            </DetailRow>

            <DetailRow label="Document">
              {displayValue(customer.document)}
            </DetailRow>

            <DetailRow label="Social login">
              {displayValue(customer.socLogin)}
            </DetailRow>
          </div>
        </section>

        {/* System information */}
        <section className={`${style.card} ${style.customerCard}`}>
          <h2>System information</h2>

          <div>
            <DetailRow label="Created">
              {displayDateTime(customer.createdAt)}
            </DetailRow>

            <DetailRow label="Last updated">
              {displayDateTime(customer.updatedAt)}
            </DetailRow>
          </div>
        </section>
      </div>

      {/* Addresses */}
      <section
        className={`${style.card} ${style.addressSection} ${style.customerAddressSection}`}
      >
        <div className={style.addressHeader}>
          <div>
            <h2>Addresses</h2>

            <p>
              {addresses.length === 0
                ? "No saved addresses"
                : `${addresses.length} saved address${
                    addresses.length === 1 ? "" : "es"
                  }`}
            </p>
          </div>

          <button
            type="button"
            className={style.secondary}
            onClick={() => setIsAddingAddress(true)}
          >
            + Add address
          </button>
        </div>

        {/* Add address form */}
        {isAddingAddress && (
          <form
            className={style.addAddressForm}
            onSubmit={handleAddAddress}
          >
            <div className={style.addAddressHeader}>
              <div>
                <h3>Add address</h3>
                <p>Enter the customer's address details.</p>
              </div>
            </div>

            <div className={style.addAddressGrid}>
              <label>
                Address line 1
                <input
                  name="address1"
                  type="text"
                  placeholder="Street address"
                  required
                />
              </label>

              <label>
                Address line 2
                <input
                  name="address2"
                  type="text"
                  placeholder="Apartment, unit, etc. (optional)"
                />
              </label>

              <label>
                City
                <input
                  name="city"
                  type="text"
                  placeholder="City"
                  required
                />
              </label>

              <label>
                State / Province
                <input
                  name="state"
                  type="text"
                  placeholder="State"
                  required
                />
              </label>

              <label>
                Postcode
                <input
                  name="postcode"
                  type="text"
                  placeholder="Postcode"
                  required
                />
              </label>

              <label>
                Country
                <input
                  name="country"
                  type="text"
                  defaultValue="Australia"
                  placeholder="Country"
                  required
                />
              </label>
            </div>

            {addressError && (
              <div
                className={style.notice}
                role="alert"
              >
                {addressError}
              </div>
            )}

            <div className={style.addAddressActions}>
              <button
                type="button"
                className={style.secondary}
                onClick={() => {
                  setIsAddingAddress(false);
                  setAddressError(null);
                }}
                disabled={isAddingAddressSubmitting}
              >
                Cancel
              </button>

              <button
                type="submit"
                className={style.primary}
                disabled={isAddingAddressSubmitting}
              >
                {isAddingAddressSubmitting
                  ? "Adding..."
                  : "Add address"}
              </button>
            </div>
          </form>
        )}

        {/* Existing addresses */}
        {addresses.length === 0 ? (
          !isAddingAddress && (
            <div className={style.addressEmpty}>
              <span>
                This customer does not have a saved address.
              </span>

              <button
                type="button"
                className={style.secondary}
                onClick={() => setIsAddingAddress(true)}
              >
                Add address
              </button>
            </div>
          )
        ) : (
          <div className={style.addressList}>
            {addresses.map((address, index) => {
              const addressId = displayValue(
                address.id,
                `address-${index}`,
              );

              const addressName =
                `${displayValue(
                  address.firstName,
                  "",
                )} ${displayValue(
                  address.lastName,
                  "",
                )}`.trim();

              return (
                <div
                  key={addressId}
                  className={style.addressCard}
                >
                  <div className={style.addressCardHeader}>
                    <div>
                      <strong>
                        {addressName || "Customer address"}
                      </strong>

                      <span className={style.addressType}>
                        {address.isDefault
                          ? "Default address"
                          : "Saved address"}
                      </span>
                    </div>

                    <div className={style.addressCardActions}>
                      {address.isDefault === true ? (
                        <span className={style.status}>
                          Default
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={style.secondary}
                          onClick={() =>
                            handleSetDefaultAddress(
                              String(address.id),
                            )
                          }
                          disabled={
                            settingDefaultAddress ===
                            String(address.id)
                          }
                        >
                          {settingDefaultAddress ===
                          String(address.id)
                            ? "Setting..."
                            : "Make default"}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className={style.customerAddressText}>
                    {displayValue(address.address1, "")}

                    {address.address2 != null &&
                      String(address.address2).trim() !== "" && (
                        <>
                          <br />
                          {String(address.address2)}
                        </>
                      )}

                    <br />

                    {displayValue(address.city, "")}

                    {address.province != null &&
                      String(address.province).trim() !== "" && (
                        <>{`, ${String(address.province)}`}</>
                      )}

                    {address.zip != null &&
                      String(address.zip).trim() !== "" && (
                        <>{` ${String(address.zip)}`}</>
                      )}

                    <br />

                    {displayValue(address.country, "")}
                  </div>

                  {Boolean(address.phone) && (
                    <div className={style.customerAddressPhone}>
                      {String(address.phone)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className={style.customerBackLink}>
        <Link href="/dashboard/customers">← Back to customers</Link>
      </div>
    </>
  );
}
