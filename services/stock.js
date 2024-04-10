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
        WHERE datePeremption < '${datePeremptionSixMoisString}' GROUP BY stock.numLot LIMIT ${offset},${config.listPerPage}`
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
      `SELECT idStock, idMateriel, nomMateriel
      FROM stock INNER JOIN materiels ON materiels.idMateriel = stock.idMateriel 
      WHERE datePeremption < '${datePeremptionSixMoisString}' AND idMateriel = '${idMateriel}' LIMIT ${offset},${config.listPerPage}`
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
    getPeremptionids
  }