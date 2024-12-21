const fs = require('fs');
const turf = require('@turf/turf');
let fetch;

const telexFirstPartGeoJson = JSON.parse(fs.readFileSync('ressources/firstPart.geojson', 'utf8'));
const telexSecondPartGeoJson = JSON.parse(fs.readFileSync('ressources/secondPart.geojson', 'utf8'));

async function getFirstPartGeoJson(lon, lat) {
    const firstPart = telexFirstPartGeoJson;
    const point = turf.point([lon, lat]);
    for (const feature of firstPart.features) {
        if (turf.booleanPointInPolygon(point, feature)) {
            return feature;
        }
    }
    return { est: true, data: getClosestFeature(firstPart, point) };
}

async function getSecondPartGeoJson(lon, lat) {
    const secondPart = telexSecondPartGeoJson;
    const point = turf.point([lon, lat]);
    for (const feature of secondPart.features) {
        if (turf.booleanPointInPolygon(point, feature)) {
            return feature;
        }
    }
    return getClosestFeature(secondPart, point);
}

function getClosestFeature(geoJson, point) {
    let closestFeature = null;
    let minDistance = Infinity;
    for (const feature of geoJson.features) {
        const distance = turf.distance(point, turf.centroid(feature));
        if (distance < minDistance) {
            minDistance = distance;
            closestFeature = feature;
        }
    }
    if (minDistance < 0.5) {
        return closestFeature;
    } else {
        return null;
    }
}

