const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
const peremptions = require("./routes/peremptions");
const peremptionsids = require("./routes/peremptionsids");
const peremptionscount = require("./routes/peremptioncount");
const materielstheoriques = require("./routes/materielstheoriques");
const create = require("./routes/createDB");
const todayCreation = require("./routes/todayCreation");
const remove = require("./routes/remove");
const dataVision = require("./routes/dataVision");
const archivePeremption = require("./routes/archivePeremption");
const getOneMonthPeremption = require("./routes/getOneMonthPeremption");
const getRealCount = require("./routes/realCount");
const emailsAdresses = require("./routes/emailsAdresses");
const retourIntervention = require("./routes/retourInter");
const getMaterielsToCheck = require("./routes/getMaterielToCheck");
const getPharmaItems = require("./routes/getPharmaItems");
const archivePharma = require("./routes/archivePharma");
const getReserveItems = require("./routes/getReserveItems");
const dispoReserve = require("./routes/dispoReserve");
const reinitialiserRetourInter = require("./routes/reinitialiseRetourIntervention");
const generatePDF = require("./routes/generatePDF");
const notif = require("./routes/insertNotification");
const interType = require("./routes/interventionType");
const getRecap = require("./routes/getRecapPDF");
const exportDataBase = require("./routes/exportDataBase");
const getDoctor = require("./routes/getDoctor");
const getAsupAgents = require("./routes/getAsupAgents");
const getMedicamentsForCare = require("./routes/getMedicamentsForCare");
const availableAsup = require("./routes/availableAsup");
const newUtilisationAsup = require("./routes/newUtilisationAsup");
const sendEmailAsup = require("./routes/sendEmailAsup");
const addDemandePeremptionAsup = require("./routes/addDemandePeremptionAsup");
const getLastDemandePeremptionAsup = require("./routes/getLastDemandePeremptionAsup");
const autoStatus = require("./routes/autoStatusPeremptionAsup");
const getAsupReplacementCount = require("./routes/getAsupReplacementCount");
const getAsupPeremptionCount = require("./routes/getPeremptionsCountAsup");
const getPeremptionsAsup = require("./routes/getPeremptionsAsup");
const getMedicaments = require("./routes/getMedicaments");
const getMedicamentsToReplace = require("./routes/getMedicamentsToReplace");
const replaceStep1 = require("./routes/replaceStep1");
const replaceStep2 = require("./routes/replaceStep2");
const getReplaceStep3 = require("./routes/getReplaceStep3");
const replaceStep3 = require("./routes/replaceStep3");
const getVizDataAsup = require("./routes/getVizDataAsup");
const asupPDF = require("./routes/generateAsupPDF");
const smartemis = require("./routes/smartemis");
const verifyIfInter = require("./routes/verifyIfInter");
const getFormationCoordinates = require("./routes/getFormationCoordinates");
const getFormationAutoSuggest = require("./routes/getFormationAutoSuggest");
const clearInterPeople = require("./routes/clearInterPeople");
const getVehiculesandPeople = require("./routes/getVehiculesandPeople");
const vehiculesAffectation = require("./routes/vehiculesAffectation");
const getVehiculesAndCaserne = require("./routes/getCaserneAndVehicules");
const generateTelex = require("./routes/generateTelex");
const getWeatherLabelForCode = require("./routes/getWeatherLabel");
const getPlanning = require("./routes/getPlanning");
const getPeremptionAndCount = require("./routes/getPeremptionAndCount");
const sendRIResults = require("./routes/sendRIResults");
const RI_checked = require("./routes/RI_checked");
const resetRICount = require("./routes/resetRICount");
const performedECG = require("./routes/performedECG");
const switchArah = require("./routes/switchArah_");
const sendParrainageData = require("./routes/sendParrainageData");
const getAllSheetsData = require("./routes/getAllSheetsData");
const allAgentsSync = require("./routes/allAgentsSync");
const nextAvailableIds = require("./routes/nextAvailableIds");
const getAuthInfo = require("./routes/getAuthInfo");
const manoeuvre = require("./routes/manoeuvre");
const inventaireVehicule = require("./routes/inventaireVehicule");
const getInventaireAsup = require("./routes/getInventaireAsup");
const inventaireRecap = require("./routes/inventaireRecap");

app.use(cors());
app.use(express.json());

// Servir les fichiers statiques avec le bon Content-Type pour le Service Worker
app.use(express.static('public', {
    setHeaders: (res, path) => {
        if (path.endsWith('service-worker.js')) {
            res.setHeader('Content-Type', 'application/javascript');
            res.setHeader('Service-Worker-Allowed', '/');
        }
    }
}));
app.use(
  express.urlencoded({
    extended: true,
  })
);

