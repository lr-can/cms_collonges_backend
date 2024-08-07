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

app.use(express.json());
app.use(cors());
app.use(
  express.urlencoded({
    extended: true,
  })
);

app.get("/", (req, res) => {
  res.json({ message: "ok" });
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

app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    console.error(err.message, err.stack);
    res.status(statusCode).json({ message: err.message });
    return;
  });

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});