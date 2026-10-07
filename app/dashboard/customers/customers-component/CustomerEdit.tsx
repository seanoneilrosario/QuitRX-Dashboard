"use client";

import {
  useState,
} from "react";

import Link from "next/link";

import style from "../../../components/dashboard.module.css";

import {
  updateCustomerAction,
} from "../../../../lib/quitmed-retail-admin/customers/customer-actions";

import type { RetailRecord } from "@/lib/quitmed-retail-admin/collections/client";

type CustomerEditProps = {
  customer: RetailRecord;
};

function inputValue(
  value: unknown,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value);
}

function dateInputValue(
  value: unknown,
): string {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }

  const date = new Date(
    String(value),
  );

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date
    .toISOString()
    .slice(0, 10);
}

function tagsInputValue(
  value: unknown,
): string {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((tag) => String(tag))
    .join(", ");
}

function booleanInputValue(
  value: unknown,
): string {
  return value === true
    ? "true"
    : "false";
}

export default function CustomerEdit({
  customer,
}: CustomerEditProps) {
  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  // console.log("customer", customer)

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const form = event.currentTarget;

    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData(form);

      console.log(
        "form data entries:",
        Array.from(formData.entries()),
      );

      await updateCustomerAction(
        String(customer.id),
        formData,
      );

      window.location.href =
        `/dashboard/customers/view?id=${encodeURIComponent(
          String(customer.id),
        )}`;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update customer.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const customerId =
    String(customer.id);

  return (
    <>
      <div className={style.pageHeader}>
        <div>
          <div className={style.eyebrow}>
            CUSTOMER
          </div>

          <h1>
            Edit customer
          </h1>

          <p>
            Update all customer
            information.
          </p>
        </div>
      </div>

      {error && (
        <div className={style.notice}>
          {error}
        </div>
      )}

      <form
        className={style.form}
        onSubmit={handleSubmit}
      >
        {/* Identity */}
        <section
          className={style.formCard}
        >
          <h2>
            Customer identity
          </h2>

          <div
            className={style.formGrid}
          >
            <label>
              Customer ID

              <input
                type="text"
                value={customerId}
                readOnly
                disabled
              />
            </label>

            <label>
              Shopify ID

              <input
                type="text"
                value={inputValue(
                  customer.shopifyId,
                )}
                readOnly
                disabled
              />
            </label>

            <label>
              First name

              <input
                name="firstName"
                type="text"
                defaultValue={inputValue(
                  customer.firstName,
                )}
                disabled={submitting}
              />
            </label>

            <label>
              Last name

              <input
                name="lastName"
                type="text"
                defaultValue={inputValue(
                  customer.lastName,
                )}
                disabled={submitting}
              />
            </label>

            <label>
              Email

              <input
                name="email"
                type="email"
                defaultValue={inputValue(
                  customer.email,
                )}
                disabled={submitting}
              />
            </label>

            <label>
              Phone

              <input
                name="phone"
                type="tel"
                defaultValue={inputValue(
                  customer.phone,
                )}
                disabled={submitting}
              />
            </label>

            <label>
              Birthday

              <input
                name="birthday"
                type="date"
                defaultValue={dateInputValue(
                  customer.birthday,
                )}
                disabled={submitting}
              />
            </label>

            <label>
              Gender

              <input
                name="gender"
                type="text"
                defaultValue={inputValue(
                  customer.gender,
                )}
                disabled={submitting}
              />
            </label>
          </div>
        </section>

        {/* Customer data */}
        <section
          className={style.formCard}
        >
          <h2>
            Customer data
          </h2>

          <div
            className={style.formGrid}
          >
            <label>
              Number of orders

              <input
                name="numberOfOrders"
                type="number"
                min="0"
                defaultValue={inputValue(
                  customer.numberOfOrders,
                )}
                disabled={submitting}
              />
            </label>

            <label>
              Total spent

              <input
                name="totalSpent"
                type="number"
                step="0.01"
                min="0"
                defaultValue={inputValue(
                  customer.totalSpent,
                )}
                disabled={submitting}
              />
            </label>

            <label>
              Currency code

              <input
                name="currencyCode"
                type="text"
                defaultValue={inputValue(
                  customer.currencyCode,
                )}
                disabled={submitting}
              />
            </label>

            <label>
              Account state

              <input
                name="state"
                type="text"
                defaultValue={inputValue(
                  customer.state,
                )}
                disabled={submitting}
              />
            </label>

            <label>
              Tags

              <input
                name="tags"
                type="text"
                defaultValue={tagsInputValue(
                  customer.tags,
                )}
                disabled={submitting}
              />

              <small>
                Separate tags with commas.
              </small>
            </label>

            <label>
              Tax exempt

              <select
                name="taxExempt"
                defaultValue={booleanInputValue(
                  customer.taxExempt,
                )}
                disabled={submitting}
              >
                <option value="false">
                  No
                </option>

                <option value="true">
                  Yes
                </option>
              </select>
            </label>

            <label>
              Verified email

              <select
                name="verifiedEmail"
                defaultValue={booleanInputValue(
                  customer.verifiedEmail,
                )}
                disabled={submitting}
              >
                <option value="false">
                  No
                </option>

                <option value="true">
                  Yes
                </option>
              </select>
            </label>
          </div>
        </section>

        {/* Prescription */}
        <section
          className={style.formCard}
        >
          <h2>
            Prescription
          </h2>

          <div
            className={style.formGrid}
          >
            <label>
              Consult purchase

              <select
                name="consultPurchase"
                defaultValue={booleanInputValue(
                  customer.consultPurchase,
                )}
                disabled={submitting}
              >
                <option value="false">
                  No
                </option>

                <option value="true">
                  Yes
                </option>
              </select>
            </label>

            <label>
              Script ID

              <input
                name="scriptId"
                type="text"
                defaultValue={inputValue(
                  customer.scriptId,
                )}
                disabled={submitting}
              />
            </label>

            <label>
              Script expiry

              <input
                name="scriptExpiry"
                type="date"
                defaultValue={dateInputValue(
                  customer.scriptExpiry,
                )}
                disabled={submitting}
              />
            </label>

            <label>
              Script validity

              <input
                name="scriptValidity"
                type="text"
                defaultValue={inputValue(
                  customer.scriptValidity,
                )}
                disabled={submitting}
              />
            </label>

            <label>
              Renewal form

              <input
                name="renewalForm"
                type="text"
                defaultValue={inputValue(
                  customer.renewalForm,
                )}
                disabled={submitting}
              />
            </label>

            <label>
              Script uploaded

              <input
                name="scriptUploaded"
                type="text"
                defaultValue={inputValue(
                  customer.scriptUploaded,
                )}
                disabled={submitting}
              />
            </label>

            <label>
              Script active

              <select
                name="scriptActive"
                defaultValue={booleanInputValue(
                  customer.scriptActive,
                )}
                disabled={submitting}
              >
                <option value="false">
                  No
                </option>

                <option value="true">
                  Yes
                </option>
              </select>
            </label>

            <label>
              Document

              <input
                name="document"
                type="text"
                defaultValue={inputValue(
                  customer.document,
                )}
                disabled={submitting}
              />
            </label>
          </div>
        </section>

        {/* Customer-specific fields */}
        <section
          className={style.formCard}
        >
          <h2>
            Customer fields
          </h2>

          <div
            className={style.formGrid}
          >
            <label>
              Vape tag

              <input
                name="vapeTag"
                type="text"
                defaultValue={inputValue(
                  customer.vapeTag,
                )}
                disabled={submitting}
              />
            </label>

            <label>
              Pouch tag

              <input
                name="pouchTag"
                type="text"
                defaultValue={inputValue(
                  customer.pouchTag,
                )}
                disabled={submitting}
              />
            </label>

            <label>
              Social login

              <input
                name="socLogin"
                type="text"
                defaultValue={inputValue(
                  customer.socLogin,
                )}
                disabled={submitting}
              />
            </label>
          </div>
        </section>

        {/* System information */}
        <section
          className={style.formCard}
        >
          <h2>
            System information
          </h2>

          <div
            className={style.formGrid}
          >
            <label>
              Created at

              <input
                type="text"
                value={inputValue(
                  customer.createdAt,
                )}
                readOnly
                disabled
              />
            </label>

            <label>
              Updated at

              <input
                type="text"
                value={inputValue(
                  customer.updatedAt,
                )}
                readOnly
                disabled
              />
            </label>
          </div>
        </section>

        <div
          className={style.formActions}
        >
          <Link
            href={`/dashboard/customers/view?id=${encodeURIComponent(
              customerId,
            )}`}
          >
            Cancel
          </Link>

          <button
            type="submit"
            className={style.primary}
            disabled={submitting}
          >
            {submitting
              ? "Saving..."
              : "Save customer"}
          </button>
        </div>
      </form>
    </>
  );
}