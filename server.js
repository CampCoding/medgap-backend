require("dotenv").config();
console.log(process.env.PG_USER)
const express = require("express");
const app = express();
const port = 3120;
const client = require("./config/db-connect").client; 
const bodyParser = require("body-parser");
const cors = require("cors");
app.use(bodyParser.json());
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200,
    preflightContinue: false
  })
);




const publicRouter = require("./routes/public");
app.use("/api/admin/public/", publicRouter);
app.use("/", publicRouter);


const adminRoles = require("./routes/admin-copy/admins/roles/index");
app.use("/api/admin/users/roles/", adminRoles);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
