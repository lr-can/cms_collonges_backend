/**
 * Service de gestion des kits (materielKit, completKit, stockKit)
 * Gère : catalogue, constitution, modification, remplacement, historique
 */
const db = require('./db');
const helper = require('../helper');
const config = require('../config');

const HISTORIQUE_MAX = 500;

/**
 * Tronque l'historique à 500 caractères en supprimant les entrées les plus anciennes
 * @param {string} historique - Chaîne actuelle
 * @param {string} nouvelleEntree - Nouvelle entrée à ajouter (ex: "remplacement du X par Y (péremption le :)")
 */
function appendHistorique(historique, nouvelleEntree) {
  const separateur = ' | ';
  let resultat = (historique || '') + (historique ? separateur : '') + nouvelleEntree;
  if (resultat.length > HISTORIQUE_MAX) {
    const parties = resultat.split(separateur);
    let acc = '';
    let i = parties.length - 1;
    while (i >= 0) {
      const test = parties.slice(i).join(separateur);
      if (test.length <= HISTORIQUE_MAX) {
        acc = test;
      } else break;
      i--;
    }
    resultat = acc || parties[parties.length - 1];
  }
  return resultat;
}

/**
 * Liste le catalogue materielKit (tous les types de kits et leurs articles)
 */
async function getMaterielKitList(params = {}) {
  const { nomKit } = params;
  let sql = `SELECT * FROM materielKit`;
  const p = [];
  if (nomKit) {
    sql += ` WHERE nomKit = ?`;
    p.push(nomKit);
  }
  sql += ` ORDER BY nomKit, nomCommun`;
  const rows = await db.query(sql, p.length ? p : null);
  return helper.emptyOrRows(rows);
}

/**
 * Articles d'un type de kit (materielKit filtré par nomKit)
 */
async function getMaterielKitByNomKit(nomKit) {
  const rows = await db.query(
    `SELECT * FROM materielKit WHERE nomKit = ? ORDER BY nomCommun`,
    [nomKit]
  );
  return helper.emptyOrRows(rows);
}

/**
 * Liste des noms de kits distincts
 */
async function getNomsKits() {
  const rows = await db.query(
    `SELECT DISTINCT nomKit FROM materielKit ORDER BY nomKit`
  );
  return helper.emptyOrRows(rows);
}

/**
 * Liste des kits physiques (completKit) avec filtres optionnels
 */
async function getCompletKitList(params = {}) {
  const { nomKit, statut } = params;
  let sql = `SELECT ck.*, CASE ck.statut WHEN 1 THEN 'Reserve pharmacie' WHEN 2 THEN 'Mis en kit' WHEN 3 THEN 'Archive' END AS statutLabel FROM completKit ck WHERE 1=1`;
  const p = [];
  if (nomKit) {
    sql += ` AND ck.nomKit = ?`;
    p.push(nomKit);
  }
  if (statut != null && statut !== undefined && statut !== '') {
    sql += ` AND ck.statut = ?`;
    p.push(statut);
  }
  sql += ` ORDER BY ck.nomKit, ck.datePeremption`;
  const rows = await db.query(sql, p.length ? p : null);
  return helper.emptyOrRows(rows);
}

/**
 * Détail complet d'un kit physique (completKit + stockKit via v_stockKit)
 */
async function getCompletKitDetail(idKit) {
  const rows = await db.query(
    `SELECT * FROM v_completKit WHERE idKit = ?`,
    [idKit]
  );
  const kit = helper.emptyOrRows(rows)[0];
  if (!kit) return null;

  const stockRows = await db.query(
    `SELECT * FROM v_stockKit WHERE idKit = ? ORDER BY nomCommun`,
    [idKit]
  );
  kit.items = helper.emptyOrRows(stockRows);
  return kit;
}

/**
 * Détail par id numérique (completKit.id)
 */
