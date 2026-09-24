"use client";

import { useEffect } from "react";
import { socket } from "./socket";

export default function RealtimeConnection() {
  useEffect(() => {
    const handleCustomerCreated = (data: unknown) => {
      console.log("Realtime customer.created:", data);
    };

    const handleCustomerUpdated = (data: unknown) => {
      console.log("Realtime customer.updated:", data);
    };

    const handleCustomerDeleted = (data: unknown) => {
      console.log("Realtime customer.deleted:", data);
    };

    socket.on("customer.created", handleCustomerCreated);
    socket.on("customer.updated", handleCustomerUpdated);
    socket.on("customer.deleted", handleCustomerDeleted);

    return () => {
      socket.off("customer.created", handleCustomerCreated);
      socket.off("customer.updated", handleCustomerUpdated);
      socket.off("customer.deleted", handleCustomerDeleted);
    };
  }, []);

  // useEffect(() => {
  //   const handleCustomerCreated = (data: unknown) => {
  //     console.log("Realtime customer.created:", data);
  //   };

  //   socket.on("customer.created", handleCustomerCreated);

  //   return () => {
  //     socket.off("customer.created", handleCustomerCreated);
  //   };
  // }, []);

  return null;
}
