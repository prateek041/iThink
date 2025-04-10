"use client";

import { TopicSelector } from "@/components/topic/topic-selector";
import { useDebate } from "@/contexts/debate-context";

function DebateInterface() {
  const { state } = useDebate();

  if (state.status === "not_started") {
    return null;
  }

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="loader mb-4 border-4 border-t-4 border-t-blue-500 rounded-full w-9 h-9 animate-spin"></div>
        <p className="text-lg font-medium">Setting up the debate...</p>
        <h1 className="text-2xl font-bold my-10 ">{state.topic}</h1>
      </div>
    </div>
  );
}

export default function Home() {
  const { state, setTopic } = useDebate();

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        {state.status === "not_started" ? (
          <TopicSelector onTopicSelect={setTopic} />
        ) : (
          <DebateInterface />
        )}
      </main>
    </div>
  );
}
