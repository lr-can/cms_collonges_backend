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

async function getERP(lon, lat){
    if (!fetch) {
        fetch = (await import('node-fetch')).default;
    }
    let url = 'https://data.grandlyon.com/geoserver/service-departemental-metropolitain-d-incendie-et-de-secours-sdmis/ows?SERVICE=WFS&VERSION=2.0.0&request=GetFeature&typename=service-departemental-metropolitain-d-incendie-et-de-secours-sdmis:sdmis.erp&outputFormat=application/json&SRSNAME=EPSG:4171&startIndex=0&sortBy=gid'
    const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        redirect: 'follow'
    });
    let url2 = 'https://data.grandlyon.com/geoserver/service-departemental-metropolitain-d-incendie-et-de-secours-sdmis/ows?SERVICE=WFS&VERSION=2.0.0&request=GetFeature&typename=service-departemental-metropolitain-d-incendie-et-de-secours-sdmis:sdmis.caserne&outputFormat=application/json&SRSNAME=EPSG:4171&startIndex=0&sortBy=gid'
    const response2 = await fetch(url2, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        redirect: 'follow'
    });
    const erpGeoJson = await response.json();
    const casernesGeoJson = await response2.json();
    const point = turf.point([lon, lat]);
    const erpDistances = erpGeoJson.features.map(feature => {
        const erpPoint = turf.point(feature.geometry.coordinates);
        const distance = turf.distance(point, erpPoint, { units: 'meters' });
        let nom = `${feature.properties.denomination} - ${feature.properties.code}`
        return { feature: nom, distance };
    });

    const casernesDistances = casernesGeoJson.features.map(feature => {
        const erpPoint = turf.point(feature.geometry.coordinates);
        const distance = turf.distance(point, erpPoint, { units: 'meters' });
        let nom = `CT ${feature.properties.nom_officiel_site} - ${feature.properties.groupement}`;
        return { feature: nom, distance };
    });

    const allDistances = [...erpDistances, ...casernesDistances];
    allDistances.sort((a, b) => a.distance - b.distance);

    return allDistances.slice(0, 5);
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
        fireHydrants: await getClosestFireHydrants(lon, lat),
        erp: await getERP(lon, lat)
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
  "Sergent-Chef": "SCH",
  "Adjudant": "ADJ",
  "Adjudant-Chef": "ADC",
  "Lieutenant": "LTN",
  "Capitaine": "CNE",
  "Commandant": "CDT",
  "Colonel": "COL",
  "Lieutenant-Colonel": "LCL",
  "Expert": "EXP",
  "Infirmière": "INF",
}
return grades[grade];
}

