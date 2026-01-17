const db = require('./db');

async function getAuthInfo(email, matricule) {
  try {
    // Rechercher l'agent dans la table agents par email et matricule (idAgent)
    const rows = await db.query(
      'SELECT idAgent, nomAgent, gradeAgent, email, role FROM agents WHERE email = ? AND idAgent = ?',
      [email, matricule]
    );

    if (rows.length === 0) {
      return {
        success: false,
        error: 'Utilisateur non trouvé ou authentification échouée'
      };
    }

    const agent = rows[0];
    
    // Vérifier que le rôle est renseigné
    if (!agent.role || agent.role.trim() === '') {
      return {
        success: false,
        error: 'Utilisateur non trouvé ou authentification échouée'
      };
    }
    
    // Formater la réponse selon le format demandé
    return {
      success: true,
      user: {
        matricule: agent.idAgent || matricule,
        grade: agent.gradeAgent || '',
        role: agent.role || '',
        name: agent.nomAgent || '',
        email: agent.email || email
      }
    };
  } catch (error) {
    console.error('Erreur lors de la récupération des informations d\'authentification:', error);
    return {
      success: false,
      error: 'Erreur lors de la récupération des informations d\'authentification'
    };
  }
}

module.exports = {
  getAuthInfo
};

