export async function analyzeStudentDashboard(
  userQuestion: string,
  context: any
) {
  const res = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: userQuestion,
      context,
    }),
  });

  return res.json();
}
