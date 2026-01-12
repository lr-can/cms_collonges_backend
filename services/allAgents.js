const db = require('./db');
const mysql = require('mysql2/promise');
const config = require('../config');

async function upsertAgents(agents) {
  if (!Array.isArray(agents) || agents.length === 0) {
    throw new Error('Le tableau d\'agents ne peut pas être vide');
  }

  const results = {
    inserted: 0,
    updated: 0,
    errors: []
  };

  // Créer une seule connexion pour tous les upserts
  const connection = await mysql.createConnection(config.db);
  
  try {
    for (const agent of agents) {
      try {
        // Préparer les valeurs pour l'upsert
        const values = {
          matricule: agent.matricule || null,
          nomAgent: agent.nomAgent || null,
          prenomAgent: agent.prenomAgent || null,
          grade: agent.grade || null,
          asup1: agent.asup1 !== undefined ? agent.asup1 : 0,
          asup2: agent.asup2 !== undefined ? agent.asup2 : 0,
          email: agent.email || null,
          SAP_ca: agent.SAP_ca !== undefined ? agent.SAP_ca : 0,
          SAP_cd: agent.SAP_cd !== undefined ? agent.SAP_cd : 0,
          SAP_eq: agent.SAP_eq !== undefined ? agent.SAP_eq : 0,
          SAP_eqc: agent.SAP_eqc !== undefined ? agent.SAP_eqc : 0,
          PSSAP_ca: agent.PSSAP_ca !== undefined ? agent.PSSAP_ca : 0,
          PSSAP_cd: agent.PSSAP_cd !== undefined ? agent.PSSAP_cd : 0,
          PSSAP_eq: agent.PSSAP_eq !== undefined ? agent.PSSAP_eq : 0,
          PSSAP_eqc: agent.PSSAP_eqc !== undefined ? agent.PSSAP_eqc : 0,
          DIV_ca: agent.DIV_ca !== undefined ? agent.DIV_ca : 0,
          DIV_cd: agent.DIV_cd !== undefined ? agent.DIV_cd : 0,
          DIV_eq: agent.DIV_eq !== undefined ? agent.DIV_eq : 0,
          INC_ca: agent.INC_ca !== undefined ? agent.INC_ca : 0,
          INC_cd: agent.INC_cd !== undefined ? agent.INC_cd : 0,
          INC_ce: agent.INC_ce !== undefined ? agent.INC_ce : 0,
          INC_eq: agent.INC_eq !== undefined ? agent.INC_eq : 0,
          PSINC_ca: agent.PSINC_ca !== undefined ? agent.PSINC_ca : 0,
          PSINC_cd: agent.PSINC_cd !== undefined ? agent.PSINC_cd : 0,
          PSINC_ce: agent.PSINC_ce !== undefined ? agent.PSINC_ce : 0,
          PSINC_eq: agent.PSINC_eq !== undefined ? agent.PSINC_eq : 0,
          CDG_cd: agent.CDG_cd !== undefined ? agent.CDG_cd : 0,
          CDG_cdg: agent.CDG_cdg !== undefined ? agent.CDG_cdg : 0,
          INFAMU_inf: agent.INFAMU_inf !== undefined ? agent.INFAMU_inf : 0,
          INFAMU_cd: agent.INFAMU_cd !== undefined ? agent.INFAMU_cd : 0,
          BATO_ca: agent.BATO_ca !== undefined ? agent.BATO_ca : 0,
          BATO_eq: agent.BATO_eq !== undefined ? agent.BATO_eq : 0,
          AQUA_ca: agent.AQUA_ca !== undefined ? agent.AQUA_ca : 0,
          AQUA_cd: agent.AQUA_cd !== undefined ? agent.AQUA_cd : 0
        };

        if (!values.matricule) {
          results.errors.push(`Agent sans matricule ignoré: ${JSON.stringify(agent)}`);
          continue;
        }

        // Construire la requête INSERT ... ON DUPLICATE KEY UPDATE
        const query = `
          INSERT INTO all_agents (
            matricule, nomAgent, prenomAgent, grade, asup1, asup2, email,
            SAP_ca, SAP_cd, SAP_eq, SAP_eqc,
            PSSAP_ca, PSSAP_cd, PSSAP_eq, PSSAP_eqc,
            DIV_ca, DIV_cd, DIV_eq,
            INC_ca, INC_cd, INC_ce, INC_eq,
            PSINC_ca, PSINC_cd, PSINC_ce, PSINC_eq,
            CDG_cd, CDG_cdg,
            INFAMU_inf, INFAMU_cd,
            BATO_ca, BATO_eq,
            AQUA_ca, AQUA_cd
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?,
            ?, ?,
            ?, ?,
            ?, ?
          )
          ON DUPLICATE KEY UPDATE
            nomAgent = VALUES(nomAgent),
            prenomAgent = VALUES(prenomAgent),
            grade = VALUES(grade),
            asup1 = VALUES(asup1),
            asup2 = VALUES(asup2),
            email = VALUES(email),
            SAP_ca = VALUES(SAP_ca),
            SAP_cd = VALUES(SAP_cd),
            SAP_eq = VALUES(SAP_eq),
            SAP_eqc = VALUES(SAP_eqc),
            PSSAP_ca = VALUES(PSSAP_ca),
            PSSAP_cd = VALUES(PSSAP_cd),
            PSSAP_eq = VALUES(PSSAP_eq),
            PSSAP_eqc = VALUES(PSSAP_eqc),
            DIV_ca = VALUES(DIV_ca),
            DIV_cd = VALUES(DIV_cd),
            DIV_eq = VALUES(DIV_eq),
            INC_ca = VALUES(INC_ca),
            INC_cd = VALUES(INC_cd),
            INC_ce = VALUES(INC_ce),
            INC_eq = VALUES(INC_eq),
            PSINC_ca = VALUES(PSINC_ca),
            PSINC_cd = VALUES(PSINC_cd),
            PSINC_ce = VALUES(PSINC_ce),
            PSINC_eq = VALUES(PSINC_eq),
            CDG_cd = VALUES(CDG_cd),
            CDG_cdg = VALUES(CDG_cdg),
            INFAMU_inf = VALUES(INFAMU_inf),
            INFAMU_cd = VALUES(INFAMU_cd),
            BATO_ca = VALUES(BATO_ca),
            BATO_eq = VALUES(BATO_eq),
            AQUA_ca = VALUES(AQUA_ca),
            AQUA_cd = VALUES(AQUA_cd)
        `;

        const params = [
          values.matricule, values.nomAgent, values.prenomAgent, values.grade,
          values.asup1, values.asup2, values.email,
          values.SAP_ca, values.SAP_cd, values.SAP_eq, values.SAP_eqc,
          values.PSSAP_ca, values.PSSAP_cd, values.PSSAP_eq, values.PSSAP_eqc,
          values.DIV_ca, values.DIV_cd, values.DIV_eq,
          values.INC_ca, values.INC_cd, values.INC_ce, values.INC_eq,
          values.PSINC_ca, values.PSINC_cd, values.PSINC_ce, values.PSINC_eq,
          values.CDG_cd, values.CDG_cdg,
          values.INFAMU_inf, values.INFAMU_cd,
          values.BATO_ca, values.BATO_eq,
          values.AQUA_ca, values.AQUA_cd
        ];

        const [result] = await connection.execute(query, params);

        if (result.affectedRows === 1) {
          results.inserted++;
        } else if (result.affectedRows === 2) {
          results.updated++;
        }
      } catch (error) {
        results.errors.push({
          matricule: agent.matricule || 'INCONNU',
          error: error.message
        });
      }
    }
  } finally {
    // Toujours fermer la connexion, même en cas d'erreur
    await connection.end();
  }

  return {
    message: `Synchronisation terminée: ${results.inserted} insérés, ${results.updated} mis à jour`,
    inserted: results.inserted,
    updated: results.updated,
    total: results.inserted + results.updated,
    errors: results.errors.length > 0 ? results.errors : undefined
  };
}

