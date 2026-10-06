import fs from "fs/promises";
import OpenAI from "openai";

type Memory = Record<string, string>;

type MemoryKey = "preferred_language" | "city" | "dietary_restriction";

async function loadMemory(memoryFile: any): Promise<Memory> {
  try {
    const data = await fs.readFile(memoryFile, "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

export async function saveMemory(
  key: string,
  value: string,
  file: string,
) {
  const memory = await loadMemory(file);
  memory[key] = value;
  await fs.writeFile(
    file,
    JSON.stringify(memory, null, 2),
  );

  return {
    success: true,
    key,
    value,
  };
}

export async function getMemory(
  key: MemoryKey,
  memoryFile: any,
): Promise<string | null> {
  const memory = await loadMemory(memoryFile);

  return memory[key] ?? null;
}

export const memoryToolsDefinition: OpenAI.Responses.Tool[] = [
  {
    type: "function",
    name: "saveMemory",
    strict: true,
    description:
      "Save an important piece of information about the user for future conversations.",
    parameters: {
      type: "object",
      properties: {
        key: {
          type: "string",
          enum: ["preferred_language", "city", "dietary_restriction"],
        },
        value: {
          type: "string",
        },
      },
      required: ["key", "value"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "getMemory",
    strict: true,
    description: "Retrieve information previously saved about the user.",
    parameters: {
      type: "object",
      properties: {
        key: {
          type: "string",
          enum: ["preferred_language", "city", "dietary_restriction"],
        },
      },
      required: ["key"],
      additionalProperties: false,
    },
  },
];
