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

app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    console.error(err.message, err.stack);
    res.status(statusCode).json({ message: err.message });
    return;
  });

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});