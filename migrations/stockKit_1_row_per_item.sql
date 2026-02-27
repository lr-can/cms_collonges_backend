-- Migration: stockKit 1 ligne par item physique
-- Quantités = COUNT(*), date péremption kit = MIN(datePeremption des items)
-- Objectif: 4 kits de chaque type (statut 1 ou 2)

-- 1. Ajouter datePeremption à stockKit (ignorer si déjà présent)
ALTER TABLE stockKit ADD COLUMN datePeremption DATE NULL AFTER numeroLot;

-- 2. Mettre à jour la vue v_stockKit (agrégation avec COUNT)
DROP VIEW IF EXISTS v_stockKit;
CREATE VIEW v_stockKit AS
SELECT
    MIN(sk.id) AS id,
    ck.idKit,
    ck.nomKit,
    mk.nomCommande,
    mk.nomCommun,
    mk.quantite AS quantiteTheorique,
    COUNT(*) AS quantiteReelle,
    MIN(sk.datePeremption) AS datePeremptionItem,
    MIN(sk.dateArticle) AS dateArticle,
    MAX(sk.numeroLot) AS numeroLot,
    ck.datePeremption,
    ck.createurNom,
    sk.completKitId,
    sk.materielKitId
FROM stockKit sk
JOIN completKit ck ON ck.id = sk.completKitId
JOIN materielKit mk ON mk.id = sk.materielKitId
GROUP BY ck.idKit, ck.nomKit, mk.nomCommande, mk.nomCommun, mk.quantite, ck.datePeremption, ck.createurNom, sk.completKitId, sk.materielKitId;
