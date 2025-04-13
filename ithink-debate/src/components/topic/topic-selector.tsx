import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const exampleTopics = [
  "USA Tarrifs, should you be scared as a citizen of US?",
  "Is Quantum Physics more valuable than Particle Physics?",
  "Should AI be regulated?",
  "Is Global Warming Real?",
];

export function TopicSelector() {
  const [customTopic, setCustomTopic] = useState("");

  const handleTopicSelect = (topic: string) => {
    window.location.href = `/debate?topic=${encodeURIComponent(topic)}`;
  };

  const handleCustomSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (customTopic.trim()) {
      handleTopicSelect(customTopic.trim());
      setCustomTopic("");
    }
  };

  return (
    <div className="flex flex-col h-full items-center justify-center py-5 w-full max-w-2xl mx-auto px-4">
      <div className="text-center space-y-6 w-full">
        <h1 className="text-5xl font-bold tracking-tight">
          What would you like to debate about?
        </h1>
        <p className="text-muted-foreground text-lg">
          Choose a topic or enter your own. Let the AI debate begin!
        </p>
      </div>

      <div className="w-full mt-8 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {exampleTopics.map((topic, index) => (
            <Card
              key={index}
              className={cn(
                "p-4 cursor-pointer hover:shadow-lg rounded-md transition-shadow",
                "text-sm text-start"
              )}
              onClick={() => handleTopicSelect(topic)}
            >
              {topic}
            </Card>
          ))}
        </div>

        <form onSubmit={handleCustomSubmit} className="space-y-2">
          <div className="relative">
            <Input
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              placeholder="Enter your debate topic..."
              className="h-12 text-base pr-24"
            />
            <Button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2"
              disabled={!customTopic.trim()}
            >
              Start Debate
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
