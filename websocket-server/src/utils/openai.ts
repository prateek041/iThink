import { z } from "zod";
import * as dotenv from "dotenv";

import { AzureOpenAI } from "openai";
import { infoLogger } from "../logger";
import { zodResponseFormat } from "openai/helpers/zod";

const azureEndpoint: string | undefined = process.env.AZURE_OPENAI_ENDPOINT;
const deploymentName = "gpt-4o"
const apiVersion: string = "2024-08-01-preview"
const apiKey: string | undefined = process.env.AZURE_OPENAI_API_KEY;

dotenv.config({ path: ".env" });

const modelName = "gpt-4o";

const openAIClient = new AzureOpenAI({
  endpoint: azureEndpoint,
  apiKey: apiKey,
  apiVersion,
  deployment: deploymentName
});

export function getOpenAIClient() {
  return openAIClient;
};

/**
 * chatComplete uses the OpenAI's chat completions API to return a response following a certain schema.
 */
export const chatComplete = async <T extends z.ZodTypeAny>({
  prompt,
  systemPrompt,
  validatorSchema,
  model = "gpt-4o",
  validatorSchemaName,
}: {
  prompt: string;
  systemPrompt: string;
  validatorSchema: T;
  model?: string;
  validatorSchemaName: string;
}): Promise<z.infer<T>> => {
  try {
    const azureClient = getOpenAIClient()
    infoLogger({ message: "initiating chat completion" });
    const completion = await azureClient.beta.chat.completions.parse({
      model: model,
      response_format: zodResponseFormat(validatorSchema, validatorSchemaName),
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });
    const output = completion.choices[0].message.parsed;
    if (!output) {
      infoLogger({
        message: "error complete chat",
        status: "failed",
        layer: "SERVICE",
        name: "OPENAI",
      });
      throw new Error("error completing chat");
    }
    infoLogger({
      message: "chat complete -> success",
      status: "success",
      layer: "SERVICE",
      name: "OPENAI",
    });
    return validatorSchema.parse(output);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Validation Error", error.errors);
      throw new Error("Failed to validate AI response");
    }
    // OpenAI error
    throw error;
  }
};

export const validateResponse = async <T extends z.ZodTypeAny>({
  prompt,
  validatorSchema,
  validatorSchemaName,
}: {
  prompt: string;
  validatorSchema: T;
  validatorSchemaName: string;
}): Promise<z.infer<T>> => {
  const systemPrompt =
    "out of the user's input prompt, generate a structured output that follows the given schema in json properly";
  const validatedResponse = await chatComplete({
    prompt,
    validatorSchema,
    validatorSchemaName,
    systemPrompt,
  });
  console.log(`Success: valid data for ${validatorSchemaName} generated`)
  return validatedResponse;
};

export const getValidArguments = async<T extends z.ZodTypeAny>({ data, validatorSchema, validatorSchemaName }: { data: string, validatorSchema: T, validatorSchemaName: string }): Promise<z.infer<T>> => {
  const validate = validatorSchema.safeParse(data)
  if (!validate.success) {
    return await validateResponse({ prompt: data, validatorSchema: validatorSchema, validatorSchemaName: validatorSchemaName })
  }
  return validate.data
}


