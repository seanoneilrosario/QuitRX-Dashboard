
"use client";

import { useRouter } from "next/navigation";

import { useState } from "react";
import type {
  CustomerSegment,
  CustomerSegmentInput,
  CustomerSegmentMatchMode,
  CustomerSegmentRule,
} from "@/lib/quitmed-retail-admin/customer-segments/client";


import styles from "./customer-segments.module.css";
import { createCustomerSegmentAction, refreshCustomerSegmentAction } from "@/lib/quitmed-retail-admin/customer-segments/customer-segment-actions";

type Props = {
  initialSegments: CustomerSegment[];
  showSegments?: boolean;
  redirectAfterCreate?: boolean;
};

const FIELDS = [
  { value: "firstName", label: "First name", type: "string" },
  { value: "lastName", label: "Last name", type: "string" },
  { value: "email", label: "Email", type: "string" },
  { value: "phone", label: "Phone", type: "string" },
  { value: "shopifyId", label: "Shopify ID", type: "string" },
  { value: "state", label: "State", type: "string" },
  { value: "currencyCode", label: "Currency code", type: "string" },
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

const OPERATORS: Record<FieldType, { value: string; label: string }[]> = {
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

function fieldType(field: string): FieldType {
  return FIELDS.find((item) => item.value === field)?.type ?? "string";
}

function defaultOperator(field: string) {
  const type = fieldType(field);
  return OPERATORS[type][0].value;
}

function defaultValue(field: string, operator: string): unknown {
  if (EMPTY_OPERATORS.has(operator)) return undefined;

  switch (fieldType(field)) {
    case "boolean":
      return true;
    case "number":
    case "date":
    case "tags":
    case "string":
      return "";
  }
}

function newRule(): CustomerSegmentRule {
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

    const type = fieldType(rule.field);
    let value = rule.value;

    if (type === "number") {
      if (value === "" || value === undefined || value === null) {
        throw new Error("Enter a number for each numeric rule.");
      }

      value = Number(value);

      if (!Number.isFinite(value)) {
        throw new Error("Numeric rules must contain a valid number.");
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
          throw new Error("Enter a tag for each tag rule.");
        }

        value = value.trim();
      } else {
        const values = String(value ?? "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean);

        if (!values.length) {
          throw new Error("Enter at least one comma-separated tag.");
        }

        value = values;
      }
    } else if (typeof value !== "string" || !value.trim()) {
      throw new Error("Enter a value for each text rule.");
    }

    return { field: rule.field, operator: rule.operator, value };
  });
}