async function getCompletKitById(id) {
  const rows = await db.query(`SELECT * FROM v_completKit WHERE id = ?`, [id]);
  const kit = helper.emptyOrRows(rows)[0];
  if (!kit) return null;

  const stockRows = await db.query(
    `SELECT sk.completKitId, sk.materielKitId, mk.nomCommande, mk.nomCommun, mk.quantite AS quantiteTheorique,
            COUNT(*) AS quantiteReelle,
            MIN(sk.dateArticle) AS dateArticle, MIN(sk.numeroLot) AS numeroLot, MIN(sk.datePeremption) AS datePeremption,
            MIN(sk.id) AS id
     FROM stockKit sk
     JOIN materielKit mk ON mk.id = sk.materielKitId
     WHERE sk.completKitId = ?
     GROUP BY sk.completKitId, sk.materielKitId, mk.nomCommande, mk.nomCommun, mk.quantite
     ORDER BY mk.nomCommun`,
    [id]
  );
  kit.items = helper.emptyOrRows(stockRows);
  return kit;
}

/**
 * Néo-création : crée un nouveau kit physique vide (sans stockKit)
 */
async function createCompletKit(body) {
  const { idKit, nomKit, createurId, createurNom } = body;
  const result = await db.query(
    `INSERT INTO completKit (idKit, nomKit, createurId, createurNom, statut) VALUES (?, ?, ?, ?, 1)`,
    [idKit, nomKit, createurId, createurNom || '']
  );
  return { message: 'Kit créé.', id: result.insertId };
}

/**
 * Réaliser un kit : constituer le stockKit à partir du modèle materielKit
 * Crée les lignes stockKit pour chaque article du modèle (quantité à compléter ensuite)
 */
async function realiserKit(body) {
  const { idKit, createurId, createurNom } = body;

  const kit = await db.query(`SELECT id, nomKit FROM completKit WHERE idKit = ?`, [idKit]);
  if (!kit || kit.length === 0) {
    throw new Error('Kit non trouvé');
  }
  const completKitId = kit[0].id;
  const nomKit = kit[0].nomKit;

  const modeles = await db.query(
    `SELECT id, quantite FROM materielKit WHERE nomKit = ?`,
    [nomKit]
  );
  if (!modeles || modeles.length === 0) {
    throw new Error('Aucun article dans le modèle de kit');
  }

  await db.query(`DELETE FROM stockKit WHERE completKitId = ?`, [completKitId]);
  for (const m of modeles) {
    const qte = Math.max(0, m.quantite || 1);
    for (let i = 0; i < qte; i++) {
      await db.query(
        `INSERT INTO stockKit (completKitId, materielKitId) VALUES (?, ?)`,
        [completKitId, m.id]
      );
    }
  }

  await db.query(
    `UPDATE completKit SET createurId = ?, createurNom = ?, statut = 2, updatedAt = NOW() WHERE id = ?`,
    [createurId, createurNom || '', completKitId]
  );
  await updateCompletKitDatePeremption(completKitId);

  return { message: 'Kit réalisé.' };
}

/**
 * Modifier un kit (statut, datePeremption, etc.)
 */
async function updateCompletKit(id, body) {
  const { statut, datePeremption, createurNom } = body;
  const updates = [];
  const params = [];
  if (statut != null) {
    updates.push('statut = ?');
    params.push(statut);
  }
  if (datePeremption !== undefined) {
    updates.push('datePeremption = ?');
    params.push(datePeremption || null);
  }
  if (createurNom !== undefined) {
    updates.push('createurNom = ?');
    params.push(createurNom);
  }
  if (updates.length === 0) return { message: 'Rien à modifier.' };
  params.push(id);
  await db.query(
    `UPDATE completKit SET ${updates.join(', ')}, updatedAt = NOW() WHERE id = ?`,
    params
  );
  return { message: 'Kit modifié.' };
}

/**
 * Remplacer un matériel dans un kit
 * body: { completKitId, stockKitId, dateArticle?, numeroLot?, quantiteReelle? }
 * + info pour l'historique: ancien id_stock / nouveau
 */
