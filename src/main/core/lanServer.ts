import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocketServer } from "ws";
import type { DeviceIdentity } from "./deviceIdentity";

const SHUTDOWN_TIMEOUT_MS = 1_000;

export interface StartLanServerOptions {
  identity: DeviceIdentity;
  host: string;
  preferredPort: number;
}

export interface LanServer {
  port: number;
  url: string;
  close(): Promise<void>;
}

export async function startLanServer({ identity, host, preferredPort }: StartLanServerOptions): Promise<LanServer> {
  const app = express();
  const server = http.createServer(app);
  const webSocketServer = new WebSocketServer({ server });

  app.get("/api/device", (_request, response) => {
    response.json({
      deviceId: identity.deviceId,
      displayName: identity.displayName,
      deviceType: "desktop"
    });
  });

  app.get("/mobile", (_request, response) => {
    response
      .type("html")
      .send("<!doctype html><html><head><meta charset=\"utf-8\"><title>LAN Transfer</title></head><body><h1>LAN Transfer</h1><p>Mobile transfer placeholder.</p></body></html>");
  });

  webSocketServer.on("connection", (socket) => {
    socket.send(
      JSON.stringify({
        type: "hello",
        deviceId: identity.deviceId
      })
    );
  });

  const port = await listen(server, preferredPort);

  return {
    port,
    url: `http://${host}:${port}`,
    close: () => closeServer(server, webSocketServer)
  };
}

function listen(server: http.Server, preferredPort: number): Promise<number> {
  return attemptListen(server, preferredPort).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE" || error.code === "EACCES") {
      return attemptListen(server, 0);
    }

    throw error;
  });
}

function attemptListen(server: http.Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException): void => {
      server.off("listening", onListening);
      reject(error);
    };

    const onListening = (): void => {
      server.off("error", onError);
      const address = server.address() as AddressInfo;
      resolve(address.port);
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "0.0.0.0");
  });
}

function closeServer(server: http.Server, webSocketServer: WebSocketServer): Promise<void> {
  for (const client of webSocketServer.clients) {
    client.terminate();
  }

  return closeWebSocketServer(webSocketServer).then(() => closeHttpServer(server));
}

function closeWebSocketServer(webSocketServer: WebSocketServer): Promise<void> {
  return withTimeout(
    new Promise((resolve, reject) => {
      webSocketServer.close((webSocketError) => {
        if (webSocketError) {
          reject(webSocketError);
          return;
        }

        resolve();
      });
    }),
    SHUTDOWN_TIMEOUT_MS
  );
}

function closeHttpServer(server: http.Server): Promise<void> {
  return withTimeout(
    new Promise((resolve, reject) => {
      server.close((serverError) => {
        if (serverError) {
          reject(serverError);
          return;
        }

        resolve();
      });
    }),
    SHUTDOWN_TIMEOUT_MS
  );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then(resolve, reject)
      .finally(() => {
        clearTimeout(timeout);
      });
  });
}
