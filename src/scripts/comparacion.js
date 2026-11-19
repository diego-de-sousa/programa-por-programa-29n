export function questionsForScope(questions, candidates, district, includeLocal) {
  const ids = new Set(candidates.map(item => item.id));
  return questions.filter(question =>
    (!question.local || (district ? question.districts.includes(district) : includeLocal)) &&
    Object.keys(question.positions).some(id => ids.has(id)));
}

const binary = value => value === "yes" || value === "no";

export function getComparison(item, activeQuestions, responses) {
  const rows = activeQuestions.map(question => ({
    question, position: question.positions[item.id], response: responses.get(question.id)
  }));
  const comparable = rows.filter(row => binary(row.response) && binary(row.position?.stance));
  const matching = comparable.filter(row => row.response === row.position.stance);
  const disagreements = comparable.filter(row => row.response !== row.position.stance);
  const omitted = rows.filter(row => binary(row.position?.stance) && !binary(row.response));
  const ambiguous = rows.filter(row => row.position && !binary(row.position.stance));
  const unpositioned = rows.filter(row => !row.position && binary(row.response));
  const ratio = comparable.length ? matching.length / comparable.length : null;
  return { item, comparable, matching, disagreements, omitted, ambiguous, unpositioned, ratio };
}

export function comparePair(first, second, questions, responses) {
  const shared = first.id === second.id ? [] : questions.filter(question =>
    binary(responses.get(question.id)) && binary(question.positions[first.id]?.stance) &&
    binary(question.positions[second.id]?.stance));
  const topics = [...new Set(shared.map(question => question.topic))];
  const eligible = shared.length >= 8 && topics.length >= 4;
  if (!eligible) return { shared, topics, eligible, scores: null, sensitive: null };
  const counts = rows => [first, second].map(item => rows.filter(q => q.positions[item.id].stance === responses.get(q.id)).length);
  const total = counts(shared);
  const direction = Math.sign(total[0] - total[1]);
  const sensitive = topics.some(topic => {
    const remaining = counts(shared.filter(q => q.topic !== topic));
    return Math.sign(remaining[0] - remaining[1]) !== direction;
  });
  return { shared, topics, eligible, scores: total.map(count => count / shared.length), sensitive };
}