async function getClosestFireHydrants(lon, lat) {
    const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';
    if (!fetch) {
        fetch = (await import('node-fetch')).default;
    }
        const query = `
            [out:json];
            node
              ["emergency"="fire_hydrant"]
              (around:200,${lat},${lon});
            out body;
        `;
        const response = await fetch(OVERPASS_API_URL, {
            method: 'POST',
            body: query,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch fire hydrants from OpenStreetMap');
        }

        const data = await response.json();
        const point = turf.point([lon, lat]);
        const hydrants = data.elements.map(element => ({
            id: element.id,
            lat: element.lat,
            lon: element.lon,
            tags: element.tags,
            distance: turf.distance(point, turf.point([element.lon, element.lat]))
        }));
        hydrants.sort((a, b) => a.distance - b.distance);
        return hydrants.map(hydrant => ({
            id: hydrant.id,
            numero: hydrant.tags.ref,
            distance: Math.round(hydrant.distance * 1000)
        }));
    }

    function getSessionToken() {
        // Generate a unique session token
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

async function autoCompleteAddress(input_str) {
    if (typeof input_str !== 'string') {
        throw new Error('input_str must be a string');
    }
    if (!fetch) {
        fetch = (await import('node-fetch')).default;
    }

    const input = input_str.replace("%20", "+");

    const url = `https://api-adresse.data.gouv.fr/search/?q=${input}&lat=45.8172792&lon=4.8474605`;
    const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
        throw new Error('Failed to fetch address suggestions from api-adresse.data.gouv.fr');
    }

    const data = await response.json();
    return data;
}

async function getMapCoordinates(lon, lat) {
    const firstPart = await getFirstPartGeoJson(lon, lat);
    const firstPartString = firstPart && firstPart.est ? "est. " + (firstPart.data && firstPart.data.properties ? firstPart.data.properties.assigned_data : '') : firstPart && firstPart.properties ? firstPart.properties.assigned_data : '';
    const secondPart = await getSecondPartGeoJson(lon, lat);
    const secondPartString = secondPart && secondPart.properties ? secondPart.properties.assigned_data : '';
    return {
        coordinates: { lon, lat },
        mapCoordinates: `${firstPartString} ${secondPartString}`.replace("est.  ", "inconnu"),
        fireHydrants: await getClosestFireHydrants(lon, lat)
    };
}

async function assignAgentsToVehicles(matricules, codeSinistre, personnalises = []) {
  if (!fetch) {
      fetch = (await import('node-fetch')).default;
  }
  const personnalise = personnalises;
  try {
      // Charger les données nécessaires
      const [sinistres, engins, emploisGFO, agents] = await Promise.all([
          fetch('https://opensheet.elk.sh/13y-17sHUSenIoehILJMzuJcpqnRG2CVX9RvDzvaa448/libelleSinistres').then(res => res.json()),
          fetch('https://opensheet.elk.sh/13y-17sHUSenIoehILJMzuJcpqnRG2CVX9RvDzvaa448/GFO_COLLONGES').then(res => res.json()),
          fetch('https://opensheet.elk.sh/13y-17sHUSenIoehILJMzuJcpqnRG2CVX9RvDzvaa448/GFO_EMPLOIS').then(res => res.json()),
          fetch('https://opensheet.elk.sh/1ottTPiBjgBXSZSj8eU8jYcatvQaXLF64Ppm3qOfYbbI/agentsAsup').then(res => res.json())
      ]);

      console.log('Données chargées:', { sinistres, engins, emploisGFO, agents });

      // Identifier les GFO correspondant au codeSinistre
      const sinistre = sinistres.find(s => s.sinistreCode === codeSinistre);
      if (!sinistre) {
          console.error('Code sinistre non trouvé:', codeSinistre);
          throw new Error('Code sinistre non trouvé');
      }
      let gfoAvailable = [];
      for (const key of Object.keys(engins[0])){
        if (key.includes("GFO")){
          gfoAvailable.push(key.replace("priorite_GFO_", ""));
        }

      }
      const gfoBase = sinistre.sinistreGFOBase
                    .split(', ')
                    .filter(gfo => gfoAvailable.includes(gfo));

      console.log('GFO de base:', gfoBase);

      // Trier les engins par priorité
      const enginsTries = engins.sort((a, b) => a.prioriteEngin - b.prioriteEngin);

      // Filtrer et trier les agents selon leur matricule
      const agentsDispo = agents
          .filter(agent => matricules.includes(agent.matricule))
          .sort((a, b) => a.matricule.localeCompare(b.matricule));
      
      let agentsDispoWithEmplois = agentsDispo.map(agent => {
          const emplois = [];
          for (const key in agent) {
        if (key.endsWith('_ca') || key.endsWith('_cd') || key.endsWith('_eq') || key.endsWith('_eqc') || key.endsWith('_ce') || key.endsWith('_cdg') || key.endsWith('_inf')) {
            if (agent[key] === '1') {
          emplois.push(key);
            }
        }
          }
          return {
        matricule: agent.matricule,
        grade: gradeAbbreviation(agent.grade),
        nomAgent: agent.nomAgent,
        prenomAgent: agent.prenomAgent,
        emplois
          };
      });

      console.log('Agents disponibles:', agentsDispo);

      // Initialiser les affectations et les GFO restants
      const affectations = [];
      const gfoRestants = [...gfoBase];
      // Ajouter les GFO personnalisés additionnels
      if (personnalise.gfo_additionnel && Array.isArray(personnalise.gfo_additionnel)) {
          gfoRestants.splice(0,0,...personnalise.gfo_additionnel);
      }

      // Retirer les GFO personnalisés de soustraction
      if (personnalise.gfo_soustraction && Array.isArray(personnalise.gfo_soustraction)) {
          for (const gfo of personnalise.gfo_soustraction) {
        const index = gfoRestants.indexOf(gfo);
        if (index !== -1) {
            gfoRestants.splice(index, 1);
        }
          }
      }
      // Remove duplicates of "INC" in gfoRestants
      const uniqueGfoRestants = [];
      const seenGfo = new Set();
      for (const gfo of gfoRestants) {
        if (gfo !== "INC" || !seenGfo.has("INC")) {
          uniqueGfoRestants.push(gfo);
          seenGfo.add(gfo);
        }
      }
      const agentsNonAffectes = [...agentsDispoWithEmplois];
      const { score: score1, affectation: try1, agentsNonAffectesRestants: agentsRestants1  } = affectByGFO(
        uniqueGfoRestants,
        agentsNonAffectes,
        enginsTries,
        emploisGFO,
        "min",
        personnalise
    );
    affectations.push({ score: score1, affectation: try1, agentsNonAffectesRestants: agentsRestants1 });
    
    const { score: score2, affectation: try2, agentsNonAffectesRestants: agentsRestants2 } = affectByGFO(
        uniqueGfoRestants,
        agentsNonAffectes,
        enginsTries,
        emploisGFO,
        "max",
        personnalise
    );
    affectations.push({ score: score2, affectation: try2,  agentsNonAffectesRestants: agentsRestants2});
    
      console.log(affectations);
      // Return max score's affectation
      console.log(affectations.sort((a, b) => b.score - a.score)[0]);
      return affectations.sort((a, b) => b.score - a.score)[0];
      

    }
    catch (err) {
      console.error('Erreur lors de l\'affectation des agents aux véhicules:', err.message);
      throw err;
  }
}


function affectByGFO(gfoRestants, agentsNonAffectes, enginsTries, emploisGFO, config, personnalise) {
// Affecter les agents aux engins selon les GFO
// renvoie un dictionnaire de la forme { score : int , affectation : []}
// personnalise sera utilisé en personnalise.agents de la forme : [{"matricule" : "VXXXXX", "engin":"X", "emploi" : "X"}]
const affectation = [];
let enginsTriesRestants = [...enginsTries];
let agentsNonAffectesRestants = [...agentsNonAffectes];
let score = 0;
for (const gfo of gfoRestants) {
    filteredEngins = enginsTriesRestants
      .filter(engin => engin["priorite_GFO_" + gfo] !== "0")
      .sort((a, b) => a["priorite_GFO_" + gfo] - b["priorite_GFO_" + gfo])[0];
    if (!filteredEngins) {
        console.warn('Aucun engin disponible pour le GFO', gfo);
        continue;
    }
    const engin = filteredEngins;
    console.log(engin.libEngin);
    let i = enginsTriesRestants.findIndex(e => e.libEngin === engin.libEngin);
    enginsTriesRestants.splice(i, 1);


    // Trouver les emplois correspondant au GFO
    const emplois = emploisGFO.filter(emploi => emploi.GFO === gfo);
    let emploiConfig = [];
    let gfoAffect = [];
    if (config === "min"){ 
     emploiConfig = emplois[0].emploisGFO_min.split(", ")
    } else if (config === "max"){
      emploiConfig = emplois[0].emploisGFO_pref.split(", ")
    }
    
    for (const emploi of emploiConfig) {
        // Trouver les agents disponibles pour cet emploi
const agentsDispo = agentsNonAffectesRestants
.filter(agent => agent.emplois.includes(emploi))
.sort((a, b) => a.emplois.length - b.emplois.length); // Tri ascendant par longueur du tableau emplois
for(const agent of personnalise.agents){
        let index;
        index = agentsDispo.findIndex(a => a.matricule === agent.matricule);
        if (index !== -1) {
            agentsDispo.splice(index, 1);
        }
        if (engin.libEngin === agent.engin && agent.emploi === emploi){
          agentsDispo.splice(0, 0, agent);
        
        }
    }

        if (agentsDispo.length === 0) {
            console.warn('Aucun agent disponible pour l\'emploi', emploi);
            let emptyAgent = {
                matricule: "",
                prenom: "",
                nom: "",
                grade: "",
                engin: engin.libEngin,
                emploi: emploi
            }
            gfoAffect.push(emptyAgent);
            score -= 10;
            continue;
        }
        const agent = agentsDispo[0];
        const index = agentsNonAffectesRestants.findIndex(a => a.matricule === agent.matricule);
        agentsNonAffectesRestants.splice(index, 1);
        const agentAffectation = {
            matricule: agent.matricule,
            prenom: agent.prenomAgent,
            nom: agent.nomAgent,
            grade: agent.grade,
            engin: engin.libEngin,
            emploi: emploi
        };
        gfoAffect.push(agentAffectation);
        
    }
    affectation.push({"engin": engin.libEngin, "affectation": gfoAffect});
    score -= 50 * agentsNonAffectesRestants.length;
}
console.log(affectation);
return {score, affectation, agentsNonAffectesRestants};
}

function gradeAbbreviation(grade){
const grades = {
  "Sap 2CL": "SAP",
  "Sap 1CL": "SAP",
  "Caporal" : "CAP",
  "Caporal-Chef": "CCH",
  "Sergent": "SGT",
  "Sergent-Chef": "SCHE",
  "Adjudant": "ADJ",
  "Adjudant-Chef": "ADC",
  "Lieutenant": "LTN",
  "Capitaine": "CNE",
  "Commandant": "CDT",
  "Colonel": "COL",
  "Lieutenant-Colonel": "LCL",
  "Infirmière": "INF",
}
return grades[grade];
}

/* assignAgentsToVehicles(
  matricules= ["V30001",
"V33624",
"V06208",
"V33117",
"V33369",
"V25076",
"V29738",
"V29952",
"V26371",
"V13706",
"V27192",
"V29997",
"V06175",
"V29242",
"V33243",
"V29996",
"V06734",
"V32227"],
  codeSinistre= "3160",
  personnalise={
       "agents": [
          {"matricule" : "V29996", "engin":"VSAV-2", "emploi" : "SAP_ca", "grade": "CNE", "nomAgent": "CHATEAUX", "prenomAgent": "Thierry"},
       {"matricule": "V06175","grade":"SCHE","nomAgent":"BERNARD", "prenomAgent":"Albert","engin": "VSAV-2", "emploi":"SAP_cd"}],
  "gfo_additionnel": ["SAP"],
  "gfo_soustraction": []
  }
)
*/

module.exports = {
    getMapCoordinates,
    autoCompleteAddress,
    assignAgentsToVehicles
};