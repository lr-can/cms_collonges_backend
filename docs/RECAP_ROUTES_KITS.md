# Récapitulatif des routes et fonctionnalités – Gestion des kits

## Base de données (schéma v2 – matrice par type de kit)

- **materielKit** : Matrice des articles. 1 ligne par article, avec booléens et quantités par type de kit :
  - `kitAccouchement`, `kitMembreSectionne`, `kitAESAEV` (BOOLEAN)
  - `quantiteAccouchement`, `quantiteMembreSectionne`, `quantiteAESAEV` (quantités théoriques)
  - Même référence (ex. Gant T7) = mêmes matériels, affectables à plusieurs kits via les booléens.
- **completKit** : Kits physiques (idKit, nomKit, createurId, datePeremption, historique). Pas de statut.
- **stockKit** : 1 ligne par article par kit physique. `id` VARCHAR (K1, K2...), `completKitId`, `materielKitId`, `statut`, `dateArticle`, `numeroLot`, `creator`.
- **v_materielKits** : Vue de la matrice (articles + booléens + quantités par kit).
- **v_stockKit** : Vue détaillée du contenu des kits (stockKit + completKit + materielKit).
- **v_kitsPerimantBientot** : Kits dont la date de péremption est dans moins de 2 mois.

**Types de kits fixes :** `KIT ACCOUCHEMENT`, `KIT MEMBRE SECTIONNE`, `KIT AES / AEV`

---

## Routes API

### 1. `GET /infoKit/:idKit`

**Méthode :** GET  
**Paramètres :** `idKit` dans l’URL (ex. `KIT-ACCOUCHE-2026-001`)

**Rôle :** Endpoint public pour le QR code. Retourne les infos de base du kit.

**Réponse :**  
```json
{
  "idKit": "KIT-ACCOUCHE-2026-001",
  "nomKit": "KIT ACCOUCHEMENT",
  "datePeremption": "2026-12-31",
  "createurId": "V26371"
}
```

---

### 2. `GET /kits/stockDisponible`

**Méthode :** GET  
**Query :** `idMateriel` (optionnel) – filtre par matériel

**Rôle :** Liste du stock disponible (table `stock`, pool pharmacie). Items non affectés aux kits.  
*Note : nécessite la colonne `stock.completKitId` (migration kits_use_stock_commun).*

**Réponse :** tableau d’objets  
```json
[
  { "idStock": 123, "idMateriel": "dakin", "nomMateriel": "Dakin", "numLot": "LOT1", "datePeremption": "2026-06-15", "dateCreation": "...", "idStatut": 1 }
]
```

---

### 3. `GET /kits/stockDisponibleParMateriel`

**Méthode :** GET  
**Rôle :** Stock disponible agrégé par matériel (quantités).

**Réponse :** tableau  
```json
[
  { "idMateriel": "dakin", "nomMateriel": "Dakin", "quantiteDisponible": 5, "datePeremptionMin": "2026-06-15" }
]
```

---

### 4. `GET /kits/materielKit`

**Méthode :** GET  
**Query :** `nomKit` ou `kitPour` (optionnel) – filtre par type de kit (`KIT ACCOUCHEMENT`, `KIT MEMBRE SECTIONNE`, `KIT AES / AEV`)

**Rôle :** Liste du catalogue materielKit. Si `nomKit` fourni, ne retourne que les articles présents dans ce kit (booléen = true).

