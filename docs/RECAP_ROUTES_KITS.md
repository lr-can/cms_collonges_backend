# Récapitulatif des routes et fonctionnalités – Gestion des kits

## Base de données utilisée

- **materielKit** : catalogue des articles par type de kit (nomKit, nomCommande, nomCommun, quantite)
- **completKit** : kits physiques (idKit, nomKit, createurId, createurNom, statut, datePeremption, historique)
- **stockKit** : 1 ligne par item physique (completKitId, materielKitId, dateArticle, numeroLot, datePeremption). Quantités = COUNT(*). Date péremption kit = MIN(datePeremption) des items.

---

## Routes API

### 1. `GET /infoKit/:idKit`

**Méthode :** GET  
**Paramètres :** `idKit` dans l’URL (ex. `KIT-ACC-2025-001`)

**Données attendues :** aucune (URL uniquement)

**Rôle :** Endpoint public pour le QR code. Retourne les infos de base du kit.

**Réponse :**  
```json
{
  "idKit": "KIT-ACC-2025-001",
  "nomKit": "KIT ACCOUCHEMENT",
  "statut": "Reserve pharmacie",
  "datePeremption": "2025-12-31",
  "createurNom": "DUPONT Jean"
}
```

---

### 2. `GET /kits/materielKit`

**Méthode :** GET  
**Query :** `nomKit` (optionnel) – filtre par type de kit

**Rôle :** Liste du catalogue `materielKit` (articles des kits).

