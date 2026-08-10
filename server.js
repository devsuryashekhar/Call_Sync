require("dotenv").config();

const express = require("express");
const cors = require("cors");

const {
    getApps,
    initializeApp,
    cert
} = require("firebase-admin/app");


// =====================================================
// FIREBASE ADMIN INITIALIZATION
// =====================================================

const serviceAccount =
    require("./firebase-service-account.json");


const firebaseApp =
    getApps().length === 0
        ? initializeApp({
            credential: cert(serviceAccount)
        })
        : getApps()[0];


console.log(
    "Firebase Admin initialized:",
    firebaseApp.name
);


// =====================================================
// EXPRESS
// =====================================================

const app = express();

app.use(cors());

app.use(
    express.json()
);


// =====================================================
// HEALTH CHECK
// =====================================================

app.get(
    "/",
    (req, res) => {

        res.send(
            "CallSync Backend is Running ✅"
        );

    }
);


// =====================================================
// ROUTES
// =====================================================

const uploadRoute =
    require("./routes/upload");


const remoteCommandRoute =
    require("./routes/remoteCommand");


app.use(
    "/upload",
    uploadRoute
);


app.use(
    "/remote/command",
    remoteCommandRoute
);


// =====================================================
// SERVER
// =====================================================

const PORT =
    process.env.PORT || 3000;


app.listen(
    PORT,
    () => {

        console.log(
            `CallSync Backend running on port ${PORT}`
        );

        console.log(
            `Upload endpoint: /upload`
        );

        console.log(
            `Remote command endpoint: /remote/command`
        );

    }
);