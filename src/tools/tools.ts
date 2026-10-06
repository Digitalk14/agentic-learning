export const tools = {
  calculator: ({ a, b, operation }: {
    a: number;
    b: number;
    operation: "add" | "subtract" | "multiply" | "divide";
  }) => {
    switch (operation) {
      case "add":
        return a + b;

      case "subtract":
        return a - b;

      case "multiply":
        return a * b;

      case "divide":
        return a / b;
    }
  },

  getTime: () => {
    return new Date().toLocaleTimeString();
  }
};