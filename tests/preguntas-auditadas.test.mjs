import assert from 'node:assert/strict';
import { test } from 'node:test';
import programas from '../src/data/programas.js';
import { getComparison } from '../src/scripts/comparacion.js';

const question = id => {
  const matches = programas.questions.filter(item => item.id === id);
  assert.equal(matches.length, 1, `unique question ${id}`);
  return matches[0];
};
const sharedFA = ['fa', 'fa-andaluz', 'fa-asturias', 'frente-amplio-fronte-ampla', 'frente-amplio-fronte-zabala'];
const cases = [
  {
    id: 'judgesElectCouncil',
    title: '¿Deben elegir los jueces y magistrados a los vocales de procedencia judicial del Consejo General del Poder Judicial?',
    positions: {
      ie: ['yes', 'Propone que los jueces y magistrados en activo elijan por sufragio directo y secreto a los diez miembros del Consejo, que podrían proceder de distintos perfiles jurídicos.'],
      'fe-jons': ['yes', 'Propone que jueces y magistrados elijan al Consejo General del Poder Judicial.'],
      ph: ['no', 'Propone elegir a los vocales mediante candidaturas independientes sometidas a sufragio de la ciudadanía y juristas de reconocido prestigio.'],
      vox: ['yes', 'Propone que los jueces y magistrados elijan directamente a los doce vocales de procedencia judicial.'],
    },
  },
  {
    id: 'childBenefit',
    title: '¿Debe establecerse una prestación universal por cada menor hasta los 18 años?',
    positions: { 'arames-eu-ms': ['yes', 'Propone una prestación universal de 200 euros por menor hasta los 18 años, con independencia de los ingresos o el empleo de sus progenitores.'] },
  },
  {
    id: 'aiPublicProcedures',
    title: '¿Debe usarse inteligencia artificial para reducir la burocracia en la Administración pública?',
    positions: {
      pp: ['yes', 'Propone automatizar con IA procedimientos repetitivos de la Administración del Estado y mantener supervisión humana sobre decisiones que afecten a derechos.'],
      psoe: ['yes', 'Propone utilizar IA para liberar a empleados públicos de tareas repetitivas con supervisión humana y protección de derechos.'],
      vox: ['yes', 'Propone implantar IA en las administraciones para reducir la burocracia y conservar la atención presencial.'],
    },
  },
  {
    id: 'classSizeLimits',
    title: '¿Debe reducirse el número de estudiantes por aula en la educación obligatoria?',
    positions: {
      psoe: ['yes', 'Reduciría el número de estudiantes por aula y computaría doble al alumnado con necesidades educativas especiales.'],
      ...Object.fromEntries(sharedFA.map(id => [id, ['yes', 'Fijaría por ley límites de alumnado por aula para cada etapa educativa.']])),
      podemos: ['yes', 'Fijaría un máximo de 15 estudiantes por aula en Primaria y de 20 en Secundaria.'],
      'eh-bildu': ['yes', 'Defiende reducir el alumnado por grupo para reforzar la atención individual.'],
    },
  },
  {
    id: 'minimumPensions',
    title: '¿Deben elevarse las pensiones mínimas con el objetivo de equipararlas al salario mínimo interprofesional?',
    positions: {
      bng: ['yes', 'Propone elevar las pensiones mínimas hasta alcanzar como mínimo el salario mínimo interprofesional.'],
      'eh-bildu': ['yes', 'Propone aumentar las pensiones mínimas hasta al menos 1.220 euros y vincular su cuantía y actualización al salario mínimo interprofesional.'],
    },
  },
];

for (const { id, title, positions } of cases) {
  test(`${id}: revised question and every existing position`, () => {
    const q = question(id);
    assert.equal(q.title, title);
    assert.equal(q.note, undefined);
    assert.deepEqual(Object.keys(q.positions).sort(), Object.keys(positions).sort());
    for (const [party, [stance, evidence]] of Object.entries(positions)) {
      assert.equal(q.positions[party].stance, stance, party);
      assert.equal(q.positions[party].evidence, evidence, party);
      assert.ok(q.positions[party].locator, party);
      const result = getComparison({ id: party }, [q], new Map([[id, stance]]));
      assert.equal(result.ratio, 1, party);
      assert.equal(result.comparable.length, 1, party);
    }
  });
}

