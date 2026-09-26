"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { socket } from "./socket";

export default function RealtimeConnection() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleConnect = () => {
      console.log("Realtime connected:", socket.id);
    };

    const handleDisconnect = (reason: string) => {
      console.log("Realtime disconnected:", reason);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  },[]);

  useEffect(() => {
    const handleCustomerCreated = (data: unknown) => {
      console.log("Realtime customer.created:", data);
    };

    const handleCustomerUpdated = (data: unknown) => {
      console.log("Realtime customer.updated:", data);

      if (!data || typeof data !== "object") return;

      const payload = data as {
        customer?: {
          id?: unknown;
        };
      };

      const customerId = payload.customer?.id;

      if (typeof customerId !== "string") return;

      const currentCustomerId = searchParams.get("id");

      const isCustomerPage =
        pathname === "/dashboard/customers/details" ||
        pathname === "/dashboard/customers/edit";

      if (isCustomerPage && currentCustomerId === customerId) {
        console.log("Refreshing current customer:", customerId);
        router.refresh();
      }
    };

    const handleCustomerDeleted = (data: unknown) => {
      console.log("Realtime customer.deleted:", data);

      if (!data || typeof data !== "object") return;

      const payload = data as {
        id?: unknown;
      };

      const customerId = payload.id;

      if (typeof customerId !== "string") return;

      const currentCustomerId = searchParams.get("id");

      const isCustomerList =
        pathname === "/dashboard/customers";

      const isCustomerPage =
        pathname === "/dashboard/customers/details" ||
        pathname === "/dashboard/customers/edit";

      if (isCustomerList) {
        console.log("Refreshing customer list after delete:", customerId);
        router.refresh();
        return;
      }

      if (isCustomerPage && currentCustomerId === customerId) {
        console.log("Refreshing deleted customer page:", customerId);
        router.refresh();
      }
    };

    const handleOrderUpdated = (data: unknown) => {
      console.log("Realtime order.updated:", data);

      if (!data || typeof data !== "object") return;

      const payload = data as {
        order?: {
          id?: unknown;
        };
      };

      const orderId = payload.order?.id;

      if (typeof orderId !== "string") return;

      const currentOrderId = searchParams.get("id");

      const isOrderPage =
        pathname === "/dashboard/orders/details";

      if (isOrderPage && currentOrderId === orderId) {
        console.log("Refreshing current order:", orderId);
        router.refresh();
      }
    };

    socket.on("customer.created", handleCustomerCreated);
    socket.on("customer.updated", handleCustomerUpdated);
    socket.on("order.updated", handleOrderUpdated);
    socket.on("customer.deleted", handleCustomerDeleted);

    return () => {
      socket.off("customer.created", handleCustomerCreated);
      socket.off("customer.updated", handleCustomerUpdated);
      socket.off("order.updated", handleOrderUpdated);
      socket.off("customer.deleted", handleCustomerDeleted);
    };
  }, [pathname, router, searchParams]);

  return null;
}
