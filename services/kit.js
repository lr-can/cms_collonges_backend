/**
 * Service de gestion des kits (materielKit, completKit, stockKit)
 * Gère : catalogue, constitution, modification, remplacement, historique
 */
const db = require('./db');
const helper = require('../helper');
const config = require('../config');

const HISTORIQUE_MAX = 500;

/** Mapping nomKit -> colonne boolean et quantite dans materielKit */
const NOM_KIT_COLUMNS = {
  'KIT ACCOUCHEMENT': { bool: 'kitAccouchement', quantite: 'quantiteAccouchement' },
  'KIT MEMBRE SECTIONNE': { bool: 'kitMembreSectionne', quantite: 'quantiteMembreSectionne' },
  'KIT AES / AEV': { bool: 'kitAESAEV', quantite: 'quantiteAESAEV' }
};
const NOMS_KITS_FIXES = ['KIT ACCOUCHEMENT', 'KIT MEMBRE SECTIONNE', 'KIT AES / AEV'];

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
 * Liste le catalogue materielKit (matrice : 1 ligne par article, booléens par kit)
 * Query: nomKit ou kitPour (optionnel) = 'KIT ACCOUCHEMENT' | 'KIT MEMBRE SECTIONNE' | 'KIT AES / AEV'
 */
async function getMaterielKitList(params = {}) {
  const kitPour = params.kitPour || params.nomKit;
  let sql = `SELECT * FROM materielKit`;
  if (kitPour && NOM_KIT_COLUMNS[kitPour]) {
    sql += ` WHERE ${NOM_KIT_COLUMNS[kitPour].bool} = 1`;
  }
  sql += ` ORDER BY nomCommun`;
  const rows = await db.query(sql);
  return helper.emptyOrRows(rows);
}

/**
 * Articles d'un type de kit (filtré par le booléen correspondant)
 */
async function getMaterielKitByNomKit(nomKit) {
  const col = NOM_KIT_COLUMNS[nomKit];
  if (!col) return [];
  const rows = await db.query(
    `SELECT *, ${col.quantite} AS quantite FROM materielKit WHERE ${col.bool} = 1 ORDER BY nomCommun`,
    []
  );
  return helper.emptyOrRows(rows);
}

/**
 * Liste des noms de kits (fixe : KIT ACCOUCHEMENT, KIT MEMBRE SECTIONNE, KIT AES / AEV)
 */
async function getNomsKits() {
  return NOMS_KITS_FIXES.map(nomKit => ({ nomKit }));
}

/**
 * Liste des kits physiques (completKit) avec filtre optionnel nomKit
 */
async function getCompletKitList(params = {}) {
  const { nomKit } = params;
  let sql = `SELECT ck.* FROM completKit ck WHERE 1=1`;
  const p = [];
  if (nomKit) {
    sql += ` AND ck.nomKit = ?`;
    p.push(nomKit);
  }
  sql += ` ORDER BY ck.nomKit, ck.datePeremption`;
  const rows = await db.query(sql, p.length ? p : null);
  return helper.emptyOrRows(rows);
}

/**
 * Détail complet d'un kit physique (completKit + v_stockKit agrégé par materielKitId)
 */
async function getCompletKitDetail(idKit) {
  const rows = await db.query(`SELECT * FROM completKit WHERE idKit = ?`, [idKit]);
  const kit = helper.emptyOrRows(rows)[0];
  if (!kit) return null;

  const stockRows = await db.query(
    `SELECT MIN(stockId) AS id, completKitId, materielKitId, idKit, nomKit, nomCommande, nomCommun, idMateriel, quantiteTheorique,
      COUNT(*) AS quantiteReelle, MIN(dateArticle) AS dateArticle, MAX(numeroLot) AS numeroLot,
      statut, statutLabel, datePeremption, creator
     FROM v_stockKit WHERE idKit = ?
     GROUP BY completKitId, materielKitId, idKit, nomKit, nomCommande, nomCommun, idMateriel, quantiteTheorique, statut, statutLabel, datePeremption, creator
     ORDER BY nomCommun`,
    [idKit]
  );
  kit.items = helper.emptyOrRows(stockRows);
  return kit;
}

/**
 * Détail par id numérique (completKit.id)
 */
