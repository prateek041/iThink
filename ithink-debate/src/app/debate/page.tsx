"use client";

import Debater from "@/components/ai/talk";
import { Button } from "@/components/ui/button";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "next-themes";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";

const forAvatars = [
  "/jotaro-green.png",
  "/naruto-green.png",
  "/sukuna-green.png",
]

const againstAvatars = [
  "/jotaro-red.png",
  "/naruto-red.png",
  "/sukuna-red.png"
]

export interface DebateHistory {
  role: string;
  text: string;
}

function DebateContent() {
  const theme = useTheme()
  const router = useRouter();
  const searchParams = useSearchParams();
  const topic = searchParams?.get("topic");

  const [currentTurn, setCurrentTurn] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<string>("");
  const [debateHistory, setDebateHistory] = useState<DebateHistory[]>([]);
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
  const date = new Date().toDateString()

  if (!topic) return null;

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      <div className="absolute w-full h-full inset-0">
        {/* video is not playing */}
        <video
          src={theme.theme === "light" ? "/ascii-light.mp4" : "/ascii-2.mp4"}
          autoPlay={true}
          loop={true}
          muted={true}
          className="h-full w-full object-cover"
        />
      </div>

      {/* Main content */}
      <div className="bg-card/60 backdrop-blur-lg flex flex-col items-center justify-center min-h-screen py-10">
        <div className="container w-full h-full  mx-auto">
          {/* Topic display */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full mb-16"
          >
            <div className="mx-auto flex md:flex-row flex-col justify-between items-center md:px-6 px-10 gap-y-5">
              <div>
                <h1 className="text-3xl font-semibold text-foreground leading-tight tracking-tight">
                  {topic}
                </h1>
                <div className="flex gap-x-2 items-end ">
                  {/* <h3 className="text-sm"> */}
                  {/*   Episode 1 */}
                  {/* </h3> */}
                  <p className="text-xs text-muted-foreground">{date}</p>
                </div>
              </div>

              {/* Control buttons */}
              <div className="flex items-center gap-4">
                <Button
                  onClick={startDebate}
                  disabled={currentTurn !== null}
                  className="cursor-pointer rounded-xs"
                >
                  Start Debate
                </Button>
                <Button
                  onClick={stopDebate}
                  variant="outline"
                  disabled={currentTurn === null}
                  className="cursor-pointer rounded-xs"
                >
                  Stop Debate
                </Button>
              </div>
            </div>
            <div className="w-full px-5 mx-auto">
              <Separator className="mt-5" />
            </div>
          </motion.div>

          {/* Debaters grid */}
          <div className="w-full flex flex-col gap-y-4 max-w-[1400px] mx-auto px-6 mb-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              <div >
                <Debater
                  topic={topic}
                  history={debateHistory}
                  avatarUrl={forAvatars[0]}
                  role="for"
                  currentTurn={currentTurn}
                  onFinish={onFinish}
                  lastMessage={lastMessage}
                  isDebateActive={isDebateActive}
                />
              </div>
              <div >
                <Debater
                  topic={topic}
                  avatarUrl={againstAvatars[2]}
                  history={debateHistory}
                  role="against"
                  currentTurn={currentTurn}
                  onFinish={onFinish}
                  lastMessage={lastMessage}
                  isDebateActive={isDebateActive}
                />
              </div>
            </div>
            <div>
              <AnimatePresence mode="wait">
                {debateHistory && debateHistory.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="flex-1 max-h-[400px]"
                  >
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="message" className="border-none">
                        <AccordionTrigger className="py-2 px-4 rounded-lg hover:bg-primary/5 transition-colors">
                          <span className="text-sm font-medium">
                            View Debate So Far
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2 pb-4">
                          <div className="bg-background/50 backdrop-blur-sm rounded-xl border border-border/50 p-6 shadow-inner">
                            <div className="max-h-[300px] overflow-y-auto pr-2">
                              <div className="text-foreground/90 flex flex-col leading-relaxed whitespace-pre-wrap">
                                {debateHistory.map((message, index) => {
                                  return (
                                    <DebateMessage key={index} message={message} />
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const DebateMessage = ({ message }: { message: DebateHistory }) => {
  const role = message.role[0].toUpperCase() + message.role.slice(1)
  return (
    <div className="flex flex-col gap-y-2 my-2">
      <h1 className={`font-semibold text-md ${message.role === "for" ? "text-green-700" : "text-red-500"}`}>{role}:</h1>
      <div>{message.text}</div>
      <Separator />
    </div>
  )
}

export default function DebatePage() {
  return (
    <Suspense fallback={<div className="p-12 text-center">Loading...</div>}>
      <DebateContent />
    </Suspense>
  );
}
