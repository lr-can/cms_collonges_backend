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

/** Matériel : statut 1 = réserve pharmacie, statut 2 = mise à disposition */
async function getPeremptionsMateriel() {
  const rows = await db.query(
    `SELECT m.nomMateriel, s.numLot, s.datePeremption,
            COUNT(*) AS nombre,
            SUM(CASE WHEN s.idStatut = 1 THEN 1 ELSE 0 END) AS reservePharmacie,
            SUM(CASE WHEN s.idStatut = 2 THEN 1 ELSE 0 END) AS miseADisposition
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
    reservePharmacie: row.reservePharmacie || 0,
    miseADisposition: row.miseADisposition || 0
  }));
}

/** ASUP : statut 1 = disponible dans les VSAV, statut 3 = bientôt périmé dans les VSAV (statut 2 ignoré) */
async function getPeremptionsAsup() {
  try {
    const rows = await db.query(
      `SELECT med.nomMedicament, a.numLot, a.datePeremption,
              COUNT(*) AS nombre,
              SUM(CASE WHEN a.idStatutAsup = 1 THEN 1 ELSE 0 END) AS disponibleVsav,
              SUM(CASE WHEN a.idStatutAsup = 3 THEN 1 ELSE 0 END) AS bientotPerimeVsav
       FROM asupStock a
       INNER JOIN medicaments med ON med.idMedicament = a.idMedicament
       WHERE a.idStatutAsup IN (1, 3)
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
      disponibleVsav: row.disponibleVsav || 0,
      bientotPerimeVsav: row.bientotPerimeVsav || 0
    }));
  } catch (err) {
    console.warn('getPeremptionsAsup:', err.message);
    return { semaine1: [], semaine2: [], semaine3: [], semaine4: [] };
  }
}

/**
 * Utilise v_kitsPerimantBientot. Si idKit = _POOL_ → afficher "réserve pharmacie", sinon idKit.
 * Retourne les kits regroupés par idKit, avec la liste du matériel qui périme.
 */
