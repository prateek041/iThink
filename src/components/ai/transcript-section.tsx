"use client"

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import * as React from "react"

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
