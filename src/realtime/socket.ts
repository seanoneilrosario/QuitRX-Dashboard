"use client";

import { io } from "socket.io-client";

export const socket = io("https://retail-api.quithero.com.au/realtime", {
  transports: ["websocket"],
  withCredentials: true,
  // Connect after mounting so server rendering never opens a connection.
  autoConnect: false,
});