async function getPeremptionsKits() {
  try {
    const rows = await db.query(
      `SELECT mk.nomCommun, sk.numeroLot, sk.dateArticle, v.idKit, v.nomKit,
              COUNT(*) AS nombre
       FROM v_kitsPerimantBientot v
       INNER JOIN stockKit sk ON sk.completKitId = v.id
       INNER JOIN materielKit mk ON mk.id = sk.materielKitId
       WHERE sk.statut != 3
         AND sk.dateArticle IS NOT NULL
         AND sk.dateArticle >= CURDATE()
         AND sk.dateArticle <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
       GROUP BY mk.nomCommun, sk.numeroLot, sk.dateArticle, v.idKit, v.nomKit
       ORDER BY v.idKit, sk.dateArticle, mk.nomCommun`
    );
    const data = helper.emptyOrRows(rows);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const byKit = {};
    for (const row of data) {
      const d = row.dateArticle;
      if (!d) continue;
      const datePeremption = new Date(d);
      datePeremption.setHours(0, 0, 0, 0);
      const diffMs = datePeremption - now;
      const diffJours = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
      if (diffJours < 1 || diffJours > 30) continue;

      let semaine;
      if (diffJours >= 22 && diffJours <= 30) semaine = 'semaine4';
      else if (diffJours >= 15 && diffJours <= 21) semaine = 'semaine3';
      else if (diffJours >= 8 && diffJours <= 14) semaine = 'semaine2';
      else semaine = 'semaine1';

      const idKit = row.idKit;
      if (!byKit[idKit]) {
        byKit[idKit] = { idKit, nomKit: row.nomKit, materiels: [] };
      }
      byKit[idKit].materiels.push({
        nomProduit: row.nomCommun,
        numeroLot: row.numeroLot,
        datePeremption: row.dateArticle ? new Date(row.dateArticle).toISOString().slice(0, 10) : null,
        nombre: row.nombre,
        semaine
      });
    }
    return Object.values(byKit);
  } catch (err) {
    console.warn('getPeremptionsKits:', err.message);
    return [];
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

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function getExamplePeremptions() {
  const fmt = (d) => d.toISOString().slice(0, 10);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const dateForSemaine = (sem) => {
    const d = new Date(now);
    if (sem === 1) d.setDate(d.getDate() + randInt(1, 7));
    else if (sem === 2) d.setDate(d.getDate() + randInt(8, 14));
    else if (sem === 3) d.setDate(d.getDate() + randInt(15, 21));
    else d.setDate(d.getDate() + randInt(22, 30));
    return fmt(d);
  };

  const emptyBuckets = () => ({
    semaine1: [],
    semaine2: [],
    semaine3: [],
    semaine4: []
  });

  let materiel = emptyBuckets();
  let kit = [];
  let medicamentsAsup = emptyBuckets();

  try {
    const stockRows = await db.query(
      `SELECT m.nomMateriel, s.numLot, COUNT(*) AS nombre,
              SUM(CASE WHEN s.idStatut = 1 THEN 1 ELSE 0 END) AS reservePharmacie,
              SUM(CASE WHEN s.idStatut = 2 THEN 1 ELSE 0 END) AS miseADisposition
       FROM stock s
       INNER JOIN materiels m ON m.idMateriel = s.idMateriel
       WHERE s.idStatut != 3
       GROUP BY m.nomMateriel, s.numLot
       LIMIT 8`
    );
    const stockData = helper.emptyOrRows(stockRows);
    [1, 2, 3, 4].forEach((sem, i) => {
      const row = stockData[i];
      if (row) {
        materiel[`semaine${sem}`].push({
          nomMateriel: row.nomMateriel,
          numLot: row.numLot || '-',
          datePeremption: dateForSemaine(sem),
          nombre: parseInt(row.nombre, 10) || 0,
          reservePharmacie: parseInt(row.reservePharmacie, 10) || 0,
          miseADisposition: parseInt(row.miseADisposition, 10) || 0
        });
      }
    });
  } catch (err) {
    console.warn('getExamplePeremptions materiel:', err.message);
  }

  try {
    const kitRows = await db.query(
      `SELECT mk.nomCommun, sk.numeroLot, ck.idKit, ck.nomKit, COUNT(*) AS nombre
       FROM stockKit sk
       INNER JOIN completKit ck ON ck.id = sk.completKitId
       INNER JOIN materielKit mk ON mk.id = sk.materielKitId
       WHERE sk.statut != 3
         AND sk.dateArticle IS NOT NULL
         AND sk.dateArticle >= CURDATE()
         AND sk.dateArticle <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
       GROUP BY mk.nomCommun, sk.numeroLot, ck.idKit, ck.nomKit
       LIMIT 12`
    );
    const kitData = helper.emptyOrRows(kitRows);
    const byKit = {};
    [1, 2, 3, 4].forEach((sem, i) => {
      const row = kitData[i];
      if (row) {
        const idKit = row.idKit;
        if (!byKit[idKit]) {
          byKit[idKit] = { idKit, nomKit: row.nomKit, materiels: [] };
        }
        byKit[idKit].materiels.push({
          nomProduit: row.nomCommun,
          numeroLot: row.numeroLot || '-',
          datePeremption: dateForSemaine(sem),
          nombre: parseInt(row.nombre, 10) || 0,
          semaine: 'semaine' + sem
        });
      }
    });
    kit.push(...Object.values(byKit));
  } catch (err) {
    console.warn('getExamplePeremptions kit:', err.message);
  }

  try {
    const asupRows = await db.query(
      `SELECT med.nomMedicament, a.numLot, COUNT(*) AS nombre,
              SUM(CASE WHEN a.idStatutAsup = 1 THEN 1 ELSE 0 END) AS disponibleVsav,
              SUM(CASE WHEN a.idStatutAsup = 3 THEN 1 ELSE 0 END) AS bientotPerimeVsav
       FROM asupStock a
       INNER JOIN medicaments med ON med.idMedicament = a.idMedicament
       WHERE a.idStatutAsup IN (1, 3)
       GROUP BY med.nomMedicament, a.numLot
       LIMIT 8`
    );
    const asupData = helper.emptyOrRows(asupRows);
    [1, 2, 3, 4].forEach((sem, i) => {
      const row = asupData[i];
      if (row) {
        medicamentsAsup[`semaine${sem}`].push({
          nomMedicament: row.nomMedicament,
          numLot: row.numLot || '-',
          datePeremption: dateForSemaine(sem),
          nombre: parseInt(row.nombre, 10) || 0,
          disponibleVsav: parseInt(row.disponibleVsav, 10) || 0,
          bientotPerimeVsav: parseInt(row.bientotPerimeVsav, 10) || 0
        });
      }
    });
  } catch (err) {
    console.warn('getExamplePeremptions medicamentsAsup:', err.message);
  }

  return {
    materiel,
    kit,
    medicamentsAsup
  };
}

module.exports = {
  getAllPeremptions,
  getExamplePeremptions,
  getPeremptionsMateriel,
  getPeremptionsKits,
  getPeremptionsAsup
};
