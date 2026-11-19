import roster from "../data/candidaturas.js";
import programas from "../data/programas.js";
import { getComparison } from "./comparacion.js";

const hero = document.querySelector(".hero");
const form = document.querySelector("#start-form");
const province = document.querySelector("#province");
const territorial = document.querySelector("#territorial");
const territorialOption = document.querySelector("#territorial-option");
const quiz = document.querySelector("#cuestionario");
const results = document.querySelector("#resultados");
const catalogue = document.querySelector("#catalogue");
const heroNote = document.querySelector("#hero-note");
const { parties, questions } = programas;
const districts = roster.districts;
const alphabet = new Intl.Collator("es", { sensitivity: "base" });
const formatter = new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 1 });
const points = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
const seats = {
  pp: 129, psoe: 112, vox: 64, erc: 11, "eh-bildu": 8, fa: 8, junts: 4,
  "adelante-andalucia": 3, bng: 3, compromis: 3, "eaj-pnv": 3, cc: 1, podemos: 1
};
const projectionGroups = {
  "upn-pp": "pp", "fa-andaluz": "fa", "fa-asturias": "fa", "cha-fa": "fa",
  "comuns-front-ampli": "fa", "frente-amplio-fronte-ampla": "fa", "frente-amplio-fronte-zabala": "fa"
};
const answers = [
  { id: "yes", label: "A favor" },
  { id: "no", label: "En contra" },
  { id: "skip", label: "Sin opinión / prefiero pasar" }
];
const responsesLabel = { yes: "A favor", no: "En contra", skip: "Omitida" };

let activeQuestions = [];
let responses = new Map();
let step = 0;