async function remplacerMaterielKit(body) {
  const { completKitId, stockKitId, dateArticle, numeroLot, datePeremption, ancienIdStock, nouveauIdStock, datePeremptionNouveau, nomMateriel } = body;

  const kitRows = await db.query(`SELECT historique FROM completKit WHERE id = ?`, [completKitId]);
  if (!kitRows || !kitRows[0]) throw new Error('Kit non trouvé');

  const updates = [];
  const params = [];
  if (dateArticle !== undefined) {
    updates.push('dateArticle = ?');
    params.push(dateArticle ? new Date(dateArticle).toISOString().slice(0, 19).replace('T', ' ') : null);
  }
  if (numeroLot !== undefined) {
    updates.push('numeroLot = ?');
    params.push(numeroLot || '');
  }
  if (datePeremption !== undefined) {
    updates.push('datePeremption = ?');
    params.push(datePeremption ? new Date(datePeremption).toISOString().slice(0, 10) : null);
  }
  if (updates.length > 0) {
    params.push(stockKitId);
    await db.query(`UPDATE stockKit SET ${updates.join(', ')}, updatedAt = NOW() WHERE id = ?`, params);
  }

  const entreeHist = `remplacement du ${nomMateriel || 'matériel'} ${ancienIdStock || '?'} par ${nouveauIdStock || '?'}${datePeremptionNouveau ? ` (péremption le ${datePeremptionNouveau})` : ''}`;
  const nouvelHistorique = appendHistorique(kitRows[0].historique || '', entreeHist);

  await db.query(
    `UPDATE completKit SET historique = ?, updatedAt = NOW() WHERE id = ?`,
    [nouvelHistorique, completKitId]
  );
  await updateCompletKitDatePeremption(completKitId);

  return { message: 'Matériel remplacé.' };
}

/**
 * Mettre à jour une ligne stockKit (1 row = 1 item : date, lot, péremption)
 */
async function updateStockKit(stockKitId, body) {
  const { dateArticle, numeroLot, datePeremption } = body;
  const updates = [];
  const params = [];
  if (dateArticle !== undefined) { updates.push('dateArticle = ?'); params.push(dateArticle ? new Date(dateArticle).toISOString().slice(0, 19).replace('T', ' ') : null); }
  if (numeroLot !== undefined) { updates.push('numeroLot = ?'); params.push(numeroLot || ''); }
  if (datePeremption !== undefined) { updates.push('datePeremption = ?'); params.push(datePeremption ? new Date(datePeremption).toISOString().slice(0, 10) : null); }
  if (updates.length === 0) return { message: 'Rien à modifier.' };
  params.push(stockKitId);
  const rows = await db.query(`SELECT completKitId FROM stockKit WHERE id = ?`, [stockKitId]);
  await db.query(`UPDATE stockKit SET ${updates.join(', ')}, updatedAt = NOW() WHERE id = ?`, params);
  if (rows && rows[0]) await updateCompletKitDatePeremption(rows[0].completKitId);
  return { message: 'Ligne stock kit modifiée.' };
}

/**
 * Ajuster la quantité d'un matériel dans un kit (add/remove rows)
 */
async function ajusterQuantiteStockKit(completKitId, materielKitId, quantiteSouhaitee) {
  const countRows = await db.query(
    `SELECT COUNT(*) AS nb FROM stockKit WHERE completKitId = ? AND materielKitId = ?`,
    [completKitId, materielKitId]
  );
  const current = countRows && countRows[0] ? countRows[0].nb : 0;
  const qte = Math.max(0, quantiteSouhaitee || 0);
  if (qte > current) {
    for (let i = 0; i < qte - current; i++) {
      await db.query(
        `INSERT INTO stockKit (completKitId, materielKitId) VALUES (?, ?)`,
        [completKitId, materielKitId]
      );
    }
  } else if (qte < current) {
    const toDelete = current - qte;
    const limit = parseInt(toDelete, 10);
    const rows = await db.query(
      `SELECT id FROM stockKit WHERE completKitId = ? AND materielKitId = ? ORDER BY COALESCE(datePeremption, '9999-12-31') ASC, id ASC LIMIT ${limit}`,
      [completKitId, materielKitId]
    );
    for (const r of Array.isArray(rows) ? rows : []) {
      if (r && r.id) await db.query(`DELETE FROM stockKit WHERE id = ?`, [r.id]);
    }
  }
  await updateCompletKitDatePeremption(completKitId);
  return { message: 'Quantité ajustée.' };
}

/**
 * Mise à jour d'un groupe (completKitId, materielKitId) : quantité + date/lot
 */
