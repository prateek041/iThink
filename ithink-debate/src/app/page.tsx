"use client";

import { TopicSelector } from "@/components/topic/topic-selector";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        <TopicSelector />
      </main>
    </div>
  );
}
