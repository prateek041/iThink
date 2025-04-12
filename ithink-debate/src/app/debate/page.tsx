"use client";

import Debater from "@/components/ai/talk";
import { Button } from "@/components/ui/button";
// import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { motion } from "framer-motion";

interface History {
  role: string;
  text: string;
}

function DebateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const topic = searchParams?.get("topic");

  const [currentTurn, setCurrentTurn] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<string>("");
  const [debateHistory, setDebateHistory] = useState<History[]>([]);
  const [isDebateActive, setIsDebateActive] = useState<boolean>(false);

  // Redirect to home if no topic
  useEffect(() => {
    if (!topic) {
      router.push("/");
      return;
    }
    setLastMessage(topic);
  }, [topic, router]);

  const onFinish = (responseText: string) => {
    if (!currentTurn || !isDebateActive) return;

    setDebateHistory([
      ...debateHistory,
      { role: currentTurn, text: responseText },
    ]);
    setLastMessage(responseText);
    setCurrentTurn(currentTurn === "for" ? "against" : "for");
  };

  const stopDebate = () => {
    setCurrentTurn(null);
    setIsDebateActive(false);
  };

  const startDebate = () => {
    setCurrentTurn("for");
    setIsDebateActive(true);
  };

  if (!topic) return null;

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      {/* Background gradients */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Primary gradient */}
        <div className="absolute top-0 left-0 w-full h-[50vh] bg-gradient-to-br from-primary/20 via-primary/5 to-transparent dark:from-primary/10 dark:via-primary/5" />
        {/* Secondary gradient */}
        <div className="absolute bottom-0 right-0 w-full h-[50vh] bg-gradient-to-tl from-secondary/20 via-secondary/5 to-transparent dark:from-secondary/10 dark:via-secondary/5" />
        {/* Radial overlay */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(255,255,255,0.15),rgba(255,255,255,0))]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_120%,rgba(120,119,198,0.1),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_120%,rgba(255,255,255,0.15),rgba(255,255,255,0))]" />
        </div>
      </div>

      {/* Main content */}
      <div className="container relative mx-auto flex flex-col items-center min-h-screen py-12">
        {/* Topic display */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full mb-16"
        >
          <div className="max-w-[800px] mx-auto px-6">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-foreground leading-tight tracking-tight">
              {topic}
            </h1>
            <div className="h-px w-20 bg-primary/20 mt-6" />
          </div>
        </motion.div>

        {/* Debaters grid */}
        <div className="w-full max-w-[1400px] mx-auto px-6 mb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <div className="h-[600px]">
              <Debater
                avatarUrl="/right.png"
                role="for"
                currentTurn={currentTurn}
                onFinish={onFinish}
                lastMessage={lastMessage}
                isDebateActive={isDebateActive}
              />
            </div>
            <div className="h-[600px]">
              <Debater
                avatarUrl="/left.png"
                role="against"
                currentTurn={currentTurn}
                onFinish={onFinish}
                lastMessage={lastMessage}
                isDebateActive={isDebateActive}
              />
            </div>
          </div>
        </div>

        {/* Control buttons */}
        <div className="flex gap-4 mt-auto">
          <Button
            onClick={startDebate}
            disabled={currentTurn !== null}
            className="bg-primary/90 hover:bg-primary text-primary-foreground px-8 py-6 text-lg rounded-full transition-colors"
          >
            Start Debate
          </Button>
          <Button
            onClick={stopDebate}
            variant="outline"
            disabled={currentTurn === null}
            className="px-8 py-6 text-lg rounded-full border-primary/20 hover:bg-primary/5"
          >
            Stop Debate
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function DebatePage() {
  return (
    <Suspense fallback={<div className="p-12 text-center">Loading...</div>}>
      <DebateContent />
    </Suspense>
  );
}