app.get('/', (req, res) => {
  res.send('API is running 🚀');
});

app.use("/peremptions", peremptions);
app.use("/peremptionsids", peremptionsids);
app.use("/peremptionscount", peremptionscount);
app.use("/materielstheoriques", materielstheoriques);
app.use("/createDB", create);
app.use("/todayCreation", todayCreation);
app.use("/remove", remove);
app.use("/dataVision", dataVision);
app.use("/archivePeremption", archivePeremption);
app.use("/getOneMonthPeremption", getOneMonthPeremption);
app.use("/getRealCount", getRealCount);
app.use("/emailsAdresses", emailsAdresses);
app.use("/retourIntervention", retourIntervention);
app.use("/getMaterielsToCheck", getMaterielsToCheck);
app.use("/getPharmaItems", getPharmaItems);
app.use("/archivePharma", archivePharma);
app.use("/getReserveItems", getReserveItems);
app.use("/dispoReserve", dispoReserve);
app.use("/reinitialiserRetourInter", reinitialiserRetourInter);
app.use("/generatePDF", generatePDF);
app.use("/getRecap", generatePDF);
app.use("/notif", notif);
app.use("/interventionType", interType);
app.use("/exportDataBase", exportDataBase);
app.use("/getDoctor", getDoctor);
app.use("/getAsupAgents", getAsupAgents);
app.use("/getMedicamentsForCare", getMedicamentsForCare);
app.use("/availableAsup", availableAsup);
app.use("/newUtilisationAsup", newUtilisationAsup);
app.use("/sendEmailAsup", sendEmailAsup);
app.use("/addDemandePeremptionAsup", addDemandePeremptionAsup);
app.use("/getLastDemandePeremptionAsup", getLastDemandePeremptionAsup);
app.use("/autoStatusAsup", autoStatus);
app.use("/getAsupReplacementCount", getAsupReplacementCount);
app.use("/getAsupPeremptionCount", getAsupPeremptionCount);
app.use("/getPeremptionsAsup", getPeremptionsAsup);
app.use("/getMedicaments", getMedicaments);
app.use("/getMedicamentsToReplace", getMedicamentsToReplace);
app.use("/replaceStep1", replaceStep1);
app.use("/replaceStep2", replaceStep2);
app.use("/getReplaceStep3", getReplaceStep3);
app.use("/replaceStep3", replaceStep3);
app.use("/getVizDataAsup", getVizDataAsup);
app.use("/asupPDF", asupPDF);
app.use("/smartemis", smartemis);
app.use("/verifyIfInter", verifyIfInter);
app.use("/getFormationCoordinates", getFormationCoordinates);
app.use("/getFormationAutoSuggest", getFormationAutoSuggest);
app.use("/clearInterPeople", clearInterPeople);
app.use("/getVehiculesandPeople", getVehiculesandPeople);
app.use("/vehiculesAffectation", vehiculesAffectation);
app.use("/getVehiculesAndCaserne", getVehiculesAndCaserne);
app.use("/generateTelex", generateTelex);
app.use("/getWeatherLabel", getWeatherLabelForCode);
app.use("/getPlanning", getPlanning);
app.use("/getPeremptionAndCount", getPeremptionAndCount);
app.use("/sendRIResults", sendRIResults);
app.use("/RI_checked", RI_checked);
app.use("/resetRICount", resetRICount);
app.use("/performedECG", performedECG);
app.use("/switchArah", switchArah);
app.use("/sendParrainageData", sendParrainageData);
app.use("/getAllSheetsData", getAllSheetsData);
app.use("/allAgentsSync", allAgentsSync);
app.use("/nextAvailableIds", nextAvailableIds);
app.use("/getAuthInfo", getAuthInfo);
app.use("/inventaireVehicule", inventaireVehicule);
app.use("/getInventaireAsup", getInventaireAsup);
app.use("/inventaireRecap", inventaireRecap);
app.use("/", manoeuvre);

// Routes pour les pages HTML
app.get('/manoeuvreAdmin', (req, res) => {
    res.sendFile(__dirname + '/public/manoeuvreAdmin.html');
});

app.get('/manoeuvreDisplay', (req, res) => {
    res.sendFile(__dirname + '/public/manoeuvreDisplay.html');
});

app.get('/manoeuvreAgent', (req, res) => {
    res.sendFile(__dirname + '/public/manoeuvreAgent.html');
});


app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    console.error(err.message, err.stack);
    res.status(statusCode).json({ message: err.message });
    return;
  });

  app.use((req, res, next) => {
    res.status(404).json({ message: 'Route not found' });
});



  app.listen(port, '0.0.0.0', () => {
      console.log(`Server is running at http://localhost:${port}`);
  });
  