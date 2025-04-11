# Audio Implementation Plan for Real-Time AI Chat

## Overview
This document outlines the plan for implementing audio support in our real-time AI chat application. The system consists of a Next.js frontend (`ithink-debate`) and a WebSocket proxy server (`websocket-server`) that communicates with Azure OpenAI's Realtime API.

## Phase 1: Frontend Implementation (`ithink-debate/src/components/ai/talk.tsx`)

### 1. Audio Utility Functions
- Implement helper functions in `src/lib/audioUtils.ts`:
  ```typescript
  // Convert Float32Array to 16-bit PCM ArrayBuffer
  function floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }

  // Convert ArrayBuffer to base64 string
  function base64EncodeAudio(arrayBuffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(arrayBuffer);
    const chunkSize = 0x8000; // 32KB chunks
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(binary);
  }
  ```

### 2. Audio Recording Implementation
1. **Microphone Access**
   - Request microphone access with desired format:
   ```typescript
   const stream = await navigator.mediaDevices.getUserMedia({
     audio: {
       sampleRate: 16000,
       channelCount: 1
     }
   });
   ```

2. **Recording Setup**
   - Create MediaRecorder instance
   - Configure for periodic chunks
   - Initialize AudioContext
   ```typescript
   const mediaRecorder = new MediaRecorder(stream);
   const audioContext = new AudioContext();
   mediaRecorder.start(500); // Get chunks every 500ms
   ```

3. **Audio Processing Pipeline**
   - Handle `ondataavailable` event:
   ```typescript
   mediaRecorder.ondataavailable = async (event) => {
     try {
       const arrayBuffer = await event.data.arrayBuffer();
       const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
       const float32Data = audioBuffer.getChannelData(0);
       const pcmBuffer = floatTo16BitPCM(float32Data);
       const base64Chunk = base64EncodeAudio(pcmBuffer);
       socketRef.current?.emit('audio_chunk', base64Chunk);
     } catch (error) {
       console.error('Error processing audio chunk:', error);
       setStatus('Error processing audio');
     }
   };
   ```

4. **Recording Controls**
   - Handle recording stop:
   ```typescript
   mediaRecorder.onstop = () => {
     socketRef.current?.emit('audio_commit');
     // Clean up resources
     stream.getTracks().forEach(track => track.stop());
   };
   ```

### 3. UI Components
1. **Recording Controls**
   ```typescript
   const [isRecording, setIsRecording] = useState(false);
   const [status, setStatus] = useState<string>('Idle');

   // Start recording button
   <Button 
     onClick={startRecording} 
     disabled={isRecording}>
     Start Recording
   </Button>

   // Stop recording button
   <Button 
     onClick={stopRecording} 
     disabled={!isRecording}>
     Stop Recording
   </Button>
   ```

2. **Status Display**
   ```typescript
   <p>Status: {status}</p>
   ```

## Phase 2: Proxy Server Implementation (`websocket-server/src/server.ts`)

### 1. Connection Management
```typescript
interface ConnectionPair {
  socket: Socket;
  azureSession: Session;
  azureRtClient: OpenAIRealtimeWS;
}

const connections = new Map<string, ConnectionPair>();
```

### 2. Azure Session Configuration
```typescript
io.on("connect", async (socket: Socket) => {
  // ... existing connection setup ...

  azureRtClient.on("session.created", (event: SessionCreatedEvent) => {
    // Configure session for audio
    azureRtClient.send({
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        model: "gpt-4o-mini-realtime-preview",
        input_audio_format: {
          encoding: "pcm_s16le",
          sample_rate: 16000,
          channels: 1,
        },
      },
    });

    // Store connection
    connections.set(socket.id, { 
      socket, 
      azureSession: event.session,
      azureRtClient 
    });
  });
});
```

### 3. Audio Event Handlers
```typescript
// Handle incoming audio chunks
socket.on('audio_chunk', (base64Chunk: string) => {
  const connection = connections.get(socket.id);
  if (connection?.azureRtClient) {
    connection.azureRtClient.send({
      type: 'input_audio_buffer.append',
      audio: base64Chunk
    });
  }
});

// Handle audio commit
socket.on('audio_commit', () => {
  const connection = connections.get(socket.id);
  if (connection?.azureRtClient) {
    connection.azureRtClient.send({ 
      type: 'input_audio_buffer.commit' 
    });
    connection.azureRtClient.send({ 
      type: 'response.create' 
    });
  }
});
```

## Phase 3: Error Handling & Considerations

### 1. Frontend Error Handling
- Handle microphone access denial
- Handle audio processing errors
- Handle WebSocket connection issues
- Implement proper resource cleanup

### 2. Backend Error Handling
- Handle Azure API errors
- Handle WebSocket disconnections
- Implement connection cleanup
- Log important events and errors

### 3. Performance Considerations
- Monitor audio processing performance
- Watch for potential main thread blocking
- Consider implementing Web Workers in the future if needed

### 4. Format Verification
- Ensure consistent audio format (16kHz, mono, PCM)
- Verify Azure model compatibility
- Test with various audio inputs

## Implementation Notes
1. Start with the frontend audio capture and processing
2. Test audio format compatibility
3. Implement proxy server changes
4. Add error handling
5. Test end-to-end functionality 