async function updateStockKitGroupe(completKitId, materielKitId, body) {
  const { quantiteReelle, dateArticle, numeroLot, datePeremption } = body;
  if (quantiteReelle !== undefined) {
    await ajusterQuantiteStockKit(completKitId, materielKitId, quantiteReelle);
  }
  if (dateArticle !== undefined || numeroLot !== undefined || datePeremption !== undefined) {
    const updates = [];
    const params = [];
    if (dateArticle !== undefined) { updates.push('dateArticle = ?'); params.push(dateArticle ? new Date(dateArticle).toISOString().slice(0, 19).replace('T', ' ') : null); }
    if (numeroLot !== undefined) { updates.push('numeroLot = ?'); params.push(numeroLot || ''); }
    if (datePeremption !== undefined) { updates.push('datePeremption = ?'); params.push(datePeremption ? new Date(datePeremption).toISOString().slice(0, 10) : null); }
    if (updates.length > 0) {
      params.push(completKitId, materielKitId);
      await db.query(`UPDATE stockKit SET ${updates.join(', ')}, updatedAt = NOW() WHERE completKitId = ? AND materielKitId = ?`, params);
      await updateCompletKitDatePeremption(completKitId);
    }
  }
  return { message: 'Groupe mis à jour.' };
}

/**
 * Ajouter une observation au kit (historique, max 500 caractères)
 */
async function ajouterObservation(completKitId, observation) {
  const [kit] = await db.query(`SELECT historique FROM completKit WHERE id = ?`, [completKitId]);
  if (!kit) throw new Error('Kit non trouvé');

  const nouvelHistorique = appendHistorique(kit[0].historique || '', `Obs: ${observation}`);
  await db.query(
    `UPDATE completKit SET historique = ?, updatedAt = NOW() WHERE id = ?`,
    [nouvelHistorique, completKitId]
  );
  return { message: 'Observation ajoutée.' };
}

/**
 * Données pour la fiche inventaire imprimable (format generateKitPDF)
 */
async function getDonneesFicheInventaire(idKit) {
  const kit = await getCompletKitDetail(idKit);
  if (!kit) return null;

  const itemsKit = (kit.items || []).map(item => ({
    produit: item.nomCommande || item.nomCommun,
    qte: item.quantiteReelle ?? item.quantiteTheorique ?? 0,
    date: item.dateArticle ? new Date(item.dateArticle).toLocaleDateString('fr-FR') : '',
    numero: item.numeroLot || ''
  }));

  return {
    idKit: kit.idKit,
    nomKit: kit.nomKit,
    itemsKit,
    observations: kit.historique || '',
    datePeremption: kit.datePeremption ? new Date(kit.datePeremption).toLocaleDateString('fr-FR') : null
  };
}

/**
 * Info kit pour API publique (QR code https://api.cms-collonges.fr/infoKit/{idKit})
 */
async function getInfoKit(idKit) {
  const kit = await getCompletKitDetail(idKit);
  if (!kit) return null;
  return {
    idKit: kit.idKit,
    nomKit: kit.nomKit,
    statut: kit.statutLabel,
    datePeremption: kit.datePeremption,
    createurNom: kit.createurNom
  };
}

/**
 * Met à jour completKit.datePeremption = MIN des datePeremption des items du kit
 */
async function updateCompletKitDatePeremption(completKitId) {
  const rows = await db.query(
    `SELECT MIN(sk.datePeremption) AS minPeremption
     FROM stockKit sk
     WHERE sk.completKitId = ? AND sk.datePeremption IS NOT NULL`,
    [completKitId]
  );
  const minDate = rows && rows[0] && rows[0].minPeremption ? rows[0].minPeremption : null;
  let sql = `UPDATE completKit SET datePeremption = ?`;
  const params = [minDate];
  sql += ` WHERE id = ?`;
  params.push(completKitId);
  await db.query(sql, params);
}

/**
 * Ajouter du matériel au stock d'un kit (stockKit) - 1 ligne par item physique
 */