function escapeHtml(value) {
  const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(value).replace(/[&<>"']/g, character => entities[character]);
}

function labelFor(item) {
  const metadata = parties[item.id];
  return metadata?.name ?? item.name;
}

function selectedDistrict() {
  return districts.find(district => district.id === province.value);
}

function getCandidates() {
  const district = selectedDistrict();
  const candidates = district?.congress ?? [...new Map(
    districts.flatMap(item => item.congress).map(item => [item.id, item])
  ).values()];
  return candidates.slice().sort((a, b) => alphabet.compare(labelFor(a), labelFor(b)));
}

function currentQuestions(candidates) {
  const ids = new Set(candidates.map(item => item.id));
  const includeTerritorial = Boolean(selectedDistrict()) || territorial.checked;
  return questions.filter(question =>
    (includeTerritorial || !question.local) && Object.keys(question.positions).some(id => ids.has(id)));
}

function answeredCount() {
  return [...responses.values()].filter(value => value === "yes" || value === "no").length;
}

function sourceLink(url, text) {
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
}

function programLinks(metadata) {
  if (!metadata?.url) return "";
  const primary = metadata.landing ?? metadata.url;
  const links = [sourceLink(primary, metadata.label)];
  if (metadata.landing && metadata.landing !== metadata.url) links.push(sourceLink(metadata.url, "Documento"));
  if (metadata.copy) links.push(sourceLink(metadata.copy, "Copia del programa"));
  return links.join(" · ");
}

function renderCatalogue() {
  const candidates = getCandidates();
  const scope = selectedDistrict()?.name ?? "Toda España";
  const documents = candidates.filter(item => parties[item.id]?.url).length;
  const availableQuestions = currentQuestions(candidates).length;
  territorialOption.hidden = Boolean(selectedDistrict());
  heroNote.textContent = `${availableQuestions} preguntas · ${candidates.length} candidaturas · respuestas en tu navegador`;
  catalogue.innerHTML = `
    <details class="catalogue-box"${selectedDistrict() ? " open" : ""}>
      <summary>${escapeHtml(scope)} · ${documents} de ${candidates.length} candidaturas con documento programático</summary>
      <ul class="catalogue-list">${candidates.map(item => {
        const metadata = parties[item.id];
        const hasPositions = questions.some(question => question.positions[item.id]);
        const detail = metadata?.url
          ? `${programLinks(metadata)}${hasPositions ? "" : " · Sin medidas puntuadas"}`
          : "Programa 29N no localizado en su web";
        return `<li><div class="catalogue-name">${escapeHtml(labelFor(item))}</div><div class="catalogue-status">${detail}</div></li>`;
      }).join("")}</ul>
    </details>
    <p class="catalogue-status">Listas proclamadas según el ${sourceLink(roster.source, "BOE del 3 de noviembre")} y su ${sourceLink(roster.correction, "corrección oficial")}.</p>`;
}

function showStage(stage) {
  hero.hidden = stage !== hero;
  quiz.hidden = stage !== quiz;
  results.hidden = stage !== results;
}

function focusOn(title) {
  title.focus({ preventScroll: true });
  title.closest("section").scrollIntoView({ block: "start" });
}

function renderQuestion() {
  const question = activeQuestions[step];
  const selected = responses.get(question.id);
  const scope = selectedDistrict()?.name ?? "Toda España";
  quiz.innerHTML = `
    <form class="quiz-box">
      <div class="quiz-meta"><p class="overline">${escapeHtml(question.topic)}</p><p>${escapeHtml(scope)} · ${step + 1} de ${activeQuestions.length}</p></div>
      <progress value="${step + 1}" max="${activeQuestions.length}" aria-label="Pregunta ${step + 1} de ${activeQuestions.length}"></progress>
      <h2 id="quiz-title" tabindex="-1">${escapeHtml(question.title)}</h2>
      ${question.note ? `<p class="question-note" id="question-note">${escapeHtml(question.note)}</p>` : ""}
      <fieldset class="responses" aria-labelledby="quiz-title"${question.note ? ' aria-describedby="question-note"' : ""}>
        <legend class="sr-only">Tu respuesta</legend>
        ${answers.map(answer => `<label class="response"><input type="radio" name="answer" value="${answer.id}"${selected === answer.id ? " checked" : ""}><span>${answer.label}</span></label>`).join("")}
      </fieldset>
      <p class="error" id="response-error" role="alert" hidden>Elige una respuesta o marca «Sin opinión / prefiero pasar».</p>
      <div class="quiz-actions">
        <button class="button secondary" type="button" data-previous>${step > 0 ? "Anterior" : "Volver al inicio"}</button>
        <button class="button primary" type="submit">${step + 1 === activeQuestions.length ? "Ver resultados" : "Siguiente"}</button>
      </div>
      ${step + 1 < activeQuestions.length
        ? `<button class="text-button" type="button" data-finish${answeredCount() ? "" : " hidden"}>Ver resultados con mis respuestas actuales</button>`
        : ""}
    </form>`;
  const questionForm = quiz.querySelector("form");
  const error = quiz.querySelector("#response-error");
  const finish = quiz.querySelector("[data-finish]");
  finish?.addEventListener("click", renderResults);
  questionForm.addEventListener("change", event => {
    responses.set(question.id, event.target.value);
    error.hidden = true;
    if (finish) finish.hidden = !answeredCount();
  });
  questionForm.addEventListener("submit", event => {
    event.preventDefault();
    const value = new FormData(questionForm).get("answer");
    if (!value) {
      error.hidden = false;
      questionForm.querySelector("input").focus();
      return;
    }
    responses.set(question.id, value);
    if (step + 1 < activeQuestions.length) {
      step += 1;
      renderQuestion();
      return;
    }
    renderResults();
  });
  quiz.querySelector("[data-previous]").addEventListener("click", () => {
    if (step === 0) {
      showStage(hero);
      form.querySelector("select").focus();
      hero.scrollIntoView({ block: "start" });
      return;
    }
    step -= 1;
    renderQuestion();
  });
  focusOn(quiz.querySelector("h2"));
}

function withPage(url, page) {
  return page && /\.pdf(?:[?#]|$)|\/pdf\/|sdm_process_download/.test(url)
    ? `${url.split("#")[0]}#page=${page}`
    : url;
}

function renderEvidence(rows, metadata, type, name, loss = 0) {
  if (!rows.length) return "";
  return `<details class="evidence-group ${type}">
    <summary><span class="evidence-count">${rows.length}</span> ${name}${loss ? ` <span class="loss">−${points.format(loss * rows.length)} pp</span>` : ""}</summary>
    ${loss ? "<p class='loss-note'>Puntos porcentuales que se pierden respecto a coincidir en estas medidas.</p>" : ""}
    <ul class="evidence">${rows.map(({ question, position, response }) => {
      const original = position.url ?? metadata.url;
      const official = metadata.landing ?? metadata.url;
      const verifiedCopy = metadata.copy;
      const document = verifiedCopy && (original === verifiedCopy || original === official) ? verifiedCopy : original;
      const location = document === verifiedCopy ? `Copia del programa · ${position.locator}` : position.locator;
      const backup = official !== document ? sourceLink(official, "Web de la candidatura") : "";
      const links = [sourceLink(withPage(document, position.page), location), backup].filter(Boolean);
      const userAnswer = responsesLabel[response] ?? "Sin respuesta";
      return `<li><div class="evidence-title"><strong>${escapeHtml(question.title)}</strong>
        ${loss ? `<span class="loss">−${points.format(loss)} pp</span>` : ""}</div>
        <dl class="answer-compare"><div><dt>Tu respuesta</dt><dd>${userAnswer}</dd></div>
        <div><dt>Programa</dt><dd>${responsesLabel[position.stance]}</dd></div></dl>
        <p>${escapeHtml(position.evidence)}</p>
        <p class="evidence-source">${links.join(" · ")}</p></li>`;
    }).join("")}</ul></details>`;
}

function projectionLabel(item) {
  const key = projectionGroups[item.id] ?? item.id;
  if (!seats[key]) return "";
  if (key === "pp") return item.id === "pp"
    ? "129 escaños estimados con UPN–PP" : "Incluida en la estimación de PP y UPN–PP";
  if (item.id === "fa") return "8 escaños estimados para el conjunto de Frente Amplio";
  if (key !== item.id) return "Incluida en la estimación de Frente Amplio";
  return `${seats[key]} ${seats[key] === 1 ? "escaño estimado" : "escaños estimados"}`;
}

function renderResultCard({ item, comparable, matching, disagreements, omitted, ratio }) {
  const metadata = parties[item.id];
  const label = projectionLabel(item);
  const coverage = ratio !== null
    ? `${comparable.length} ${comparable.length === 1 ? "respuesta comparable" : "respuestas comparables"}${comparable.length < 3 ? " · Muestra reducida" : ""}`
    : omitted.length
      ? "Sin respuestas comparables."
      : metadata?.url ? "Sin medidas verificadas para estas preguntas." : "Programa del 29N no verificado.";
  const color = metadata?.color ?? "#8b8173";
  const loss = comparable.length ? 100 / comparable.length : 0;
  return `<article class="result-card" style="--party:${escapeHtml(color)}">
    <div class="result-top"><div><h3>${escapeHtml(labelFor(item))}</h3>
      ${label ? `<p class="projection-label">${label}</p>` : ""}</div>
      <span class="score${ratio === null ? " small" : ""}">${ratio === null ? "Sin puntuación" : formatter.format(ratio)}</span></div>
    ${ratio === null ? "" : `<div class="bar" aria-hidden="true"><span style="width:${ratio * 100}%"></span></div>
      <p class="match-count">${matching.length} ${matching.length === 1 ? "coincidencia" : "coincidencias"} · ${disagreements.length} ${disagreements.length === 1 ? "discrepancia" : "discrepancias"}</p>`}
    <p>${coverage}</p>
    ${renderEvidence(disagreements, metadata, "is-disagreement", disagreements.length === 1 ? "discrepancia" : "discrepancias", loss)}
    ${renderEvidence(matching, metadata, "is-match", matching.length === 1 ? "coincidencia" : "coincidencias")}
    ${renderEvidence(omitted, metadata, "is-omitted", omitted.length === 1 ? "medida sin comparar" : "medidas sin comparar")}
    ${!comparable.length && !omitted.length && metadata?.url ? `<p>${programLinks(metadata)}</p>` : ""}
  </article>`;
}

function resultGrid(rows) {
  return `<div class="result-grid">${rows.map(renderResultCard).join("")}</div>`;
}

function resultGroup(rows, title) {
  return rows.length
    ? `<details class="result-group"><summary>${title} <span>${rows.length}</span></summary>${resultGrid(rows)}</details>`
    : "";
}

function renderOrderedResults(candidates, order) {
  const rows = candidates.map(item => getComparison(item, activeQuestions, responses));
  if (order === "alphabet") return resultGrid(rows);
  if (order === "ratio") {
    const scored = rows.filter(row => row.ratio !== null).sort((a, b) =>
      b.ratio - a.ratio || b.comparable.length - a.comparable.length);
    return resultGrid(scored.slice(0, 6)) + resultGroup(scored.slice(6), "Más coincidencias")
      + resultGroup(rows.filter(row => row.ratio === null), "Candidaturas sin puntuación");
  }
  const hasProjection = ({ item }) =>
    Boolean(seats[item.id] || (selectedDistrict() && seats[projectionGroups[item.id]]));
  const nationalSeats = ({ item }) => seats[projectionGroups[item.id] ?? item.id] ?? 0;
  const projected = rows.filter(hasProjection).sort((a, b) => nationalSeats(b) - nationalSeats(a));
  const others = rows.filter(row => !hasProjection(row));
  return `<h3 class="result-group-title">Mayor proyección de escaños</h3>${resultGrid(projected.slice(0, 6))}
    ${resultGroup(projected.slice(6), "Otras candidaturas en la proyección")}
    ${resultGroup(others, "Resto de candidaturas")}`;
}

function renderResults() {
  showStage(results);
  const candidates = getCandidates();
  const answered = answeredCount();
  const scope = selectedDistrict()?.name ?? "Toda España";
  results.innerHTML = `
    <div class="section-heading">
      <p class="overline">${escapeHtml(scope)} · ${answered} de ${activeQuestions.length} respondidas</p>
      <h2 id="result-title" tabindex="-1">Tus coincidencias</h2>
      <p>${answered
        ? "Abre las discrepancias de una candidatura para ver qué respuestas bajaron tu coincidencia y cuánto influyó cada una."
        : "Has omitido todas las medidas. Puedes revisar tus respuestas o consultar las fuentes."}</p>
    </div>
    <div class="result-actions">
      <button class="button secondary" type="button" data-review>Revisar respuestas</button>
      <button class="button secondary" type="button" data-restart>Nuevo cuestionario</button>
      <a href="#programas">Ver todos los programas disponibles</a>
    </div>
    <div class="result-controls">
      <div class="sort-control"><label for="result-sort">Orden</label><div class="select-wrap"><select id="result-sort">
        <option value="projection">Proyección de escaños</option>
        <option value="ratio"${answered ? "" : " disabled"}>Mayor coincidencia</option>
        <option value="alphabet">Alfabético</option>
      </select></div></div>
      <p class="projection-label">Proyección nacional · ${sourceLink(document.querySelector("#projection-source").href, "DatosRTVE, 18 nov")}</p>
    </div>
    <div id="ordered-results">${renderOrderedResults(candidates, "projection")}</div>`;
  results.querySelector("#result-sort").addEventListener("change", event => {
    results.querySelector("#ordered-results").innerHTML = renderOrderedResults(candidates, event.target.value);
  });
  results.querySelector("[data-review]").addEventListener("click", () => {
    step = 0;
    showStage(quiz);
    renderQuestion();
  });
  results.querySelector("[data-restart]").addEventListener("click", () => {
    responses = new Map();
    showStage(hero);
    form.querySelector("select").focus();
    hero.scrollIntoView({ block: "start" });
  });
  focusOn(results.querySelector("h2"));
}

for (const district of districts.slice().sort((a, b) => alphabet.compare(a.name, b.name))) {
  province.add(new Option(district.name, district.id));
}
province.addEventListener("change", renderCatalogue);
territorial.addEventListener("change", renderCatalogue);
form.addEventListener("submit", event => {
  event.preventDefault();
  activeQuestions = currentQuestions(getCandidates());
  responses = new Map();
  step = 0;
  showStage(quiz);
  renderQuestion();
});
renderCatalogue();
