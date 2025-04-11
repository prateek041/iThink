"use client"

import Debater from "@/components/ai/talk"
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
    if (topic) {
      setLastMessage(topic)
      setCurrentTurn("for")
      setDebateHistory([])
    }
  }, [topic])

  const onFinish = (responseText: string) => {
    if (currentTurn) { // wait for debate to be active
      setDebateHistory([...debateHistory, { role: currentTurn, text: responseText }])
      setLastMessage(responseText);
      setCurrentTurn(currentTurn === 'for' ? 'against' : 'for');
    }
  }

  const stopDebate = () => {
    setCurrentTurn(null);
  };

  return (
    <div className="container mx-auto flex flex-col justify-center items-center h-full">
      <h1 className="text-4xl font-bold mb-24">{topic}</h1>
      <div className="grid grid-cols-2 gap-x-5 w-full">
        <Debater role="For" currentTurn="for" onFinish={onFinish} />
        <Debater role="Against" currentTurn="for" onFinish={onFinish} />
      </div>
      <button onClick={stopDebate} style={{ marginTop: '20px' }}>
        Stop Debate
      </button>
    </div>
  )
}
