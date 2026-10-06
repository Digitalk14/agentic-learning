import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({
  name: "learning-mcp-client",
  version: "1.0.0",
});

const transport = new StdioClientTransport({
  command: "npx",
  args: ["tsx", "src/server.ts"],
});

await client.connect(transport);

const tools = await client.listTools();


console.log(tools.tools);

const result = await client.callTool({
  name: "calculator",
  arguments: {
    a: 25,
    b: 17,
    operation: "add"
  },
});

console.log("Result:");
console.log(result);