import * as dotenv from "dotenv";
import { AzureOpenAI } from "openai";
import { OpenAIRealtimeWS } from "openai/beta/realtime/ws";
import http from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { OpenAIRealtimeError } from "openai/beta/realtime/internal-base";
import { SessionCreatedEvent } from "openai/resources/beta/realtime/realtime";
import { Session } from "openai/resources/beta/realtime/sessions";
import { ResponseTextDeltaEvent } from "openai/lib/responses/EventTypes";

dotenv.config({ path: ".env" });

const PORT: number = parseInt(process.env.PORT || "3001", 10);

const allowedOrigins: string[] = [
  process.env.NEXT_PUBLIC_APP_URL,
  "http://localhost:3000",
].filter(
  (origin): origin is string => typeof origin === "string" && origin.length > 0
);

const WSS_SHARED_SECRET: string | undefined = process.env.WSS_SHARED_SECRET;

if (!WSS_SHARED_SECRET) {
  console.warn(
    "!!! WARNING: WSS_SHARED_SECRET is not set, Token authentication is disabled. !!!"
  );
}

console.log("Allowed origins for Socket.io:", allowedOrigins);

// Type for connection mapping (Socket.IO socket <-> Azure SDK client)
interface ConnectionPair {
  socket: Socket; // Socket.IO socket instance
  azureSession: Session; // Session Instance
}

const connections = new Map<string, ConnectionPair>(); // Map socket.id -> ConnectionPair

const azureEndpoint: string | undefined = process.env.AZURE_OPENAI_ENDPOINT;
const deploymentName: string | undefined =
  process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
const apiVersion: string | undefined = process.env.OPENAI_API_VERSION;
const apiKey: string | undefined = process.env.AZURE_OPENAI_API_KEY;

if (!azureEndpoint || !deploymentName || !apiVersion || !apiKey) {
  console.error(
    "Azure OpenAI SDK environment variables not fully set! Exiting."
  );
  process.exit(1);
}

// Client configuration setup
let azureOpenAIClient: AzureOpenAI;

try {
  azureOpenAIClient = new AzureOpenAI({
    apiKey: apiKey,
    apiVersion: apiVersion,
    deployment: deploymentName,
    endpoint: azureEndpoint,
  });
  console.log("SUCCESS: AzureOpenAI client configured");
} catch (error) {
  console.error("ERROR: Failed to initialise Azure Credentials/client:", error);
  process.exit();
}

// Basic HTTP server configuration.

const httpServer = http.createServer((_, res) => {
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("web-socketProxy server OK");
});

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: false,
  },
});

// --- Proxy connection complete ---

// New conneciton established

io.on("connect", async (socket: Socket) => {
  const connectionId = socket.id // get the unique conneciton id
  console.log(`✅: ${connectionId} Client connected via socket.io`);

  let azureRtClient: OpenAIRealtimeWS | null = null

  try {
    // attempt connection with Azure Realtime Service.
    azureRtClient = await OpenAIRealtimeWS.azure(azureOpenAIClient)
    if (!azureRtClient) {
      throw new Error("FAILED ❌: Azure Client initialisation failed")
    }

    // azureRtClient.socket.on("open", (azureSocket: any) => {
    //   console.log(`✅: ${azureSocket} Azure WebSocket ready!`);
    //   // console.log("typof", typeof (azureSocket))
    //   azureRtClient?.send({
    //     type: "session.update",
    //     session: {
    //       modalities: ["text"],
    //       model: "gpt-4o-mini-realtime-preview",
    //     },
    //   });
    //   azureRtClient?.send({
    //     type: "conversation.item.create",
    //     item: {
    //       type: "message",
    //       role: "user",
    //       content: [{ type: "input_text", text: "Write a Poem for me in exactly 100 words" }],
    //     },
    //   });
    //   azureRtClient?.send({ type: "response.create" }); // ready to receive response from model.
    // });

    azureRtClient.on("session.created", (event: SessionCreatedEvent) => {
      // console.log("SUCCESS: Session Created", event.session)
      connections.set(connectionId, { socket, azureSession: event.session })
      socket.emit("ws_ready");
    })

    azureRtClient.on("response.text.delta", (event) => {
      socket.emit("response_text_delta", event)
    })

    azureRtClient.on('response.text.done', (event) => console.log("END:", event.content_index));

    // azureRtClient.on('response.done', () => console.log("RESPONSE FINISHED"));

    // azureRtClient.socket.on('close', () => console.log('\nConnection closed!'));

    // Handle SDK-level errors
    azureRtClient.on("error", (error: OpenAIRealtimeError) => {
      console.error(`[${connectionId}] Azure SDK Error Event:`, error);
      if (socket.connected) {
        socket.emit("ws_error", {
          code: "AZURE_SDK_ERROR",
          message: error.message || "Upstream SDK error.",
        });
      }
    });

    // Handle Azure WebSocket closure
    azureRtClient.socket.on("close", (code: number, reason: Buffer) => {
      console.log(
        `[${connectionId}] Azure SDK Socket closed: ${code} - ${reason.toString()}`
      );
      if (socket.connected) {
        socket.emit("azure_disconnected", { code, reason: reason.toString() });
        socket.disconnect(true);
      }
      connections.delete(connectionId);
    });

    socket.on("disconnect", (reason) => {
      console.log(`[${connectionId}] Client disconnected: ${reason}`);
      if (azureRtClient) azureRtClient.close();
      connections.delete(connectionId);
    });

    // Signal Readiness to Frontend
  } catch (error) {
    console.error(`[${connectionId}] Setup failed:`, error);
    socket.emit("ws_error", { code: "INIT_FAILED", message: "Connection setup failed" });
    socket.disconnect(true);
  }
})

// General Socket.IO Error Handler
io.on("error", (error) => {
  console.error("Socket.IO Error:", error);
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Socket.IO Proxy Server started on port ${PORT}`);
  console.log(
    `🔒 Shared Secret Auth: ${WSS_SHARED_SECRET ? "Enabled" : "DISABLED"}`
  );
  console.log(`☁️ Azure Client Auth: Keyless (Entra ID / Managed Identity)`);
});

// const forwardSdkEvent = (
//   sdkEventName: string,
//   azureRtClient: OpenAIRealtimeWS,
//   socket: Socket,
//   connectionId: string,
//   socketEventName?: string
// ) => {
//   console.log("SOCKET EVENT", socketEventName);
//   console.log("SDK EVENT NAME", sdkEventName);
//   const targetEvent = socketEventName || sdkEventName.replace(/\./g, "_"); // Convert dots to underscores for event name
//   azureRtClient?.on(sdkEventName as any, (sdkEventData: any) => {
//     console.log(`[${connectionId}] Azure SDK -> SIO Emit: ${targetEvent}`);
//     // Ensure socket is still connected before emitting
//     if (socket.connected) {
//       socket.emit(targetEvent, sdkEventData);
//     } else {
//       console.log(
//         `[${connectionId}] Cannot emit ${targetEvent}, socket disconnected.`
//       );
//     }
//   });
// };
