"use client";

import { useEffect } from "react";
import { socket } from "./socket";

export default function RealtimeConnection() {
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
  }, []);

  useEffect(() => {
    const handleCustomerCreated = (data: unknown) => {
      console.log("Realtime customer.created:", data);
    };

    socket.on("customer.created", handleCustomerCreated);

    return () => {
      socket.off("customer.created", handleCustomerCreated);
    };
  }, []);

  return null;
}
