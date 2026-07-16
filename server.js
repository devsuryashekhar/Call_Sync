require("dotenv").config();

const express = require("express");
const cors = require("cors");

const uploadRoute = require("./routes/upload");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("CallSync Backend is Running ✅");
});

app.use("/upload", uploadRoute);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});