// Fonction pour convertir les valeurs numériques en strings (compatibilité avec l'ancien format OpenSheet)
function formatAgentForCompatibility(agent) {
  if (!agent) return null;
  
  return {
    matricule: agent.matricule,
    nomAgent: agent.nomAgent,
    prenomAgent: agent.prenomAgent,
    grade: agent.grade,
    asup1: String(agent.asup1 || 0),
    asup2: String(agent.asup2 || 0),
    email: agent.email,
    SAP_ca: String(agent.SAP_ca || 0),
    SAP_cd: String(agent.SAP_cd || 0),
    SAP_eq: String(agent.SAP_eq || 0),
    SAP_eqc: String(agent.SAP_eqc || 0),
    PSSAP_ca: String(agent.PSSAP_ca || 0),
    PSSAP_cd: String(agent.PSSAP_cd || 0),
    PSSAP_eq: String(agent.PSSAP_eq || 0),
    PSSAP_eqc: String(agent.PSSAP_eqc || 0),
    DIV_ca: String(agent.DIV_ca || 0),
    DIV_cd: String(agent.DIV_cd || 0),
    DIV_eq: String(agent.DIV_eq || 0),
    INC_ca: String(agent.INC_ca || 0),
    INC_cd: String(agent.INC_cd || 0),
    INC_ce: String(agent.INC_ce || 0),
    INC_eq: String(agent.INC_eq || 0),
    PSINC_ca: String(agent.PSINC_ca || 0),
    PSINC_cd: String(agent.PSINC_cd || 0),
    PSINC_ce: String(agent.PSINC_ce || 0),
    PSINC_eq: String(agent.PSINC_eq || 0),
    CDG_cd: String(agent.CDG_cd || 0),
    CDG_cdg: String(agent.CDG_cdg || 0),
    INFAMU_inf: String(agent.INFAMU_inf || 0),
    INFAMU_cd: String(agent.INFAMU_cd || 0),
    BATO_ca: String(agent.BATO_ca || 0),
    BATO_eq: String(agent.BATO_eq || 0),
    AQUA_ca: String(agent.AQUA_ca || 0),
    AQUA_cd: String(agent.AQUA_cd || 0)
  };
}

// Récupérer tous les agents depuis la base de données
async function getAllAgents() {
  try {
    const rows = await db.query('SELECT * FROM all_agents');
    return rows.map(formatAgentForCompatibility);
  } catch (error) {
    console.error('Erreur lors de la récupération des agents:', error);
    throw error;
  }
}

// Récupérer tous les agents sous forme d'objet indexé par matricule
async function getAllAgentsAsMap() {
  try {
    const agents = await getAllAgents();
    const agentsMap = {};
    agents.forEach(agent => {
      if (agent && agent.matricule) {
        agentsMap[agent.matricule] = agent;
      }
    });
    return agentsMap;
  } catch (error) {
    console.error('Erreur lors de la récupération des agents (map):', error);
    throw error;
  }
}

// Récupérer un agent par matricule
async function getAgentByMatricule(matricule) {
  try {
    const rows = await db.query('SELECT * FROM all_agents WHERE matricule = ?', [matricule]);
    if (rows.length === 0) {
      return null;
    }
    return formatAgentForCompatibility(rows[0]);
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'agent:', error);
    throw error;
  }
}

module.exports = {
  upsertAgents,
  getAllAgents,
  getAllAgentsAsMap,
  getAgentByMatricule
};