async function getCompletKitById(id) {
  const rows = await db.query(`SELECT * FROM completKit WHERE id = ?`, [id]);
  const kit = helper.emptyOrRows(rows)[0];
  if (!kit) return null;

  const stockRows = await db.query(
    `SELECT MIN(stockId) AS id, completKitId, materielKitId, idKit, nomKit, nomCommande, nomCommun, idMateriel, quantiteTheorique,
      COUNT(*) AS quantiteReelle, MIN(dateArticle) AS dateArticle, MAX(numeroLot) AS numeroLot,
      statut, statutLabel, datePeremption, creator
     FROM v_stockKit WHERE completKitId = ?
     GROUP BY completKitId, materielKitId, idKit, nomKit, nomCommande, nomCommun, idMateriel, quantiteTheorique, statut, statutLabel, datePeremption, creator
     ORDER BY nomCommun`,
    [id]
  );
  kit.items = helper.emptyOrRows(stockRows);
  return kit;
}

/**
 * Néo-création : crée un nouveau kit physique vide (sans stockKit)
 */
async function createCompletKit(body) {
  const { idKit, nomKit, createurId } = body;
  const result = await db.query(
    `INSERT INTO completKit (idKit, nomKit, createurId) VALUES (?, ?, ?)`,
    [idKit, nomKit, createurId || '']
  );
  return { message: 'Kit créé.', id: result.insertId };
}

/**
 * Génère le prochain id stockKit (K1, K2, ...)
 */
async function getNextStockKitId() {
  const rows = await db.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(id, 2) AS UNSIGNED)), 0) + 1 AS nextNum FROM stockKit WHERE id REGEXP '^K[0-9]+$'`
  );
  const num = rows && rows[0] ? rows[0].nextNum : 1;
  return `K${num}`;
}

/**
 * Retourne les N prochains ids stockKit disponibles (K1, K2, ...)
 */
async function getNextAvailableStockKitIds(count) {
  const cnt = Math.max(1, Math.min(parseInt(count, 10) || 1, 1000));
  const rows = await db.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(id, 2) AS UNSIGNED)), 0) AS maxNum FROM stockKit WHERE id REGEXP '^K[0-9]+$'`
  );
  const maxNum = rows && rows[0] ? rows[0].maxNum : 0;
  const nextIds = [];
  for (let i = 1; i <= cnt; i++) {
    nextIds.push(`K${maxNum + i}`);
  }
  return {
    maxId: maxNum > 0 ? `K${maxNum}` : null,
    nextIds,
    count: nextIds.length
  };
}

/**
 * Réaliser un kit : constituer stockKit à partir de materielKit (booléens true/false)
 */
async function realiserKit(body) {
  const { idKit, createurId } = body;

  const kit = await db.query(`SELECT id, nomKit FROM completKit WHERE idKit = ?`, [idKit]);
  if (!kit || kit.length === 0) throw new Error('Kit non trouvé');
  const completKitId = kit[0].id;
  const nomKit = kit[0].nomKit;

  const col = NOM_KIT_COLUMNS[nomKit];
  if (!col) throw new Error('Type de kit inconnu : ' + nomKit);

  const modeles = await db.query(
    `SELECT id, ${col.quantite} AS quantite FROM materielKit WHERE ${col.bool} = 1 AND ${col.quantite} > 0`,
    []
  );
  if (!modeles || modeles.length === 0) throw new Error('Aucun article dans le modèle de kit');

  await db.query(`DELETE FROM stockKit WHERE completKitId = ?`, [completKitId]);

  for (const m of modeles) {
    const qte = Math.max(0, m.quantite || 1);
    for (let i = 0; i < qte; i++) {
      const skId = await getNextStockKitId();
      await db.query(
        `INSERT INTO stockKit (id, completKitId, materielKitId, statut, creator) VALUES (?, ?, ?, 2, ?)`,
        [skId, completKitId, m.id, createurId || '000000']
      );
    }
  }

  await db.query(`UPDATE completKit SET createurId = ?, updatedAt = NOW() WHERE id = ?`, [createurId || '', completKitId]);
  await updateCompletKitDatePeremption(completKitId);
  return { message: 'Kit réalisé.' };
}

/**
 * Modifier un kit (datePeremption, createurId, historique)
 */
