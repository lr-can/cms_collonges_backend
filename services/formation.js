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
        const gfoBase = sinistre.sinistreGFOBase.split(', ');

        console.log('GFO de base:', gfoBase);

        // Trier les engins par priorité
        const enginsTries = engins.sort((a, b) => a.prioriteEngin - b.prioriteEngin);

        // Filtrer et trier les agents selon leur matricule
        const agentsDispo = agents
            .filter(agent => matricules.includes(agent.matricule))
            .sort((a, b) => a.matricule.localeCompare(b.matricule));

        console.log('Agents disponibles:', agentsDispo);

        // Initialiser les affectations et les GFO restants
        const affectations = [];
        const gfoRestants = [...gfoBase];
        const agentsNonAffectes = [...agentsDispo];

        // Fonction pour assigner un agent à un emploi
        const assignerAgent = (emploi, agentsDispo) => {
            const agent = agentsDispo.find(a => a[emploi] === '1');
            if (agent) {
                agentsDispo.splice(agentsDispo.indexOf(agent), 1);
                return agent;
            }
            return null;
        };

        // Gérer les personnalisations
        for (const perso of personnalises) {
            const agent = agentsDispo.find(a => a.matricule === perso.matricule);
            if (agent) {
                const emploi = perso.emploi;
                const engin = affectations.find(a => a.personnel && a.personnel[emploi]);
                if (engin) {
                    engin.personnel[emploi] = {
                        matricule: agent.matricule,
                        grade: agent.grade,
                        prenom: agent.prenomAgent,
                        nom: agent.nomAgent
                    };
                } else {
                    const newEngin = {
                        enginLib: '',
                        gfo: [],
                        personnel: {
                            [emploi]: {
                                matricule: agent.matricule,
                                grade: agent.grade,
                                prenom: agent.prenomAgent,
                                nom: agent.nomAgent
                            }
                        }
                    };
                    affectations.push(newEngin);
                }
                agentsDispo.splice(agentsDispo.indexOf(agent), 1);
                agentsNonAffectes.splice(agentsNonAffectes.indexOf(agent), 1);
            }
        }

        // Assigner les agents aux engins et emplois
        for (const engin of enginsTries) {
            const gfoEngin = engin.gfoEngin.split(', ');
            const personnel = {};

            for (const gfo of gfoEngin) {
                if (gfoRestants.includes(gfo)) {
                    const emplois = emploisGFO.find(e => e.GFO === gfo);
                    if (emplois) {
                        const emploisPref = emplois.emploisGFO_pref.split(', ');
                        const emploisMin = emplois.emploisGFO_min.split(', ');

                        const emploiCounts = {};

                        const getUniqueEmploiKey = (emploi) => {
                            if (!emploiCounts[emploi]) {
                                emploiCounts[emploi] = 1;
                                return emploi;
                            } else {
                                emploiCounts[emploi]++;
                                return `${emploi}${emploiCounts[emploi]}`;
                            }
                        };

                        for (const emploi of emploisPref) {
                            const uniqueEmploiKey = getUniqueEmploiKey(emploi);
                            if (!personnel[uniqueEmploiKey]) {
                                const agent = assignerAgent(emploi, agentsDispo);
                                if (agent) {
                                    personnel[uniqueEmploiKey] = {
                                        matricule: agent.matricule,
                                        grade: agent.grade,
                                        prenom: agent.prenomAgent,
                                        nom: agent.nomAgent
                                    };
                                    agentsNonAffectes.splice(agentsNonAffectes.indexOf(agent), 1);
                                }
                            }
                        }

                        for (const emploi of emploisMin) {
                            const uniqueEmploiKey = getUniqueEmploiKey(emploi);
                            if (!personnel[uniqueEmploiKey]) {
                                const agent = assignerAgent(emploi, agentsDispo);
                                if (agent) {
                                    personnel[uniqueEmploiKey] = {
                                        matricule: agent.matricule,
                                        grade: agent.grade,
                                        prenom: agent.prenomAgent,
                                        nom: agent.nomAgent
                                    };
                                    agentsNonAffectes.splice(agentsNonAffectes.indexOf(agent), 1);
                                }
                            }
                        }

                        gfoRestants.splice(gfoRestants.indexOf(gfo), 1);
                    }
                }
            }

            if (Object.keys(personnel).length > 0) {
                affectations.push({
                    enginLib: engin.libEngin,
                    gfo: gfoEngin,
                    personnel
                });
            }
        }

        console.log('Affectations finales:', affectations);
        console.log('GFO restants:', gfoRestants);
        console.log('Agents non affectés:', agentsNonAffectes);

        return { affectations, gfoRestants, agentsNonAffectes };
    } catch (error) {
        console.error('Erreur lors de l\'assignation des agents aux véhicules:', error);
        return { affectations: [], gfoRestants: [], agentsNonAffectes: [] };
    }
}
async function assignAgentsToVehicles(matricules, codeSinistre, personnalises = {}) {
    // Cette fonction assigne les agents aux véhicules en fonction du code sinistre et des personnalisations
    // matricules: tableau des matricules des agents disponibles
    // codeSinistre: code du sinistre
    // personnalises: tableau des personnalisations des agents 
    //     (chaque personnalisation contient les propriétés suivantes: matricule, emploi, engin)
    /* assignAgentsToVehicles(
  ['V06175', 'V01049', 'V16673', 'V33393', 'V30001', 'V26371'],
  '1130',
  {
    agents: [
      { matricule: 'V01049', emploi: 'SAP_SAP_ca', engin: 'VSAV-1' },
      { matricule: 'V26371', emploi: 'SAP_SAP_eqc', engin: 'VSAV-1' },
    ],
    gfo_additionnel: ['INFAMU'],
    gfo_soustraction: [],
  }
);
    */
async function assignAgentsToVehicles(matricules, codeSinistre, personnalises = {}) {
  if (!fetch) {
      fetch = (await import('node-fetch')).default;
  }
  try {
      const [sinistres, engins, emploisGFO, agents] = await Promise.all([
          fetch(
              'https://opensheet.elk.sh/13y-17sHUSenIoehILJMzuJcpqnRG2CVX9RvDzvaa448/libelleSinistres'
          ).then(res => res.json()).catch(err => { throw new Error('Erreur de connexion pour libelleSinistres: ' + err.message); }),
          fetch(
              'https://opensheet.elk.sh/13y-17sHUSenIoehILJMzuJcpqnRG2CVX9RvDzvaa448/GFO_COLLONGES'
          ).then(res => res.json()).catch(err => { throw new Error('Erreur de connexion pour GFO_COLLONGES: ' + err.message); }),
          fetch(
              'https://opensheet.elk.sh/13y-17sHUSenIoehILJMzuJcpqnRG2CVX9RvDzvaa448/GFO_EMPLOIS'
          ).then(res => res.json()).catch(err => { throw new Error('Erreur de connexion pour GFO_EMPLOIS: ' + err.message); }),
          fetch(
              'https://opensheet.elk.sh/1ottTPiBjgBXSZSj8eU8jYcatvQaXLF64Ppm3qOfYbbI/agentsAsup'
          ).then(res => res.json()).catch(err => { throw new Error('Erreur de connexion pour agentsAsup: ' + err.message); }),
      ]);

      const sinistre = sinistres.find(s => s.sinistreCode === codeSinistre);
      if (!sinistre) {
          console.error('Code sinistre non trouvé:', codeSinistre);
          throw new Error('Code sinistre non trouvé');
      }

      const gfoBase = sinistre.sinistreGFOBase.split(', ');
      const gfoComplets = [
          ...gfoBase,
          ...(personnalises.gfo_additionnel || []),
      ].filter(gfo => !(personnalises.gfo_soustraction || []).includes(gfo));

      const agentsDispo = agents
          .filter(agent => matricules.includes(agent.matricule))
          .sort((a, b) => a.matricule.localeCompare(b.matricule))
          .reverse();

      const affectations = [];
      const gfoRestants = [...gfoComplets];
      const agentsNonAffectes = [...agentsDispo];

      // Ajouter les agents personnalisés, même sans emploi
      personnalises.agents?.forEach(agentPerso => {
          const agent = {
              matricule: agentPerso.matricule,
              emploi: agentPerso.emploi,
              engin: agentPerso.engin,
          };
          agentsDispo.push(agent);
      });

      const assignerAgent = (emploi, agentsDispo) => {
          const agent = agentsDispo.find(a => a[emploi.replace(/\d/, '')] === '1');
          if (agent) {
              agentsDispo.splice(agentsDispo.indexOf(agent), 1);
              return agent;
          }
          return null;
      };

      const assignerAgentsAuxEngins = (gfo, engin, personnel) => {
          const emplois = emploisGFO.find(e => e.GFO === gfo);
          if (emplois) {
              const emploisPref = emplois.emploisGFO_pref
                  .split(', ')
                  .map(emploi => `${gfo}_${emploi}`);
              const emploisMin = emplois.emploisGFO_min
                  .split(', ')
                  .map(emploi => `${gfo}_${emploi}`);

              for (const emploi of emploisPref.concat(emploisMin)) {
                  if (!personnel[emploi]) {
                      const agent = assignerAgent(
                          emploi.replace(`${gfo}_`, ''),
                          agentsDispo
                      );
                      if (agent) {
                          personnel[emploi] = {
                              matricule: agent.matricule,
                              grade: agent.grade,
                              prenom: agent.prenomAgent,
                              nom: agent.nomAgent,
                          };
                          agentsNonAffectes.splice(agentsNonAffectes.indexOf(agent), 1);
                      }
                  }
              }
          }
      };

      const obtenirPrioritePourGFO = (gfo, engin) => {
          const prioriteGfo = `priorite_GFO_${gfo}`;
          return parseInt(engin[prioriteGfo]) || Infinity;
      };

      // Forcer l'affectation des agents personnalisés, même sans emploi
      personnalises.agents?.forEach(agentPerso => {
          const engin = affectations.find(a => a.enginLib === agentPerso.engin);
          if (!engin) {
              const nouveauEngin = {
                  enginLib: agentPerso.engin,
                  gfo: [],
                  personnel: {},
              };
              nouveauEngin.personnel[`${agentPerso.emploi}`] = {
                  matricule: agentPerso.matricule,
                  grade: agents.find(a => a.matricule === agentPerso.matricule).grade,
                  prenom: agents.find(a => a.matricule === agentPerso.matricule).prenomAgent,
                  nom: agents.find(a => a.matricule === agentPerso.matricule).nomAgent,
              };
              affectations.push(nouveauEngin);
          } else {
              engin.personnel[`${agentPerso.emploi}`] = {
                  matricule: agentPerso.matricule,
                  grade: agents.find(a => a.matricule === agentPerso.matricule).grade,
                  prenom: agents.find(a => a.matricule === agentPerso.matricule).prenomAgent,
                  nom: agents.find(a => a.matricule === agentPerso.matricule).nomAgent,
              };
          }
          agentsDispo.splice(agentsDispo.findIndex(a => a.matricule === agentPerso.matricule), 1);
          agentsNonAffectes.splice(agentsNonAffectes.findIndex(a => a.matricule === agentPerso.matricule), 1);
      });

      for (const gfo of gfoComplets) {
          const enginsPourGFO = engins
              .filter(
                  engin =>
                      engin[`priorite_GFO_${gfo}`] && engin[`priorite_GFO_${gfo}`] !== '0'
              )
              .sort(
                  (a, b) =>
                      obtenirPrioritePourGFO(gfo, a) - obtenirPrioritePourGFO(gfo, b)
              );

          // Utiliser un engin non encore utilisé pour chaque nouveau GFO
          const enginLibNonUtilise = enginsPourGFO.find(
              engin => !affectations.some(a => a.enginLib === engin.libEngin)
          );

          if (enginLibNonUtilise) {
              const enginLePlusComplet = {
                  enginLib: enginLibNonUtilise.libEngin,
                  gfo: [gfo],
                  personnel: {},
              };
              affectations.push(enginLePlusComplet);

              assignerAgentsAuxEngins(
                  gfo,
                  enginLibNonUtilise,
                  enginLePlusComplet.personnel
              );
          }
      }

      console.log('Affectations finales:', affectations);
      console.log('GFO restants:', gfoRestants);
      console.log('Agents non affectés:', agentsNonAffectes);

      return { affectations, gfoRestants, agentsNonAffectes };
  } catch (error) {
      console.error(
          "Erreur lors de l'assignation des agents aux véhicules:",
          error.message
      );
      return { affectations: [], gfoRestants: [], agentsNonAffectes: [] };
  }
}
}

module.exports = {
    getMapCoordinates,
    autoCompleteAddress,
    assignAgentsToVehicles
};