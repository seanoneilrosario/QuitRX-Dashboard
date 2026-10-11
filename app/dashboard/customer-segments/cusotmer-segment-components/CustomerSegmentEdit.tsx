
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type {
  CustomerSegment,
  CustomerSegmentInput,
  CustomerSegmentRule,
  CustomerSegmentMatchMode,
} from "@/lib/quitmed-retail-admin/customer-segments/client";

import styles from "./customer-segments.module.css";
import { deleteCustomerSegmentAction, updateCustomerSegmentAction } from "@/lib/quitmed-retail-admin/customer-segments/customer-segment-actions";

type Props = {
  initialSegment: CustomerSegment;
};

const FIELDS = [
  { value: "shopifyId", label: "Shopify ID", type: "string" },
  { value: "firstName", label: "First name", type: "string" },
  { value: "lastName", label: "Last name", type: "string" },
  { value: "email", label: "Email", type: "string" },
  { value: "phone", label: "Phone", type: "string" },
  { value: "currencyCode", label: "Currency code", type: "string" },
  { value: "state", label: "State", type: "string" },
  { value: "gender", label: "Gender", type: "string" },
  { value: "scriptId", label: "Script ID", type: "string" },
  { value: "scriptValidity", label: "Script validity", type: "string" },
  { value: "renewalForm", label: "Renewal form", type: "string" },
  { value: "vapeTag", label: "Vape tag", type: "string" },
  { value: "pouchTag", label: "Pouch tag", type: "string" },
  { value: "document", label: "Document", type: "string" },
  { value: "socLogin", label: "Social login", type: "string" },
  { value: "scriptUploaded", label: "Script uploaded field", type: "string" },
  { value: "numberOfOrders", label: "Number of orders", type: "number" },
  { value: "totalSpent", label: "Total spent", type: "number" },
  { value: "taxExempt", label: "Tax exempt", type: "boolean" },
  { value: "verifiedEmail", label: "Verified email", type: "boolean" },
  { value: "consultPurchase", label: "Consult purchase", type: "boolean" },
  { value: "scriptActive", label: "Script active", type: "boolean" },
  { value: "birthday", label: "Birthday", type: "date" },
  { value: "scriptExpiry", label: "Script expiry", type: "date" },
  { value: "createdAt", label: "Customer created date", type: "date" },
  { value: "updatedAt", label: "Customer updated date", type: "date" },
  { value: "tags", label: "Customer tags", type: "tags" },
] as const;

type FieldType = (typeof FIELDS)[number]["type"];

const OPERATORS: Record<
  FieldType,
  { value: string; label: string }[]
> = {
  string: [
    { value: "equals", label: "is equal to" },
    { value: "notEquals", label: "is not equal to" },
    { value: "contains", label: "contains" },
    { value: "notContains", label: "does not contain" },
    { value: "startsWith", label: "starts with" },
    { value: "endsWith", label: "ends with" },
    { value: "isEmpty", label: "is empty" },
    { value: "isNotEmpty", label: "is not empty" },
  ],
  number: [
    { value: "equals", label: "is equal to" },
    { value: "notEquals", label: "is not equal to" },
    { value: "greaterThan", label: "is greater than" },
    { value: "greaterThanOrEqual", label: "is at least" },
    { value: "lessThan", label: "is less than" },
    { value: "lessThanOrEqual", label: "is at most" },
  ],
  boolean: [
    { value: "equals", label: "is" },
    { value: "notEquals", label: "is not" },
  ],
  date: [
    { value: "equals", label: "is on" },
    { value: "before", label: "is before" },
    { value: "after", label: "is after" },
    { value: "onOrBefore", label: "is on or before" },
    { value: "onOrAfter", label: "is on or after" },
    { value: "isEmpty", label: "is empty" },
    { value: "isNotEmpty", label: "is not empty" },
  ],
  tags: [
    { value: "hasTag", label: "includes tag" },
    { value: "notHasTag", label: "does not include tag" },
    { value: "hasAnyTag", label: "includes any of these tags" },
    { value: "hasAllTags", label: "includes all of these tags" },
    { value: "isEmpty", label: "has no tags" },
    { value: "isNotEmpty", label: "has at least one tag" },
  ],
};

const EMPTY_OPERATORS = new Set(["isEmpty", "isNotEmpty"]);

function getFieldType(field: string): FieldType {
  return FIELDS.find((item) => item.value === field)?.type ?? "string";
}

