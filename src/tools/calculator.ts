export const calculator = (a: number, b: number, operation: string) => {
  let result: number;
  let expression: string;

  switch (operation) {
    case "add":
      result = a + b;
      expression = `${a} + ${b}`;
      break;

    case "subtract":
      result = a - b;
      expression = `${a} - ${b}`;
      break;

    case "multiply":
      result = a * b;
      expression = `${a} * ${b}`;
      break;

    case "divide":
      result = a / b;
      expression = `${a} / ${b}`;
      break;

    default:
      throw new Error(`Unknown operation: ${operation}`);
  }

  return {
    result,
    expression,
  };
};