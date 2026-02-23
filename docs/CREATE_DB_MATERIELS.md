# POST /createDB - Réception de matériel

Deux flux supportés :
- **Matériel classique** : insertion dans `stock` (idMateriel = chaîne, ex. "dakin")
- **Matériel kit** : insertion dans `stockKit` (idMateriel = entier = materielKit.id) — nécessite `completKitId`

## Erreurs fréquentes et solutions

### 1. Foreign key `idMateriel` invalide

**Erreur :** `Cannot add or update a child row: a foreign key constraint fails (materiel)`

**Cause :** Le `idMateriel` envoyé n'existe pas dans la table `materiels`.

**Solutions :**
- Envoyer le `idMateriel` correct (ex: `"dakin"` au lieu de `"DAKIN COOPER STABILISE HOP 60 ML"`).
- Ou envoyer `nomMateriel` / un libellé long : le backend tente de résoudre vers `idMateriel` via `materiels.nomMateriel` ou `materielKit.nomCommande`.
- Vérifier que l'article existe dans `materiels` et que `materielKit.idMateriel` est renseigné pour les articles de kit.

### 2. `idStock` null

**Comportement :** Si `idStock` n’est pas fourni, le backend génère automatiquement les prochains IDs disponibles.

### 3. Frontend – `toIdStock is not defined`

**Cause :** Dans `receptionView.vue`, une référence à `toIdStock` n’existe pas ou n’est pas importée.

**Solution :** Supprimer ou corriger l’appel à `toIdStock`. Pour générer les ids côté frontend :
```
GET /nextAvailableIds/:count
```
Retourne `{ nextIds: [1, 2, 3, ...], count }`.

## Format attendu

```json
[
  {
    "idStock": 12345,
    "idMateriel": "dakin",
    "idStatut": 1,
    "idAgent": "V26371",
    "numLot": "Test",
    "datePeremption": "2026-12-31"
  }
]
```

- `idStock` : optionnel (généré si absent)
- `idMateriel` : obligatoire, doit exister dans `materiels`, ou peut être un libellé long (résolution automatique)
- `idStatut` : défaut 1
- `idAgent` : matricule (6 caractères)
- `numLot` : optionnel
- `datePeremption` : format ISO ou YYYY-MM-DD

### Matériel kit (stockKit)

**Body avec completKitId :**
```json
{
  "completKitId": 1,
  "materiels": [
    { "idMateriel": 24, "quantiteReelle": 1 },
    { "idMateriel": 24, "quantiteReelle": 2 }
  ]
}
```

**Ou array + query :** `POST /createDB?completKitId=1`
```json
[
  { "idMateriel": 24, "idStock": "K21", "numLot": "test" },
  { "idMateriel": 24, "idStock": "K22", "numLot": "test" }
]
```

- `idMateriel` : entier = materielKit.id (ex. 24)
- `completKitId` : obligatoire pour le flux kit (body ou query)
- `quantiteReelle` : optionnel, défaut 1 par ligne
