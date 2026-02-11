# Exemple de requête POST pour /inventaireVehicule

## Configuration Postman

### Méthode
POST

### URL
```
http://localhost:3000/inventaireVehicule
```
(Remplacez par l'URL de votre serveur si différent)

### Headers
```
Content-Type: application/json
```

### Body (raw JSON)
```json
{
  "Vehicule": "VSAV",
  "Date": "15/12/2024",
  "HeureDebut": "08:00",
  "HeureFin": "12:30",
  "ChefDeGarde": "Dupont Jean",
  "Inventaireur1": "Martin Pierre",
  "Inventaireur2": "Bernard Marie",
  "Inventaireur3": "Durand Luc",
  "Inventaire": {
    "roueSecours": "OK",
    "extincteur": "À vérifier",
    "trousseSecours": "Complète",
    "radio": "Fonctionnelle"
  },
  "EtatVehicule": {
    "niveauCarburant": "Plein",
    "kilometrage": 125000,
    "etatGeneral": "Bon",
    "remarques": "Véhicule en bon état général"
  },
  "CommentaireInventaire": "Commentaire global de l'inventaire",
  "Commentaire": "Commentaire global de l'inventaire",
  "Status": "PENDING"
}
```

## Notes importantes

- **Vehicule** : Requis (ex: `VSAV`, `VSR`, `FPT`)
- **Date** : Format obligatoire `JJ/MM/YYYY` (ex: `15/12/2024`)
- **HeureDebut** : Format obligatoire `HH:mm` (ex: `08:00`)
- **HeureFin** : Format obligatoire `HH:mm` (ex: `12:30`)
- **ChefDeGarde, Inventaireur1, Inventaireur2, Inventaireur3** : Chaînes de caractères (strings)
- **Inventaire** : Objet/dictionnaire JSON (peut être vide `{}` ou omis)
- **EtatVehicule** : Objet/dictionnaire JSON (peut être vide `{}` ou omis)
- **CommentaireInventaire / Commentaire** : Optionnel. Le backend priorise `CommentaireInventaire`, sinon `Commentaire`
- **Status** : Par défaut `PENDING` si non spécifié

## Exemple minimal (sans Inventaire et EtatVehicule)

```json
{
  "Vehicule": "VSAV",
  "Date": "15/12/2024",
  "HeureDebut": "08:00",
  "HeureFin": "12:30",
  "ChefDeGarde": "Dupont Jean",
  "Inventaireur1": "Martin Pierre",
  "Inventaireur2": "Bernard Marie",
  "Inventaireur3": "Durand Luc"
}
```

## Réponse attendue (succès)

```json
{
  "message": "Inventaire ajouté avec succès",
  "insertedRows": 1
}
```

## Réponse en cas d'erreur

```json
{
  "message": "Format de date invalide. Format attendu: JJ/MM/YYYY"
}
```