async function ajouterMaterielStockKit(body) {
  const { completKitId, materielKitId, quantiteReelle, dateArticle, numeroLot, datePeremption } = body;
  if (!completKitId || !materielKitId) {
    throw new Error('completKitId et materielKitId requis pour l\'ajout de matériel kit');
  }
  const qte = Math.max(1, quantiteReelle || 1);
  let dateArticleSql = null;
  let datePeremptionSql = null;
  if (dateArticle) {
    const d = new Date(dateArticle);
    dateArticleSql = d.toISOString().slice(0, 19).replace('T', ' ');
  }
  if (datePeremption) {
    const d = new Date(datePeremption);
    datePeremptionSql = d.toISOString().slice(0, 19).replace('T', ' ');
  }
  for (let i = 0; i < qte; i++) {
    await db.query(
      `INSERT INTO stockKit (completKitId, materielKitId, dateArticle, numeroLot, datePeremption) VALUES (?, ?, ?, ?, ?)`,
      [completKitId, materielKitId, dateArticleSql, numeroLot || null, datePeremptionSql]
    );
  }
  await updateCompletKitDatePeremption(completKitId);
  return { inserted: qte };
}

/**
 * Matériel manquant pour atteindre N kits de chaque type (statut 1 ou 2)
 */
async function getMaterielManquantKits(nbKitsCible = 4) {
  const nomsKits = await db.query(`SELECT DISTINCT nomKit FROM materielKit ORDER BY nomKit`);
  const result = [];
  for (const { nomKit } of nomsKits || []) {
    const modeles = await db.query(
      `SELECT id, nomCommande, nomCommun, quantite FROM materielKit WHERE nomKit = ?`,
      [nomKit]
    );
    const nbKitsExistants = await db.query(
      `SELECT COUNT(DISTINCT ck.id) AS nb FROM completKit ck WHERE ck.nomKit = ? AND ck.statut IN (1, 2)`,
      [nomKit]
    );
    const nbExist = nbKitsExistants && nbKitsExistants[0] ? nbKitsExistants[0].nb : 0;
    for (const m of modeles || []) {
      const totalRequis = nbKitsCible * m.quantite;
      const enStock = await db.query(
        `SELECT COUNT(*) AS nb FROM stockKit sk
         JOIN completKit ck ON ck.id = sk.completKitId
         WHERE sk.materielKitId = ? AND ck.nomKit = ? AND ck.statut IN (1, 2)`,
        [m.id, nomKit]
      );
      const nbEnStock = enStock && enStock[0] ? enStock[0].nb : 0;
      const manquant = Math.max(0, totalRequis - nbEnStock);
      if (manquant > 0) {
        result.push({
          nomKit,
          materielKitId: m.id,
          nomCommande: m.nomCommande,
          nomCommun: m.nomCommun,
          quantiteParKit: m.quantite,
          nbKitsExistants: nbExist,
          nbKitsCible,
          nbUnitesRequis: totalRequis,
          nbUnitesEnStock: nbEnStock,
          manquant
        });
      }
    }
  }
  return result;
}

/**
 * Génère le prochain idKit suggéré (ex: KIT-ACC-2025-001)
 */
async function getNextIdKitSuggestion(nomKit) {
  const prefix = (nomKit || 'KIT').replace(/\s+/g, '-').substring(0, 12);
  const an = new Date().getFullYear();
  const pattern = `${prefix}-${an}-%`;
  const rows = await db.query(
    `SELECT idKit FROM completKit WHERE idKit LIKE ? ORDER BY idKit DESC LIMIT 1`,
    [pattern]
  );
  if (!rows || rows.length === 0) {
    return `${prefix}-${an}-001`;
  }
  const last = rows[0].idKit;
  const match = last.match(/-(\d+)$/);
  const num = match ? parseInt(match[1], 10) + 1 : 1;
  return `${prefix}-${an}-${String(num).padStart(3, '0')}`;
}

module.exports = {
  ajouterMaterielStockKit,
  ajusterQuantiteStockKit,
  updateStockKitGroupe,
  getMaterielKitList,
  getMaterielKitByNomKit,
  getNomsKits,
  getCompletKitList,
  getCompletKitDetail,
  getCompletKitById,
  createCompletKit,
  realiserKit,
  updateCompletKit,
  remplacerMaterielKit,
  updateStockKit,
  ajouterObservation,
  getDonneesFicheInventaire,
  getInfoKit,
  getNextIdKitSuggestion,
  getMaterielManquantKits,
  appendHistorique
};
