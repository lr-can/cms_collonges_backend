-- Historique kit : 5000 caractères (truncation à 4000 dans le code)
ALTER TABLE completKit MODIFY COLUMN historique VARCHAR(5000) NULL;
