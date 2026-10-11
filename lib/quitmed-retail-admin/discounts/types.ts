export type DiscountMethod =
  | "PERCENTAGE"
  | "FIXED_AMOUNT"
  | "BUY_X_GET_Y"
  | "FREE_SHIPPING";

export type DiscountScope = "ORDER" | "PRODUCT" | "SHIPPING";
export type BuyXGetYBenefit = "FREE" | "PERCENTAGE" | "FIXED_AMOUNT";

export interface DiscountRelation {
  id?: string;
  customerId?: string;
  segmentId?: string;
  productId?: string;
  variantId?: string;
  role?: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  product?: { id?: string; title?: string | null; name?: string | null };
  variant?: { id?: string; name?: string | null; sku?: string | null; price?: string | number | null };
  customer?: { id?: string; firstName?: string | null; lastName?: string | null; email?: string | null };
  segment?: { id?: string; name?: string | null; isActive?: boolean };
}

export interface Discount {
  id: string;
  name: string;
  description?: string | null;
  code?: string | null;
  isAutomatic: boolean;
  isActive: boolean;
  method: DiscountMethod;
  scope: DiscountScope;
  value?: string | number | null;
  maxDiscountAmount?: string | number | null;
  minSubtotal?: string | number | null;
  minQuantity?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  usageLimit?: number | null;
  usageCount?: number;
  perCustomerUsageLimit?: number | null;
  buyQuantity?: number | null;
  getQuantity?: number | null;
  getDiscountType?: BuyXGetYBenefit | null;
  getDiscountValue?: string | number | null;
  priority?: number;
  combineWithProductDiscounts?: boolean;
  combineWithOrderDiscounts?: boolean;
  combineWithShippingDiscounts?: boolean;
  createdAt?: string;
  updatedAt?: string;
  products?: DiscountRelation[];
  variants?: DiscountRelation[];
  customers?: DiscountRelation[];
  segments?: DiscountRelation[];
}

/**
 * Payload expected by the discounts API.
 * The API accepts customerIds and segmentIds (confirmed by the live API).
 * productIds and variantIds are included for product/variant targeting and should
 * match the names used by your Discounts DTO/service.
 */
export interface DiscountPayload {
  name: string;
  description?: string | null;
  code?: string | null;
  isAutomatic: boolean;
  isActive: boolean;
  method: DiscountMethod;
  scope: DiscountScope;
  value?: number | null;
  maxDiscountAmount?: number | null;
  minSubtotal?: number | null;
  minQuantity?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  usageLimit?: number | null;
  perCustomerUsageLimit?: number | null;
  buyQuantity?: number | null;
  getQuantity?: number | null;
  getDiscountType?: BuyXGetYBenefit | null;
  getDiscountValue?: number | null;
  priority?: number;
  combineWithProductDiscounts: boolean;
  combineWithOrderDiscounts: boolean;
  combineWithShippingDiscounts: boolean;
  productIds?: string[];
  variantIds?: string[];
  customerIds?: string[];
  segmentIds?: string[];
}

export interface ActionResult<T = undefined> {
  success: boolean;
  message?: string;
  data?: T;
}
