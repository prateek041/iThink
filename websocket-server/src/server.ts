import * as dotenv from "dotenv";
import { AzureOpenAI } from "openai";
import { OpenAIRealtimeWS } from "openai/beta/realtime/ws";
import http from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { OpenAIRealtimeError } from "openai/beta/realtime/internal-base";
import { SessionCreatedEvent } from "openai/resources/beta/realtime/realtime";
import { Session } from "openai/resources/beta/realtime/sessions";
import * as fs from "fs";
import * as path from "path";

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
  audioBuffer?: Buffer; // Buffer to store the complete audio
  responseAudioBuffer?: Buffer;
  mimeType: string; // MIME type of the audio
  isProcessingResponse?: boolean; // Flag to track if we're processing a response
  accumulatedAudioMs: number; // Track accumulated audio duration
  inputAudioChunks: Buffer[]; // Store input audio chunks for debugging
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

// Create audio directories if they don't exist
const audioDir = path.join(process.cwd(), "audio_responses");
const audioTestsDir = path.join(process.cwd(), "audio-tests");
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}
if (!fs.existsSync(audioTestsDir)) {
  fs.mkdirSync(audioTestsDir, { recursive: true });
}

// --- Proxy connection complete ---

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
            voice: "shimmer"
          },
        });
      }

      // Store connection
      connections.set(connectionId, {
        socket,
        azureSession: event.session,
        azureRtClient: azureRtClient as OpenAIRealtimeWS,
        audioBuffer: Buffer.alloc(0), // Initialize empty buffer
        responseAudioBuffer: undefined,
        mimeType: "audio/webm;codecs=opus",
        isProcessingResponse: false,
        accumulatedAudioMs: 0,
        inputAudioChunks: [],
      });

      socket.emit("ws_ready");
    });

    // azureRtClient.on("response.text.delta", (event) => {
    //   socket.emit("response_text_delta", event);
    // });

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
        // Convert base64 to buffer
        // const audioChunk = Buffer.from(data.delta, "base64");

        // Debug info
        // console.log(
        //   `[${connectionId}] Audio chunk decoded, size: ${audioChunk.length} bytes`
        // );
        //
        // Append to response audio buffer
        // if (!connection.responseAudioBuffer) {
        //   connection.responseAudioBuffer = audioChunk;
        //   console.log(
        //     `[${connectionId}] Created new response audio buffer with ${audioChunk.length} bytes`
        //   );
        // } else {
        //   const newBuffer = Buffer.concat([
        //     connection.responseAudioBuffer,
        //     audioChunk,
        //   ]);
        //   connection.responseAudioBuffer = newBuffer;
        //   console.log(
        //     `[${connectionId}] Appended to response audio buffer, new size: ${newBuffer.length} bytes`
        //   );
        // }
      } catch (error) {
        console.error(`[${connectionId}] Error processing audio delta:`, error);
      }
    });

    azureRtClient.on("response.audio.done", () => {
      console.log(`[${connectionId}] AUDIO RESPONSE COMPLETE - SAVING FILE`);
      const connection = connections.get(connectionId);
      if (!connection) {
        console.log(
          `[${connectionId}] No connection found when trying to save audio`
        );
        return;
      }

      if (!connection.responseAudioBuffer) {
        console.log(`[${connectionId}] Response audio buffer is undefined`);
        connection.isProcessingResponse = false;
        return;
      }

      if (connection.responseAudioBuffer.length === 0) {
        console.log(
          `[${connectionId}] Response audio buffer is empty (0 bytes)`
        );
        connection.isProcessingResponse = false;
        return;
      }

      try {
        // Create WAV header for PCM 16bit mono audio at 24kHz (Azure's output format)
        const sampleRate = 24000;
        const numChannels = 1;
        const bitsPerSample = 16;

        const audioData = connection.responseAudioBuffer;
        console.log(
          `[${connectionId}] Creating WAV header for ${audioData.length} bytes of audio data`
        );

        const wavHeader = createWavHeader(
          audioData.length,
          sampleRate,
          numChannels,
          bitsPerSample
        );

        // Combine header and audio data
        const wavFile = Buffer.concat([wavHeader, audioData]);

        // Generate unique filename
        const filename = `response_${Date.now()}.wav`;
        const filepath = path.join(audioDir, filename);

        // Save the audio file
        fs.writeFileSync(filepath, wavFile);
        console.log(
          `[${connectionId}] Saved audio response to: ${filepath} (${wavFile.length} bytes)`
        );

        // Try to get the file stats to verify it was written
        try {
          const stats = fs.statSync(filepath);
          console.log(
            `[${connectionId}] Verified file was written: ${stats.size} bytes`
          );
        } catch (statError) {
          console.error(
            `[${connectionId}] Error verifying saved file:`,
            statError
          );
        }

        // Notify client
        socket.emit("audio_saved", {
          filename,
          filepath,
          size: wavFile.length,
        });
      } catch (error) {
        console.error(`[${connectionId}] Error saving audio file:`, error);
      } finally {
        // Clear the buffer and reset processing flag
        connection.responseAudioBuffer = undefined;
        connection.isProcessingResponse = false;
        console.log(`[${connectionId}] Cleaned up response resources`);
      }
    });

    azureRtClient.on("response.text.done", (event) =>
      console.log("END:", event.content_index)
    );

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
      const connection = connections.get(connectionId);
      if (connection) {
        connection.isProcessingResponse = false;
        connection.accumulatedAudioMs = 0;
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

      connection.azureRtClient.send({ type: "response.create" })
    })

    // Handle audio chunks from frontend
    socket.on("audio_chunk", (payload: { data: string }) => {
      const connection = connections.get(connectionId);
      if (!connection) {
        console.warn(
          `[${connectionId}] Cannot process audio chunk, connection not found`
        );
        return;
      }

      try {
        // Log the received audio chunk (avoid logging the full payload data)
        console.log(
          `[${connectionId}] Received audio chunk of length: ${payload.data.length}`
        );

        // Decode base64 to get actual byte length
        const audioData = Buffer.from(payload.data, "base64");

        // Store the audio chunk for debugging
        connection.inputAudioChunks.push(audioData);

        // Calculate duration in milliseconds (assuming 16-bit PCM at 16kHz)
        // Each sample is 2 bytes (16-bit) and we're sampling at 16000Hz
        const durationMs = audioData.length / 2 / 16; // Convert bytes to samples, then to milliseconds
        connection.accumulatedAudioMs += durationMs;

        console.log(
          `[${connectionId}] Audio chunk size: ${audioData.length
          } bytes, duration: ${durationMs.toFixed(
            2
          )}ms, total: ${connection.accumulatedAudioMs.toFixed(2)}ms`
        );

        // Send the audio chunk to Azure
        connection.azureRtClient.send({
          type: "input_audio_buffer.append",
          audio: payload.data,
        });
      } catch (error) {
        console.error(`[${connectionId}] Error processing audio chunk:`, error);
      }
    });

    socket.on("commit_audio", (event) => {
      console.log(`[${connectionId}] Received commit_audio request`);

      const connection = connections.get(connectionId);
      if (!connection) {
        console.warn(
          `[${connectionId}] Cannot commit audio, connection not found`
        );
        return;
      }

      // Save the accumulated input audio for debugging
      try {
        if (connection.inputAudioChunks.length > 0) {
          // Concatenate all chunks
          const inputAudioBuffer = Buffer.concat(connection.inputAudioChunks);

          // Create WAV header for PCM 16bit mono audio at 16kHz (input format)
          const sampleRate = 16000;
          const numChannels = 1;
          const bitsPerSample = 16;

          console.log(
            `[${connectionId}] Creating WAV file for ${inputAudioBuffer.length} bytes of input audio`
          );

          const wavHeader = createWavHeader(
            inputAudioBuffer.length,
            sampleRate,
            numChannels,
            bitsPerSample
          );

          // Combine header and audio data
          const wavFile = Buffer.concat([wavHeader, inputAudioBuffer]);

          // Generate unique filename
          const filename = `input_${Date.now()}.wav`;
          const filepath = path.join(audioTestsDir, filename);

          // Save the audio file
          fs.writeFileSync(filepath, wavFile);
          console.log(
            `[${connectionId}] Saved input audio to: ${filepath} (${wavFile.length} bytes)`
          );

          // Clear the input audio chunks after saving
          connection.inputAudioChunks = [];
        } else {
          console.log(`[${connectionId}] No input audio chunks to save`);
        }
      } catch (saveError) {
        console.error(`[${connectionId}] Error saving input audio:`, saveError);
      }

      // Only proceed if we have enough audio and no active response
      if (connection.accumulatedAudioMs < 100) {
        console.warn(
          `[${connectionId}] Not enough audio data (${connection.accumulatedAudioMs.toFixed(
            2
          )}ms), need at least 100ms`
        );
        return;
      }

      if (connection.isProcessingResponse) {
        console.warn(
          `[${connectionId}] Already processing a response, skipping`
        );
        return;
      }

      connection.isProcessingResponse = true;
      console.log(
        `[${connectionId}] Committing audio buffer and requesting response`
      );

      try {
        // Send the audio commit command
        connection.azureRtClient.send({
          type: "input_audio_buffer.commit",
        });

        // Request a response
        connection.azureRtClient.send({
          type: "response.create",
        });

        console.log(`[${connectionId}] Audio committed successfully`);

        // Reset the accumulated audio counter
        connection.accumulatedAudioMs = 0;
      } catch (error) {
        console.error(`[${connectionId}] Error committing audio:`, error);
        connection.isProcessingResponse = false;
      }
    });

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

// Helper function to create a WAV header
function createWavHeader(
  dataLength: number,
  sampleRate: number,
  numChannels: number,
  bitsPerSample: number
): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;

  const buffer = Buffer.alloc(44);

  // RIFF identifier
  buffer.write("RIFF", 0);
  // File length minus RIFF header
  buffer.writeUInt32LE(36 + dataLength, 4);
  // RIFF type
  buffer.write("WAVE", 8);
  // Format chunk identifier
  buffer.write("fmt ", 12);
  // Format chunk length
  buffer.writeUInt32LE(16, 16);
  // Sample format (PCM)
  buffer.writeUInt16LE(1, 20);
  // Channel count
  buffer.writeUInt16LE(numChannels, 22);
  // Sample rate
  buffer.writeUInt32LE(sampleRate, 24);
  // Byte rate (sample rate * block align)
  buffer.writeUInt32LE(byteRate, 28);
  // Block align (channel count * bytes per sample)
  buffer.writeUInt16LE(blockAlign, 32);
  // Bits per sample
  buffer.writeUInt16LE(bitsPerSample, 34);
  // Data chunk identifier
  buffer.write("data", 36);
  // Data chunk length
  buffer.writeUInt32LE(dataLength, 40);

  return buffer;
}
