import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export const tools = [
  {
    name: "search",
    description: "Search the web for information.",
    schema: z.object({
      query: z.string().min(1),
    }),
    execute: async ({ query }: { query: string }) => {
      return {
        query,
        results: [
          `Result 1 for "${query}"`,
          `Result 2 for "${query}"`,
          `Result 3 for "${query}"`,
        ],
      };
    },
  },
  {
    name: "calculator",
    description: "Perform a basic arithmetic calculation.",
    schema: z.object({
      a: z.number(),
      b: z.number(),
      operation: z.enum(["add", "subtract", "multiply", "divide"]),
    }),
    execute: async ({
      a,
      b,
      operation,
    }: {
      a: number;
      b: number;
      operation: "add" | "subtract" | "multiply" | "divide";
    }) => {
      let result: number;
      switch (operation) {
        case "add":
          result = a + b;
          break;
        case "subtract":
          result = a - b;
          break;
        case "multiply":
          result = a * b;
          break;
        case "divide":
          result = a / b;
          break;
      }
      return {
        result,
        expression: `${a} ${operation} ${b}`,
      };
    },
  },
  {
    name: "getWeather",
    description: "Get the current weather for a city.",
    schema: z.object({
      city: z.string().min(1),
    }),
    execute: async ({ city }: { city: string }) => {
      return {
        city,
        temperature: 18,
        condition: "Partly cloudy",
      };
    },
  },
];

export const toolDefinitions = [
  {
    type: "function" as const,
    function: {
      name: "search",
      description: "Search the web for information.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query",
          },
        },
        required: ["query"],
      },
    },
  },

  {
    type: "function" as const,
    function: {
      name: "calculator",
      description: "Perform a basic arithmetic calculation.",
      parameters: {
        type: "object",
        properties: {
          a: {
            type: "number",
          },
          b: {
            type: "number",
          },
          operation: {
            type: "string",
            enum: ["add", "subtract", "multiply", "divide"],
          },
        },
        required: ["a", "b", "operation"],
      },
    },
  },

  {
    type: "function" as const,
    function: {
      name: "getWeather",
      description: "Get the current weather for a city.",
      parameters: {
        type: "object",
        properties: {
          city: {
            type: "string",
            description: "The city to get weather for",
          },
        },
        required: ["city"],
      },
    },
  },
];
