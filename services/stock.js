const db = require('./db');
const helper = require('../helper');
const config = require('../config');

async function getPeremption(page = 1){
    const offset = helper.getOffset(page, config.listPerPage);
    const datePeremptionSixMois = new Date();
    datePeremptionSixMois.setMonth(datePeremptionSixMois.getMonth() + 6);
    let datePeremptionSixMoisString = datePeremptionSixMois.toISOString().slice(0, 19).replace('T', ' ');
    const rows = await db.query(
      `SELECT materiels.nomMateriel, stock.numLot, stock.datePeremption
      FROM stock
      INNER JOIN materiels
        ON materiels.idMateriel = stock.idMateriel
        WHERE datePeremption < '${datePeremptionSixMoisString}' AND stock.idStatut != 3 GROUP BY stock.numLot ORDER BY stock.datePeremption LIMIT ${offset},${config.listPerPage}`
    );
    const data = helper.emptyOrRows(rows);
    const meta = {page};
  
    return {
      data,
      meta
    }
  }

  async function getPeremptionids(page = 1, idMateriel){
    const offset = helper.getOffset(page, config.listPerPage);
    const datePeremptionSixMois = new Date();
    datePeremptionSixMois.setMonth(datePeremptionSixMois.getMonth() + 6);
    let datePeremptionSixMoisString = datePeremptionSixMois.toISOString().slice(0, 19).replace('T', ' ');
    const rows = await db.query(
      `SELECT stock.idStock, stock.idMateriel, materiels.nomMateriel
      FROM stock INNER JOIN materiels ON materiels.idMateriel = stock.idMateriel 
      WHERE stock.datePeremption < '${datePeremptionSixMoisString}' AND stock.idMateriel = '${idMateriel}'  AND stock.idStatut != 3 LIMIT ${offset},${config.listPerPage}`
    );
    const data = helper.emptyOrRows(rows);
    const meta = {page};
  
    return {
      data,
      meta
    }
  }

  async function getPeremptionsCount(page = 1){
    const datePeremptionSixMois = new Date();
    const offset = helper.getOffset(page, config.listPerPage);
    datePeremptionSixMois.setMonth(datePeremptionSixMois.getMonth() + 6);
    let datePeremptionSixMoisString = datePeremptionSixMois.toISOString().slice(0, 19).replace('T', ' ');
    const rows = await db.query(
      `SELECT
        (SELECT COUNT(*) FROM stock WHERE datePeremption < '${datePeremptionSixMoisString}' AND idStatut != 3) AS nbProduits,
        (SELECT COUNT(DISTINCT numLot) FROM stock WHERE datePeremption < '${datePeremptionSixMoisString}' AND idStatut != 3) AS nbLots,
        (SELECT COUNT(*) FROM stock WHERE idStatut != 3) AS nbTotal
      FROM stock
      WHERE datePeremption < '${datePeremptionSixMoisString}' AND idStatut != 3
      LIMIT 1;`
    );
    const data = helper.emptyOrRows(rows);
    const meta = {page};
  
    return {
      data,
      meta
    }
  }
  
  module.exports = {
    getPeremption,
    getPeremptionids,
    getPeremptionsCount
  }