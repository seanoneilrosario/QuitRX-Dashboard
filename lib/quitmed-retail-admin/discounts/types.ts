
export type DiscountMethod =
  | "PERCENTAGE"
  | "FIXED_AMOUNT"
  | "BUY_X_GET_Y"
  | "FREE_SHIPPING";

export type DiscountScope = "ORDER" | "PRODUCT" | "SHIPPING";

export type BuyXGetYBenefit =
  | "FREE"
  | "PERCENTAGE"
  | "FIXED_AMOUNT";

export type DiscountProductRole =
  | "APPLIES_TO"
  | "BUY_X"
  | "GET_Y";

export type DiscountProductAssignment = {
  productId: string;
  role?: DiscountProductRole;
};

export type DiscountVariantAssignment = {
  variantId: string;
  role?: DiscountProductRole;
};

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
  product?: {
    id?: string;
    title?: string | null;
    name?: string | null;
  };
  variant?: {
    id?: string;
    name?: string | null;
    sku?: string | null;
    price?: string | number | null;
  };
  customer?: {
    id?: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  };
  segment?: {
    id?: string;
    name?: string | null;
    isActive?: boolean;
  };
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
  productAssignments?: {
    productId: string;
    role?: "APPLIES_TO" | "BUY_X" | "GET_Y";
  }[];

  variantAssignments?: {
    variantId: string;
    role?: "APPLIES_TO" | "BUY_X" | "GET_Y";
  }[];
}

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
  productAssignments?: {
    productId: string;
    role?: "APPLIES_TO" | "BUY_X" | "GET_Y";
  }[];

  variantAssignments?: {
    variantId: string;
    role?: "APPLIES_TO" | "BUY_X" | "GET_Y";
  }[];
  customerIds?: string[];
  segmentIds?: string[];
}

export interface ActionResult<T = undefined> {
  success: boolean;
  message?: string;
  data?: T;
}
