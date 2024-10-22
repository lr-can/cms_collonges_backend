const db = require('./db');
const helper = require('../helper');
const config = require('../config');
const { google } = require('googleapis');
const fs = require('fs');
const pdf = require('html-pdf');
const turf = require('@turf/turf');
let fetch

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
    return {est: true, data:getClosestFeature(firstPart, point)};
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
    return closestFeature;
}

async function getMapCoordinates(lon, lat) {
    const firstPart = await getFirstPartGeoJson(lon, lat);
    const firstPartString = firstPart.est ? "est. " + firstPart.data.properties.assigned_data : firstPart.properties.assigned_data;
    const secondPart = await getSecondPartGeoJson(lon, lat);
    const secondPartString = secondPart.properties.assigned_data;
    return { coordinates: { lon, lat }, mapCoordinates: `${firstPartString} ${secondPartString}` };
}

module.exports = {
    getMapCoordinates
};