const partial = [
  ['protectedEvictions', 'psoe', 'Propone un marco estable de protección frente a desahucios de personas vulnerables sin alternativa y que las administraciones asuman el coste de la prohibición. No precisa que se suspendan todos hasta disponer de alternativa.'],
  ['earlyEd', 'vox', 'Incluye la gratuidad real de la educación infantil de 0 a 3 años en un plan para familias españolas; no precisa una garantía para todas las familias solicitantes.'],
  ['defence', 'eh-bildu', 'Rechaza el aumento del gasto en defensa exigido por la OTAN, sin pronunciarse aquí sobre cualquier aumento.'],
  ['rentCaps', 'junts', 'Propone derogar los artículos estatales sobre contención de precios y zonas tensionadas por invadir competencias de Cataluña; no aclara si rechaza cualquier límite legal.'],
  ['nationalSchoolBullyingPlan', 'compromis', 'Propone protocolos específicos contra el acoso escolar, la violencia digital y la difusión no consentida de imágenes íntimas, sin precisar un plan o protocolo estatal.'],
  ['aiImageConsent', 'nex', 'Propone un delito específico para la pornografía infantil generada con IA y los deepfakes sexuales, sin precisar el alcance de la difusión sin consentimiento.'],
  ['cercaniasTransfer', 'eaj-pnv', 'Propone culminar la transferencia a Euskadi de su infraestructura ferroviaria de cercanías, sin plantear una transferencia general a todas las comunidades.'],
  ['cercaniasTransfer', 'erc', 'Propone transferir a Cataluña las líneas acordadas, sus vías, estaciones e instalaciones y avanzar en el traspaso del mantenimiento de la red, sin plantear una transferencia general a todas las comunidades.'],
  ['bestPensionContributionYears', 'partido-autonomos', 'Propone que los trabajadores autónomos puedan elegir sus 25 mejores años cotizados para calcular la pensión, sin extender expresamente la medida a todos los trabajadores.'],
];
for (const [id, party, evidence] of partial) {
  test(`${id}/${party}: qualified evidence is non-scoring`, () => {
    const q = question(id);
    const position = q.positions[party];
    assert.equal(position.stance, 'ambiguous');
    assert.equal(position.evidence, evidence);
    assert.ok(position.locator);
    for (const response of ['yes', 'no']) {
      const result = getComparison({ id: party }, [q], new Map([[id, response]]));
      assert.equal(result.ratio, null);
      assert.deepEqual(result.comparable, []);
      assert.deepEqual(result.matching, []);
      assert.deepEqual(result.disagreements, []);
      assert.deepEqual(result.ambiguous.map(row => row.position), [position]);
    }
  });
}

test('rural services retain a maximum of 30 minutes for both candidates', () => {
  const q = question('ruralServices30');
  assert.equal(q.title, '¿Debe garantizarse el acceso a servicios públicos básicos en un máximo de 30 minutos en zonas rurales?');
  assert.equal(q.positions.sy.stance, 'yes');
  assert.equal(q.positions.sy.evidence, 'Propone garantizar los servicios públicos esenciales en un máximo de 30 minutos con independencia del lugar de residencia, mediante financiación suficiente y adaptada al territorio.');
  assert.equal(q.positions['teruel-existe'].stance, 'yes');
  assert.equal(q.positions['teruel-existe'].evidence, 'Propone que sanidad, educación, servicios sociales y seguridad queden a un máximo de 30 minutos.');
  for (const party of ['sy', 'teruel-existe']) {
    assert.equal(getComparison({ id: party }, [q], new Map([[q.id, 'yes']])).ratio, 1);
  }
});
