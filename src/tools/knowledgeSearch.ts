import { tool } from "@openai/agents";
import { z } from "zod";

export const knowledgeSearchWithSdk = tool({
  name: "knowledgeSearch",
  description:
    "Executes search calling the RAG app that includes some fictional tales",
  parameters: z.object({
    query: z.string(),
  }),
  execute: async ({ query }) => {
    const response = await fetch("http://localhost:3000/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error("RAG request failed");
    }
    return response.json();
  },
});

export const knowledgeSearch = async (query: string) => {
  const response = await fetch("http://localhost:3000/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error("RAG request failed");
  }
  return response.json();
};
