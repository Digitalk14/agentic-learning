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
