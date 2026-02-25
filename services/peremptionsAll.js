/**
 * Service : péremptions consolidées (materiel, kit, medicamentsAsup)
 * Retourne les items qui périment dans les 30 jours, classés par semaines (1, 2, 3, 4)
 * avec nombre par lot, date de péremption, et répartition réserve/VSAV
 */
const db = require('./db');
const helper = require('../helper');

function getSemaine(diffJours) {
  if (diffJours >= 22 && diffJours <= 30) return 'semaine4';
  if (diffJours >= 15 && diffJours <= 21) return 'semaine3';
  if (diffJours >= 8 && diffJours <= 14) return 'semaine2';
  if (diffJours >= 1 && diffJours <= 7) return 'semaine1';
  return null;
}

function bucketBySemaine(rows, dateField, formatRow) {
  const buckets = { semaine1: [], semaine2: [], semaine3: [], semaine4: [] };
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  for (const row of rows || []) {
    const d = row[dateField];
    if (!d) continue;
    const datePeremption = new Date(d);
    datePeremption.setHours(0, 0, 0, 0);
    const diffMs = datePeremption - now;
    const diffJours = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    if (diffJours < 1 || diffJours > 30) continue;
    const semaine = getSemaine(diffJours);
    if (semaine) buckets[semaine].push(formatRow ? formatRow(row) : row);
  }
  return buckets;
}

async function getPeremptionsMateriel() {
  const rows = await db.query(
    `SELECT m.nomMateriel, s.numLot, s.datePeremption,
            COUNT(*) AS nombre,
            SUM(CASE WHEN s.idStatut = 1 THEN 1 ELSE 0 END) AS reserve,
            SUM(CASE WHEN s.idStatut = 2 THEN 1 ELSE 0 END) AS vsav
     FROM stock s
     INNER JOIN materiels m ON m.idMateriel = s.idMateriel
     WHERE s.idStatut != 3
       AND s.datePeremption IS NOT NULL
       AND s.datePeremption >= CURDATE()
       AND s.datePeremption <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
     GROUP BY m.nomMateriel, s.numLot, s.datePeremption
     ORDER BY s.datePeremption, m.nomMateriel`
  );
  const data = helper.emptyOrRows(rows);
  return bucketBySemaine(data, 'datePeremption', (row) => ({
    nomMateriel: row.nomMateriel,
    numLot: row.numLot,
    datePeremption: row.datePeremption ? new Date(row.datePeremption).toISOString().slice(0, 10) : null,
    nombre: row.nombre,
    reserve: row.reserve || 0,
    vsav: row.vsav || 0
  }));
}

async function getPeremptionsAsup() {
  try {
    const rows = await db.query(
      `SELECT med.nomMedicament, a.numLot, a.datePeremption,
              COUNT(*) AS nombre,
              SUM(CASE WHEN a.affectationVSAV = 1 THEN 1 ELSE 0 END) AS vsav1,
              SUM(CASE WHEN a.affectationVSAV = 2 THEN 1 ELSE 0 END) AS vsav2,
              SUM(CASE WHEN a.affectationVSAV IS NULL OR a.affectationVSAV = 0 THEN 1 ELSE 0 END) AS reserve
       FROM asupStock a
       INNER JOIN medicaments med ON med.idMedicament = a.idMedicament
       WHERE a.idStatutAsup != 4 AND a.idStatutAsup != 2
         AND a.datePeremption IS NOT NULL
         AND a.datePeremption >= CURDATE()
         AND a.datePeremption <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
       GROUP BY med.nomMedicament, a.numLot, a.datePeremption
       ORDER BY a.datePeremption, med.nomMedicament`
    );
    const data = helper.emptyOrRows(rows);
    return bucketBySemaine(data, 'datePeremption', (row) => ({
      nomMedicament: row.nomMedicament,
      numLot: row.numLot,
      datePeremption: row.datePeremption ? new Date(row.datePeremption).toISOString().slice(0, 10) : null,
      nombre: row.nombre,
      vsav1: row.vsav1 || 0,
      vsav2: row.vsav2 || 0,
      reserve: row.reserve || 0
    }));
  } catch (err) {
    console.warn('getPeremptionsAsup:', err.message);
    return { semaine1: [], semaine2: [], semaine3: [], semaine4: [] };
  }
}

async function getPeremptionsKits() {
  try {
    const rows = await db.query(
      `SELECT mk.nomCommun, sk.numeroLot, sk.dateArticle, ck.idKit, ck.nomKit,
              COUNT(*) AS nombre
       FROM stockKit sk
       INNER JOIN completKit ck ON ck.id = sk.completKitId
       INNER JOIN materielKit mk ON mk.id = sk.materielKitId
       WHERE sk.dateArticle IS NOT NULL
         AND sk.dateArticle >= CURDATE()
         AND sk.dateArticle <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
         AND ck.idKit != '_POOL_'
       GROUP BY mk.nomCommun, sk.numeroLot, sk.dateArticle, ck.idKit, ck.nomKit
       ORDER BY sk.dateArticle, mk.nomCommun`
    );
    const data = helper.emptyOrRows(rows);
    return bucketBySemaine(data, 'dateArticle', (row) => ({
      nomProduit: row.nomCommun,
      numeroLot: row.numeroLot,
      datePeremption: row.dateArticle ? new Date(row.dateArticle).toISOString().slice(0, 10) : null,
      idKit: row.idKit,
      nomKit: row.nomKit,
      nombre: row.nombre
    }));
  } catch (err) {
    console.warn('getPeremptionsKits:', err.message);
    return { semaine1: [], semaine2: [], semaine3: [], semaine4: [] };
  }
}

async function getAllPeremptions() {
  const [materiel, kit, medicamentsAsup] = await Promise.all([
    getPeremptionsMateriel(),
    getPeremptionsKits(),
    getPeremptionsAsup()
  ]);

  return {
    materiel,
    kit,
    medicamentsAsup
  };
}

module.exports = {
  getAllPeremptions,
  getPeremptionsMateriel,
  getPeremptionsKits,
  getPeremptionsAsup
};
