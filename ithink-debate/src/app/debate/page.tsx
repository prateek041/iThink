"use client"

import Debater from "@/components/ai/talk"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { useSearchParams } from "next/dist/client/components/navigation"
import { useEffect, useState } from "react"

interface History {
  role: string,
  text: string
}

export default function DebatePage() {
  const searchParams = useSearchParams()
  const topic = searchParams?.get("topic")

  const [currentTurn, setCurrentTurn] = useState<string | null>(null)
  const [lastMessage, setLastMessage] = useState<string>("")
  const [debateHistory, setDebateHistory] = useState<History[]>([])

  useEffect(() => {
    console.log("topic useEffect")
    if (topic) {
      setLastMessage(topic)
      setCurrentTurn(null)
      setDebateHistory([])
    }
  }, [topic])

  const onFinish = (responseText: string) => {
    if (currentTurn === null) {
      console.log("condition true")
      return
    }
    console.log("On Finish running")
    if (currentTurn) { // wait for debate to be active
      setDebateHistory([...debateHistory, { role: currentTurn, text: responseText }])
      setLastMessage(responseText);
      setCurrentTurn(currentTurn === 'for' ? 'against' : 'for');
    }
  }

  const stopDebate = () => {
    setCurrentTurn(null);
  };

  const startDebate = () => {
    console.log("I was run")
    setCurrentTurn("for")
  }

  return (
    <div className="container mx-auto flex flex-col justify-center items-center h-full">
      <h1 className="text-4xl font-bold mb-24">{topic}</h1>
      <Card className="w-full mb-24">
        <CardHeader>Debate Debugger</CardHeader>
        <CardContent className="flex flex-col">
          <span>current Turn: {currentTurn}</span>
          <span>last Message: {lastMessage}</span>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-x-5 w-full">
        <Debater role="for" currentTurn={currentTurn} onFinish={onFinish} lastMessage={lastMessage} />
        <Debater role="against" currentTurn={currentTurn} onFinish={onFinish} lastMessage={lastMessage} />
      </div>
      <div className="flex gap-y-2 flex-col mt-10">
        <Button onClick={startDebate}>
          Start Debate
        </Button>
        <Button onClick={stopDebate} variant={"outline"}>
          Stop Debate
        </Button>
      </div>

    </div>
  )
}
