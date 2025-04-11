# WebSocket Proxy Server

This is a WebSocket proxy server that connects the frontend application to Azure OpenAI's Realtime API.

## Features

- Secure WebSocket communication between client and server
- Azure OpenAI Realtime API integration
- Support for both text and audio modalities
- Audio input streaming from the browser microphone
- Large message handling with chunking

## Setup

1. Clone this repository
2. Install dependencies: `npm install`
3. Create a `.env` file with the following variables:
   ```
   PORT=3001
   AZURE_OPENAI_ENDPOINT=your_azure_endpoint
   AZURE_OPENAI_DEPLOYMENT_NAME=your_deployment_name
   OPENAI_API_VERSION=your_api_version
   AZURE_OPENAI_API_KEY=your_api_key
   WSS_SHARED_SECRET=optional_shared_secret
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

## Running the Server

```bash
npm start
```

## Azure OpenAI Realtime API Integration

This server acts as a proxy between the frontend client and Azure's OpenAI Realtime API. It handles:

1. Establishing WebSocket connections with the client
2. Creating and managing sessions with Azure OpenAI
3. Streaming audio data to Azure OpenAI
4. Forwarding text responses back to the client

### Audio Format Requirements

Azure OpenAI's Realtime API expects audio in the following format:
- 16-bit PCM (pcm16)
- 16kHz sample rate
- Mono channel

The current implementation sends audio directly to Azure without conversion, which may result in errors if the browser's native audio format doesn't match Azure's requirements. In a production environment, you would want to implement proper audio format conversion on the server or client side.

## Architecture

```
Client (Browser) <--> WebSocket Proxy Server <--> Azure OpenAI Realtime API
```

1. The client captures audio from the microphone using the MediaRecorder API
2. Audio chunks are base64 encoded and sent to the proxy server
3. The proxy server forwards these chunks to Azure OpenAI
4. Azure processes the audio and returns text responses
5. The proxy forwards these responses back to the client

## Security Considerations

- Protect your API keys and sensitive credentials
- Consider implementing proper authentication for the WebSocket connections
- Be mindful of data transmission sizes and rate limits 