**Réponse :** tableau d’objets  
```json
[
  {
    "id": 1,
    "nomCommande": "ALESE",
    "nomCommun": "Alese",
    "kitAccouchement": true,
    "kitMembreSectionne": false,
    "kitAESAEV": false,
    "quantiteAccouchement": 2,
    "quantiteMembreSectionne": 0,
    "quantiteAESAEV": 0,
    "idMateriel": null,
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

---

### 5. `GET /kits/nomsKits`

**Méthode :** GET  

**Rôle :** Liste des noms de types de kits (fixe).

**Réponse :**  
```json
[
  { "nomKit": "KIT ACCOUCHEMENT" },
  { "nomKit": "KIT MEMBRE SECTIONNE" },
  { "nomKit": "KIT AES / AEV" }
]
```

---

### 6. `GET /kits/materielKit/:nomKit`

**Méthode :** GET  
**Paramètres :** `nomKit` dans l’URL (ex. `KIT ACCOUCHEMENT`)

**Rôle :** Articles d’un type de kit donné (filtrés par le booléen correspondant), avec la quantité théorique.

**Réponse :** tableau d’articles pour ce kit.

---

### 7. `GET /kits/completKit`

**Méthode :** GET  
**Query :** `nomKit` (optionnel)

**Rôle :** Liste des kits physiques (completKit).

**Réponse :** tableau d’objets  
```json
[
  {
    "id": 1,
    "idKit": "KIT-ACCOUCHE-2026-001",
    "nomKit": "KIT ACCOUCHEMENT",
    "createurId": "V26371",
    "datePeremption": "2026-12-31",
    "historique": "...",
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

---

### 8. `GET /kits/completKit/:idKit`

**Méthode :** GET  
**Paramètres :** `idKit` dans l’URL : chaîne (ex. `KIT-ACCOUCHE-2026-001`) ou id numérique du kit

**Rôle :** Détail complet d’un kit avec son contenu (stockKit agrégé par materielKitId).

**Réponse :**  
```json
{
  "id": 1,
  "idKit": "KIT-ACCOUCHE-2026-001",
  "nomKit": "KIT ACCOUCHEMENT",
  "createurId": "V26371",
  "datePeremption": "2026-12-31",
  "historique": "remplacement du ...",
  "items": [
    {
      "id": "K1",
      "completKitId": 1,
      "materielKitId": 1,
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

### 9. `POST /kits/completKit`

**Méthode :** POST  
**Body JSON :**
```json
{
  "idKit": "KIT-ACCOUCHE-2026-001",
  "nomKit": "KIT ACCOUCHEMENT",
  "createurId": "V26371"
}
```

**Champs requis :** `idKit`, `nomKit`, `createurId`

**Rôle :** Création d’un nouveau kit physique (sans contenu).

**Réponse :**  
```json
{
  "message": "Kit créé.",
  "id": 42
}
```

---

### 10. `PUT /kits/completKit/:id`

**Méthode :** PUT  
**Paramètres :** `id` (id numérique du completKit) dans l’URL  
**Body JSON :**
```json
{
  "datePeremption": "2026-12-31",
  "createurId": "V26371",
  "historique": "Contrôle effectué..."
}
```

**Rôle :** Modification des données générales d’un kit.

**Réponse :**  
```json
{ "message": "Kit modifié." }
```

---

### 11. `POST /kits/realiser`

**Méthode :** POST  
**Body JSON :**
```json
{
  "idKit": "KIT-ACCOUCHE-2026-001",
  "createurId": "V26371"
}
```

**Champs requis :** `idKit`, `createurId`

**Rôle :** Réalisation du kit : crée les lignes stockKit à partir de materielKit (articles dont le booléen est true pour ce type de kit, avec les quantités correspondantes).

**Réponse :**  
```json
{ "message": "Kit réalisé." }
```

---

### 12. `POST /kits/remplacerMateriel`

**Méthode :** POST  
**Body JSON :**
```json
{
  "completKitId": 1,
  "stockKitId": "K1",
  "dateArticle": "2026-02-20",
  "numeroLot": "LOT456",
  "ancienIdStock": "K1",
  "nouveauIdStock": "K42",
  "datePeremptionNouveau": "15/03/2026",
  "nomMateriel": "ALESE"
}
```

**Champs requis :** `completKitId`, `stockKitId`  
**Champs optionnels :** `dateArticle`, `numeroLot`, `ancienIdStock`, `nouveauIdStock`, `datePeremptionNouveau`, `nomMateriel`

**Rôle :** Met à jour la ligne stockKit (dateArticle, numeroLot) et ajoute une entrée dans l’historique du kit. L’historique est limité à 500 caractères.

**Réponse :**  
```json
{ "message": "Matériel remplacé." }
```

---

### 13. `PUT /kits/stockKit/:id`

**Méthode :** PUT  
**Paramètres :** `id` dans l’URL – identifiant de la ligne stockKit (format `K1`, `K2`, …)  
**Body JSON :**
```json
{
  "dateArticle": "2026-02-20",
  "numeroLot": "LOT456"
}
```

**Rôle :** Mise à jour d’une ligne stockKit (date, lot).

**Réponse :**  
```json
{ "message": "Ligne stock kit modifiée." }
```

---

### 14. `POST /kits/observation/:completKitId`

**Méthode :** POST  
**Paramètres :** `completKitId` dans l’URL  
**Body JSON :**
```json
{
  "observation": "Contrôle effectué le 20/02/2026"
}
```

**Rôle :** Ajoute une observation dans l’historique du kit (limité à 500 caractères).

**Réponse :**  
```json
{ "message": "Observation ajoutée." }
```

---

### 15. `GET /kits/nextIdKit`

**Méthode :** GET  
**Query :** `nomKit` (optionnel) – pour le préfixe de l’id suggéré

**Rôle :** Propose un prochain identifiant de kit (ex. `KIT-ACCOUCHE-2026-002`).

**Réponse :**  
```json
{
  "suggestion": "KIT-ACCOUCHE-2026-002"
}
```

---

### 16. `GET /kits/materielManquant`

**Méthode :** GET  
**Query :** `nbKits` (optionnel, défaut: 4)

**Rôle :** Retourne le matériel manquant pour atteindre N kits de chaque type.

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

### 17. `PUT /kits/stockKit/groupe`

**Méthode :** PUT  
**Body JSON :**
```json
{
  "completKitId": 1,
  "materielKitId": 5,
  "quantiteReelle": 3,
  "dateArticle": "2026-02-20",
  "numeroLot": "LOT789"
}
```

**Champs requis :** `completKitId`, `materielKitId`  
**Champs optionnels :** `quantiteReelle`, `dateArticle`, `numeroLot`

**Rôle :** Met à jour un groupe (completKitId, materielKitId) : ajuste la quantité (add/remove lignes stockKit), date, lot. Mise à jour automatique de completKit.datePeremption = MIN(dateArticle) des items.

---

### 18. `GET /kits/ficheInventaire/:idKit`

**Méthode :** GET  
**Paramètres :** `idKit` dans l’URL  
**Query :** `agent` (optionnel) – objet JSON encodé en URL `{ matricule, nom, prenom, grade, mail }`

**Rôle :** Retourne une page HTML d’impression de la fiche inventaire du kit (produits, quantités, dates, QR code, observations).

---

## Page HTML

### `/kitDetail`

**URL :** `/kitDetail?idKit=KIT-ACCOUCHE-2026-001` ou `/kitDetail?id=1`

**Rôle :** Page de détail d’un kit avec :

1. **Imprimer la fiche inventaire** : ouvre la fiche dans une nouvelle fenêtre puis imprime.
2. **Valider les modifications** : enregistre les changements de quantité, date, n° lot dans le tableau.
3. **Remplacer** : modale pour remplacer un matériel (ancien/nouveau id, péremption, date, lot).
4. Édition inline des colonnes Quantité réelle, Date, N° lot.

---

## Ajout de matériel pharmacie

**Route :** `POST /createDB`

Tous les matériels sont enregistrés dans la table **stock** (pool commun). Aucune distinction par kit à l’ajout.

**Exemple :**
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

*Note : les lignes stockKit sont créées lors de la réalisation du kit (`POST /kits/realiser`), à partir de la matrice materielKit.*

---

## Création de commande / récapitulatif

**Route :** `GET /generatePDF/commande` ou `GET /getRecap/commande`

**Rôle :** Retourne les données pour l’onglet création de commande : matériel classique + matériel manquant pour les kits (objectif N kits par type).

---

## Règles applicatives

- **Matrice materielKit** : 1 ligne par article. Les booléens (`kitAccouchement`, etc.) indiquent dans quels kits l’article est présent. Les quantités (`quantiteAccouchement`, etc.) donnent le nombre par kit.
- **1 item = 1 ligne** : stockKit stocke 1 ligne par unité physique. Quantités = COUNT(*).
- **ID stockKit** : format `K1`, `K2`, … (VARCHAR).
- **Date péremption kit** : `completKit.datePeremption` = MIN des `stockKit.dateArticle` des items. Mise à jour automatique lors des modifications.
- **Historique / observations** : stockés dans `completKit.historique`, max 500 caractères.

---

## Migration

```bash
node scripts/run-migration.js migrations/schema_kits_v2.sql
```
