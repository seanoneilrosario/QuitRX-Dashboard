import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteResource, saveResource } from "../actions";
import { safeRetailAll, safeRetailList, safeRetailPage, safeRetailRecord, type RetailPagination, type RetailRecord } from "@/lib/quithero-admin";
import styles from "./dashboard.module.css";
import { logoutStaff } from "../login/actions";

export const metadata: Metadata = { title: "Staff Dashboard | QuitRX" };

const routes = [
  [], ["products"], ["products", "create"], ["products", "edit"], ["products", "variants"],
  ["products", "images"], ["products", "options"], ["products", "tags"], ["products", "collections"],
  ["collections"], ["collections", "details"],
  ["customers"], ["customers", "details"], ["customers", "edit"],
  ["orders"], ["orders", "details"], ["inventory"], ["inventory", "history"],
];

export function generateStaticParams() { return routes.map((section) => ({ section })); }

type Props = {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const nav = [
  { label: "Dashboard", href: "/dashboard", icon: "⌂" },
  { label: "Products", href: "/dashboard/products", icon: "□" },
  { label: "Collections", href: "/dashboard/collections", icon: "◇" },
  { label: "Customers", href: "/dashboard/customers", icon: "♙" },
  { label: "Orders", href: "/dashboard/orders", icon: "▤" },
  { label: "Inventory", href: "/dashboard/inventory", icon: "▥" },
];

function text(value: unknown, fallback = "—") { return typeof value === "string" || typeof value === "number" ? String(value) : fallback; }
function money(value: unknown) { const amount = Number(value); return Number.isFinite(amount) ? new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(amount) : "—"; }
function nested(item: RetailRecord, key: string) { const value = item[key]; return value && typeof value === "object" ? value as RetailRecord : undefined; }

function Header({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <header className={styles.pageHeader}><div><p className={styles.eyebrow}>QuitRX operations</p><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}

function Notice({ message }: { message?: string }) {
  return message ? <div className={styles.notice}><strong>API connection needed</strong><span>{message}</span></div> : null;
}

function Search({ placeholder, query }: { placeholder: string; query?: string }) {
  return <form className={styles.search}><span>⌕</span><input name="q" aria-label="Search" placeholder={placeholder} defaultValue={query}/><button>Search</button></form>;
}

function Status({ value }: { value: unknown }) {
  const label = text(value, "ACTIVE");
  return <span className={`${styles.status} ${/draft|pending|low/i.test(label) ? styles.warning : ""}`}>{label.replaceAll("_", " ")}</span>;
}

function Table({ heads, children }: { heads: string[]; children: React.ReactNode }) {
  return <div className={styles.tableWrap}><table><thead><tr>{heads.map((head) => <th key={head}>{head}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}

function Pagination({ pagination, path, query, status }: { pagination: RetailPagination; path: string; query?: string; status?: string }) {
  if (pagination.totalPages <= 1) return null;
  const href = (page: number) => `${path}?page=${page}${query ? `&q=${encodeURIComponent(query)}` : ""}${status ? `&status=${encodeURIComponent(status)}` : ""}`;
  return <nav className={styles.pagination} aria-label="Pagination"><span>Showing page {pagination.page} of {pagination.totalPages} · {pagination.total.toLocaleString()} records</span><div>{pagination.page > 1 ? <Link href={href(pagination.page - 1)}>Previous</Link> : <span>Previous</span>}{pagination.page < pagination.totalPages ? <Link href={href(pagination.page + 1)}>Next</Link> : <span>Next</span>}</div></nav>;
}

function Dashboard({ productTotal, customerTotal, orders, variants, error }: { productTotal: number; customerTotal: number; orders: RetailRecord[]; variants: RetailRecord[]; error?: string }) {
  const revenue = orders.reduce((sum, order) => sum + Number(order.total ?? order.totalPrice ?? 0), 0);
  const stock = variants.reduce((sum, variant) => sum + Number(variant.inventory ?? 0), 0);
  const lowStock = variants.filter((variant) => Number(variant.inventory ?? 0) <= 10).length;
  return <><Header title="Good morning, team" description="Here’s what’s happening across your store today." action={<Link className={styles.primary} href="/dashboard/products/create">+ Add product</Link>}/><Notice message={error}/>
    <section className={styles.metrics}>
      {[ ["Total sales", money(revenue), "Across loaded orders"], ["Orders", orders.length, "Current API results"], ["Products", productTotal, "Product records"], ["Customers", customerTotal, "Customer records"], ["Units in stock", stock, `${lowStock} low-stock variants`] ].map(([label, value, note]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}
    </section>
    <div className={styles.twoCols}><section className={styles.card}><div className={styles.cardTitle}><div><h2>Recent orders</h2><p>Latest customer purchases</p></div><Link href="/dashboard/orders">View all</Link></div><Table heads={["Order", "Customer", "Total", "Status"]}>{orders.slice(0, 5).map((order, index) => <tr key={text(order.id, String(index))}><td><Link href={`/dashboard/orders/details?id=${text(order.id)}`}>#{text(order.orderNumber ?? order.id, String(index + 1))}</Link></td><td>{text(order.customerName ?? nested(order, "customer")?.email)}</td><td>{money(order.total ?? order.totalPrice)}</td><td><Status value={order.status}/></td></tr>)}</Table></section>
    <section className={styles.card}><div className={styles.cardTitle}><div><h2>Inventory health</h2><p>Variants needing attention</p></div><Link href="/dashboard/inventory">Manage</Link></div><div className={styles.stockList}>{variants.slice(0, 6).map((variant, index) => <div key={text(variant.id, String(index))}><span><strong>{text(variant.name)}</strong><small>{text(variant.sku)}</small></span><b>{text(variant.inventory, "0")} units</b></div>)}</div></section></div></>;
}

function Products({ items, query, status, page, pagination, error }: { items: RetailRecord[]; query: string; status: string; page: number; pagination: RetailPagination; error?: string }) {
  const filtered = items.filter((item) => {
    const matchesQuery = !query || `${text(item.name)} ${text(item.slug)} ${text(item.status)} ${text(nested(item, "brand")?.name)} ${text(nested(item, "productType")?.name)}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = !status || text(item.status, "").toLowerCase() === status.toLowerCase();
    return matchesQuery && matchesStatus;
  });
  const isFiltered = Boolean(query || status);
  const filteredPagination = isFiltered ? { page, limit: 50, total: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / 50)) } : pagination;
  const visibleItems = isFiltered ? filtered.slice((page - 1) * 50, page * 50) : filtered;
  return <><Header title="Products" description="Manage products and everything customers see in your store." action={<Link className={styles.primary} href="/dashboard/products/create">+ Create product</Link>}/><Notice message={error}/><div className={styles.toolbar}><form className={styles.search}><span>⌕</span><input name="q" aria-label="Search products" placeholder="Search name, handle, brand or type" defaultValue={query}/><select name="status" aria-label="Filter by status" defaultValue={status}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="DRAFT">Draft</option><option value="ARCHIVED">Archived</option></select><button>Apply</button></form><div className={styles.subnav}>{[["Variants","variants"],["Images","images"],["Options","options"],["Tags","tags"]].map(([label, path]) => <Link key={path} href={`/dashboard/products/${path}`}>{label}</Link>)}</div></div><Table heads={["Product", "Brand", "Type", "Status", "Actions"]}>{visibleItems.map((item, index) => <tr key={text(item.id, String(index))}><td><strong>{text(item.name)}</strong><small>{text(item.slug)}</small></td><td>{text(nested(item, "brand")?.name ?? item.brandId)}</td><td>{text(nested(item, "productType")?.name ?? item.productTypeId)}</td><td><Status value={item.status}/></td><td className={styles.actions}><Link href={`/dashboard/products/edit?id=${text(item.id)}`}>Edit</Link><form action={deleteResource}><input type="hidden" name="_resource" value="products"/><input type="hidden" name="_id" value={text(item.id)}/><button>Delete</button></form></td></tr>)}</Table>{!visibleItems.length ? <div className={styles.notice}><strong>No products found</strong><span>Try changing the search text or status filter.</span></div> : null}<Pagination pagination={filteredPagination} path="/dashboard/products" query={query} status={status}/></>;
}

function ProductForm({ item }: { item?: RetailRecord }) {
  return <><Header title={item ? "Edit product" : "Create product"} description="Product information is saved directly to the QuitHero Retail API."/><form action={saveResource} className={styles.form}><input type="hidden" name="_resource" value="products"/><input type="hidden" name="_id" value={text(item?.id, "")}/><input type="hidden" name="_returnTo" value="/dashboard/products"/><section className={styles.formCard}><h2>Product details</h2><div className={styles.formGrid}><label>Name<input required name="name" defaultValue={text(item?.name, "")}/></label><label>Slug<input required name="slug" defaultValue={text(item?.slug, "")}/></label><label>Brand ID<input required name="brandId" defaultValue={text(item?.brandId ?? nested(item ?? {}, "brand")?.id, "")}/></label><label>Product type ID<input required name="productTypeId" defaultValue={text(item?.productTypeId ?? nested(item ?? {}, "productType")?.id, "")}/></label><label className={styles.full}>Short description<textarea name="shortDescription" defaultValue={text(item?.shortDescription, "")}/></label><label className={styles.full}>Description<textarea rows={7} name="description" defaultValue={text(item?.description, "")}/></label><label>Status<select name="status" defaultValue={text(item?.status, "DRAFT")}><option>DRAFT</option><option>ACTIVE</option><option>ARCHIVED</option></select></label><label>Primary image ID<input name="imageId" defaultValue={text(item?.imageId, "")}/></label><label>SEO title<input name="seoTitle" defaultValue={text(item?.seoTitle, "")}/></label><label>SEO description<input name="seoDescription" defaultValue={text(item?.seoDescription, "")}/></label></div></section><div className={styles.formActions}><Link href="/dashboard/products">Cancel</Link><button className={styles.primary}>{item ? "Save changes" : "Create product"}</button></div></form></>;
}

const resourceConfig: Record<string, { title: string; description: string; resource: string; heads: string[]; fields: [string, string, string?][] }> = {
  variants: { title: "Product variants", description: "Manage pricing, SKUs and inventory by variant.", resource: "product-variants", heads: ["Variant", "SKU", "Price", "Available", "Actions"], fields: [["productId","Product ID"],["name","Variant name"],["sku","SKU"],["price","Price","number"],["cost","Cost","number"],["inventory","Inventory","number"]] },
  images: { title: "Product images", description: "Add image URLs, alt text and display order.", resource: "product-images", heads: ["Image URL", "Product", "Alt text", "Order", "Actions"], fields: [["productId","Product ID"],["url","Image URL","url"],["altText","Alt text"],["sortOrder","Sort order","number"]] },
  options: { title: "Options & attributes", description: "Create reusable options such as strength, flavour or size.", resource: "product-options", heads: ["Option", "Slug", "ID", "", "Actions"], fields: [["name","Option name"],["slug","Slug"]] },
  tags: { title: "Tags", description: "Organise and merchandise products with tags.", resource: "tags", heads: ["Tag", "Slug", "SEO title", "", "Actions"], fields: [["name","Tag name"],["slug","Slug"],["image","Image URL","url"],["seoTitle","SEO title"]] },
  collections: { title: "Collections", description: "Group products into storefront collections.", resource: "collections", heads: ["Collection", "Slug", "SEO title", "", "Actions"], fields: [["name","Collection name"],["slug","Slug"],["description","Description"],["image","Image URL","url"],["seoTitle","SEO title"]] },
};

function ResourcePage({ kind, items, error, path = `/dashboard/products/${kind}` }: { kind: string; items: RetailRecord[]; error?: string; path?: string }) {
  const config = resourceConfig[kind];
  return <><Header title={config.title} description={config.description}/><Notice message={error}/><details className={styles.creator}><summary>+ Add {config.title.toLowerCase().replace(/s$/, "")}</summary><form action={saveResource}><input type="hidden" name="_resource" value={config.resource}/><input type="hidden" name="_returnTo" value={path}/><div className={styles.inlineForm}>{config.fields.map(([name, label, type]) => <label key={name}>{label}<input required={["productId","name","sku","price","url","slug"].includes(name)} type={type ?? "text"} step={type === "number" ? "any" : undefined} name={name}/></label>)}</div><button className={styles.primary}>Save</button></form></details><Table heads={config.heads}>{items.map((item, index) => <tr key={text(item.id, String(index))}><td><strong>{text(item.name ?? item.url)}</strong><small>{text(item.productId)}</small></td><td>{text(item.sku ?? item.slug ?? item.productId)}</td><td>{kind === "variants" ? money(item.price) : text(item.altText ?? item.seoTitle ?? item.id)}</td><td>{text(item.inventory ?? item.sortOrder, "")}</td><td className={styles.actions}><form action={deleteResource}><input type="hidden" name="_resource" value={config.resource}/><input type="hidden" name="_id" value={text(item.id)}/><button>Delete</button></form></td></tr>)}</Table></>;
}

function Customers({ items, query, pagination, error }: { items: RetailRecord[]; query: string; pagination: RetailPagination; error?: string }) {
  const filtered = items.filter((item) => !query || `${text(item.firstName)} ${text(item.lastName)} ${text(item.email)}`.toLowerCase().includes(query.toLowerCase()));
  return <><Header title="Customers" description="Search customer accounts, purchase history and prescription status."/><Notice message={error}/><div className={styles.toolbar}><Search placeholder="Search name or email"/></div><Table heads={["Customer", "Contact", "Orders", "Total spent", "Status", ""]}>{filtered.map((item, index) => <tr key={text(item.id, String(index))}><td><strong>{text(item.firstName)} {text(item.lastName, "")}</strong><small>{text(item.id)}</small></td><td>{text(item.email)}<small>{text(item.phone)}</small></td><td>{text(item.numberOfOrders, "0")}</td><td>{money(item.totalSpent)}</td><td><Status value={item.state}/></td><td><Link href={`/dashboard/customers/details?id=${text(item.id)}`}>View</Link></td></tr>)}</Table><Pagination pagination={pagination} path="/dashboard/customers" query={query}/></>;
}

function CustomerDetail({ item, editing }: { item?: RetailRecord; editing?: boolean }) {
  if (!item) return <><Header title="Customer not found" description="Choose a customer from the customer list."/><Link className={styles.primary} href="/dashboard/customers">Back to customers</Link></>;
  if (editing) return <><Header title="Edit customer" description="Update customer information in QuitHero."/><form action={saveResource} className={styles.form}><input type="hidden" name="_resource" value="customers"/><input type="hidden" name="_id" value={text(item.id)}/><input type="hidden" name="_returnTo" value={`/dashboard/customers/details?id=${text(item.id)}`}/><section className={styles.formCard}><div className={styles.formGrid}>{[["firstName","First name"],["lastName","Last name"],["email","Email"],["phone","Phone"],["birthday","Birthday"],["gender","Gender"],["scriptId","Script ID"],["scriptExpiry","Script expiry"]].map(([name,label]) => <label key={name}>{label}<input name={name} defaultValue={text(item[name], "")}/></label>)}</div></section><div className={styles.formActions}><Link href={`/dashboard/customers/details?id=${text(item.id)}`}>Cancel</Link><button className={styles.primary}>Save changes</button></div></form></>;
  return <><Header title={`${text(item.firstName)} ${text(item.lastName, "")}`} description={text(item.email)} action={<Link className={styles.primary} href={`/dashboard/customers/edit?id=${text(item.id)}`}>Edit customer</Link>}/><div className={styles.detailGrid}><section className={styles.card}><h2>Customer information</h2>{[["Email",item.email],["Phone",item.phone],["Birthday",item.birthday],["Account state",item.state],["Verified email",item.verifiedEmail ? "Yes" : "No"]].map(([label,value]) => <div className={styles.detailRow} key={String(label)}><span>{text(label)}</span><strong>{text(value)}</strong></div>)}</section><section className={styles.card}><h2>Prescription & purchases</h2>{[["Total orders",item.numberOfOrders],["Total spent",money(item.totalSpent)],["Script ID",item.scriptId],["Script expiry",item.scriptExpiry],["Script active",item.scriptActive ? "Yes" : "No"]].map(([label,value]) => <div className={styles.detailRow} key={String(label)}><span>{text(label)}</span><strong>{text(value)}</strong></div>)}</section></div></>;
}

function Orders({ items, query, detail, error }: { items: RetailRecord[]; query: string; detail?: RetailRecord; error?: string }) {
  if (detail) { const customer = nested(detail, "customer"); const lineItems = Array.isArray(detail.items) ? detail.items as RetailRecord[] : Array.isArray(detail.lineItems) ? detail.lineItems as RetailRecord[] : []; return <><Header title={`Order #${text(detail.orderNumber ?? detail.id)}`} description={`Placed by ${text(customer?.email ?? detail.customerEmail)}`} action={<Link className={styles.secondary} href="/dashboard/orders">Back to orders</Link>}/><div className={styles.detailGrid}><section className={styles.card}><h2>Order summary</h2>{[["Status",detail.status],["Payment",detail.financialStatus],["Fulfilment",detail.fulfillmentStatus],["Total",money(detail.total ?? detail.totalPrice)]].map(([label,value]) => <div className={styles.detailRow} key={String(label)}><span>{text(label)}</span><strong>{text(value)}</strong></div>)}</section><section className={styles.card}><h2>Customer</h2><p>{text(customer?.firstName)} {text(customer?.lastName, "")}</p><p>{text(customer?.email ?? detail.customerEmail)}</p></section></div><section className={styles.card}><h2>Order items</h2><Table heads={["Item", "SKU", "Quantity", "Price"]}>{lineItems.map((line,index) => <tr key={text(line.id,String(index))}><td>{text(line.name ?? line.title)}</td><td>{text(line.sku)}</td><td>{text(line.quantity,"1")}</td><td>{money(line.price)}</td></tr>)}</Table></section><div className={styles.notice}><strong>Status updates are read-only</strong><span>The published UpdateOrderDto has no documented fields. Add status controls once the API contract exposes them.</span></div></>; }
  const filtered = items.filter((item) => !query || JSON.stringify(item).toLowerCase().includes(query.toLowerCase()));
  return <><Header title="Orders" description="Review purchases, customers, items and fulfilment state."/><Notice message={error}/><div className={styles.toolbar}><Search placeholder="Search order or customer"/></div><Table heads={["Order", "Customer", "Date", "Total", "Status", ""]}>{filtered.map((item,index) => <tr key={text(item.id,String(index))}><td><strong>#{text(item.orderNumber ?? item.id)}</strong></td><td>{text(item.customerEmail ?? nested(item,"customer")?.email)}</td><td>{text(item.createdAt)}</td><td>{money(item.total ?? item.totalPrice)}</td><td><Status value={item.status}/></td><td><Link href={`/dashboard/orders/details?id=${text(item.id)}`}>View</Link></td></tr>)}</Table></>;
}

function Inventory({ variants, history, error }: { variants: RetailRecord[]; history?: RetailRecord[]; error?: string }) {
  if (history) return <><Header title="Inventory history" description="Audit activity returned by QuitHero." action={<Link className={styles.secondary} href="/dashboard/inventory">Back to inventory</Link>}/><Notice message={error}/><Table heads={["Event", "Resource", "Staff", "Date"]}>{history.map((item,index) => <tr key={text(item.id,String(index))}><td>{text(item.action ?? item.event)}</td><td>{text(item.resource ?? item.entity)}</td><td>{text(item.user ?? item.staffEmail)}</td><td>{text(item.createdAt)}</td></tr>)}</Table></>;
  return <><Header title="Inventory" description="Manage available, allocated and incoming stock by product variant." action={<Link className={styles.secondary} href="/dashboard/inventory/history">View history</Link>}/><Notice message={error}/><Table heads={["Variant", "SKU", "Available", "Allocated", "Incoming", "Health"]}>{variants.map((item,index) => <tr key={text(item.id,String(index))}><td><strong>{text(item.name)}</strong><small>{text(item.productId)}</small></td><td>{text(item.sku)}</td><td>{text(item.inventory,"0")}</td><td>{text(item.allocatedInventory,"0")}</td><td>{text(item.incomingInventory,"0")}</td><td><Status value={Number(item.inventory ?? 0) <= 10 ? "LOW STOCK" : "HEALTHY"}/></td></tr>)}</Table></>;
}

export default async function DashboardPage({ params, searchParams }: Props) {
  const { section = [] } = await params; const queryParams = await searchParams;
  if (!routes.some((route) => route.join("/") === section.join("/"))) notFound();
  const [area = "dashboard", sub] = section; const q = typeof queryParams.q === "string" ? queryParams.q.trim() : ""; const status = typeof queryParams.status === "string" ? queryParams.status : ""; const id = typeof queryParams.id === "string" ? queryParams.id : ""; const page = Math.max(1, Number(queryParams.page) || 1);
  const active = area === "dashboard" ? "/dashboard" : `/dashboard/${area}`;
  let content: React.ReactNode;
  if (area === "dashboard") { const [p,c,o,v] = await Promise.all([safeRetailPage("/products",1),safeRetailPage("/customers",1),safeRetailList("/orders"),safeRetailList("/product-variants")]); content = <Dashboard productTotal={p.pagination.total} customerTotal={c.pagination.total} orders={o.data} variants={v.data} error={p.error ?? c.error ?? o.error ?? v.error}/>; }
  else if (area === "products" && !sub) { const result = q || status ? await safeRetailAll("/products") : await safeRetailPage("/products", page, 50); content = <Products items={result.data} query={q} status={status} page={page} pagination={result.pagination} error={result.error}/>; }
  else if (area === "products" && sub === "create") content = <ProductForm/>;
  else if (area === "products" && sub === "edit") { const result = await safeRetailRecord(`/products/${encodeURIComponent(id)}`); content = <ProductForm item={result.data}/>; }
  else if (area === "products" && resourceConfig[sub]) { const config = resourceConfig[sub]; const result = await safeRetailList(`/${config.resource}`); content = <ResourcePage kind={sub} items={result.data} error={result.error}/>; }
  else if (area === "collections") {
    const result = await safeRetailList("/collections");
    content = <ResourcePage kind="collections" items={result.data} error={result.error} path="/dashboard/collections"/>;
  }
  else if (area === "customers" && !sub) { const result = await safeRetailPage("/customers", page, 50); content = <Customers items={result.data} query={q} pagination={result.pagination} error={result.error}/>; }
  else if (area === "customers") { const result = await safeRetailRecord(`/customers/${encodeURIComponent(id)}`); content = <CustomerDetail item={result.data} editing={sub === "edit"}/>; }
  else if (area === "orders") { const result = await safeRetailList("/orders"); content = <Orders items={result.data} query={q} detail={sub === "details" ? result.data.find((item) => item.id === id) : undefined} error={result.error}/>; }
  else { const result = await safeRetailList(sub === "history" ? "/audit-logs" : "/product-variants"); content = <Inventory variants={sub ? [] : result.data} history={sub === "history" ? result.data : undefined} error={result.error}/>; }
  return <div className={styles.shell}><aside><Link className={styles.logo} href="/"><span>Q</span><strong>QuitRX</strong></Link><nav>{nav.map((item) => <Link className={active === item.href ? styles.active : ""} key={item.href} href={item.href}><i>{item.icon}</i>{item.label}</Link>)}</nav><div className={styles.profile}><span>ST</span><div><strong>Staff account</strong><small>Operations</small></div><form action={logoutStaff}><button type="submit">Logout</button></form></div></aside><main><div className={styles.mobileTop}><Link className={styles.logo} href="/"><span>Q</span><strong>QuitRX</strong></Link><nav>{nav.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}</nav><form action={logoutStaff}><button type="submit">Logout</button></form></div>{content}</main></div>;
}
