"use client";

import { TopicSelector } from "@/components/topic/topic-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";

export default function Home() {
  const theme = useTheme()
  if (!theme) {
    return
  }
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-background">
      <div className="absolute w-full h-full inset-0">
        {/* video is not playing */}
        <video
          src={theme?.theme === "light" ? "/ascii-light.mp4" : "/ascii-2.mp4"}
          autoPlay={true}
          loop={true}
          muted={true}
          className="h-full w-full object-cover"
        />
      </div>
      <main className="flex-1 flex flex-col bg-card/60 backdrop-blur-md items-center justify-center relative z-10 px-4">
        <div className="absolute top-0 bottom-0 md:left-10 left-5 w-[0.5px] bg-foreground"></div>
        <div className="absolute top-0 bottom-0 md:right-10 right-5 w-[0.5px] bg-foreground "></div>
        <div className="absolute md:top-10 top-5 left-0 right-0 h-[0.5px] bg-foreground "></div>


        <motion.div
          className="w-full h-full m-10"
          initial={{ opacity: 0.5, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="w-full ">
            <TopicSelector />
          </div>
        </motion.div>

        {/* Feature highlights */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-6 md:mt-16 w-full max-w-[900px]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          {[
            {
              title: "Real-time Debate",
              desc: "Watch AI debaters discuss in real-time",
            },
            {
              title: "Any Topic",
              desc: "Choose any topic you're interested in",
            },
            {
              title: "Smart Analysis",
              desc: "Experience nuanced perspectives",
            },
          ].map((feature, i) => (
            <motion.div
              key={feature.title}
              className="rounded-md bg-card/50 backdrop-blur-sm md:mx-0 mx-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-foreground">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </CardContent>
              </Card>

            </motion.div>
          ))}
          <div className="hidden md:block absolute md:bottom-10 bottom-5 left-0 right-0 h-[0.5px] bg-foreground"></div>

          <div className="md:hidden block mb-5 -translate-x-5 h-[0.5px] bg-foreground w-[500px]"></div>
        </motion.div>
      </main>
    </div>
  );
}
