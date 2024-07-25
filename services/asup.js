const db = require('./db');
const helper = require('../helper');
const config = require('../config');
const fs = require('fs');
let fetch


async function getAsupAgent(matricule) {
    if (!fetch) {
        fetch = (await import('node-fetch')).default;
    };
    try {
        const agents = await fetch('https://opensheet.elk.sh/1ottTPiBjgBXSZSj8eU8jYcatvQaXLF64Ppm3qOfYbbI/agentsASUP');
        const data = await agents.json();
        
        const agent = data.find(agent => agent.matricule === matricule);
        if (!agent) {
            throw new Error('Agent non trouvé');
        }
        
        const { nomAgent, prenomAgent, grade, asup1, asup2 } = agent;
        return { nomAgent, prenomAgent, grade, asup1, asup2 };
    } catch (error) {
        console.error(error);
        throw new Error('Aucun agent ne correspond à au matricule : ' + matricule + '.');
    }
}
async function getDoctor(RPPS) {
    if (!fetch) {
        fetch = (await import('node-fetch')).default;
    };
    try {
        const doctors = await fetch('https://opensheet.elk.sh/1ottTPiBjgBXSZSj8eU8jYcatvQaXLF64Ppm3qOfYbbI/RPPS');
        const data = await doctors.json();
        
        const doctor = data.find(doctor => doctor.identifiantRPPS === RPPS);
        if (!doctor) {
            throw new Error('Médecin non trouvé');
        }
        
        const { nomExercice, prenomExercice } = doctor;
        return { nomExercice, prenomExercice };
    } catch (error) {
        console.error(error);
        throw new Error('Aucun médecin trouvé pour ce numéro RPPS : ' + RPPS);
    }
}

module.exports = { getAsupAgent, getDoctor };