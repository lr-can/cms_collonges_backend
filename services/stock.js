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
        WHERE datePeremption < '${datePeremptionSixMoisString}' AND stock.idStatut != 3 GROUP BY stock.numLot ORDER BY stock.datePeremption LIMIT ${config.listPerPage}`
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
      WHERE stock.datePeremption < '${datePeremptionSixMoisString}' AND stock.idMateriel = '${idMateriel}'  AND stock.idStatut != 3 LIMIT ${config.listPerPage}`
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
      `SELECT * FROM materiels ORDER BY nomMateriel LIMIT ${config.listPerPage}`
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
      LIMIT ${config.listPerPage}`
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
  async function getStock(page = 1, idMateriel){
    const offset = helper.getOffset(page, config.listPerPage);
    const rows1 = await db.query(
      `SELECT * FROM stock WHERE stock.idMateriel = '${idMateriel}' AND stock.idStatut != 3;`
    );
    const rows2 = await db.query(
      `SELECT
      COUNT(stock.idStock) AS totalCount,
      SUM(CASE WHEN stock.idStatut = 1 THEN 1 ELSE 0 END) AS reserveCount,
      SUM(CASE WHEN stock.idStatut = 2 THEN 1 ELSE 0 END) AS vsavCount,
      agents.gradeAbbrAgent,
      agents.nomAgent,
      agents.idAgent
  FROM stock
  INNER JOIN agents ON stock.idAgent = agents.idAgent
  WHERE stock.idMateriel = '${idMateriel}' AND stock.idStatut != '3'
  GROUP BY agents.gradeAgent, agents.nomAgent;
  `
    );
    const rows3 = await db.query(
      `SELECT COUNT(idStock) AS nombreProduits,datePeremption, numLot
      FROM stock
      WHERE stock.idMateriel = '${idMateriel}' AND stock.idStatut != 3
      GROUP BY numLot ORDER BY stock.datePeremption;`
    )
    const rows4 = await db.query(
      `SELECT
      COUNT(stock.idStock) AS totalCount,
      SUM(CASE WHEN stock.idStatut = 1 THEN 1 ELSE 0 END) AS reserveCount,
      SUM(CASE WHEN stock.idStatut = 2 THEN 1 ELSE 0 END) AS vsavCount
    FROM stock
    WHERE stock.idMateriel = '${idMateriel}' AND stock.idStatut != '3'`
    )
    const data = {
      "donneesCompletes":helper.emptyOrRows(rows1),
      "compteParAgent":helper.emptyOrRows(rows2), 
      "isolationLot":helper.emptyOrRows(rows3),
      "compteTotal":helper.emptyOrRows(rows4)
      };
    const meta = {page};
  
    return {
      data,
      meta
    }
  }

  async function archivePeremption(){
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    const dateOneMonthLater = date.toISOString().slice(0, 19).replace('T', ' ');
    const result = await db.query(
      `UPDATE stock SET idStatut = 3 WHERE datePeremption < '${dateOneMonthLater}'`
    );
    let message = 'Il y a eu une erreur lors de l\'archivage des lots dans la base de données.';

    if (result.affectedRows) {
      message = 'Les lots ont bien été archivés.';
    }
    return {message};
  }

  async function getOneMonthPeremption(page = 1){
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    const dateOneMonthLater = date.toISOString().slice(0, 19).replace('T', ' ');
    const rows = await db.query(
      `SELECT COUNT(*) AS perimant FROM stock WHERE datePeremption < '${dateOneMonthLater}' AND idStatut != 3`
    );
    const data = helper.emptyOrRows(rows);
    const meta = {page};
    return {
      data,
      meta
    }
  }

  async function getRealCount(page = 1){
    const offset = helper.getOffset(page, config.listPerPage);
    const rows = await db.query(
      `SELECT stock.idMateriel, COUNT(*) as realCount FROM stock WHERE stock.idStatut != '3' GROUP BY stock.idMateriel LIMIT ${config.listPerPage};`
    );
    const data = helper.emptyOrRows(rows);
    const meta = {page};
    return {
      data,
      meta
    }
  }

  async function getAdressesMails(page = 1){
    const offset = helper.getOffset(page, config.listPerPage);
    const rows = await db.query(
      `SELECT emails.adresseMail, agents.nomAgent
      FROM emails
      INNER JOIN agents
          ON emails.idAgent = agents.idAgent
      WHERE 1 LIMIT ${config.listPerPage};`
    );
    const data = helper.emptyOrRows(rows);
    const meta = {page};
    return {
      data,
      meta
    }
  }

  async function retourIntervention(retourData){
    const getMaterielList = await db.query(
      `SELECT idMateriel, nomRetourInter FROM materiels WHERE nomRetourInter IS NOT NULL` 
    );
    
    const materielList = helper.emptyOrRows(getMaterielList);

    let systematique = retourData.systematique;
    let autreMateriel = retourData.autreMateriel;
    let kits = retourData.kits;
    let specifique = retourData.specifique;

   await db.query(
      `UPDATE retourIntervention SET statutRI = 1
      WHERE idMateriel = 'controleGluco' OR idMateriel = 'gantL' OR idMateriel = 'gantM' 
      OR idMateriel = 'gantS' OR idMateriel = 'gantXL' OR idMateriel = 'masqueChir' OR idMateriel = 'sprayDesinfect'
      OR idMateriel = 'gelHydroAlcolo'`);

    for (let i = 0; i < systematique.length; i++) {
      const materiel = materielList.filter(item => item.nomRetourInter === systematique[i]);
      if (materiel) {
        for (let j = 0; j < materiel.length; j++) {
          const idMateriel = materiel[j].idMateriel;
          await db.query(
            `UPDATE retourIntervention SET statutRI = 1 WHERE idMateriel = '${idMateriel}'`
          );
        }
      }
    }
    for (let i = 0; i < autreMateriel.length; i++) {
      const materiel = materielList.filter(item => item.nomRetourInter === autreMateriel[i]);
      if (materiel) {
        for (let j = 0; j < materiel.length; j++) {
          const idMateriel = materiel[j].idMateriel;
          await db.query(
            `UPDATE retourIntervention SET statutRI = 1 WHERE idMateriel = '${idMateriel}'`
          );
        }
      }
    }
    for (let i = 0; i < kits.length; i++) {
      const materiel = materielList.filter(item => item.nomRetourInter === kits[i]);
      if (materiel) {
        for (let j = 0; j < materiel.length; j++) {
          const idMateriel = materiel[j].idMateriel;
          await db.query(
            `UPDATE retourIntervention SET statutRI = 1 WHERE idMateriel = '${idMateriel}'`
          );
        }
      }
    }
    for (let i = 0; i < specifique.length; i++) {
      const materiel = materielList.filter(item => item.nomRetourInter === specifique[i]);
      if (materiel) {
        for (let j = 0; j < materiel.length; j++) {
          const idMateriel = materiel[j].idMateriel;
          await db.query(
            `UPDATE retourIntervention SET statutRI = 1 WHERE idMateriel = '${idMateriel}'`
          );
        }
      }
    }
    let message = 'Fait.';

    return {message};
  };

    async function getMaterielsToCheck(page = 1, status){
      if (status == "partial"){
        const rows = await db.query(
          `SELECT retourIntervention.idMateriel, materiels.nomMateriel, materiels.nbVSAV, materiels.zone
          FROM retourIntervention
          INNER JOIN materiels ON retourIntervention.idMateriel = materiels.idMateriel
          WHERE retourIntervention.statutRI = 1 AND materiels.nbVSAV != 0
          ORDER BY materiels.zone;`
        );
        const data = helper.emptyOrRows(rows);
        const meta = {page};
        return {
          data,
          meta
        }
      } else {
        const rows = await db.query(
          `SELECT materiels.idMateriel, materiels.nomMateriel, materiels.nbVSAV, materiels.zone
          FROM materiels
          WHERE materiels.nbVSAV != 0
          ORDER BY materiels.zone;`
        )
        const data = helper.emptyOrRows(rows);
        const meta = {page};
        return {
          data,
          meta
        }
      };
    };

    async function getPharmaItems(page = 1, idMateriel){
      const offset = helper.getOffset(page, config.listPerPage);
      const rows = await db.query(
        `SELECT * FROM stock WHERE stock.idMateriel = '${idMateriel}' AND stock.idStatut = 2;`
      );
      const data = helper.emptyOrRows(rows);
      const meta = {page};
    
      return {
        data,
        meta
      }
    }

    async function archivePharma(archiveData){
      const idAgent = archiveData.idAgent;
      const materielsLists = archiveData.materielsList;

      for (let i = 0; i < materielsLists.length; i++) {
        const idStock = materielsLists[i];
        await db.query(
          `UPDATE stock SET idStatut = 3, idAgent = "${idAgent}" WHERE idStock = '${idStock}'`
        );
      }

      let message = 'Il y a eu une erreur lors de l\'archivage des éléments dans la base de données.';
  
      if (result.affectedRows) {
        message = 'Les éléments ont bien été archivés.';
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
    remove,
    getStock,
    archivePeremption,
    getOneMonthPeremption,
    getRealCount,
    getAdressesMails,
    retourIntervention,
    getMaterielsToCheck,
    getPharmaItems,
    archivePharma
  }