async function updateCompletKit(id, body) {
  const { datePeremption, createurId, historique } = body;
  const updates = [];
  const params = [];
  if (datePeremption !== undefined) {
    updates.push('datePeremption = ?');
    params.push(datePeremption || null);
  }
  if (createurId !== undefined) {
    updates.push('createurId = ?');
    params.push(createurId);
  }
  if (historique !== undefined) {
    updates.push('historique = ?');
    params.push(historique);
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
 * Remplacer un matériel dans un kit (mise à jour de la ligne stockKit)
 * body: { completKitId, stockKitId (id stockKit), dateArticle?, numeroLot?, ancienIdStock?, nouveauIdStock?, datePeremptionNouveau?, nomMateriel? }
 */
async function remplacerMaterielKit(body) {
  const { completKitId, stockKitId, dateArticle, numeroLot, ancienIdStock, nouveauIdStock, datePeremptionNouveau, nomMateriel } = body;

  const kitRows = await db.query(`SELECT historique FROM completKit WHERE id = ?`, [completKitId]);
  if (!kitRows || !kitRows[0]) throw new Error('Kit non trouvé');

  const updates = [];
  const params = [];
  if (dateArticle !== undefined) {
    updates.push('dateArticle = ?');
    params.push(dateArticle ? new Date(dateArticle).toISOString().slice(0, 10) : null);
  }
  if (numeroLot !== undefined) {
    updates.push('numeroLot = ?');
    params.push(numeroLot || null);
  }
  if (updates.length > 0) {
    params.push(stockKitId);
    await db.query(`UPDATE stockKit SET ${updates.join(', ')}, updatedAt = NOW() WHERE id = ?`, params);
  }

  const entreeHist = `remplacement du ${nomMateriel || 'matériel'} ${ancienIdStock || stockKitId || '?'} par ${nouveauIdStock || '?'}${datePeremptionNouveau ? ` (péremption le ${datePeremptionNouveau})` : ''}`;
  const nouvelHistorique = appendHistorique(kitRows[0].historique || '', entreeHist);
  await db.query(`UPDATE completKit SET historique = ?, updatedAt = NOW() WHERE id = ?`, [nouvelHistorique, completKitId]);

  await updateCompletKitDatePeremption(completKitId);
  return { message: 'Matériel remplacé.' };
}

/**
 * Mettre à jour une ligne stockKit (dateArticle, numeroLot)
 */
async function updateStockKit(stockKitId, body) {
  const { dateArticle, numeroLot } = body;
  const updates = [];
  const params = [];
  if (dateArticle !== undefined) { updates.push('dateArticle = ?'); params.push(dateArticle ? new Date(dateArticle).toISOString().slice(0, 10) : null); }
  if (numeroLot !== undefined) { updates.push('numeroLot = ?'); params.push(numeroLot || null); }
  if (updates.length === 0) return { message: 'Rien à modifier.' };
  params.push(stockKitId);
  const rows = await db.query(`SELECT completKitId FROM stockKit WHERE id = ?`, [stockKitId]);
  await db.query(`UPDATE stockKit SET ${updates.join(', ')}, updatedAt = NOW() WHERE id = ?`, params);
  if (rows && rows[0]) await updateCompletKitDatePeremption(rows[0].completKitId);
  return { message: 'Ligne stock kit modifiée.' };
}

/**
 * Ajuster la quantité d'un matériel dans un kit (add/remove lignes stockKit)
 */
async function ajusterQuantiteStockKit(completKitId, materielKitId, quantiteSouhaitee) {
  const ck = await db.query(`SELECT createurId FROM completKit WHERE id = ?`, [completKitId]);
  const creator = (ck && ck[0] && ck[0].createurId) ? ck[0].createurId : '000000';

  const countRows = await db.query(
    `SELECT COUNT(*) AS nb FROM stockKit WHERE completKitId = ? AND materielKitId = ?`,
    [completKitId, materielKitId]
  );
  const current = countRows && countRows[0] ? countRows[0].nb : 0;
  const qte = Math.max(0, quantiteSouhaitee || 0);

  if (qte > current) {
    for (let i = 0; i < qte - current; i++) {
      const skId = await getNextStockKitId();
      await db.query(
        `INSERT INTO stockKit (id, completKitId, materielKitId, statut, creator) VALUES (?, ?, ?, 2, ?)`,
        [skId, completKitId, materielKitId, creator]
      );
    }
  } else if (qte < current) {
    const toDel = current - qte;
    const rows = await db.query(
      `SELECT id FROM stockKit WHERE completKitId = ? AND materielKitId = ? ORDER BY COALESCE(dateArticle, '9999-12-31') ASC LIMIT ?`,
      [completKitId, materielKitId, toDel]
    );
    for (const r of rows || []) {
      if (r?.id) await db.query(`DELETE FROM stockKit WHERE id = ?`, [r.id]);
    }
  }
  await updateCompletKitDatePeremption(completKitId);
  return { message: 'Quantité ajustée.' };
}

/**
 * Mise à jour d'un groupe (completKitId, materielKitId) : quantité + date/lot
 */
async function updateStockKitGroupe(completKitId, materielKitId, body) {
  const { quantiteReelle, dateArticle, numeroLot } = body;

  if (quantiteReelle !== undefined) {
    await ajusterQuantiteStockKit(completKitId, materielKitId, quantiteReelle);
  }
  if (dateArticle !== undefined || numeroLot !== undefined) {
    const updates = [];
    const params = [];
    if (dateArticle !== undefined) { updates.push('dateArticle = ?'); params.push(dateArticle ? new Date(dateArticle).toISOString().slice(0, 10) : null); }
    if (numeroLot !== undefined) { updates.push('numeroLot = ?'); params.push(numeroLot || null); }
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
 * Contenu complet du kit : modèle (materielKit) + réel (stockKit). Inclut les articles attendus même sans matériel affecté.
 * Accepte idKit (string) ou id (numérique)
 */
async function getContenuKitComplet(idKitOrId) {
  let kit;
  if (/^\d+$/.test(String(idKitOrId))) {
    kit = await getCompletKitById(parseInt(idKitOrId, 10));
  } else {
    kit = await getCompletKitDetail(idKitOrId);
  }
  if (!kit) return null;

  const modelItems = await getMaterielKitByNomKit(kit.nomKit);
  const itemsInKit = kit.items || [];
  const byMaterielKitId = {};
  for (const it of itemsInKit) {
    byMaterielKitId[it.materielKitId] = it;
  }

  const merged = modelItems.map((m) => {
    const inKit = byMaterielKitId[m.id];
    return {
      materielKitId: m.id,
      idMateriel: m.idMateriel,
      nomCommande: m.nomCommande,
      nomCommun: m.nomCommun,
      quantiteTheorique: m.quantite ?? 0,
      quantiteReelle: inKit ? (inKit.quantiteReelle ?? 0) : 0,
      dateArticle: inKit?.dateArticle,
      numeroLot: inKit?.numeroLot,
      id: inKit?.id
    };
  });

  return { ...kit, items: merged };
}

/**
 * Données pour la fiche inventaire imprimable (inclut tous les articles attendus, même sans matériel)
 */
async function getDonneesFicheInventaire(idKit) {
  const kit = await getContenuKitComplet(idKit);
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
    datePeremption: kit.datePeremption,
    createurId: kit.createurId
  };
}

/**
 * Met à jour completKit.datePeremption = MIN des dateArticle des items du kit
 */
async function updateCompletKitDatePeremption(completKitId) {
  const rows = await db.query(
    `SELECT MIN(sk.dateArticle) AS minPeremption
     FROM stockKit sk
     WHERE sk.completKitId = ? AND sk.dateArticle IS NOT NULL`,
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
 * Ajouter du matériel au kit (insertion lignes stockKit)
 */
async function ajouterMaterielStockKit(body) {
  const { completKitId, materielKitId, quantiteReelle } = body;
  if (!completKitId || !materielKitId) {
    throw new Error('completKitId et materielKitId requis');
  }
  const ck = await db.query(`SELECT createurId FROM completKit WHERE id = ?`, [completKitId]);
  const creator = (ck && ck[0]) ? ck[0].createurId : '000000';

  const qte = Math.max(1, quantiteReelle || 1);
  let inserted = 0;
  for (let i = 0; i < qte; i++) {
    const skId = await getNextStockKitId();
    await db.query(
      `INSERT INTO stockKit (id, completKitId, materielKitId, statut, creator) VALUES (?, ?, ?, 2, ?)`,
      [skId, completKitId, materielKitId, creator]
    );
    inserted++;
  }
  await updateCompletKitDatePeremption(completKitId);
  return { inserted };
}

/**
 * Matériel manquant pour atteindre N kits de chaque type (stockKit)
 */
async function getMaterielManquantKits(nbKitsCible = 4) {
  const result = [];
  for (const nomKit of NOMS_KITS_FIXES) {
    const col = NOM_KIT_COLUMNS[nomKit];
    if (!col) continue;

    const modeles = await db.query(
      `SELECT id, nomCommande, nomCommun, ${col.quantite} AS quantite FROM materielKit WHERE ${col.bool} = 1 AND ${col.quantite} > 0`,
      []
    );
    const nbKitsExistants = await db.query(
      `SELECT COUNT(DISTINCT ck.id) AS nb FROM completKit ck WHERE ck.nomKit = ?`,
      [nomKit]
    );
    const nbExist = nbKitsExistants && nbKitsExistants[0] ? nbKitsExistants[0].nb : 0;

    for (const m of modeles || []) {
      const totalRequis = nbKitsCible * m.quantite;
      const enStock = await db.query(
        `SELECT COUNT(*) AS nb FROM stockKit sk
         JOIN completKit ck ON ck.id = sk.completKitId
         WHERE sk.materielKitId = ? AND ck.nomKit = ?`,
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
  getContenuKitComplet,
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
  getNextAvailableStockKitIds,
  getMaterielManquantKits,
  appendHistorique
};
