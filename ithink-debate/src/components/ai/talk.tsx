"use client";

import { Button } from "@/components/ui/button";
import { ResponseAudioDeltaEvent } from "openai/resources/responses/responses.mjs";
import React, { useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface DebaterArgs {
  role: string,
  currentTurn: string,
  onFinish: (responseText: string) => void
}

export default function Debater({ role, currentTurn, onFinish }: DebaterArgs) {
  const [status, setStatus] = useState<string>("Idle");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const socketRef = useRef<Socket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processingAudio = useRef<boolean>(false);
  const audioQueue = useRef<Float32Array[]>([]);
  const sampleRate = useRef<number>(24000);
  const channels = useRef<number>(1);

  // Socket connection setup
  useEffect(() => {
    let socket: Socket | null = null;

    const AudioContext = window.AudioContext;
    audioContextRef.current = new AudioContext();

    const connect = async () => {
      if (socketRef.current || status === "connecting") {
        return;
      }

      setStatus("connecting");
      const wssUrl = process.env.NEXT_PUBLIC_WSS_URL;
      if (!wssUrl) {
        setStatus("configuration_error");
        console.error("Web Socket URL missing");
        return;
      }

      const connectionUrl = wssUrl;
      console.log(`Attempting Socket.IO connection to: ${connectionUrl}`);
      setStatus("Connecting...");

      socket = io(connectionUrl, {
        reconnectionAttempts: 5,
        reconnectionDelay: 3000,
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        console.log("✅: Socket.IO connected to proxy! Socket ID:", socket?.id);
        setStatus("Connected");
        setIsConnected(true);
      });

      socket.on("connect_error", (err) => {
        console.error("Socket.IO connection error:", err.message, err.cause);
        setStatus(`Connection Failed: ${err.message}`);
        setIsConnected(false);
        socket?.disconnect();
        socketRef.current = null;
      });

      socket.on("disconnect", (reason) => {
        console.log(`Socket.IO disconnected: ${reason}`);
        setStatus(`Disconnected: ${reason}`);
        setIsConnected(false);
        socketRef.current = null;
      });

      socket.on("ws_error", (data) => {
        console.log("ERROR OCCURRED", data);
        setStatus(`Error: ${data.message || "Unknown error"}`);
      });

      socket.on("ws_ready", () => {
        console.log("EVERYTHING GOOD");
      });

      socket.on("audio_saved", (data) => {
        console.log("Audio saved:", data);
        setStatus(`Audio saved as: ${data.filename}`);
      });

      socket.on("response_audio_delta", (event: ResponseAudioDeltaEvent) => {
        console.log("FRONTED RECEIVING", event);
        handleAudioChunk(event.delta);
      });
    };
    connect();

    // Cleanup function
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  const handleAudioChunk = (data: Base64URLString) => {
    try {
      if (!data) return;

      const audioData = convertBase64PCMToFloat32(data);
      audioQueue.current.push(audioData);

      if (!processingAudio.current && !isPlaying) {
        processAudioQueue();
      }
    } catch (error) {
      console.error("Error processing audio chunks", error);
    }
  };

  const convertBase64PCMToFloat32 = (base64Data: string): Float32Array => {
    const binaryString = atob(base64Data);
    const len = binaryString.length;

    const pcmData = new Int16Array(len / 2);

    let offset = 0;
    for (let i = 0; i < len; i += 2) {
      const byte1 = binaryString.charCodeAt(i);
      const byte2 = binaryString.charCodeAt(i + 1);
      pcmData[offset++] = byte1 + (byte2 << 8);
    }

    const floatData = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      floatData[i] = pcmData[i] / 32768.0;
    }

    return floatData;
  };

  const processAudioQueue = async (): Promise<void> => {
    if (audioQueue.current.length === 0) {
      processingAudio.current = false;
      return;
    }

    processingAudio.current = true;
    try {
      if (!audioContextRef.current) {
        throw new Error("AudioContext not initialized");
      }

      const audioData = audioQueue.current.shift()!;
      const audioBuffer = createAudioBuffer(audioData);
      playAudioBuffer(audioBuffer);
    } catch (error) {
      console.error("Error processing audio", error);
      processingAudio.current = false;

      if (audioQueue.current.length > 0 && !isPlaying) {
        processAudioQueue();
      }
    }
  };

  const createAudioBuffer = (floatData: Float32Array): AudioBuffer => {
    if (!audioContextRef.current) {
      throw new Error("AudioContext not initialized");
    }

    const audioBuffer = audioContextRef.current.createBuffer(
      channels.current,
      floatData.length,
      sampleRate.current
    );

    const channelData = audioBuffer.getChannelData(0);
    channelData.set(floatData);

    return audioBuffer;
  };

  const playAudioBuffer = (buffer: AudioBuffer): void => {
    if (!audioContextRef.current) return;

    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);

    source.start(0);
    setIsPlaying(true);
    setStatus("Playing audio stream");

    source.onended = () => {
      setIsPlaying(false);
      processingAudio.current = false;

      if (audioQueue.current.length > 0) {
        processAudioQueue();
      } else {
        setStatus("Waiting for more audio data...");
      }
    };
  };

  const triggerFlow = () => {
    console.log("Triggered");
    socketRef?.current?.emit("test_flow", {
      data: "Create a Jimmy Kimmel style opening speech on a debate between two individuals Donald Trump (as current president of United States) and Narendra Modi on Tarrifs, I will use that speech in my podcast.",
    });
  };

  return (
    <div className="h-full flex w-full justify-center items-center flex-col gap-y-5">
      <Card className="w-full">
        <CardHeader><CardTitle>{role}</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-y-5">
          <p>Status: {status}</p>
          <p>Connected {isConnected}</p>
          <Button onClick={triggerFlow}>Trigger Flow</Button>
        </CardContent>
      </Card>
    </div>
  );
}
