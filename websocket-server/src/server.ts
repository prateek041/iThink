import * as dotenv from "dotenv";
import { AzureOpenAI } from "openai";
import { OpenAIRealtimeWS } from "openai/beta/realtime/ws";
import http from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { OpenAIRealtimeError } from "openai/beta/realtime/internal-base";
import { SessionCreatedEvent } from "openai/resources/beta/realtime/realtime";
import { Session } from "openai/resources/beta/realtime/sessions";
import fs from "fs";
import path from "path";
import { Readable } from "stream";

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

// Create output directory for saving audio files
const AUDIO_OUTPUT_DIR = path.join(__dirname, "../audio_output");
const TRANSCRIPTION_OUTPUT_DIR = path.join(
  __dirname,
  "../transcription_output"
);

if (!fs.existsSync(AUDIO_OUTPUT_DIR)) {
  fs.mkdirSync(AUDIO_OUTPUT_DIR, { recursive: true });
  console.log(`Created audio output directory: ${AUDIO_OUTPUT_DIR}`);
}

if (!fs.existsSync(TRANSCRIPTION_OUTPUT_DIR)) {
  fs.mkdirSync(TRANSCRIPTION_OUTPUT_DIR, { recursive: true });
  console.log(
    `Created transcription output directory: ${TRANSCRIPTION_OUTPUT_DIR}`
  );
}

// Type for connection mapping (Socket.IO socket <-> Azure SDK client)
interface ConnectionPair {
  socket: Socket; // Socket.IO socket instance
  azureSession: Session; // Session Instance
  azureRtClient: OpenAIRealtimeWS; // Azure RT Client
  audioBuffer: Buffer[]; // Array to collect audio chunks
  isStreaming: boolean; // Flag to track streaming state
  sessionId: string; // Unique ID for filename generation
  streamStartTime: number; // When this stream started
}

const connections = new Map<string, ConnectionPair>(); // Map socket.id -> ConnectionPair

const azureEndpoint: string | undefined = process.env.AZURE_OPENAI_ENDPOINT;
const deploymentName: string | undefined =
  process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
const apiVersion: string | undefined = process.env.OPENAI_API_VERSION;
const apiKey: string | undefined = process.env.AZURE_OPENAI_API_KEY;
const whisperEndpoint: string | undefined = process.env.AZURE_WHISPER_ENDPOINT;
const whisperDeploymentName: string | undefined =
  process.env.AZURE_WHISPER_DEPLOYMENT_NAME;
const whisperAPIVersion: string | undefined =
  process.env.AZURE_WHISPER_API_VERSION;
const whisperAPIKey: string | undefined = process.env.AZURE_WHISPER_API_KEY;

console.log("deployment", whisperDeploymentName);
console.log("api key", whisperAPIKey);
console.log("endpoint", whisperEndpoint);
console.log("api key", whisperAPIKey);

if (
  !azureEndpoint ||
  !deploymentName ||
  !apiVersion ||
  !apiKey ||
  !whisperAPIKey ||
  !whisperDeploymentName ||
  !whisperEndpoint ||
  !whisperAPIVersion
) {
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

// Function to create WAV header for PCM16 audio
function createWavHeader(
  sampleRate: number,
  numChannels: number,
  bitsPerSample: number,
  dataLength: number
): Buffer {
  const headerLength = 44;
  const header = Buffer.alloc(headerLength);

  // RIFF chunk descriptor
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataLength, 4); // File size - 8
  header.write("WAVE", 8);

  // "fmt " sub-chunk
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // Audio format (1 = PCM)
  header.writeUInt16LE(numChannels, 22); // Number of channels
  header.writeUInt32LE(sampleRate, 24); // Sample rate
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  header.writeUInt32LE(byteRate, 28); // Byte rate
  const blockAlign = (numChannels * bitsPerSample) / 8;
  header.writeUInt16LE(blockAlign, 32); // Block align
  header.writeUInt16LE(bitsPerSample, 34); // Bits per sample

  // "data" sub-chunk
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40); // Data size

  return header;
}