function getDefaultValue(field: string, operator: string): unknown {
  if (EMPTY_OPERATORS.has(operator)) return undefined;

  switch (getFieldType(field)) {
    case "boolean":
      return true;
    case "number":
    case "date":
    case "tags":
    case "string":
      return "";
  }
}

function createRule(): CustomerSegmentRule {
  return {
    field: "firstName",
    operator: "contains",
    value: "",
  };
}

function prepareRules(rules: CustomerSegmentRule[]) {
  return rules.map((rule) => {
    if (EMPTY_OPERATORS.has(rule.operator)) {
      return {
        field: rule.field,
        operator: rule.operator,
      };
    }

    const type = getFieldType(rule.field);
    let value = rule.value;

    if (type === "number") {
      if (value === "" || value === undefined || value === null) {
        throw new Error("Enter a number for each numeric rule.");
      }

      value = Number(value);

      if (!Number.isFinite(value)) {
        throw new Error("Enter a valid number.");
      }

      if (rule.field === "numberOfOrders" && !Number.isInteger(value)) {
        throw new Error("Number of orders must be a whole number.");
      }
    } else if (type === "boolean") {
      value = value === true || value === "true";
    } else if (type === "date") {
      if (typeof value !== "string" || !value.trim()) {
        throw new Error("Choose a date for each date rule.");
      }
    } else if (type === "tags") {
      if (rule.operator === "hasTag" || rule.operator === "notHasTag") {
        if (typeof value !== "string" || !value.trim()) {
          throw new Error("Enter a tag.");
        }

        value = value.trim();
      } else {
        const tags = String(value ?? "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean);

        if (!tags.length) {
          throw new Error("Enter at least one tag.");
        }

        value = tags;
      }
    } else {
      if (typeof value !== "string" || !value.trim()) {
        throw new Error("Enter a value for each text rule.");
      }

      value = value.trim();
    }

    return {
      field: rule.field,
      operator: rule.operator,
      value,
    };
  });
}

export default function CustomerSegmentEdit({
  initialSegment,
}: Props) {
  const router = useRouter();

  const [name, setName] = useState(initialSegment.name);
  const [description, setDescription] = useState(
    initialSegment.description ?? "",
  );
  const [matchMode, setMatchMode] =
    useState<CustomerSegmentMatchMode>(initialSegment.matchMode);
  const [rules, setRules] = useState<CustomerSegmentRule[]>(
    initialSegment.rules ?? [],
  );
  const [isActive, setIsActive] = useState(initialSegment.isActive);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function updateRule(
    index: number,
    patch: Partial<CustomerSegmentRule>,
  ) {
    setRules((current) =>
      current.map((rule, i) =>
        i === index ? { ...rule, ...patch } : rule,
      ),
    );
  }

  function changeField(index: number, field: string) {
    const type = getFieldType(field);

    updateRule(index, {
      field,
      operator:
        type === "string"
          ? "contains"
          : type === "number"
            ? "greaterThanOrEqual"
            : type === "boolean"
              ? "equals"
              : type === "date"
                ? "after"
                : "hasTag",
      value: getDefaultValue(
        field,
        type === "string"
          ? "contains"
          : type === "number"
            ? "greaterThanOrEqual"
            : type === "boolean"
              ? "equals"
              : type === "date"
                ? "after"
                : "hasTag",
      ),
    });
  }

  function changeOperator(index: number, operator: string) {
    const rule = rules[index];
    if (!rule) return;

    updateRule(index, {
      operator,
      value: getDefaultValue(rule.field, operator),
    });
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError("Segment name is required.");
      return;
    }

    setSaving(true);

    try {
      const data: CustomerSegmentInput = {
        name: name.trim(),
        description: description.trim() || null,
        matchMode,
        rules: prepareRules(rules),
        isActive,
      };

      await updateCustomerSegmentAction(initialSegment.id, data);

      setSuccess("Customer segment updated successfully.");

      router.push("/dashboard/customer-segments");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Failed to update customer segment.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    const confirmed = window.confirm(
      `Remove the "${initialSegment.name}" segment? This will delete the segment and its saved memberships. Customer records will not be deleted.`,
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");
    setDeleting(true);

    try {
      const result = await deleteCustomerSegmentAction(initialSegment.id);

      if (!result.success) {
        throw new Error(result.error || "Failed to remove segment.");
      }

      router.push("/dashboard/customer-segments");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Failed to remove customer segment.",
      );
    } finally {
      setDeleting(false);
    }
  }

  function renderValue(rule: CustomerSegmentRule, index: number) {
    if (EMPTY_OPERATORS.has(rule.operator)) {
      return <div className={styles.noValue}>No value needed</div>;
    }

    const type = getFieldType(rule.field);
    const value = Array.isArray(rule.value)
      ? rule.value.join(", ")
      : String(rule.value ?? "");

    if (type === "boolean") {
      return (
        <select
          className={styles.input}
          value={String(rule.value ?? true)}
          onChange={(event) =>
            updateRule(index, { value: event.target.value === "true" })
          }
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    }

    if (type === "number") {
      return (
        <input
          className={styles.input}
          type="number"
          step={rule.field === "numberOfOrders" ? "1" : "0.01"}
          value={value}
          required
          onChange={(event) =>
            updateRule(index, { value: event.target.value })
          }
        />
      );
    }

    if (type === "date") {
      return (
        <input
          className={styles.input}
          type="date"
          value={value.slice(0, 10)}
          required
          onChange={(event) =>
            updateRule(index, { value: event.target.value })
          }
        />
      );
    }

    return (
      <input
        className={styles.input}
        value={value}
        required
        placeholder={
          type === "tags" &&
          ["hasAnyTag", "hasAllTags"].includes(rule.operator)
            ? "Separate tags with commas"
            : "Enter a value"
        }
        onChange={(event) =>
          updateRule(index, { value: event.target.value })
        }
      />
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>CUSTOMERS / SEGMENTS</p>
          <h1>Edit customer segment</h1>
          <p className={styles.subtitle}>
            Update the segment details, matching rules, and status.
          </p>
        </div>

        <Link
          href="/dashboard/customer-segments"
          className={styles.secondaryButton}
        >
          Back to segments
        </Link>
      </header>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      <section className={styles.panel}>
        <form className={styles.form} onSubmit={handleSave}>
          <div className={styles.twoColumns}>
            <label className={styles.field}>
              <span>Segment name *</span>
              <input
                className={styles.input}
                value={name}
                maxLength={120}
                required
                onChange={(event) => setName(event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span>Description</span>
              <input
                className={styles.input}
                value={description}
                maxLength={500}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
          </div>

          <label className={styles.field}>
            <span>Customer matching</span>
            <select
              className={styles.input}
              value={matchMode}
              onChange={(event) =>
                setMatchMode(
                  event.target.value as CustomerSegmentMatchMode,
                )
              }
            >
              <option value="ALL">Match all conditions</option>
              <option value="ANY">Match any condition</option>
            </select>
          </label>

          <label className={styles.field}>
            <span>Segment status</span>
            <select
              className={styles.input}
              value={isActive ? "true" : "false"}
              onChange={(event) =>
                setIsActive(event.target.value === "true")
              }
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>

          <div className={styles.rulesHeader}>
            <div>
              <h3>Conditions</h3>
              <p>
                {matchMode === "ALL"
                  ? "Customers must satisfy every condition."
                  : "Customers only need to satisfy one condition."}
              </p>
            </div>

            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setRules((current) => [...current, createRule()])}
            >
              + Add condition
            </button>
          </div>

          {rules.length === 0 ? (
            <div className={styles.empty}>
              No conditions configured. This segment currently matches no customers.
            </div>
          ) : (
            <div className={styles.rules}>
              {rules.map((rule, index) => (
                <div className={styles.ruleRow} key={index}>
                  <label className={styles.field}>
                    <span>Customer attribute</span>
                    <select
                      className={styles.input}
                      value={rule.field}
                      onChange={(event) =>
                        changeField(index, event.target.value)
                      }
                    >
                      {FIELDS.map((field) => (
                        <option key={field.value} value={field.value}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={styles.field}>
                    <span>Condition</span>
                    <select
                      className={styles.input}
                      value={rule.operator}
                      onChange={(event) =>
                        changeOperator(index, event.target.value)
                      }
                    >
                      {OPERATORS[getFieldType(rule.field)].map((operator) => (
                        <option
                          key={operator.value}
                          value={operator.value}
                        >
                          {operator.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={styles.field}>
                    <span>Value</span>
                    {renderValue(rule, index)}
                  </label>

                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() =>
                      setRules((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                  >
                    Remove condition
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className={styles.editFooter}>
            <button
              type="button"
              className={styles.dangerButton}
              onClick={handleRemove}
              disabled={saving || deleting}
            >
              {deleting ? "Removing..." : "Remove segment"}
            </button>

            <div className={styles.editFooterActions}>
              <Link
                href="/dashboard/customer-segments"
                className={styles.secondaryButton}
              >
                Cancel
              </Link>

              <button
                type="submit"
                className={styles.primaryButton}
                disabled={saving || deleting}
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}
