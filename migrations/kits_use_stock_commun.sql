-- Migration: Stock commun pour kits
-- On ajoute les matériels une fois, puis on pioche dans le disponible pour affecter aux kits
-- completKitId NULL = disponible, non-NULL = affecté au kit

-- 1. materielKit référence materiels (même produit, pas de doublon par kit)
-- (ignorer si la colonne existe déjà)
ALTER TABLE materielKit ADD COLUMN idMateriel VARCHAR(64) NULL AFTER nomCommun;

-- 2. stock peut être affecté à un kit (NULL = disponible)
ALTER TABLE stock ADD COLUMN completKitId INT NULL AFTER idStatut;
-- FK optionnelle (ignorer si erreur)
-- ALTER TABLE stock ADD CONSTRAINT fk_stock_completKit FOREIGN KEY (completKitId) REFERENCES completKit(id) ON DELETE SET NULL;

-- 3. Remplir materielKit.idMateriel depuis materiels (match nomCommande = nomMateriel)
UPDATE materielKit mk
SET mk.idMateriel = (
  SELECT m.idMateriel FROM materiels m
  WHERE TRIM(LOWER(m.nomMateriel COLLATE utf8mb4_unicode_ci)) = TRIM(LOWER(mk.nomCommande COLLATE utf8mb4_unicode_ci))
  LIMIT 1
)
WHERE mk.idMateriel IS NULL;

-- 4. Vue: stock disponible (pool commun, sans doublon par kit)
DROP VIEW IF EXISTS v_stockDisponible;
CREATE VIEW v_stockDisponible AS
SELECT
  s.idStock,
  s.idMateriel,
  m.nomMateriel,
  s.numLot,
  s.datePeremption,
  s.dateCreation,
  s.idStatut
FROM stock s
JOIN materiels m ON m.idMateriel = s.idMateriel
WHERE s.completKitId IS NULL AND s.idStatut IN (1, 2);

-- 5. Vue agrégée: quantités disponibles par matériel (pour piocher)
DROP VIEW IF EXISTS v_stockDisponible_par_materiel;
CREATE VIEW v_stockDisponible_par_materiel AS
SELECT
  s.idMateriel,
  m.nomMateriel,
  COUNT(*) AS quantiteDisponible,
  MIN(s.datePeremption) AS datePeremptionMin
FROM stock s
JOIN materiels m ON m.idMateriel = s.idMateriel
WHERE s.completKitId IS NULL AND s.idStatut IN (1, 2)
GROUP BY s.idMateriel, m.nomMateriel;

-- 6. v_stockKit : contenu des kits = stock avec completKitId
DROP VIEW IF EXISTS v_stockKit;
CREATE VIEW v_stockKit AS
SELECT
  MIN(s.idStock) AS id,
  ck.idKit,
  ck.nomKit,
  m.nomMateriel AS nomCommande,
  m.nomMateriel AS nomCommun,
  (SELECT mk2.quantite FROM materielKit mk2 WHERE BINARY mk2.nomKit = BINARY ck.nomKit AND (BINARY mk2.idMateriel = BINARY s.idMateriel OR BINARY mk2.nomCommande = BINARY m.nomMateriel) LIMIT 1) AS quantiteTheorique,
  COUNT(*) AS quantiteReelle,
  MIN(s.datePeremption) AS datePeremptionItem,
  MIN(s.dateCreation) AS dateArticle,
  MAX(s.numLot) AS numeroLot,
  ck.datePeremption,
  ck.createurNom,
  s.completKitId,
  s.idMateriel,
  (SELECT mk2.id FROM materielKit mk2 WHERE BINARY mk2.nomKit = BINARY ck.nomKit AND (BINARY mk2.idMateriel = BINARY s.idMateriel OR BINARY mk2.nomCommande = BINARY m.nomMateriel) LIMIT 1) AS materielKitId
FROM stock s
JOIN completKit ck ON ck.id = s.completKitId
JOIN materiels m ON BINARY m.idMateriel = BINARY s.idMateriel
WHERE s.completKitId IS NOT NULL
GROUP BY ck.idKit, ck.nomKit, s.idMateriel, m.nomMateriel, ck.datePeremption, ck.createurNom, s.completKitId;
