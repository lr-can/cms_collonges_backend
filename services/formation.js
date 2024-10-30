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
async function assignAgentsToVehicles(matricules, gfos) {
    if (!fetch) {
        fetch = (await import('node-fetch')).default;
    }
    try {
        // 1. Fetch des agents
        const agentsResponse = await fetch('https://opensheet.elk.sh/1ottTPiBjgBXSZSj8eU8jYcatvQaXLF64Ppm3qOfYbbI/agentsASUP');
        const agentsData = await agentsResponse.json();

        // Filtrer les agents par matricules donnés
        const filteredAgents = agentsData.filter(agent => matricules.includes(agent.matricule));

        // 2. Fetch des véhicules et GFO associés
        const vehiclesResponse = await fetch('https://opensheet.elk.sh/13y-17sHUSenIoehILJMzuJcpqnRG2CVX9RvDzvaa448/GFO_COLLONGES');
        const vehiclesData = await vehiclesResponse.json();

        // 3. Fetch des emplois préférés et minimums pour chaque GFO
        const gfoResponse = await fetch('https://opensheet.elk.sh/13y-17sHUSenIoehILJMzuJcpqnRG2CVX9RvDzvaa448/GFO_EMPLOIS');
        const gfoData = await gfoResponse.json();

        // Créer un mapping des GFO pour retrouver les emplois min et préférés rapidement
        const gfoMapping = {};
        gfoData.forEach(gfo => {
            gfoMapping[gfo.GFO] = {
                emploisMin: gfo.emploisGFO_min.split(', '),
                emploisPref: gfo.emploisGFO_pref.split(', ')
            };
        });

        // 4. Créer un dictionnaire structuré pour les affectations
        const assignments = {};

        vehiclesData.forEach((vehicle, index) => {
            const vehicleGFOs = vehicle.gfoEngin.split(', ');
            const emploisAssignments = {};

            vehicleGFOs.forEach(gfo => {
                if (gfos.includes(gfo)) {
                    const { emploisMin, emploisPref } = gfoMapping[gfo];

                    // Chercher les agents ayant les emplois minimums et préférés pour ce GFO
                    const eligibleAgents = filteredAgents.filter(agent => {
                        const hasMinEmploi = emploisMin.some(emploi => agent[emploi] === "1");
                        const hasPrefEmploi = emploisPref.some(emploi => agent[emploi] === "1");
                        return hasMinEmploi || hasPrefEmploi;
                    });

                    // Assigner les emplois aux agents
                    emploisMin.concat(emploisPref).forEach(emploi => {
                        const agent = eligibleAgents.find(agent => agent[emploi] === "1");
                        if (agent && !Object.values(emploisAssignments).includes(agent)) {
                            emploisAssignments[emploi] = {
                                grade: agent.grade,
                                emploi: emploi,
                                agent: {
                                    nom: agent.nom,
                                    prenom: agent.prenom,
                                    matricule: agent.matricule
                                }
                            };
                        }
                    });
                }
            });

            // Ajouter la structure de chaque engin
            assignments[`engin_${index + 1}`] = {
                nom_engin: vehicle.libEngin,
                gfo: vehicle.gfoEngin,
                emplois: emploisAssignments
            };
        });

        return assignments;
    } catch (error) {
        console.error("Erreur lors de l'attribution des agents :", error);
        return {};
    }
}


module.exports = {
    getMapCoordinates,
    autoCompleteAddress,
    assignAgentsToVehicles
};