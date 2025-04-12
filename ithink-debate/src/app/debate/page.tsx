"use client";

import Debater from "@/components/ai/talk";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface History {
  role: string;
  text: string;
}

export default function DebatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const topic = searchParams?.get("topic");

  const [currentTurn, setCurrentTurn] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<string>("");
  const [debateHistory, setDebateHistory] = useState<History[]>([]);

  // Redirect to home if no topic
  useEffect(() => {
    if (!topic) {
      router.push("/");
      return;
    }
    setLastMessage(topic);
  }, [topic, router]);

  const onFinish = (responseText: string) => {
    if (!currentTurn) return;

    setDebateHistory([
      ...debateHistory,
      { role: currentTurn, text: responseText },
    ]);
    setLastMessage(responseText);
    setCurrentTurn(currentTurn === "for" ? "against" : "for");
  };

  const stopDebate = () => {
    setCurrentTurn(null);
  };

  const startDebate = () => {
    setCurrentTurn("for");
  };

  if (!topic) return null;

  return (
    <div className="container mx-auto flex flex-col justify-center items-center h-full">
      <h1 className="text-4xl font-bold mb-24">{topic}</h1>
      <Card className="w-full mb-24">
        <CardHeader>Debate Status</CardHeader>
        <CardContent className="flex flex-col">
          <span>Current Turn: {currentTurn || "Not Started"}</span>
          <span>Last Message: {lastMessage}</span>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-x-5 w-full">
        <Debater
          role="for"
          currentTurn={currentTurn}
          onFinish={onFinish}
          lastMessage={lastMessage}
        />
        <Debater
          role="against"
          currentTurn={currentTurn}
          onFinish={onFinish}
          lastMessage={lastMessage}
        />
      </div>
      <div className="flex gap-y-2 flex-col mt-10">
        <Button onClick={startDebate} disabled={currentTurn !== null}>
          Start Debate
        </Button>
        <Button
          onClick={stopDebate}
          variant={"outline"}
          disabled={currentTurn === null}
        >
          Stop Debate
        </Button>
      </div>
    </div>
  );
}