// Function to save accumulated audio as WAV file
async function getTranscript(connection: ConnectionPair) {
  try {
    // Combine all audio chunks
    const audioData = Buffer.concat(connection.audioBuffer);
    let textResult: string = "";

    // Create WAV header
    // Azure OpenAI Realtime API uses 24kHz sample rate for audio output
    const sampleRate = 24000; // 24kHz instead of 16kHz
    const numChannels = 1; // Mono
    const bitsPerSample = 16; // 16-bit PCM
    const header = createWavHeader(
      sampleRate,
      numChannels,
      bitsPerSample,
      audioData.length
    );

    // Combine header and audio data
    const wavData = Buffer.concat([header, audioData]);

    // Generate filename with timestamp and session ID
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `audio_${timestamp}_${connection.sessionId}.wav`;
    const filePath = path.join(AUDIO_OUTPUT_DIR, filename);

    // Write to file (temporarily)
    fs.writeFileSync(filePath, wavData);
    console.log(
      `[${connection.sessionId}] Temporarily saved audio file for transcription`
    );

    // Create a client for Whisper transcription
    const whisperClient = new AzureOpenAI({
      endpoint: whisperEndpoint,
      apiKey: whisperAPIKey,
      apiVersion: whisperAPIVersion,
      deployment: whisperDeploymentName,
    });

    // Create a readable stream from the file we just saved
    const fileStream = fs.createReadStream(filePath);

    // Use the file stream for transcription
    try {
      const result = await whisperClient.audio.transcriptions.create({
        model: "whisper-1",
        file: fileStream,
      });

      textResult = result.text;

      // Delete the temporary audio file
      fs.unlinkSync(filePath);
      console.log(
        `[${connection.sessionId}] Deleted temporary audio file: ${filePath}`
      );
    } catch (transcriptionError) {
      console.error(`Error during transcription: ${transcriptionError}`);
      process.exit();
    }

    // Reset audio buffer
    connection.audioBuffer = [];
    connection.isStreaming = false;
    return textResult;
  } catch (error) {
    console.error(`Error processing audio:`, error);
    process.exit();
  }
}

// Basic HTTP server configuration.
const httpServer = http.createServer((req, res) => {
  // Health check endpoint
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        timestamp: new Date().toISOString(),
        service: "websocket-server",
      })
    );
    return;
  }

  // Default response
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

      // Store connection with audio buffer
      connections.set(connectionId, {
        socket,
        azureSession: event.session,
        azureRtClient: azureRtClient as OpenAIRealtimeWS,
        audioBuffer: [],
        isStreaming: false,
        sessionId: event.session.id || connectionId,
        streamStartTime: Date.now(),
      });

      socket.emit("ws_ready");
    });

    azureRtClient.on("response.text.delta", (event) => {
      console.log("Sending text data", event.delta);
      socket.emit("response_text_delta", event);
    });

    // Event for start of response
    azureRtClient.on("response.created", (event) => {
      const connection = connections.get(connectionId);
      if (connection) {
        connection.isStreaming = true;
        connection.streamStartTime = Date.now();
        connection.audioBuffer = []; // Reset buffer for new response
        console.log(`[${connectionId}] Started new audio stream`);
      }
    });

    // Event for end of response
    azureRtClient.on("response.audio.done", async (event) => {
      const connection = connections.get(connectionId);
      if (connection && connection.isStreaming) {
        console.log(`[${connectionId}] Completed audio stream, saving file...`);

        // Only save if we have audio data
        if (connection.audioBuffer.length > 0) {
          const transcript = await getTranscript(connection);
          console.log("transcript", transcript);
          socket.emit("text_final_response", transcript);
        } else {
          console.log(`[${connectionId}] No audio data to save`);
        }
      }
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
        // Stream to client (existing functionality)
        socket.emit("response_audio_delta", data);

        // Accumulate audio data (new functionality)
        if (connection.isStreaming) {
          const audioData = Buffer.from(data.delta, "base64");
          connection.audioBuffer.push(audioData);
        }
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

      // Save any pending audio before cleaning up
      const connection = connections.get(connectionId);
      if (
        connection &&
        connection.isStreaming &&
        connection.audioBuffer.length > 0
      ) {
        console.log(`[${connectionId}] Saving audio on connection close`);
      }

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
      const connection = connections.get(connectionId);
      console.log("Payload data", payload.data);
      if (!connection) {
        console.log("unable to find connection");
        return;
      }
      connection.azureRtClient.send({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: payload.data }],
        },
      });

      connection.azureRtClient.send({
        type: "response.create",
      });
    });

    socket.on("disconnect", (reason) => {
      console.log(`[${connectionId}] Client disconnected: ${reason}`);

      // Save any pending audio before disconnection
      const connection = connections.get(connectionId);
      if (
        connection &&
        connection.isStreaming &&
        connection.audioBuffer.length > 0
      ) {
        console.log(`[${connectionId}] Disconnecting client`);
      }

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
  console.log(`📁 Audio files will be saved to: ${AUDIO_OUTPUT_DIR}`);
});
