// Las candidaturas pueden no tener programa verificado; solo las posiciones lo requieren.
export function urlPublica(value, base) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) return null;
  try {
    const url = new URL(value, base);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

export function validarDatos(roster, programs) {
  const errors = [];
  const candidates = new Set();
  const districts = new Set();
  const questions = new Set();
  const checkUrl = (value, label) => {
    if (!urlPublica(value)) errors.push(`${label}: URL HTTP(S) inválida`);
  };
  for (const field of ['source', 'correction']) checkUrl(roster[field], `Candidaturas ${field}`);
  for (const district of roster.districts) {
    if (districts.has(district.id)) errors.push(`Circunscripción duplicada: ${district.id}`);
    districts.add(district.id);
    const local = new Set();
    for (const candidate of district.congress) {
      if (local.has(candidate.id)) errors.push(`Candidatura duplicada en ${district.id}: ${candidate.id}`);
      local.add(candidate.id);
      candidates.add(candidate.id);
    }
  }
  for (const [id, party] of Object.entries(programs.parties)) {
    if (!candidates.has(id)) errors.push(`Programa ${id}: candidatura desconocida`);
    for (const field of ['url', 'landing', 'copy']) {
      if (Object.hasOwn(party, field)) checkUrl(party[field], `Programa ${id} ${field}`);
    }
  }
  for (const question of programs.questions) {
    if (questions.has(question.id)) errors.push(`Pregunta duplicada: ${question.id}`);
    questions.add(question.id);
    for (const [id, position] of Object.entries(question.positions)) {
      const label = `Posición ${question.id}/${id}`;
      if (!candidates.has(id) || !Object.hasOwn(programs.parties, id)) errors.push(`${label}: candidatura desconocida`);
      if (!['yes', 'no'].includes(position.stance)) errors.push(`${label}: postura inválida`);
      if (typeof position.locator !== 'string' || !position.locator.trim()) errors.push(`${label}: localizador ausente`);
      if (Object.hasOwn(position, 'url')) checkUrl(position.url, `${label} url`);
      else if (!urlPublica(programs.parties[id]?.url)) errors.push(`${label}: fuente ausente o inválida`);
    }
  }
  return errors;
}

export function recogerEnlaces(roster, programs) {
  const links = new Set();
  const add = value => {
    const url = urlPublica(value);
    if (url) { url.hash = ''; links.add(url.href); }
  };
  add(roster.source);
  add(roster.correction);
  for (const party of Object.values(programs.parties)) {
    for (const field of ['url', 'landing', 'copy']) add(party[field]);
  }
  for (const question of programs.questions) {
    for (const position of Object.values(question.positions)) add(position.url);
  }
  return [...links];
}
