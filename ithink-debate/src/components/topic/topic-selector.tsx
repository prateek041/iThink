import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import Link from "next/link";

const exampleTopics = [
  "USA Tarrifs, should you be scared as a citizen of US?",
  "Particle Physics vs Quantum Physics, which is more valuable?",
  "Should AI be regulated?",
  "Is Global Warming Real?",
];

interface TopicSelectorProps {
  onTopicSelect: (topic: string) => void;
}

export function TopicSelector({ onTopicSelect }: TopicSelectorProps) {
  const router = useRouter()
  const [customTopic, setCustomTopic] = useState("");

  const handleExampleSelect = (topic: string) => {
    router.push(`/debate?topic=${encodeURIComponent(topic)}`)
  };

  const handleCustomSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (customTopic.trim()) {
      onTopicSelect(customTopic.trim());
      router.push(`/debate?topic=${encodeURIComponent(customTopic)}`)
      setCustomTopic("");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full max-w-2xl mx-auto px-4">
      <div className="text-center space-y-6 w-full">
        <h1 className="text-4xl font-bold tracking-tight">
          What would you like to debate about?
        </h1>
        <p className="text-muted-foreground text-lg">
          Choose a topic or enter your own. Let the AI debate begin!
        </p>
      </div>

      <div className="w-full mt-8 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {exampleTopics.map((topic, index) => (
            <Link key={index} href={`/debate?topic=${encodeURIComponent(topic)}`}>
              <Card
                key={index}
                className={cn(
                  "p-4 cursor-pointer hover:shadow-lg transition-shadow",
                  "text-sm text-center"
                )}
                onClick={() => handleExampleSelect(topic)}
              >
                {topic}
              </Card>

            </Link>))}
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
