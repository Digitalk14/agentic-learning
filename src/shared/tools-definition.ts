import OpenAI from "openai";

export const toolsDefinition : OpenAI.Responses.Tool[] = [
  {
    type: "function",
    name: "calculator",
    description: "Perform a basic arithmetic calculation.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        a: {
          type: "number",
          description: "First number",
        },
        b: {
          type: "number",
          description: "Second number",
        },
        operation: {
          type: "string",
          enum: ["add", "subtract", "multiply", "divide"],
          description: "The arithmetic operation to perform",
        },
      },
      required: ["a", "b", "operation"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "getTime",
    description: "provides current time",
    strict: true,
    parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
    }
  }
];