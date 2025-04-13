"use client";

import { ResponseAudioDeltaEvent } from "openai/resources/responses/responses.mjs";
import React, { useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { DebateHistory } from "@/app/debate/page";

interface DebaterArgs {
  topic: string
  history: DebateHistory[]
  avatarUrl: string;
  role: string;
  currentTurn: string | null;
  onFinish: (responseText: string) => void;
  lastMessage: string;
  isDebateActive: boolean;
}

export default function Debater({
  topic,
  history,
  avatarUrl,
  role,
  currentTurn,
  onFinish,
  lastMessage,
  isDebateActive,
}: DebaterArgs) {
  const [status, setStatus] = useState<string>("Idle");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [responseText, setResponseText] = useState<string>("");
  const didMount = useRef(false);

  const aiRole = role[0].toUpperCase() + role.slice(1)
  const historyString = history.map(item => `${item.role}: ${item.text}`).join('\n');

  const socketRef = useRef<Socket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processingAudio = useRef<boolean>(false);
  const audioQueue = useRef<Float32Array[]>([]);
  const sampleRate = useRef<number>(24000);
  const channels = useRef<number>(1);

  // Socket connection setup
  useEffect(() => {
    console.log("socket connection useEffect");
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

      socket.on("text_final_response", (data) => {
        console.log("FINAL TRANSCRIPT TO BE SENT", data);
        setResponseText(data);
        onFinish(data);
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

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }

    console.log("lastMessage", lastMessage);

    if (currentTurn === null || !isDebateActive) {
      return;
    }

    if (currentTurn === role && socketRef.current) {
      socketRef.current.emit("test_flow", {
        data:
          `
          HOST (smiling):
          "Good evening, ladies and gentlemen! Welcome to the show —
          the only place where you can find serious debates sandwiched
          between bad jokes and way too many commercial breaks."

          (Audience chuckles)

          HOST:
          "Tonight, we’re doing something a little different — we're
          diving deep into a hot topic that's got everyone talking: ${topic}.
          You know, the kind of thing that ruins family dinners and really
          spices up the group chat."

          (Pause for laugh)

          HOST:
          "We've brought in two experts — two real professionals, not just
          people who Googled {topic} five minutes ago — although honestly,
          that would still be better than most of Twitter."

          (Audience laughs)

          HOST:
          "On this side, we have {ExpertForName}, who says YES — they believe
          in {topic} so much, they probably have a bumper sticker about it."

          (Point dramatically at one side)

          HOST:
          "And on this side, we have Jotaro from Jojo, who says NO — they're
          here to crush dreams, debunk myths, and generally be the reason why
          we can't have nice things."

          (Audience laughs again)

          HOST:
          "So — sit back, grab some popcorn, and prepare to watch two brilliant
          minds duke it out... politely. Or at least, pretend to."

          You're a guest on a lively podcast debate. Your role is '${role}', and you
          must very agressively  argue from that point of view. Your job is to keep
          the conversation fun, sharp, and convincing — like you're trying to win
          over the other guest and the audience, use very less words. Speak like a
          real person: be witty, punchy, and don't ramble. Short and spicy is better
          than long and boring.

          Important: Don't agree too easily — challenge their points right away,
          question their assumptions, and push back when you can (even disrespectfully,
          and with some fire), even ask questions. Past conversations are:
          '${historyString}' and their last reply was ${lastMessage}. You must Win!! Now, hit back!

          Words not to use:
          - Absolutely
          - unprecidented`,
      });

      socketRef.current.on("text_final_response", (AIResponse) => {
        // Check audio playback status every 100ms
        const checkInterval = setInterval(() => {
          if (!isPlaying && audioQueue.current.length === 0) {
            clearInterval(checkInterval);
            // Add 2 second delay after audio finishes
            setTimeout(() => {
              if (isDebateActive) {
                // Only call onFinish if debate is still active
                onFinish(AIResponse);
              }
            }, 2000);
          }
        }, 100);
      });
    }
  }, [currentTurn, role, onFinish, isDebateActive]);

  // useEffect(() => {
  //   console.log("I am finally triggered", responseText)
  //   onFinish(responseText)
  // }, [responseText])
  //
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

  // Animated wave component for the speaking indicator
  const WaveAnimation = () => (
    <div className="flex gap-1 items-center h-3">
      {[1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          className="w-0.5 bg-primary"
          animate={{
            height: [8, 16, 8],
          }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            delay: i * 0.1,
          }}
        />
      ))}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative overflow-hidden bg-background/90 rounded-xl border border-border/50 backdrop-blur-md shadow-lg"
    >
      {/* Connection status indicator */}
      <div className="absolute top-3 right-3 flex items-center gap-2 px-2 py-1 rounded-full bg-background/90 backdrop-blur-md border border-border/50">
        <motion.div
          className={cn(
            "w-2 h-2 rounded-full transition-colors duration-200",
            isConnected
              ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]"
              : "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.4)]"
          )}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        />
        <span className="text-xs font-medium text-muted-foreground">
          {isConnected ? "Connected" : "Disconnected"}
        </span>
      </div>

      {/* Glossy reflections */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-[60%] bg-primary/5 opacity-20 blur-2xl rounded-full transform -translate-y-1/2 scale-150" />
        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-background opacity-30 blur-md" />
      </div>

      {/* Main content */}
      <div className="relative h-full flex flex-col p-6 gap-6">
        {/* Role header */}
        <motion.div
          className="flex items-center gap-6"
          initial={{ y: -20 }}
          animate={{ y: 0 }}
        >
          <div className="relative h-24 w-24 rounded-full overflow-hidden border-2 border-primary/20 shadow-lg">
            <Image
              src={avatarUrl}
              alt={`${role} avatar`}
              fill
              className="object-cover"
              sizes="96px"
              priority
            />
            <div className="absolute inset-0 bg-primary/5 mix-blend-overlay" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">{aiRole}</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              {isPlaying && <WaveAnimation />}
              <span>{isPlaying ? "Speaking" : "Listening"}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
