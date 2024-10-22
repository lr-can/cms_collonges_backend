const fs = require('fs');
const turf = require('@turf/turf');

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

async function getMapCoordinates(lon, lat) {
    const firstPart = await getFirstPartGeoJson(lon, lat);
    const firstPartString = firstPart && firstPart.est ? "est. " + (firstPart.data && firstPart.data.properties ? firstPart.data.properties.assigned_data : '') : firstPart && firstPart.properties ? firstPart.properties.assigned_data : '';
    const secondPart = await getSecondPartGeoJson(lon, lat);
    const secondPartString = secondPart && secondPart.properties ? secondPart.properties.assigned_data : '';
    return { coordinates: { lon, lat }, mapCoordinates: `${firstPartString} ${secondPartString}`.replace("est.  ", "inconnu") };
}

module.exports = {
    getMapCoordinates
};