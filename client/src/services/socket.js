import { io } from "socket.io-client";
import { SERVER_URL } from "../config";

let socket;

export function connectSocket() {
  if (!socket) {
    socket = io(SERVER_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      timeout: 8888,
    });
  }
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = undefined;
  }
}
