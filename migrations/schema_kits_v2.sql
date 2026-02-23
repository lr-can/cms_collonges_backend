-- ============================================================
--  PHARMACIE SDMIS - Schema kits v2
--  materielKit = matrice (1 ligne par article, booléens par type de kit)
--  Compatible MySQL 5.7+ / MariaDB - 23/02/2026
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP VIEW  IF EXISTS v_kitsPerimantBientot;
DROP VIEW  IF EXISTS v_stockKit;
DROP VIEW  IF EXISTS v_completKit;
DROP VIEW  IF EXISTS v_materielKits;
DROP TABLE IF EXISTS stockKit;
DROP TABLE IF EXISTS completKit;
DROP TABLE IF EXISTS materielKit;

-- ============================================================
--  1. TABLE : materielKit (matrice : 1 article, booléens par kit)
-- ============================================================
CREATE TABLE materielKit (
    id                      INT             NOT NULL AUTO_INCREMENT PRIMARY KEY,
    nomCommande             VARCHAR(255)    NOT NULL UNIQUE,
    nomCommun               VARCHAR(255)    NOT NULL,
    kitAccouchement         BOOLEAN         NOT NULL DEFAULT FALSE,
    kitMembreSectionne      BOOLEAN         NOT NULL DEFAULT FALSE,
    kitAESAEV               BOOLEAN         NOT NULL DEFAULT FALSE,
    quantiteAccouchement    INT             NOT NULL DEFAULT 0,
    quantiteMembreSectionne INT             NOT NULL DEFAULT 0,
    quantiteAESAEV          INT             NOT NULL DEFAULT 0,
    idMateriel              VARCHAR(64)     NULL,
    createdAt               TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt               TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  2. TABLE : completKit (kit physique)
-- ============================================================
CREATE TABLE completKit (
    id              INT             NOT NULL AUTO_INCREMENT PRIMARY KEY,
    idKit           VARCHAR(64)     NOT NULL UNIQUE,
    nomKit          VARCHAR(255)    NOT NULL,
    createurId      CHAR(6)         NOT NULL,
    datePeremption  DATE            NULL,
    historique      VARCHAR(3000)   NULL,
    createdAt       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  3. TABLE : stockKit (1 ligne par article par kit physique)
-- ============================================================
CREATE TABLE stockKit (
    id              VARCHAR(16)     NOT NULL PRIMARY KEY,
    completKitId    INT             NOT NULL,
    materielKitId   INT             NOT NULL,
    statut          TINYINT         NOT NULL DEFAULT 1,
    dateArticle     DATE            NULL,
    numeroLot       VARCHAR(64)     NULL,
    creator         CHAR(6)         NOT NULL,
    createdAt       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_stockKit_completKit  FOREIGN KEY (completKitId)  REFERENCES completKit(id)  ON DELETE CASCADE,
    CONSTRAINT fk_stockKit_materielKit FOREIGN KEY (materielKitId) REFERENCES materielKit(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

CREATE INDEX idx_materielKit_nomCommande ON materielKit(nomCommande);
CREATE INDEX idx_completKit_idKit ON completKit(idKit);
CREATE INDEX idx_completKit_nomKit ON completKit(nomKit);
CREATE INDEX idx_completKit_datePeremption ON completKit(datePeremption);
CREATE INDEX idx_stockKit_completKitId ON stockKit(completKitId);
CREATE INDEX idx_stockKit_materielKitId ON stockKit(materielKitId);
CREATE INDEX idx_stockKit_statut ON stockKit(statut);

-- ============================================================
--  SEED materielKit
-- ============================================================
INSERT INTO materielKit (nomCommande, nomCommun, kitAccouchement, kitMembreSectionne, kitAESAEV, quantiteAccouchement, quantiteMembreSectionne, quantiteAESAEV) VALUES
('ALESE', 'Alese', TRUE, FALSE, FALSE, 2, 0, 0),
('ASPIRATEUR DE MUCOSITES ENFANT', 'Aspirateur de mucosites enfant', TRUE, FALSE, FALSE, 1, 0, 0),
('BANDE EXTENSIBLE 10CM * 4M', 'Bande extensible 10 cm x 4 m', TRUE, FALSE, FALSE, 1, 0, 0),
('BISEPTINE FLACON 40 ML', 'Biseptine flacon 40 mL', TRUE, FALSE, FALSE, 1, 0, 0),
('BLOUSE', 'Blouse de protection', TRUE, FALSE, FALSE, 1, 0, 0),
('BONNET BEBE', 'Bonnet bebe', TRUE, FALSE, FALSE, 1, 0, 0),
('CHAMP ACCUEIL BEBE 100*100CM', 'Champ accueil bebe 100x100 cm', TRUE, FALSE, FALSE, 1, 0, 0),
('CHARLOTTE', 'Charlotte (coiffe de protection)', TRUE, FALSE, FALSE, 2, 0, 0),
('CISEAU OMBILICAL', 'Ciseau ombilical', TRUE, FALSE, FALSE, 1, 0, 0),
('CLAMP DE BAHR OMBILICAL', 'Clamp de Bahr ombilical', TRUE, FALSE, FALSE, 4, 0, 0),
('DUVET PEDIATRIQUE', 'Duvet pediatrique', TRUE, FALSE, FALSE, 1, 0, 0),
('MASQUE CHIRURGICAL', 'Masque chirurgical', TRUE, FALSE, FALSE, 2, 0, 0),
('PANSEMENT GYNECOLOGIQUE', 'Pansement gynecologique', TRUE, FALSE, FALSE, 2, 0, 0),
('SAC PLACENTA', 'Sac placenta', TRUE, FALSE, FALSE, 1, 0, 0),
('SPARADRAP', 'Sparadrap', TRUE, FALSE, FALSE, 1, 0, 0),
('GANT CHIR POLYISO SENSICARE T7', 'Gant chirurgical Polyisopre Taille 7', TRUE, TRUE, FALSE, 1, 1, 0),
('GANT CHIR POLYISO SENSICARE T8.5', 'Gant chirurgical Polyisopre Taille 8.5', TRUE, TRUE, FALSE, 1, 1, 0),
('CHAMPS STERILES 75*90', 'Champs steriles 75x90 cm', FALSE, TRUE, FALSE, 0, 1, 0),
('POCHE DE FROID', 'Poche de froid instantanee', FALSE, TRUE, FALSE, 0, 2, 0),
('POCHETTE ISOTHERME', 'Pochette isotherme', FALSE, TRUE, FALSE, 0, 1, 0),
('SAC DASRI', 'Sac DASRI (dechets infectieux)', FALSE, TRUE, FALSE, 0, 1, 0),
('CHLORURE DE SODIUM 0.9% 50ML VERSABLE', 'Serum physiologique 0.9% 50 mL versable', FALSE, FALSE, TRUE, 0, 0, 2),
('COMPRESSES STERILES 10 X 10CM', 'Compresses steriles 10x10 cm', FALSE, FALSE, TRUE, 0, 0, 4),
('DAKIN COOPER STABILISE HOP 60 ML', 'Dakin Cooper stabilise hospitalier 60 mL', FALSE, FALSE, TRUE, 0, 0, 1),
('CONDUITE A TENIR', 'Fiche conduite a tenir', FALSE, FALSE, TRUE, 0, 0, 1),
('PRINCIPE DE DECLARATION SPP ET PATS', 'Fiche declaration SPP et PATS', FALSE, FALSE, TRUE, 0, 0, 1),
('PRINCIPE DE DECLARATION SPV', 'Fiche declaration SPV', FALSE, FALSE, TRUE, 0, 0, 1),
('PROCEDURE ORANGE', 'Procedure Orange', FALSE, FALSE, TRUE, 0, 0, 1),
('PROCEDURE ROUGE', 'Procedure Rouge', FALSE, FALSE, TRUE, 0, 0, 1),
('ORDONNANCE (A DEMANDER PAR MAIL A PHARMACIE@SDMIS.FR)', 'Ordonnance (a demander a pharmacie@sdmis.fr)', FALSE, FALSE, TRUE, 0, 0, 1)
ON DUPLICATE KEY UPDATE
    nomCommun=VALUES(nomCommun), kitAccouchement=VALUES(kitAccouchement), kitMembreSectionne=VALUES(kitMembreSectionne),
    kitAESAEV=VALUES(kitAESAEV), quantiteAccouchement=VALUES(quantiteAccouchement),
    quantiteMembreSectionne=VALUES(quantiteMembreSectionne), quantiteAESAEV=VALUES(quantiteAESAEV);

UPDATE materielKit SET idMateriel = 'sparadrap' WHERE nomCommande = 'SPARADRAP';
UPDATE materielKit SET idMateriel = 'pocheFroid' WHERE nomCommande = 'POCHE DE FROID';

-- Optionnel : 1 kit exemple
INSERT INTO completKit (idKit, nomKit, createurId) VALUES ('KIT-ACCOUCHE-2026-001', 'KIT ACCOUCHEMENT', 'V26371')
ON DUPLICATE KEY UPDATE updatedAt = updatedAt;

-- ============================================================
--  VUES
-- ============================================================
CREATE OR REPLACE VIEW v_materielKits AS
SELECT id, nomCommande, nomCommun, idMateriel,
  kitAccouchement, quantiteAccouchement,
  kitMembreSectionne, quantiteMembreSectionne,
  kitAESAEV, quantiteAESAEV
FROM materielKit ORDER BY nomCommun;

CREATE OR REPLACE VIEW v_stockKit AS
SELECT
  sk.id AS stockId,
  ck.id AS completKitId,
  mk.id AS materielKitId,
  ck.idKit,
  ck.nomKit,
  mk.nomCommande,
  mk.nomCommun,
  mk.idMateriel,
  CASE WHEN ck.nomKit = 'KIT ACCOUCHEMENT' THEN mk.quantiteAccouchement
       WHEN ck.nomKit = 'KIT MEMBRE SECTIONNE' THEN mk.quantiteMembreSectionne
       WHEN ck.nomKit = 'KIT AES / AEV' THEN mk.quantiteAESAEV
       ELSE 0 END AS quantiteTheorique,
  sk.statut,
  CASE sk.statut WHEN 1 THEN 'Reserve' WHEN 2 THEN 'Mis en kit' WHEN 3 THEN 'Archive' END AS statutLabel,
  sk.dateArticle,
  sk.numeroLot,
  sk.creator,
  ck.datePeremption,
  sk.createdAt,
  sk.updatedAt
FROM stockKit sk
JOIN completKit ck ON ck.id = sk.completKitId
JOIN materielKit mk ON mk.id = sk.materielKitId
ORDER BY ck.idKit, mk.nomCommun;

CREATE OR REPLACE VIEW v_kitsPerimantBientot AS
SELECT ck.id, ck.idKit, ck.nomKit, ck.createurId, ck.datePeremption,
  DATEDIFF(ck.datePeremption, CURDATE()) AS joursRestants,
  ck.historique, ck.createdAt, ck.updatedAt
FROM completKit ck
WHERE ck.datePeremption IS NOT NULL
  AND ck.datePeremption <= DATE_ADD(CURDATE(), INTERVAL 2 MONTH)
ORDER BY ck.datePeremption ASC;
