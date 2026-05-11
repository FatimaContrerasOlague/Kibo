require("dotenv").config();

const { app } = require("./app");
const { port } = require("./config/env");

app.listen(port, () => {
  console.log(`Kibo backend listo en http://localhost:${port}`);
});
