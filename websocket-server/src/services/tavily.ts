import * as dotenv from "dotenv";
import { tavily } from "@tavily/core";
import { z } from "zod";
import { getValidArguments } from "../utils/openai";


dotenv.config({ path: ".env" });

const tavilyKey = process.env.TAVILY_KEY
const client = tavily({ apiKey: tavilyKey })

const generalWebSearchArgs = z.object({
  query: z.string(),
  topic: z.enum(["general", "news", "finance"]),
})

export const generalWebSearch = async (data: string): Promise<string> => {
  const validArguments = await getValidArguments({ data: data, validatorSchema: generalWebSearchArgs, validatorSchemaName: "general_search" })
  const response = await client.search(validArguments.query, {
    searchDepth: "advanced",
    topic: validArguments.topic,
    maxResults: 5
  })
  const result = response.results
  const responseString = result.map(item => `${item.title}: ${item.content}`).join('\n');
  return responseString
}