export default function CustomerSegments({
  initialSegments,
  showSegments = true,
  redirectAfterCreate = false,
}: Props) {
  const router = useRouter();
  const [segments, setSegments] = useState(initialSegments);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [matchMode, setMatchMode] =
    useState<CustomerSegmentMatchMode>("ALL");
  const [rules, setRules] = useState<CustomerSegmentRule[]>([]);
  const [saving, setSaving] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function updateRule(
    index: number,
    patch: Partial<CustomerSegmentRule>,
  ) {
    setRules((current) =>
      current.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, ...patch } : rule,
      ),
    );
  }

  function changeRuleField(index: number, field: string) {
    const operator = defaultOperator(field);

    updateRule(index, {
      field,
      operator,
      value: defaultValue(field, operator),
    });
  }

  function changeRuleOperator(index: number, operator: string) {
    const rule = rules[index];
    if (!rule) return;

    updateRule(index, {
      operator,
      value: defaultValue(rule.field, operator),
    });
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError("Enter a name for this segment.");
      return;
    }

    setSaving(true);

    try {
      const input: CustomerSegmentInput = {
        name: name.trim(),
        description: description.trim() || null,
        matchMode,
        rules: prepareRules(rules),
        isActive: true,
      };

      const created = await createCustomerSegmentAction(input);

      if (redirectAfterCreate) {
        router.push("/dashboard/customer-segments");
        router.refresh();
        return;
      }

      setSegments((current) => [
        created,
        ...current.filter((segment) => segment.id !== created.id),
      ]);

      setName("");
      setDescription("");
      setMatchMode("ALL");
      setRules([]);
      setSuccess(
        `Segment created. ${created._count?.members ?? 0} customers matched.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Failed to create customer segment.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRefresh(id: string) {
    setError("");
    setSuccess("");
    setRefreshingId(id);

    try {
      const result = await refreshCustomerSegmentAction(id);

      setSegments((current) =>
        current.map((segment) =>
          segment.id === id
            ? {
                ...segment,
                _count: { members: result.matchedCustomers },
              }
            : segment,
        ),
      );

      setSuccess(
        `Segment refreshed. ${result.matchedCustomers} customers matched.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Failed to refresh segment members.",
      );
    } finally {
      setRefreshingId(null);
    }
  }

  function renderRuleValue(rule: CustomerSegmentRule, index: number) {
    if (EMPTY_OPERATORS.has(rule.operator)) return null;

    const type = fieldType(rule.field);
    const inputId = `rule-value-${index}`;

    if (type === "boolean") {
      return (
        <select
          id={inputId}
          value={String(rule.value ?? true)}
          onChange={(event) =>
            updateRule(index, { value: event.target.value === "true" })
          }
          className={styles.input}
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    }

    if (type === "number") {
      return (
        <input
          id={inputId}
          type="number"
          step={rule.field === "numberOfOrders" ? "1" : "0.01"}
          value={String(rule.value ?? "")}
          onChange={(event) =>
            updateRule(index, { value: event.target.value })
          }
          className={styles.input}
          placeholder="Enter a number"
          required
        />
      );
    }

    if (type === "date") {
      return (
        <input
          id={inputId}
          type="date"
          value={String(rule.value ?? "").slice(0, 10)}
          onChange={(event) =>
            updateRule(index, { value: event.target.value })
          }
          className={styles.input}
          required
        />
      );
    }

    const isTagList =
      type === "tags" &&
      ["hasAnyTag", "hasAllTags"].includes(rule.operator);

    const value =
      Array.isArray(rule.value)
        ? rule.value.join(", ")
        : String(rule.value ?? "");

    return (
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(event) =>
          updateRule(index, { value: event.target.value })
        }
        className={styles.input}
        placeholder={
          isTagList
            ? "Enter tags separated by commas"
            : type === "tags"
              ? "Enter a tag"
              : "Enter a value"
        }
        required
      />
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>CUSTOMERS</p>
          <h1>Customer segments</h1>
          <p className={styles.subtitle}>
            Group customers using attributes, purchase activity, dates, and tags.
          </p>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Create customer segment</h2>
            <p>Choose the rules customers must meet to belong to this segment.</p>
          </div>
        </div>

        <form onSubmit={handleCreate} className={styles.form}>
          <div className={styles.twoColumns}>
            <label className={styles.field}>
              <span>Segment name *</span>
              <input
                className={styles.input}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. High-value customers"
                maxLength={120}
                required
              />
            </label>

            <label className={styles.field}>
              <span>Description</span>
              <input
                className={styles.input}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What is this segment for?"
                maxLength={500}
              />
            </label>
          </div>

          <label className={styles.field}>
            <span>Customer matching</span>
            <select
              className={styles.input}
              value={matchMode}
              onChange={(event) =>
                setMatchMode(event.target.value as CustomerSegmentMatchMode)
              }
            >
              <option value="ALL">Match all conditions</option>
              <option value="ANY">Match any condition</option>
            </select>
            <small>
              {matchMode === "ALL"
                ? "A customer must meet every rule."
                : "A customer only needs to meet one rule."}
            </small>
          </label>

          <div className={styles.rulesHeader}>
            <div>
              <h3>Conditions</h3>
              <p>
                {rules.length === 0
                  ? "No conditions means this segment matches no customers."
                  : `${rules.length} condition${rules.length === 1 ? "" : "s"} configured.`}
              </p>
            </div>

            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setRules((current) => [...current, newRule()])}
            >
              + Add condition
            </button>
          </div>

          {rules.length > 0 && (
            <div className={styles.rules}>
              {rules.map((rule, index) => {
                const operators = OPERATORS[fieldType(rule.field)];

                return (
                  <div className={styles.ruleRow} key={index}>
                    <label className={styles.field}>
                      <span>Customer attribute</span>
                      <select
                        className={styles.input}
                        value={rule.field}
                        onChange={(event) =>
                          changeRuleField(index, event.target.value)
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
                          changeRuleOperator(index, event.target.value)
                        }
                      >
                        {operators.map((operator) => (
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
                      {renderRuleValue(rule, index) ?? (
                        <div className={styles.noValue}>No value needed</div>
                      )}
                    </label>

                    <button
                      type="button"
                      className={styles.removeButton}
                      aria-label={`Remove condition ${index + 1}`}
                      onClick={() =>
                        setRules((current) =>
                          current.filter((_, ruleIndex) => ruleIndex !== index),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className={styles.formFooter}>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={saving}
            >
              {saving ? "Creating..." : "Create segment"}
            </button>
          </div>
        </form>
      </section>

      {showSegments && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Saved segments</h2>
              <p>Review segments and refresh their matched customer memberships.</p>
            </div>
            <span className={styles.count}>{segments.length} total</span>
          </div>

          {segments.length === 0 ? (
            <div className={styles.empty}>
              No customer segments yet. Create your first segment above.
            </div>
          ) : (
            <div className={styles.segmentList}>
              {segments.map((segment) => (
                <article className={styles.segmentCard} key={segment.id}>
                  <div className={styles.segmentInfo}>
                    <div className={styles.segmentTitle}>
                      <h3>{segment.name}</h3>
                      <span
                        className={
                          segment.isActive
                            ? styles.activeBadge
                            : styles.inactiveBadge
                        }
                      >
                        {segment.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>

                    {segment.description && (
                      <p>{segment.description}</p>
                    )}

                    <div className={styles.metadata}>
                      <span>
                        Match {segment.matchMode === "ALL" ? "all" : "any"}
                      </span>
                      <span>{segment.rules?.length ?? 0} conditions</span>
                      <strong>
                        {segment._count?.members ?? 0} customers
                      </strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={styles.secondaryButton}
                    disabled={refreshingId === segment.id}
                    onClick={() => handleRefresh(segment.id)}
                  >
                    {refreshingId === segment.id ? "Refreshing..." : "Refresh"}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
