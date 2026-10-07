import { tool } from "@openai/agents";
import { z } from "zod";

export const webSearchWithSdk = tool({
  name: "webSearch",
  description: "Executes search in the internet",
  parameters: z.object({
    query: z.string(),
  }),
  execute: async ({ query }) => {
    if (!query) return null;
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: "basic",
        max_results: 5,
      }),
    });

    if (!response.ok) {
      throw new Error("Web search request failed");
    }

    const data = await response.json();

    return {
      results: data.results.map((result: any) => ({
        title: result.title,
        url: result.url,
        content: result.content,
        score: result.score,
      })),
    };
  },
});

export const webSearch = async (query: string | undefined) => {
  if (!query) return null;
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: "basic",
      max_results: 5,
    }),
  });

  if (!response.ok) {
    throw new Error("Web search request failed");
  }

  const data = await response.json();

  return {
    results: data.results.map((result: any) => ({
      title: result.title,
      url: result.url,
      content: result.content,
      score: result.score,
    })),
  };
};
