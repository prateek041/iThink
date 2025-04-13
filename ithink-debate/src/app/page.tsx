"use client";

import { TopicSelector } from "@/components/topic/topic-selector";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";

export default function Home() {
  const theme = useTheme()
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-background">
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
      <main className="flex-1 flex flex-col bg-card/60 backdrop-blur-md items-center justify-center relative z-10 px-4">
        <div className="absolute top-0 bottom-0 left-10 w-[0.5px] bg-foreground"></div>

        <div className="absolute top-0 bottom-0 right-10 w-[0.5px] bg-foreground "></div>

        <div className="absolute top-10 left-0 right-0 h-[0.5px] bg-foreground "></div>

        <div className="absolute bottom-10 left-0 right-0 h-[0.5px] bg-foreground"></div>
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
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 w-full max-w-[900px]"
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
              className="p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
            >
              <h3 className="font-semibold mb-2 text-foreground">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </main>
    </div>
  );
}
