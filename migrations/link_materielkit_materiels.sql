-- Lie materielKit.idMateriel à materiels.idMateriel quand nomCommande = nomMateriel
-- Permet à POST /createDB d'accepter des libellés (ex: "DAKIN COOPER STABILISE HOP 60 ML")
UPDATE materielKit mk
SET mk.idMateriel = (
  SELECT m.idMateriel FROM materiels m
  WHERE TRIM(LOWER(m.nomMateriel)) = TRIM(LOWER(mk.nomCommande))
  LIMIT 1
)
WHERE mk.idMateriel IS NULL;
