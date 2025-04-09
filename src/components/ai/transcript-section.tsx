"use client"

import useWebRTCAudioSession from "@/hooks/use-webrtc";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import * as React from "react"
import { tools } from "@/lib/tools/tools";

interface AIProps {
  type: string
}

export default function AI(props: AIProps) {

  return (
    <div className="w-full h-full">
      <Card className="h-full">
        <CardHeader>
          <CardTitle>
            {props.type}
          </CardTitle>
        </CardHeader>
        <CardContent>
          Hello
        </CardContent>
      </Card>
    </div>
  )
}
