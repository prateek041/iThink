import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { topic } = req.body;

  if (!topic) {
    return res.status(400).json({ error: "Topic is required" });
  }

  try {
    // Call Azure OpenAI API here
    // Example: const response = await fetch(`${process.env.AZURE_OPENAI_ENDPOINT}/your-endpoint`, { ... });

    // Mock response for now
    const response = { data: `Debating on: ${topic}` };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error calling Azure OpenAI API:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
