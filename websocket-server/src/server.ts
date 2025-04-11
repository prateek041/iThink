import * as dotenv from "dotenv";
import { AzureOpenAI } from "openai";
import { OpenAIRealtimeWS } from "openai/beta/realtime/ws";
import http from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { OpenAIRealtimeError } from "openai/beta/realtime/internal-base";
import { RealtimeServerEvent, SessionCreatedEvent } from "openai/resources/beta/realtime/realtime";
import { Session } from "openai/resources/beta/realtime/sessions";

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
  azureRtClient: OpenAIRealtimeWS; // Azure RT Client
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

// New connection established
io.on("connect", async (socket: Socket) => {
  const connectionId = socket.id; // get the unique connection id
  console.log(`✅: ${connectionId} Client connected via socket.io`);

  let azureRtClient: OpenAIRealtimeWS | null = null;

  try {
    // attempt connection with Azure Realtime Service.
    azureRtClient = await OpenAIRealtimeWS.azure(azureOpenAIClient);
    if (!azureRtClient) {
      throw new Error("FAILED ❌: Azure Client initialisation failed");
    }

    azureRtClient.on("session.created", (event: SessionCreatedEvent) => {
      // Configure session for audio
      if (azureRtClient) {
        azureRtClient.send({
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            model: "gpt-4o-mini-realtime-preview",
            input_audio_format: "pcm16", // PCM 16-bit format
          },
        });
      }

      // Store connection
      connections.set(connectionId, {
        socket,
        azureSession: event.session,
        azureRtClient: azureRtClient as OpenAIRealtimeWS,
      });

      socket.emit("ws_ready");
    });

    azureRtClient.on("response.text.delta", (event) => {
      console.log("Sending text data", event.delta)
      socket.emit("response_text_delta", event);
    });

    azureRtClient.on("response.audio.delta", (data) => {
      console.log(
        `[${connectionId}] RECEIVING AUDIO DELTA of length: ${data.delta.length}`
      );
      const connection = connections.get(connectionId);
      if (!connection) {
        console.log(
          `[${connectionId}] No connection found when receiving audio delta`
        );
        return;
      }
      try {
        socket.emit("response_audio_delta", data)
      } catch (error) {
        console.error(`[${connectionId}] Error processing audio delta:`, error);
      }
    });

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
        socket.emit("azure_disconnected", {
          code,
          reason: reason.toString(),
        });
        socket.disconnect(true);
      }
      connections.delete(connectionId);
    });

    socket.on("test_flow", (payload: { data: string }) => {
      const connection = connections.get(connectionId)
      console.log("Paload data", payload.data)
      if (!connection) {
        console.log("unable to find connection")
        return
      }
      connection.azureRtClient.send({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: payload.data }]
        }
      })

      connection.azureRtClient.send({
        type: "response.create",
      })
    })

    // Handle audio chunks from frontend when user interrupts.
    // socket.on("audio_chunk", (payload: { data: string }) => {
    //   const connection = connections.get(connectionId);
    //   if (!connection) {
    //     console.warn(
    //       `[${connectionId}] Cannot process audio chunk, connection not found`
    //     );
    //     return;
    //   }
    //
    //   try {
    //     // Log the received audio chunk (avoid logging the full payload data)
    //     console.log(
    //       `[${connectionId}] Received audio chunk of length: ${payload.data.length}`
    //     );
    //
    //     // Decode base64 to get actual byte length
    //     const audioData = Buffer.from(payload.data, "base64");
    //
    //     // Store the audio chunk for debugging
    //     connection.inputAudioChunks.push(audioData);
    //
    //     // Calculate duration in milliseconds (assuming 16-bit PCM at 16kHz)
    //     // Each sample is 2 bytes (16-bit) and we're sampling at 16000Hz
    //     const durationMs = audioData.length / 2 / 16; // Convert bytes to samples, then to milliseconds
    //     connection.accumulatedAudioMs += durationMs;
    //
    //     console.log(
    //       `[${connectionId}] Audio chunk size: ${audioData.length
    //       } bytes, duration: ${durationMs.toFixed(
    //         2
    //       )}ms, total: ${connection.accumulatedAudioMs.toFixed(2)}ms`
    //     );
    //
    //     // Send the audio chunk to Azure
    //     connection.azureRtClient.send({
    //       type: "input_audio_buffer.append",
    //       audio: payload.data,
    //     });
    //   } catch (error) {
    //     console.error(`[${connectionId}] Error processing audio chunk:`, error);
    //   }
    // });

    socket.on("disconnect", (reason) => {
      console.log(`[${connectionId}] Client disconnected: ${reason}`);
      if (azureRtClient) azureRtClient.close();
      connections.delete(connectionId);
    });
  } catch (error) {
    console.error(`[${connectionId}] Setup failed:`, error);
    socket.emit("ws_error", {
      code: "INIT_FAILED",
      message: "Connection setup failed",
    });
    socket.disconnect(true);
  }
});

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
