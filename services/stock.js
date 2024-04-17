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
    const offset = helper.getOffset(page, config.listPerPage);
    const rows = await db.query(
      `SELECT
        (SELECT COUNT(*) FROM stock WHERE idStatut != 3) AS nbTotal,
        (SELECT COUNT(*) FROM stock WHERE idStatut = 1) AS nbReserve,
        (SELECT COUNT(*) FROM stock WHERE idStatut = 2) AS nbVSAV,
        (SELECT COUNT(DISTINCT numLot) FROM stock WHERE idStatut != 3) AS nbLotsTotal
      FROM stock
      WHERE 1
      LIMIT 1;`
    );
    const data = helper.emptyOrRows(rows);
    const meta = {page};
  
    return {
      data,
      meta
    }
  }
  async function getMaterielList(page = 1){
    const offset = helper.getOffset(page, config.listPerPage);
    const rows = await db.query(
      `SELECT * FROM materiels ORDER BY nomMateriel`
    );
    const data = helper.emptyOrRows(rows);
    const meta = {page};
  
    return {
      data,
      meta
    }
  }
  async function create(new_materiel){
    const result = await db.query(
      `INSERT INTO stock
      (idStock, idMateriel, idStatut, idAgent, dateCreation, numLot, datePeremption) 
      VALUES 
      (${new_materiel.idStock}, '${new_materiel.idMateriel}', ${new_materiel.idStatut}, '${new_materiel.idAgent}', '${new_materiel.dateCreation}', '${new_materiel.numLot}', '${new_materiel.datePeremption}')`
    );
  
    let message = 'Il y a eu une erreur lors de la création du matériel dans la base de données.';
  
    if (result.affectedRows) {
      message = 'Le matériel a bien été créé.';
    }
  
    return {message};
  }

  async function todayCreated(page = 1, idMateriel){
    const offset = helper.getOffset(page, config.listPerPage);
    let todayDate = new Date();
    let dateYesterday = new Date();
    dateYesterday.setDate(dateYesterday.getDate() - 1);
    dateYesterday = dateYesterday.toISOString().slice(0, 19).replace('T', ' ');
    todayDate = todayDate.toISOString().slice(0, 19).replace('T', ' ');
    const rows = await db.query(
      `SELECT * 
      FROM stock
      WHERE stock.idMateriel = '${idMateriel}'  AND stock.dateCreation > '${dateYesterday}' AND stock.dateCreation < '${todayDate}'
      LIMIT ${offset},${config.listPerPage}`
    );
    const data = helper.emptyOrRows(rows);
    const meta = {page};
  
    return {
      data,
      meta
    }
  }

  async function remove(id){
    const result = await db.query(
      `DELETE FROM stock WHERE idStock = ${id}`
    );
    let message = `Error in deleting ID-${id}`;

  if (result.affectedRows) {
    message = `ID-${id} a bien été supprimé.`;
  }

  return {message};
  }

  
  module.exports = {
    getPeremption,
    getPeremptionids,
    getPeremptionsCount,
    getMaterielList,
    todayCreated,
    create,
    remove
  }