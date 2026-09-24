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
    const handleConnectError = (error: Error) => {
      console.error("Realtime connection error:", error.message);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.connect();

    return () => {
      socket.disconnect();
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
    };
  }, []);

  return null;
}
