"use client";

import { TopicSelector } from "@/components/topic/topic-selector";
import { useDebate } from "@/contexts/debate-context";

export default function Home() {
  const { setTopic } = useDebate();

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        <TopicSelector onTopicSelect={setTopic} />
      </main>
    </div>
  );
}