async function getVehiculesAndCaserne (){
    const artemisData = JSON.parse(fs.readFileSync('ressources/artemisData.json', 'utf8'));
    return artemisData;
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

async function generateTelex(data){
    let adresses = data.adresses;
    let observation = data.observation;
    let numInter = 'M063_';
    let currentDate = new Date();
    let numberOfMinutesFromBeginningOfYear = Math.floor((currentDate - new Date(currentDate.getFullYear(), 0, 0)) / 60000);
    numInter += numberOfMinutesFromBeginningOfYear;
    let htmlRender = '';
    const htmlHeader = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ordre de départ</title>
    <style>
        body{
            font-family: Arial, sans-serif;
            width: 100%;
            margin: 0;
            padding: 0;
        }
        .TNR{
            font-family: "Times New Roman", Times, serif;
        }
        .Arial{
            font-family: Arial, sans-serif;
        } 
        .F10{
            font-size: 10px;
        }
        .F12{
            font-size: 12px;
        }
        .F14{
            font-size: 14px;
        }
        .F16{
            font-size: 16px;
        }
        .F18{
            font-size: 18px;
        }
        .F20{
            font-size: 20px;
        }
        .F12{
            font-size: 12px;
        }
        .bold{
            font-weight: bold;
        }
        .center{
            text-align: center;
        }
        .left{
            text-align: left;
        }
        .right{
            text-align: right;
        }
        .italic{
            font-style: italic;
        }
        .sinistre{
            border-top: black 3px solid;
            border-bottom: black 3px solid;
            font-size: 18px;
            font-weight: bold;
            text-align: center;
            padding: 0.5rem;
        }
        .dotted{
            padding-bottom: 0.3rem;
            border-bottom: dimgray 0.5px dotted !important;
        }
        .upper{
            text-transform: uppercase;
        }
        .bordered{
            padding: 1%;
            margin-top: 1rem;
            border: black 3px solid;
            width: 97%;
            margin-bottom: 1rem;
        }
        .underline{
            text-decoration: underline;
            text-decoration-thickness: 0.5px;
        }
        @media print {
            section {page-break-before: always;}
            @page {
                size: portrait;
                margin: normal;
            }
            body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
        }
        #dateAlerte{
            margin-left: 2rem;
        }
        .T5{
            width: 5%;
        }
        .T10{
            width: 10%;
        }
        .T15{
            width: 15%;
        }
        .T20{
            width: 20%;
        }
        .T25{
            width: 25%;
        }
        .T30{
            width: 30%;
        }
        .T35{
            width: 35%;
        }
        .T40{
            width: 40%;
        }
        .T50{
            width: 50%;
        }
        .T75{
            width: 75%;
        }
        .T80{
            width: 80%;
        }
        .T90{
            width: 90%;
        }
        .T100{
            width: 100%;
        }
        .T10{
            width: 10%;
        }
        .gray{
            background-color: lightgray;
        }
        .margin-right{
            margin-right: 2rem;
        }
        table{
            border-collapse: collapse;
            margin-bottom: 1rem;
        }
        .noMargin{
            margin-bottom: 0;
        }
        p{
            margin-top: 0;
        }
        .top{
            vertical-align: top;
        }
        .partTitle{
            margin-top: 0.5rem;
        }
        .lineHeight{
            line-height: 1;
        }
        .lineHeight1{
            line-height: 1.5;
        }

        .lineHeight2{
            line-height: 2;
        }
        .flexx{
            display: flex;
            flex-direction: row;
        }
        .smallMarginLeft{
            margin-left: 0.3rem;
        }
    </style>
    <script>
        window.onload = function(){
            window.print();
        }
    </script>
</head>
<body>`;
    const htmlFooter = `</body>
</html>`;
    htmlRender += htmlHeader;
    for (const OD of data.ordresDeparts){
        let odEngins = '';
        let listOfEngins = [];
        for (const engin of OD.engins){
            listOfEngins.push(engin);
        }
        let groupedByCaserne = listOfEngins.reduce((acc, obj) => {
            let key = obj.caserne;
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(obj);
            return acc;
        }, {});
        odEngins += `    <div class="dotted upper noMargin">
        <table class="T100 partTitle">
            <tr>
                <td class="T75 center">
                    <span class="bold italic underline center partTitle">Moyens alertés pour cet ordre de départ</span>
                </td>
                <td class="T25 right">
                    <span class="bold italic underline center partTitle">Echelon : 0</span>
                </td>
            </tr>
        </table>
        <table class="T100 lineHeight2">
            <tr class="F10 italic">
                <td class="T20 center">CT</td>
                <td class="T80">ENGIN (GFO)</td>
            </tr>
            `;
        for (const caserne in groupedByCaserne){
            odEngins += `            <tr class="F14 TNR">
                <td class="upper center">${caserne}</td>
                <td class="upper">`;
            for (const engin of groupedByCaserne[caserne]){
                odEngins += `<span class="margin-right">${engin.engin}(<span>${engin.gfo}</span>)</span>`;
            }
            odEngins += `</td>
            </tr>`;
        }
        odEngins += `        </table>
    </div>`;

        let previousodEngins = '';
        let previousListOfEngins = [];
        let filteredOD = data.ordresDeparts.filter(od => od.timeDate < OD.timeDate);
        if (filteredOD.length > 0){
            let previousODs = filteredOD.sort((a, b) => b.timeDate - a.timeDate);
            for (const previousOD of previousODs) {
                let timeDate = previousOD.timeDate;
                for (const engin of previousOD.engins) {
                    previousListOfEngins.push({caserne: engin.caserne, engin: engin.engin, gfo: engin.gfo, "timeDate": timeDate});
                }
            }
            let previousGroupedByTimeAndCaserne = previousListOfEngins.reduce((acc, obj) => {
                let key = obj.timeDate + obj.caserne;
                if (!acc[key]) {
                    acc[key] = [];
                }
                acc[key].push(obj);
                return acc;
            }, {});
            previousodEngins += `
            <div class="dotted upper noMargin">
        <table class="T100 partTitle">
            <tr>
                <td class="center">
                    <span class="bold italic underline center partTitle">Moyens déjà engagés pour cette opération de secours</span>
                </td>
            </tr>
        </table>
        <table class="T100 lineHeight2">
            <tr class="F10 italic">
                <td class="T20 center">CT</td>
                <td class="T60">ENGIN (GFO)</td>
                <td class="T20 center lineHeight">DATE HEURE <br>D'ALERTE</td>
            </tr>
            `;
            for (const key in previousGroupedByTimeAndCaserne) {
                const timeDate = key.slice(0, 19);
                const caserne = key.slice(19);
                previousodEngins += `            <tr class="F14 TNR">
                <td class="upper center">${caserne}</td>
                <td class="upper">`;
                for (const engin of previousGroupedByTimeAndCaserne[key]) {
                    previousodEngins += `<span class="margin-right">${engin.engin}(<span>${engin.gfo}</span>)</span> `;
                }
                previousodEngins += `</td>
                <td class="upper center lineHeight">${timeDate.replace(" ", "<br>")}</td>
            </tr>`;
            }
            previousodEngins += `
        </table>
    </div>`;

        }

        for (const engin of OD.engins){
            htmlRender += ` <section>
        <div id="header" class="F14 TNR">
            <table class="T100">
                <tr>
                    <td class="T50">
                        Déclenchement de l'alerte
                        <span id="dateAlerte">${OD.timeDate}</span>
                    </td>
                    <td class="T40 center">
                        <span id="caserneAlerte" class="F16">${engin.caserne}</span>
                    </td>
                    <td class="T10 right">
                        <span id="vehiculeAlerte" class="F16">${engin.engin}</span>
                    </td>
                </tr>
            </table>`;
        if(engin.codeAppairage && engin.codeAppairage != ""){
            htmlRender += `            <table class="T100">
                <tr>
                    <td class="T100 bold right upper">
                        Code appairage : 
                        <span id="codeApparaige" class="F18">${engin.codeAppairage}</span>
                    </td>
                </tr>
            </table>`;
        };
        htmlRender += `            <table class="T100 Arial F12">
                <tr>
                    <td class="T50 upper center">
                        N° d'intervention
                        <span id="numIntervention" class="bold F14">${numInter}</span>                        
                    </td>
                    <td class="T50 upper center">
                        Ordre de départ
                        <span id="telIntervention" class="F12">${numInter}-</span><span class="F14 bold">${OD.ordreDepart}</span>
                    </td>
                </tr>
            </table>
        </div>`;
        htmlRender += `<div class="sinistre">
            ${data.sinistre.libelleComplet}
        </div>`
        let consigne = data.consigneGenerale && data.consigneGenerale != "" ? data.consigneGenerale : "";
        if (engin.consigneParticuliere && engin.consigneParticuliere != ""){
            consigne += "<br>&ast;&ast;" + engin.consigneParticuliere.replace(/\n/g, "<br>");
        }
        consigne = consigne.replace(/\n/g, "<br>");
        if (consigne != ""){
            htmlRender += `<div class="bold T100 dotted">
            <p class="bold italic underline upper center partTitle">Consignes</p>
            <p id="consignes">${consigne}</p>
        </div>`
        }
        let adresseParticuliere = "";
        if (engin.affectationPRI && engin.affectationPRI != ""){
            adresseParticuliere = "pri";
        } else if (engin.affectationPRV && engin.affectationPRV != ""){
            adresseParticuliere = "prv";
        } else if (engin.affectationPRM && engin.affectationPRM != ""){
            adresseParticuliere = "prm";
        }
        if (adresseParticuliere != ""){
            let specialAddress = data.adresses[`adresse${adresseParticuliere.toUpperCase()}`];
            htmlRender += `<div class="bordered">
            <p class="bold italic underline upper center">${adresseParticuliere.toUpperCase().replace("PR", "CR")} / ${adresseParticuliere.toUpperCase()} - ECHELON 0</p>
            <p class="bold italic upper F16">SE RENDRE AU ${adresseParticuliere.toUpperCase()}</p>
            <table class="T100 F14 noMargin">
                <tr>
                    <td class="T15">
                        <span class="italic upper F12">Commune</span>
                    </td>
                    <td class="T30">
                        <span>:</span>
                        <span class="bold upper">${specialAddress.commune}</span>
                    </td>
                    <td class="T20 center">
                        <span class="upper italic F12">Livre : </span>
                        <span class="bold">${specialAddress.livre}</span>
                    </td>
                    <td class="T30 right">
                        <span class="upper italic F12">Coordonnées : </span>
                        <span class="bold">${specialAddress.coordonnees}</span>
                    </td>
                </tr>
                <tr>
                    <td class="T15">
                        <span class="italic upper F12">Voie</span>
                    </td>
                    <td class="T30">
                        <span>:</span>
                        <span class="bold upper">${specialAddress.voie}</span>
                    </td>
                </tr>
            </table>`
            if(specialAddress.erp && specialAddress.erp != ""){
                htmlRender += `
                            <table class="T100 F14 noMargin">
                            <tr>
                    <td class="T15">
                        <span class="italic upper F12">Pt remarq.</span>
                    </td>
                    <td class="T80">
                        <span>:</span>
                        <span class="bold upper">${specialAddress.erp}</span>
                    </td>
                </tr>
            </table>`;
            }
            if (specialAddress.etage && specialAddress.etage != ""){
                htmlRender += `
                <table class="T100 F14 noMargin">
                <tr>
                    <td class="T15">
                        <span class="italic upper F12">Etage</span>
                    </td>
                    <td class="T80">
                        <span>:</span>
                        <span class="bold upper">${specialAddress.etage}</span>
                    </td>
                </tr>
            </table>`;
            }
            if (specialAddress.batiment && specialAddress.batiment != ""){
                htmlRender += `
                <table class="T100 F14 noMargin">
                <tr>
                    <td class="T15">
                        <span class="italic upper F12">Batiment</span>
                    </td>
                    <td class="T80">
                        <span>:</span>
                        <span class="bold upper">${specialAddress.batiment}</span>
                    </td>
                </tr>
            </table>`;
            }
            htmlRender += `</div>`
            }
            htmlRender += `<div class="T100 dotted">
            <p class="bold italic underline upper center partTitle">Localisation du sinistre</p>
            <table class="T100 F14 noMargin">
                <tr>
                    <td class="T15">
                        <span class="italic upper F12">Commune</span>
                    </td>
                    <td class="T30">
                        <span>:</span>
                        <span class="bold upper">${adresses.adresseCommune.commune}</span>
                    </td>
                    <td class="T20 center">
                        <span class="upper italic F12">Livre : </span>
                        <span class="bold">${adresses.adresseCommune.livre}</span>
                    </td>
                    <td class="T30 right">
                        <span class="upper italic F12">Coordonnées : </span>
                        <span class="bold">${adresses.adresseCommune.coordonnees}</span>
                    </td>
                </tr>
                <tr>
                    <td class="T15">
                        <span class="italic upper F12">Voie</span>
                    </td>
                    <td class="T30">
                        <span>:</span>
                        <span class="bold upper">${adresses.adresseCommune.voie}</span>
                    </td>
                </tr>
            </table>
            <table class="T100 F14 noMargin">`;
            if(adresses.adresseCommune.erp && adresses.adresseCommune.erp != ""){
                htmlRender += `
                <tr>
                    <td class="T15">
                        <span class="italic upper F12">Pt remarq.</span>
                    </td>
                    <td class="T80">
                        <span>:</span>
                        <span class="bold upper">${adresses.adresseCommune.erp}</span>
                    </td>
                </tr>`;
            }
            if (adresses.adresseCommune.etage && adresses.adresseCommune.etage != ""){
                htmlRender += `
                <tr>
                    <td class="T15">
                        <span class="italic upper F12">Etage</span>
                    </td>
                    <td class="T80">
                        <span>:</span>
                        <span class="bold upper">${adresses.adresseCommune.etage}</span>
                    </td>
                </tr>
                `;
            };
            if (adresses.adresseCommune.batiment && adresses.adresseCommune.batiment != ""){
                htmlRender += `
                <tr>
                    <td class="T15">
                        <span class="italic upper F12">Batiment</span>
                    </td>
                    <td class="T80">
                        <span>:</span>
                        <span class="bold upper">${adresses.adresseCommune.batiment}</span>
                    </td>
                </tr>
                `;
            }
               htmlRender += `
                <tr>
                    <td class="T15 top">
                        <span class="italic upper F12">Observations</span>
                    </td>
                    <td class="T80 flexx">
                        <div>
                            <span>:</span>
                        </div>
                        <div class="smallMarginLeft">
                        <span class="bold upper">${observation.replace(/\n/g, "<br>")}`;
                if (engin.observationParticuliere && engin.observationParticuliere != ""){
                    htmlRender += `<br>&#42;&#42;${engin.observationParticuliere.replace(/\n/g, "<br>")}`
                }
                htmlRender += `</span>
                    </div>
                    </td>
                </tr>
            </table>            
        </div>`
            if (data.adresses.hydrants && data.adresses.hydrants.length > 0){
                if (!data.sinistre.code.startsWith("1") || (engin.gfo && !["SAP", "PSSAP", "INFAMU", "MED"].includes(engin.gfo))) {
                htmlRender += `<div class="dotted bold">
            <p class="bold italic underline center partTitle"><span class="upper">PEI</span> / colonnes incendie <span class="upper">à proximité</span></p>
        <table class="T100 F12">`
                for (const hydrant of data.adresses.hydrants){
                    htmlRender += `<tr>
                <td class="T5">
                    PEI
                </td>
                <td class="T10">
                    n° ${hydrant.numero}
                </td>
                <td class="T10 center ">
                    id_${hydrant.id}
                </td>
                <td class="T15 right">
                    situé à ${hydrant.distance} m
                </td>
                <td class="T60">
                </td>
            </tr>
            `;
                };
                htmlRender += `</table>
                </div>`;
        }};
        htmlRender += `<div class="dotted">
        <p class="bold italic underline center partTitle"><span class="upper">Armement du véhicule</span></p>
        <table class="T100 lineHeight1">
            <tr class="F10 italic left">
                <td class="T10 upper">Engin</td>
                <td class="T10 upper">Remorque</td>
                <td class="T5 upper">GFO</td>
                <td class="T5 upper">FCT</td>
                <td class="T5 upper">GRD</td>
                <td class="T30 upper">Nom</td>
                <td class="T25 upper">Matr</td>
            </tr>`;
        for (let i = 0; i < engin.affectation.length; i++){
            const agent = engin.affectation[i];
            htmlRender += `
            <tr class="F14 TNR">
                <td class="upper">${i == 0 ? agent.engin : ""}</td>
                <td class="upper">${i == 0 && engin.remorque != '' ? engin.remorque : ''}</td>
                <td class="upper">${agent.emploi.split('_')[0]}</td>
                <td class="upper">${agent.emploi.split('_')[1].toUpperCase()}</td>
                <td>${agent.grade}</td>
                <td>${agent.label.replace(`${agent.grade} `, '')}</td>
                <td>${agent.matricule}</td>
            </tr>`;
        }
        htmlRender += `</table>
    </div>`;
        htmlRender += odEngins;
        htmlRender += previousodEngins;
        htmlRender += `</section>`;
        }
        
    }
    htmlRender += htmlFooter;
    return htmlRender;
    }


module.exports = {
    getMapCoordinates,
    autoCompleteAddress,
    assignAgentsToVehicles,
    getVehiculesAndCaserne,
    generateTelex
};