import { AzureOpenAI } from "openai/src/index.js";
import { DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";

const cred = new DefaultAzureCredential()
const scope = 'https://cognitiveservices.azure.com/.default'
const azureADTokenProvider = getBearerTokenProvider(cred, scope)

const deploymentName = "gpt-4o-realtime-preview"
export const client = new AzureOpenAI({
  azureADTokenProvider,
  apiVersion: '2024-10-01-preview',
  deployment: deploymentName,
});