**Réponse :** tableau d’objets  
```json
[
  {
    "id": 1,
    "nomKit": "KIT ACCOUCHEMENT",
    "nomCommande": "ALESE",
    "nomCommun": "Alese",
    "quantite": 2,
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

---

### 3. `GET /kits/nomsKits`

**Méthode :** GET  
**Paramètres :** aucun

**Rôle :** Liste des noms de types de kits distincts.

**Réponse :**  
```json
[
  { "nomKit": "KIT ACCOUCHEMENT" },
  { "nomKit": "KIT MEMBRE SECTIONNE" }
]
```

---

### 4. `GET /kits/materielKit/:nomKit`

**Méthode :** GET  
**Paramètres :** `nomKit` dans l’URL

**Rôle :** Liste des articles d’un type de kit donné.

**Réponse :** tableau d’articles du catalogue pour ce kit.

---

### 5. `GET /kits/completKit`

**Méthode :** GET  
**Query :**  
- `nomKit` (optionnel)  
- `statut` (optionnel) : 1 = Reserve pharmacie, 2 = Mis en kit, 3 = Archive

**Rôle :** Liste des kits physiques (completKit).

**Réponse :** tableau d’objets  
```json
[
  {
    "id": 1,
    "idKit": "KIT-ACC-2025-001",
    "nomKit": "KIT ACCOUCHEMENT",
    "createurId": "12345",
    "createurNom": "DUPONT Jean",
    "statut": 1,
    "statutLabel": "Reserve pharmacie",
    "datePeremption": "2025-12-31",
    "historique": "...",
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

---

### 6. `GET /kits/completKit/:idKit`

**Méthode :** GET  
**Paramètres :**  
- `idKit` dans l’URL : chaîne (ex. `KIT-ACC-2025-001`) ou id numérique du kit

**Rôle :** Détail complet d’un kit avec son contenu (stockKit).

**Réponse :**  
```json
{
  "id": 1,
  "idKit": "KIT-ACC-2025-001",
  "nomKit": "KIT ACCOUCHEMENT",
  "statutLabel": "Mis en kit",
  "historique": "remplacement du ...",
  "items": [
    {
      "id": 10,
      "nomCommande": "ALESE",
      "nomCommun": "Alese",
      "quantiteTheorique": 2,
      "quantiteReelle": 2,
      "dateArticle": "2025-01-15",
      "numeroLot": "LOT123"
    }
  ]
}
```

---

### 7. `POST /kits/completKit`

**Méthode :** POST  
**Body JSON :**
```json
{
  "idKit": "KIT-ACC-2025-001",
  "nomKit": "KIT ACCOUCHEMENT",
  "createurId": "12345",
  "createurNom": "DUPONT Jean"
}
```

**Rôle :** Création d’un nouveau kit physique (néo-création, sans contenu).

**Réponse :**  
```json
{
  "message": "Kit créé.",
  "id": 42
}
```

---

### 8. `PUT /kits/completKit/:id`

**Méthode :** PUT  
**Paramètres :** `id` (id numérique du completKit) dans l’URL  
**Body JSON :**
```json
{
  "statut": 2,
  "datePeremption": "2025-12-31",
  "createurNom": "DUPONT Jean"
}
```

**Rôle :** Modification des données générales d’un kit.

**Réponse :**  
```json
{ "message": "Kit modifié." }
```

---

### 9. `POST /kits/realiser`

**Méthode :** POST  
**Body JSON :**
```json
{
  "idKit": "KIT-ACC-2025-001",
  "createurId": "12345",
  "createurNom": "DUPONT Jean"
}
```

**Rôle :** Réalisation du kit : création des lignes `stockKit` à partir du modèle `materielKit`, mise à jour du statut en « Mis en kit ».

**Réponse :**  
```json
{ "message": "Kit réalisé." }
```

---

### 10. `POST /kits/remplacerMateriel`

**Méthode :** POST  
**Body JSON :**
```json
{
  "completKitId": 1,
  "stockKitId": 10,
  "dateArticle": "2025-02-20",
  "numeroLot": "LOT456",
  "quantiteReelle": 2,
  "ancienIdStock": "STOCK-001",
  "nouveauIdStock": "STOCK-002",
  "datePeremptionNouveau": "15/03/2026",
  "nomMateriel": "ALESE"
}
```

**Champs requis :** `completKitId`, `stockKitId`  
**Champs optionnels :** `dateArticle`, `numeroLot`, `quantiteReelle`, `ancienIdStock`, `nouveauIdStock`, `datePeremptionNouveau`, `nomMateriel`

**Rôle :** Remplace un matériel dans le kit, met à jour la ligne `stockKit` et enregistre une entrée d’historique (ex. : « remplacement du ALESE STOCK-001 par STOCK-002 (péremption le 15/03/2026) »). L’historique est limité à 500 caractères ; les entrées les plus anciennes sont supprimées si besoin.

**Réponse :**  
```json
{ "message": "Matériel remplacé." }
```

---

### 11. `PUT /kits/stockKit/:id`

**Méthode :** PUT  
**Paramètres :** `id` (id de la ligne stockKit) dans l’URL  
**Body JSON :**
```json
{
  "quantiteReelle": 2,
  "dateArticle": "2025-02-20",
  "numeroLot": "LOT456"
}
```

**Rôle :** Mise à jour d’une ligne de contenu du kit sans enregistrer d’historique de remplacement.

**Réponse :**  
```json
{ "message": "Ligne stock kit modifiée." }
```

---

### 12. `POST /kits/observation/:completKitId`

**Méthode :** POST  
**Paramètres :** `completKitId` dans l’URL  
**Body JSON :**
```json
{
  "observation": "Contrôle effectué le 20/02/2025"
}
```

**Rôle :** Ajoute une observation dans l’historique du kit (limité à 500 caractères).

**Réponse :**  
```json
{ "message": "Observation ajoutée." }
```

---

### 13. `GET /kits/nextIdKit`

**Méthode :** GET  
**Query :** `nomKit` (optionnel) – pour le préfixe de l’id suggéré

**Rôle :** Propose un prochain identifiant de kit (ex. `KIT-ACC-2025-002`).

**Réponse :**  
```json
{
  "suggestion": "KIT-ACC-2025-002"
}
```

---

### 14. `GET /kits/materielManquant`

**Méthode :** GET  
**Query :** `nbKits` (optionnel, défaut: 4)

**Rôle :** Retourne le matériel manquant pour atteindre N kits de chaque type (statut 1 ou 2).

**Réponse :** tableau d’objets  
```json
[
  {
    "nomKit": "KIT ACCOUCHEMENT",
    "materielKitId": 1,
    "nomCommande": "ALESE",
    "nomCommun": "Alese",
    "quantiteParKit": 2,
    "nbKitsExistants": 2,
    "nbKitsCible": 4,
    "nbUnitesRequis": 8,
    "nbUnitesEnStock": 4,
    "manquant": 4
  }
]
```

---

### 15. `PUT /kits/stockKit/groupe`

**Méthode :** PUT  
**Body JSON :** `{ completKitId, materielKitId, quantiteReelle?, dateArticle?, numeroLot?, datePeremption? }`

**Rôle :** Met à jour un groupe (completKitId, materielKitId) : ajuste la quantité (add/remove rows), date, lot. Mise à jour automatique de completKit.datePeremption = MIN des items.

---

### 16. `GET /kits/ficheInventaire/:idKit`

**Méthode :** GET  
**Paramètres :** `idKit` dans l’URL  
**Query :** `agent` (optionnel) – objet JSON encodé en URL `{ matricule, nom, prenom, grade, mail }`

**Rôle :** Retourne une page HTML d’impression de la fiche inventaire du kit (produits, quantités, dates, QR code, observations). La page se lance en impression automatiquement à l’ouverture.

---

## Page HTML

### `/kitDetail`

**URL :** `/kitDetail?idKit=KIT-ACC-2025-001` ou `/kitDetail?id=KIT-ACC-2025-001`

**Rôle :** Page de détail d’un kit avec :

1. **Imprimer la fiche inventaire** : ouvre la fiche dans une nouvelle fenêtre puis imprime.
2. **Valider les modifications** : enregistre les changements de quantité, date, n° lot dans le tableau.
3. **Remplacer** : ouvre une modale pour remplacer un matériel (ancien/nouveau id stock, péremption, date, lot) et enregistre l’historique.
4. Edition inline des colonnes Quantité réelle, Date, N° lot.

---

## Ajout de matériel via la route existante

**Route :** `POST /createDB` (inchangée)

Cette route accepte désormais les deux types de matériel selon `idMateriel` :

| Type | Détection | Table | Champs requis supplémentaires |
|------|-----------|-------|-------------------------------|
| **Classique** | `idMateriel` = chaîne (ex. `"gantL"`, `"controleGluco"`) | `stock` | `idStock`, `idMateriel`, etc. (inchangé) |
| **Kit** | `idMateriel` = nombre entier (ex. `5`, `"12"`) | `stockKit` | `completKitId`, `idMateriel` (materielKitId) |

**Exemple matériel classique (inchangé) :**
```json
{
  "idStock": "STOCK-001",
  "idMateriel": "gantL",
  "idStatut": 1,
  "idAgent": "123",
  "numLot": "LOT1",
  "datePeremption": "2026-01-15"
}
```

**Exemple matériel kit :**
```json
{
  "idMateriel": 5,
  "completKitId": 1,
  "quantiteReelle": 2,
  "dateArticle": "2025-02-20",
  "numLot": "LOT456"
}
```

---

## Création de commande / récapitulatif

**Route :** `GET /generatePDF/commande` ou `GET /getRecap/commande`

**Rôle :** Retourne les données pour l’onglet création de commande : matériel classique (real vs expected) + matériel manquant pour les kits (objectif 4 kits de chaque type).

**Réponse :**  
```json
{
  "materielsClassiques": [...],
  "materielManquantKits": [...]
}
```

L’onglet création de commande doit afficher les deux sections et intégrer le matériel manquant des kits dans la liste des articles à commander.

---

## Règles applicatives

- **1 item = 1 ligne** : stockKit stocke 1 ligne par unité physique. Quantités via COUNT(*).
- **Date péremption kit** : `completKit.datePeremption` = MIN des `stockKit.datePeremption` des items. Mise à jour automatique lors de la création/modification.
- **Objectif 4 kits** : matériel suffisant en statut 1 et 2 pour constituer 4 kits de chaque type.
- **Historique / observations** : stockés dans `completKit.historique`, max 500 caractères.
