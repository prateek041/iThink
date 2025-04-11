"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ResponseTextDeltaEvent } from "openai/lib/responses/EventTypes.mjs";
import { ResponseAudioDeltaEvent } from "openai/resources/responses/responses.mjs";
import React, { useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";

export default function RealTimeTalk() {
  const [status, setStatus] = useState<string>("Idle");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [responseText, setResponseText] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState<boolean>(false)

  const socketRef = useRef<Socket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const audioChunksRef = useRef<string[]>([]);
  const processingAudio = useRef<boolean>(false)
  const audioBuffersRef = useRef<AudioBuffer[]>([])

  // Socket connection setup
  useEffect(() => {
    let socket: Socket | null = null;

    const AudioContext = window.AudioContext
    audioContextRef.current = new AudioContext()

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
        console.log("FRONTED RECEIVING", event)
        handleAudioChunk(event.delta)
      })

      socket.on("response_text_delta", (data: ResponseTextDeltaEvent) => {
        setResponseText((prev) => prev + data.delta);
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

      audioChunksRef.current.push(data)

      if (!processingAudio.current) {
        processAudioQueue()
      }

    } catch (error) {
      console.error("Error processing audio chunks", error)
    }
  }

  const processAudioQueue = async (): Promise<void> => {
    if (audioChunksRef.current.length === 0) {
      processingAudio.current = false
      return
    }

    processingAudio.current = true
    const base64Audio = audioChunksRef.current.shift()!

    try {
      if (!audioContextRef.current) {
        throw new Error("AudioContext not initialised")
      }

      const binaryData = atob(base64Audio)
      const len = binaryData.length
      const bytes = new Uint8Array(len)

      for (let i = 0; i < len; i++) {
        bytes[i] = binaryData.charCodeAt(i)
      }

      const audioBuffer = await audioContextRef.current.decodeAudioData(bytes.buffer)

      audioBuffersRef.current.push(audioBuffer)

      if (!isPlaying) {
        playNextBuffer()
      }
    } catch (error) {
      console.error("Error decoding audio", error)
      processingAudio.current = false

    }
  }

  const playNextBuffer = (): void => {
    if (!audioContextRef.current) return;

    if (audioBuffersRef.current.length === 0) {
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    const buffer = audioBuffersRef.current.shift()!;
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    audioSourceRef.current = source;

    source.onended = () => {
      playNextBuffer(); // Play next buffer when current one ends
    };
    source.start(0);
    setStatus('Playing audio stream');
  };



  const triggerFlow = () => {
    console.log("Triggered")
    socketRef?.current?.emit("test_flow", {
      data: "Write a Poem for me"
    })
  }

  return (
    <div className="h-full flex justify-center items-center flex-col gap-y-5">
      <p>Status: {status}</p>
      <p>Connected {isConnected}</p>
      <Button onClick={triggerFlow}>Trigger Flow</Button>
      {responseText && <Card className="max-w-sm">
        <CardContent>{responseText}</CardContent>
      </Card>}
    </div>
  );
}
