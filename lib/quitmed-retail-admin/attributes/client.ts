import "server-only";

import { retailRequest } from "../collections/client";

export type AttributeType =
  | "TEXT"
  | "NUMBER"
  | "BOOLEAN"
  | "SELECT"
  | "MULTI_SELECT";

export type AttributeValue = {
  id: string;
  attributeId: string;
  value: string;
  numberValue?: string | number | null;
  booleanValue?: boolean | null;
  createdAt: string;
  updatedAt: string;
};

export type Attribute = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  type: AttributeType;
  filterable: boolean;
  searchable: boolean;
  active: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
  values: AttributeValue[];
};

export async function getAttributes(): Promise<Attribute[]> {
  return retailRequest<Attribute[]>("/attributes", {
    method: "GET",
    cache: "no-store",
  });
}

export type CreateAttributeInput = {
  name: string;
  slug: string;
  description?: string;
  type: AttributeType;
  filterable?: boolean;
  searchable?: boolean;
  active?: boolean;
  position?: number;
};

export async function createAttribute(
  data: CreateAttributeInput,
): Promise<Attribute> {
  return retailRequest<Attribute>("/attributes", {
    method: "POST",
    body: JSON.stringify(data),
    cache: "no-store",
  });
}

export async function getAttribute(
  id: string,
): Promise<Attribute> {
  return retailRequest<Attribute>(
    `/attributes/${encodeURIComponent(id)}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );
}

export async function updateAttribute(
  id: string,
  data: CreateAttributeInput,
): Promise<Attribute> {
  return retailRequest<Attribute>(
    `/attributes/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
      cache: "no-store",
    },
  );
}

export async function removeAttribute(
  id: string,
): Promise<void> {
  await retailRequest(
    `/attributes/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      cache: "no-store",
    },
  );
}