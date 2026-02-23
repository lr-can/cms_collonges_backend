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

**Règle :** Si `idStock` commence par `K` (ex. K61, K62) → insertion dans **stockKit** (kit). Sinon → stock classique.

**Format avec idStock K :** `POST /createDB?completKitId=1` (obligatoire)
```json
[
  { "idStock": "K61", "idMateriel": 24, "numLot": "test", "datePeremption": "2026-02-23", "idAgent": "V26371" },
  { "idStock": "K62", "idMateriel": 24, "numLot": "test", "datePeremption": "2026-02-23", "idAgent": "V26371" }
]
```

- `idStock` commençant par `K` → stockKit (completKitId requis)
- `idMateriel` : entier = materielKit.id (ex. 24)
- `completKitId` : obligatoire (body ou query) pour le flux kit
