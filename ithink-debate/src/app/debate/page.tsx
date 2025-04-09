"use client"

import { Button } from "@/components/ui/button"
import React, { useState, useRef, useEffect, useCallback } from "react"
import { io, Socket } from "socket.io-client"

export default function RealtimeChatPage() {
  const [status, setStatus] = useState<string>("Idle")
  const [isConnected, setIsConnected] = useState<boolean>(false)

  const socketRef = useRef<Socket | null>(null)

  const disconnect = () => {
    socketRef.current?.disconnect()
    console.log('❌: Socket.IO disconnected to proxy! Socket ID:', socketRef.current?.id);
    setStatus("Disconnected")
    setIsConnected(false)
  }

  useEffect(() => {
    let socket: Socket | null = null

    const connect = async () => {
      if (socketRef.current || status === "connecting") {
        return
      }

      setStatus("connecting")
      const wssUrl = process.env.NEXT_PUBLIC_WSS_URL;
      if (!wssUrl) {
        setStatus("configration_error");
        console.error("Web Socket URL missing")
        return
      }

      // Adjust URL format if needed (socket.io typically doesn't need ws:// prefix)
      // Ensure NEXT_PUBLIC_WSS_URL is like 'http://localhost:3001' or 'https://your-proxy.onrender.com'
      const connectionUrl = wssUrl.replace(/^ws(s?):/, 'http$1:'); // Replace ws:// or wss:// with http:// or https://
      console.log(`Attempting Socket.IO connection to: ${connectionUrl}`);
      setStatus("Connecting...");

      // Connect using socket.io-client
      socket = io(connectionUrl, {
        // transports: ['websocket'], // Optionally force WebSocket transport
        reconnectionAttempts: 5, // Example: Limit reconnection attempts
        reconnectionDelay: 3000, // Example: Wait 3s before retry
        // auth: { token }, // Send token via auth object (preferred)
        // Or use query: query: { token }
      });
      socketRef.current = socket; // Store socket instance

      socket.on('connect', () => {
        console.log('✅: Socket.IO connected to proxy! Socket ID:', socket?.id);
        setStatus("Connected");
        setIsConnected(true);
      });

      socket.on('connect_error', (err) => {
        console.error('Socket.IO connection error:', err.message, err.cause);
        setStatus(`Connection Failed: ${err.message}`);
        setIsConnected(false);
        socket?.disconnect(); // Ensure cleanup if connect fails badly
        socketRef.current = null;
      });

      socket.on('disconnect', (reason) => {
        console.log(`Socket.IO disconnected: ${reason}`);
        setStatus(`Disconnected: ${reason}`);
        setIsConnected(false);
        socketRef.current = null; // Clean up ref on disconnect
        // Socket.IO will attempt auto-reconnect based on options unless disconnect was client-initiated
      });
    }
    connect()
  }, [])

  return (
    <div className="h-full flex justify-center items-center flex-col gap-y-5">
      <h1 className="text-4xl font-bold">Socket Implementation</h1>
      <Button onClick={disconnect}>Disconnect</Button>
    </div>
  )

}
