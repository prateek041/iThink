import * as dotenv from "dotenv"
import { AzureOpenAI } from "openai"
import { OpenAIRealtimeWS } from 'openai/beta/realtime/ws';
import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';
import http from "http"
import { Server as SocketIOServer, Socket } from "socket.io";

dotenv.config({ path: ".env" })

const cred = new DefaultAzureCredential();
const scope = 'https://cognitiveservices.azure.com/.default';
const azureADTokenProvider = getBearerTokenProvider(cred, scope);

const PORT: number = parseInt(process.env.PORT || '3001', 10)

const allowedOrigins: string[] = [
  process.env.NEXT_PUBLIC_APP_URL,
  "http://localhost:3000"
].filter((origin): origin is string => typeof origin === "string" && origin.length > 0)

const WSS_SHARED_SECRET: string | undefined = process.env.WSS_SHARED_SECRET;

if (!WSS_SHARED_SECRET) {
  console.warn("!!! WARNING: WSS_SHARED_SECRET is not set, Token authentication is disabled. !!!")
}

console.log("Allowed origins for Socket.io:", allowedOrigins)

const azureEndpoint: string | undefined = process.env.AZURE_OPENAI_ENDPOINT;
const deploymentName: string | undefined = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
const apiVersion: string | undefined = process.env.OPENAI_API_VERSION;

if (!azureEndpoint || !deploymentName || !apiVersion) {
  console.error('Azure OpenAI SDK environment variables not fully set! Exiting.');
  process.exit(1);
}

// Client configuration setup

let azureOpenAIClient: AzureOpenAI

try {
  const credentials = new DefaultAzureCredential()
  const scope = "https://cognitiveservices.azure.com/.default"
  const azureADTokenProvider = getBearerTokenProvider(credentials, scope)

  azureOpenAIClient = new AzureOpenAI({
    azureADTokenProvider,
    apiVersion: apiVersion,
    deployment: deploymentName,
    endpoint: azureEndpoint
  })
  console.log("SUCCESS: AzureOpenAI client configured")

} catch (error) {
  console.error("ERROR: Failed to initialise Azure Credentials/client:", error)
  process.exit()
}

// Basic HTTP server configuration.

const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' })
  res.end("web-socketProxy server OK")
})

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: false
  }
})

io.on('connection', async (socket: Socket) => {
  const connectionId = socket.id
  console.log(`✅: ${connectionId} Client connected via socket.io`)
})

io.on('error', (error: Error) => {
  console.error("Socket.IO server General Error", error)
})

httpServer.listen(PORT, () => {
  console.log(`🚀 Socket.IO Proxy Server started on port ${PORT}`);
  console.log(`🔒 Shared Secret Auth: ${WSS_SHARED_SECRET ? 'Enabled' : 'DISABLED'}`);
  console.log(`☁️ Azure Client Auth: Keyless (Entra ID / Managed Identity)`);
})
