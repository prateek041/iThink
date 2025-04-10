"use client"

import RealTimeTalk from "@/components/ai/talk"

export default function DebatePage() {
  return (
    <div className="container mx-auto flex flex-col justify-center items-center h-full">
      <h1 className="text-4xl font-bold mb-24">Debate Page</h1>
      <div className="grid gap-x-5">
        <RealTimeTalk />
        {/* <RealTimeTalk /> */}
      </div>
    </div>
  )
}
