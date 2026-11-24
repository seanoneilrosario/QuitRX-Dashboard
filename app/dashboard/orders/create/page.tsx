"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import "../orders-components/create-order.css";

import {
  createOrderAction,
  searchOrderCustomers,
  searchOrderVariants,
  getOrderCustomer,
  getOrCreateOrderInvoiceAction,
  sendOrderInvoiceAction,
  type CreateOrderPayload,
  type OrderInvoice,
} from "@/lib/quitmed-retail-admin/orders/order-actions";

type RecordData = Record<string, unknown>;

type SelectedItem = {
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  price: number;
  quantity: number;
};

type Address = {
  firstName: string;
  lastName: string;
  company: string;
  address1: string;
  address2: string;
  city: string;
  province: string;
  country: string;
  zip: string;
  phone: string;
};

const emptyAddress: Address = {
  firstName: "",
  lastName: "",
  company: "",
  address1: "",
  address2: "",
  city: "",
  province: "",
  country: "",
  zip: "",
  phone: "",
};

const money = (value: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(value);

function getText(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

function getCustomerName(customer: RecordData) {
  return (
    [customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
    "Unnamed customer"
  );
}

function mapAddress(address: RecordData): Address {
  return {
    firstName: getText(address.firstName),
    lastName: getText(address.lastName),
    company: getText(address.company),
    address1: getText(address.address1),
    address2: getText(address.address2),
    city: getText(address.city),
    province: getText(address.province ?? address.state),
    country: getText(address.country),
    zip: getText(address.zip ?? address.postcode ?? address.postalCode),
    phone: getText(address.phone),
  };
}

function Field({
  label,
  value,
  onChange,
  required = false,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="order-field">
      <span className="order-field-label">
        {label}
        {required && <span className="order-required">*</span>}
      </span>

      <input
        type={type}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "0.01" : undefined}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="order-input"
        placeholder={placeholder}
      />
    </label>
  );
}

function AddressForm({
  title,
  address,
  onChange,
}: {
  title: string;
  address: Address;
  onChange: (address: Address) => void;
}) {
  const update = (key: keyof Address, value: string) => {
    onChange({
      ...address,
      [key]: value,
    });
  };

  const fields: {
    key: keyof Address;
    label: string;
    required?: boolean;
    placeholder?: string;
  }[] = [
    { key: "firstName", label: "First name", required: true },
    { key: "lastName", label: "Last name", required: true },
    { key: "company", label: "Company" },
    { key: "address1", label: "Address", required: true },
    { key: "address2", label: "Apartment, suite, etc." },
    { key: "city", label: "City", required: true },
    { key: "province", label: "State / Province" },
    { key: "zip", label: "Postcode", required: true },
    { key: "country", label: "Country", required: true },
    {
      key: "phone",
      label: "Phone",
      required: true,
      placeholder: "+61400000000",
    },
  ];

  return (
    <section className="order-address-section">
      <h3 className="order-section-subtitle">{title}</h3>

      <div className="order-field-grid">
        {fields.map((field) => (
          <Field
            key={field.key}
            label={field.label}
            value={address[field.key]}
            required={field.required}
            placeholder={field.placeholder ?? field.label}
            onChange={(value) => update(field.key, value)}
          />
        ))}
      </div>
    </section>
  );
}

function StatusSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="order-field">
      <span className="order-field-label">{label}</span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="order-input"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function CreateOrderPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<RecordData[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<RecordData | null>(
    null,
  );

  const [showCustomers, setShowCustomers] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  const [variantSearch, setVariantSearch] = useState("");
  const [variants, setVariants] = useState<RecordData[]>([]);
  const [showVariants, setShowVariants] = useState(false);
  const [loadingVariants, setLoadingVariants] = useState(false);

  const [items, setItems] = useState<SelectedItem[]>([]);

  const [shippingAddress, setShippingAddress] = useState<Address>({
    ...emptyAddress,
  });

  const [billingAddress, setBillingAddress] = useState<Address>({
    ...emptyAddress,
  });

  const [sameAsShipping, setSameAsShipping] = useState(true);

  const [shippingMethod, setShippingMethod] = useState("express");
  const [shippingTotal, setShippingTotal] = useState("0");
  const [taxTotal, setTaxTotal] = useState("0");
  const [discountCode, setDiscountCode] = useState("");

  const [status, setStatus] = useState("PENDING");
  const [paymentStatus, setPaymentStatus] = useState("PAID");
  const [fulfillmentStatus, setFulfillmentStatus] = useState("UNFULFILLED");

  const [error, setError] = useState("");
  const [createdOrderId, setCreatedOrderId] = useState("");
  const [invoice, setInvoice] = useState<OrderInvoice | null>(null);
  const [invoiceBusy, setInvoiceBusy] = useState<"preview" | "send" | null>(
    null,
  );
  const [invoiceMessage, setInvoiceMessage] = useState("");
  const [showSendConfirmation, setShowSendConfirmation] = useState(false);

  // Customer search
  useEffect(() => {
    let active = true;

    async function loadCustomers() {
      setLoadingCustomers(true);

      try {
        const result = await searchOrderCustomers(customerSearch);

        if (active) {
          setCustomers(result);
        }
      } catch (err) {
        if (active) {
          console.error(err);
          setCustomers([]);
        }
      } finally {
        if (active) {
          setLoadingCustomers(false);
        }
      }
    }

    const timer = setTimeout(loadCustomers, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [customerSearch]);

  // Product variant search
  useEffect(() => {
    let active = true;

    async function loadVariants() {
      setLoadingVariants(true);

      try {
        const result = await searchOrderVariants(variantSearch);

        if (active) {
          setVariants(result);
        }
      } catch (err) {
        if (active) {
          console.error(err);
          setVariants([]);
        }
      } finally {
        if (active) {
          setLoadingVariants(false);
        }
      }
    }

    const timer = setTimeout(loadVariants, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [variantSearch]);

  // Select customer and load their saved address
  async function selectCustomer(customer: RecordData) {
    setError("");
    setSelectedCustomer(customer);
    setCustomerSearch(getCustomerName(customer));
    setShowCustomers(false);

    try {
      const fullCustomer = await getOrderCustomer(String(customer.id));

      if (!fullCustomer) return;

      setSelectedCustomer(fullCustomer);

      const addresses = Array.isArray(fullCustomer.addresses)
        ? fullCustomer.addresses
        : [];

      const defaultAddress =
        addresses.find((address: RecordData) => address.isDefault === true) ??
        addresses[0];

      if (defaultAddress) {
        const mapped = mapAddress(defaultAddress);
        setShippingAddress(mapped);
        setBillingAddress({ ...mapped });
      } else {
        const name = getCustomerName(fullCustomer).split(" ");

        const customerAddress = {
          ...emptyAddress,
          firstName: getText(fullCustomer.firstName) || name[0] || "",
          lastName: getText(fullCustomer.lastName) || name.slice(1).join(" "),
          phone: getText(fullCustomer.phone),
        };

        setShippingAddress(customerAddress);
        setBillingAddress({ ...customerAddress });
      }
    } catch (err) {
      console.error(err);
      setError("Unable to load customer details.");
    }
  }

  function addVariant(variant: RecordData) {
    if (!variant.id) return;

    const existing = items.find(
      (item) => item.variantId === String(variant.id),
    );

    if (existing) {
      setItems((previous) =>
        previous.map((item) =>
          item.variantId === String(variant.id)
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        ),
      );
    } else {
      const product: RecordData =
        variant.product && typeof variant.product === "object"
          ? (variant.product as RecordData)
          : {};

      setItems((previous) => [
        ...previous,
        {
          variantId: String(variant.id),
          productName: getText(product.name) || "Product",
          variantName: getText(variant.name) || "Default",
          sku: getText(variant.sku),
          price: Number(variant.price) || 0,
          quantity: 1,
        },
      ]);
    }

    setVariantSearch("");
    setShowVariants(false);
  }

  function updateQuantity(variantId: string, quantity: number) {
    setItems((previous) =>
      previous.map((item) =>
        item.variantId === variantId
          ? { ...item, quantity: Math.max(1, quantity || 1) }
          : item,
      ),
    );
  }

  function removeItem(variantId: string) {
    setItems((previous) =>
      previous.filter((item) => item.variantId !== variantId),
    );
  }

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items],
  );

  const shipping = Math.max(0, Number(shippingTotal) || 0);
  const tax = Math.max(0, Number(taxTotal) || 0);
  const total = subtotal + shipping + tax;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (createdOrderId) return;

    if (!selectedCustomer?.id) {
      setError("Please select a customer.");
      return;
    }

    if (!items.length) {
      setError("Please add at least one product.");
      return;
    }

    if (!shippingAddress.address1.trim()) {
      setError("Shipping address is required.");
      return;
    }

    if (!shippingAddress.city.trim()) {
      setError("Shipping city is required.");
      return;
    }

    const billing = sameAsShipping ? shippingAddress : billingAddress;

    if (!billing.address1.trim()) {
      setError("Billing address is required.");
      return;
    }

    const payload: CreateOrderPayload = {
      customerId: String(selectedCustomer.id),

      status,
      paymentStatus,
      fulfillmentStatus,

      source: "NATIVE",
      currencyCode: "AUD",

      subtotal: Number(subtotal.toFixed(2)),
      discountTotal: 0,
      shippingTotal: shipping,
      shippingMethod,
      taxTotal: tax,
      total: Number(total.toFixed(2)),

      billingFirstName: billing.firstName,
      billingLastName: billing.lastName,
      billingCompany: billing.company,
      billingAddress1: billing.address1,
      billingAddress2: billing.address2,
      billingCity: billing.city,
      billingProvince: billing.province,
      billingCountry: billing.country,
      billingZip: billing.zip,
      billingPhone: billing.phone,

      shippingFirstName: shippingAddress.firstName,
      shippingLastName: shippingAddress.lastName,
      shippingCompany: shippingAddress.company,
      shippingAddress1: shippingAddress.address1,
      shippingAddress2: shippingAddress.address2,
      shippingCity: shippingAddress.city,
      shippingProvince: shippingAddress.province,
      shippingCountry: shippingAddress.country,
      shippingZip: shippingAddress.zip,
      shippingPhone: shippingAddress.phone,

      ...(discountCode.trim() ? { discountCode: discountCode.trim() } : {}),

      items: items.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
      })),
    };

    startTransition(async () => {
      try {
        const result = await createOrderAction(payload);

        if (!result.success) {
          setError(result.message || "Unable to create order.");
          return;
        }

        const createdOrder = result.data as RecordData;
        const nestedOrder =
          createdOrder.data &&
          typeof createdOrder.data === "object" &&
          !Array.isArray(createdOrder.data)
            ? (createdOrder.data as RecordData)
            : null;
        const orderId = createdOrder.id ?? nestedOrder?.id;

        if (orderId) {
          const id = String(orderId);
          setCreatedOrderId(id);
          const invoiceResult = await getOrCreateOrderInvoiceAction(id);

          if (invoiceResult.success) {
            setInvoice(invoiceResult.data);
            setInvoiceMessage(
              "Order created. The invoice is ready to preview or send.",
            );
          } else {
            setInvoiceMessage(invoiceResult.message);
          }
        } else {
          router.push("/dashboard/orders");
          router.refresh();
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to create order.",
        );
      }
    });
  }

  async function previewInvoice() {
    if (!createdOrderId) return;
    setInvoiceBusy("preview");
    setInvoiceMessage("");

    try {
      const result = await getOrCreateOrderInvoiceAction(createdOrderId);

      if (!result.success) {
        setInvoiceMessage(result.message);
        return;
      }

      setInvoice(result.data);
      if (result.data.previewUrl) {
        window.open(result.data.previewUrl, "_blank", "noopener,noreferrer");
      } else {
        setInvoiceMessage(
          "The invoice was generated, but no preview URL was returned.",
        );
      }
    } finally {
      setInvoiceBusy(null);
    }
  }

  async function sendInvoice() {
    if (!createdOrderId) return;
    setShowSendConfirmation(false);
    setInvoiceBusy("send");
    setInvoiceMessage("");

    try {
      const result = await sendOrderInvoiceAction(createdOrderId);

      if (result.success) {
        setInvoice(result.data);
        setInvoiceMessage(`Invoice sent to ${result.data.customerEmail}.`);
      } else {
        setInvoiceMessage(result.message);
      }
    } finally {
      setInvoiceBusy(null);
    }
  }

  return (
    <div className="create-order-page">
      {/* Page heading */}
      <div className="create-order-header">
        <div>
          <button
            type="button"
            onClick={() => router.back()}
            className="order-back-button"
          >
            <span aria-hidden="true">←</span> Back to orders
          </button>

          <h1 className="create-order-title">Create Order</h1>
          <p className="create-order-description">
            Create a new order for an existing customer.
          </p>
        </div>
      </div>

      {error && (
        <div className="order-error" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="create-order-layout">
          {/* Main form */}
          <div className="create-order-main">
            {/* Customer */}
            <section className="order-card">
              <div className="order-card-heading">
                <span className="order-step-number">1</span>
                <h2>Customer</h2>
              </div>

              <div className="order-search-wrapper">
                <input
                  value={customerSearch}
                  onChange={(event) => {
                    setCustomerSearch(event.target.value);
                    setSelectedCustomer(null);
                    setShowCustomers(true);
                  }}
                  onFocus={() => setShowCustomers(true)}
                  placeholder="Search by customer name or email..."
                  className="order-search-input"
                />

                {showCustomers && (
                  <div className="order-dropdown">
                    {loadingCustomers ? (
                      <p className="order-dropdown-message">
                        Searching customers...
                      </p>
                    ) : customers.length ? (
                      customers.map((customer) => (
                        <button
                          key={String(customer.id)}
                          type="button"
                          onClick={() => selectCustomer(customer)}
                          className="order-dropdown-item"
                        >
                          <span className="order-dropdown-item-title">
                            {getCustomerName(customer)}
                          </span>
                          <span className="order-dropdown-item-subtitle">
                            {getText(customer.email)}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="order-dropdown-message">
                        No customers found.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {selectedCustomer && (
                <div className="order-selected-customer">
                  <div className="order-selected-customer-icon">
                    {getCustomerName(selectedCustomer).charAt(0).toUpperCase()}
                  </div>

                  <div className="order-selected-customer-info">
                    <p className="order-selected-customer-name">
                      {getCustomerName(selectedCustomer)}
                    </p>
                    <p className="order-selected-customer-email">
                      {getText(selectedCustomer.email)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setCustomerSearch("");
                      setShippingAddress({ ...emptyAddress });
                      setBillingAddress({ ...emptyAddress });
                    }}
                    className="order-remove-button"
                  >
                    Remove
                  </button>
                </div>
              )}
            </section>

            {/* Products */}
            <section className="order-card">
              <div className="order-card-heading">
                <span className="order-step-number">2</span>
                <h2>Products</h2>
              </div>

              <div className="order-search-wrapper">
                <input
                  value={variantSearch}
                  onChange={(event) => {
                    setVariantSearch(event.target.value);
                    setShowVariants(true);
                  }}
                  onFocus={() => setShowVariants(true)}
                  placeholder="Search product name, variant or SKU..."
                  className="order-search-input"
                />

                {showVariants && (
                  <div className="order-dropdown">
                    {loadingVariants ? (
                      <p className="order-dropdown-message">
                        Searching variants...
                      </p>
                    ) : variants.length ? (
                      variants.map((variant) => {
                        const product: RecordData =
                          variant.product && typeof variant.product === "object"
                            ? (variant.product as RecordData)
                            : {};

                        return (
                          <button
                            key={String(variant.id)}
                            type="button"
                            onClick={() => addVariant(variant)}
                            className="order-product-result"
                          >
                            <span className="order-product-result-info">
                              <span className="order-product-result-name">
                                {getText(product.name) || "Product"}
                              </span>
                              <span className="order-product-result-meta">
                                {getText(variant.name)}
                                {variant.sku ? ` · SKU: ${variant.sku}` : ""}
                              </span>
                            </span>

                            <span className="order-product-result-price">
                              {money(Number(variant.price) || 0)}
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <p className="order-dropdown-message">
                        No variants found.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="order-items-table-wrapper">
                {items.length ? (
                  <table className="order-items-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Price</th>
                        <th>Quantity</th>
                        <th className="text-right">Total</th>
                        <th></th>
                      </tr>
                    </thead>

                    <tbody>
                      {items.map((item) => (
                        <tr key={item.variantId}>
                          <td>
                            <span className="order-item-name">
                              {item.productName}
                            </span>
                            <span className="order-item-meta">
                              {item.variantName}
                              {item.sku ? ` · ${item.sku}` : ""}
                            </span>
                          </td>

                          <td>{money(item.price)}</td>

                          <td>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(event) =>
                                updateQuantity(
                                  item.variantId,
                                  Number(event.target.value),
                                )
                              }
                              className="order-quantity-input"
                            />
                          </td>

                          <td className="text-right">
                            <strong>{money(item.price * item.quantity)}</strong>
                          </td>

                          <td className="text-right">
                            <button
                              type="button"
                              onClick={() => removeItem(item.variantId)}
                              className="order-remove-button"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="order-empty-state">
                    <div className="order-empty-icon">＋</div>
                    <p>No products added yet.</p>
                    <span>Search for a product above to add it.</span>
                  </div>
                )}
              </div>
            </section>

            {/* Shipping address */}
            <section className="order-card">
              <div className="order-card-heading">
                <span className="order-step-number">3</span>
                <h2>Shipping Address</h2>
              </div>

              <AddressForm
                title="Delivery details"
                address={shippingAddress}
                onChange={setShippingAddress}
              />
            </section>

            {/* Billing address */}
            <section className="order-card">
              <div className="order-card-heading">
                <span className="order-step-number">4</span>
                <h2>Billing Address</h2>
              </div>

              <label className="order-checkbox-row">
                <input
                  type="checkbox"
                  checked={sameAsShipping}
                  onChange={(event) => setSameAsShipping(event.target.checked)}
                />
                <span>Same as shipping address</span>
              </label>

              {!sameAsShipping && (
                <AddressForm
                  title="Billing details"
                  address={billingAddress}
                  onChange={setBillingAddress}
                />
              )}
            </section>

            {/* Shipping and discounts */}
            <section className="order-card">
              <div className="order-card-heading">
                <span className="order-step-number">5</span>
                <h2>Shipping & Discounts</h2>
              </div>

              <div className="order-field-grid">
                <label className="order-field">
                  <span className="order-field-label">Shipping method</span>
                  <select
                    value={shippingMethod}
                    onChange={(event) => setShippingMethod(event.target.value)}
                    className="order-input"
                  >
                    <option value="standard">Standard</option>
                    <option value="express">Express</option>
                  </select>
                </label>

                <Field
                  label="Shipping cost (AUD)"
                  type="number"
                  value={shippingTotal}
                  onChange={setShippingTotal}
                />

                <Field
                  label="Tax (AUD)"
                  type="number"
                  value={taxTotal}
                  onChange={setTaxTotal}
                />

                {/* <Field
                  label="Discount code"
                  value={discountCode}
                  onChange={setDiscountCode}
                /> */}
              </div>

              <p className="order-help-text">
                Discount codes are validated by the backend when the order is
                created.
              </p>
            </section>

            {/* Order status */}
            <section className="order-card">
              <div className="order-card-heading">
                <span className="order-step-number">6</span>
                <h2>Order Status</h2>
              </div>

              <div className="order-status-grid">
                <StatusSelect
                  label="Order status"
                  value={status}
                  onChange={setStatus}
                  options={["PENDING", "OPEN", "CANCELLED", "CLOSED"]}
                />

                <StatusSelect
                  label="Payment status"
                  value={paymentStatus}
                  onChange={setPaymentStatus}
                  options={[
                    "PENDING",
                    "PAID",
                    "PARTIALLY_PAID",
                    "REFUNDED",
                    "FAILED",
                  ]}
                />

                <StatusSelect
                  label="Fulfillment status"
                  value={fulfillmentStatus}
                  onChange={setFulfillmentStatus}
                  options={["UNFULFILLED", "PARTIALLY_FULFILLED", "FULFILLED"]}
                />
              </div>
            </section>

            <section className="order-card">
              <div className="order-card-heading">
                <span className="order-step-number">7</span>
                <h2>Invoice Management</h2>
              </div>

              <div className="invoice-details-grid">
                <div className="invoice-detail">
                  <span>Customer email</span>
                  <strong>
                    {invoice?.customerEmail ||
                      getText(selectedCustomer?.email) ||
                      "Select a customer"}
                  </strong>
                </div>
                <div className="invoice-detail">
                  <span>Invoice number</span>
                  <strong>
                    {invoice?.invoiceNumber || "Generated after order creation"}
                  </strong>
                </div>
                <div className="invoice-detail">
                  <span>Invoice status</span>
                  <strong
                    className={`invoice-status invoice-status-${(invoice?.status || "NOT_SENT").toLowerCase().replace("_", "-")}`}
                  >
                    {(invoice?.status || "NOT_SENT").replace("_", " ")}
                  </strong>
                </div>
                <div className="invoice-detail">
                  <span>Last sent</span>
                  <strong>
                    {invoice?.lastSentAt
                      ? new Intl.DateTimeFormat("en-AU", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(invoice.lastSentAt))
                      : "Not sent"}
                  </strong>
                </div>
              </div>

              <div className="invoice-actions">
                <button
                  type="button"
                  className="order-secondary-button"
                  disabled={!createdOrderId || invoiceBusy !== null}
                  onClick={previewInvoice}
                >
                  {invoiceBusy === "preview"
                    ? "Preparing Invoice..."
                    : "Preview Invoice"}
                </button>
                <button
                  type="button"
                  className="order-primary-button"
                  disabled={
                    !createdOrderId ||
                    invoiceBusy !== null ||
                    !(
                      invoice?.customerEmail || getText(selectedCustomer?.email)
                    )
                  }
                  onClick={() => setShowSendConfirmation(true)}
                >
                  {invoiceBusy === "send"
                    ? "Sending Invoice..."
                    : "Send Invoice to Customer"}
                </button>
              </div>

              {!createdOrderId && (
                <p className="order-help-text">
                  Create the order first to generate and send its invoice.
                </p>
              )}
              {invoiceMessage && (
                <p className="invoice-message" role="status">
                  {invoiceMessage}
                </p>
              )}
            </section>
          </div>

          {/* Order summary sidebar */}
          <aside className="create-order-sidebar">
            <div className="order-summary-card">
              <div className="order-summary-heading">
                <h2>Order Summary</h2>
                <span>{items.length} products</span>
              </div>

              <div className="order-summary-lines">
                <div className="order-summary-line">
                  <span>
                    Items ({items.reduce((sum, item) => sum + item.quantity, 0)}
                    )
                  </span>
                  <strong>{money(subtotal)}</strong>
                </div>

                <div className="order-summary-line">
                  <span>Shipping</span>
                  <strong>{money(shipping)}</strong>
                </div>

                <div className="order-summary-line">
                  <span>Tax</span>
                  <strong>{money(tax)}</strong>
                </div>
              </div>

              <div className="order-summary-total">
                <span>Total</span>
                <strong>{money(total)}</strong>
              </div>

              <p className="order-summary-currency">Prices are in AUD</p>

              <button
                type="submit"
                disabled={
                  isPending ||
                  Boolean(createdOrderId) ||
                  !items.length ||
                  !selectedCustomer
                }
                className="order-primary-button"
              >
                {isPending
                  ? "Creating Order..."
                  : createdOrderId
                    ? "Order Created"
                    : "Create Order"}
              </button>

              <p className="order-summary-note">
                This will create the order and trigger your configured backend
                integrations.
              </p>
            </div>
          </aside>
        </div>
      </form>

      {showSendConfirmation && (
        <div
          className="invoice-modal-backdrop"
          role="presentation"
          onMouseDown={() => setShowSendConfirmation(false)}
        >
          <div
            className="invoice-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-confirm-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="invoice-confirm-title">Send invoice?</h2>
            <p>
              The PDF invoice will be emailed to{" "}
              <strong>
                {invoice?.customerEmail || getText(selectedCustomer?.email)}
              </strong>
              .
            </p>
            <div className="invoice-modal-actions">
              <button
                type="button"
                className="order-secondary-button"
                onClick={() => setShowSendConfirmation(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="order-primary-button"
                onClick={sendInvoice}
              >
                Send Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
