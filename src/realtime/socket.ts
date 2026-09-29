"use client";

import { io } from "socket.io-client";

export const socket = io("https://retail-api.quithero.com.au/realtime", {
  // Avoid the WebSocket upgrade rejected by the current Retail API deployment.
  transports: ["polling"],
  upgrade: false,
  withCredentials: true,
  autoConnect: false,
});
