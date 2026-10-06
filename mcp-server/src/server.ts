import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { webSearch, calculator } from "../../src/tools/index.ts";


const server = new McpServer({
  name: "learning-mcp-server",
  version: "1.0.0",
});

server.registerTool(
  "webSearch",
  {
    description:
      "Executes web search if information from external resources are needed",
    inputSchema: z.object({ query: z.string() }),
  },
  async ({ query }) => {
    const result = await webSearch(query);

    return {
      content:[
        {
          type: "text",
          text: JSON.stringify(result)
        }
      ]
    };
  },
);

server.registerTool(
  "calculator",
  {
    description: "Performs a simple arithmetic calculation",
    inputSchema: z.object({
      a: z.number(),
      b: z.number(),
      operation: z.string(),
    }),
  },
  async ({ a, b, operation }) => {
    const { result, expression } = calculator(a, b, operation);

    return {
      content: [
        {
          type: "text",
          text: `result is: ${result}, expression: ${String(expression)}`,
        },
      ],
    };
  },
);

const transport = new StdioServerTransport();

await server.connect(transport);
