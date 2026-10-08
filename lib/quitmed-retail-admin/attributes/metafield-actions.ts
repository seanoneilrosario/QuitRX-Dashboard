"use server";

import {
    Attribute,
  createAttribute,
  getAttribute,
  removeAttribute,
  updateAttribute,
  type CreateAttributeInput,
} from "../../../lib/quitmed-retail-admin/attributes/client";

export async function createAttributeAction(
  data: CreateAttributeInput,
) {
  await createAttribute(data);

  return {
    success: true,
  };
}

export async function getAttributeAction(
  id: string,
): Promise<Attribute> {
  return getAttribute(id);
}

export async function updateAttributeAction(
  id: string,
  data: CreateAttributeInput,
): Promise<Attribute> {
  return updateAttribute(id, data);
}

export async function removeAttributeAction(
  id: string,
) {
  await removeAttribute(id);

  return {
    success: true,
  };
}