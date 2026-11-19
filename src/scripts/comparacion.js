export function getComparison(item, activeQuestions, responses) {
  const applicable = activeQuestions.flatMap(question => {
    const position = question.positions[item.id];
    if (!position) return [];
    const response = responses.get(question.id);
    return [{ question, position, response }];
  });
  const comparable = applicable.filter(row => row.response === "yes" || row.response === "no");
  const matching = comparable.filter(row => row.response === row.position.stance);
  const disagreements = comparable.filter(row => row.response !== row.position.stance);
  const omitted = applicable.filter(row => row.response !== "yes" && row.response !== "no");
  const ratio = comparable.length ? matching.length / comparable.length : null;
  return { item, comparable, matching, disagreements, omitted, ratio };
}
