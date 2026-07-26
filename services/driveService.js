const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

// ============================
// Credential Paths
// ============================

const renderOAuth = "/etc/secrets/oauth.json";
const renderToken = "/etc/secrets/token.json";

const localOAuth = path.join(__dirname, "../credentials/oauth.json");
const localToken = path.join(__dirname, "../token.json");

const CREDENTIALS_PATH = fs.existsSync(renderOAuth)
    ? renderOAuth
    : localOAuth;

const TOKEN_PATH = fs.existsSync(renderToken)
    ? renderToken
    : localToken;

// ============================
// Check Required Files
// ============================

if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(
        `OAuth credentials not found.\nExpected at:\n${CREDENTIALS_PATH}`
    );
}

if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error(
        `Token file not found.\nExpected at:\n${TOKEN_PATH}`
    );
}

// ============================
// Read Credentials
// ============================

const credentials = JSON.parse(
    fs.readFileSync(CREDENTIALS_PATH, "utf8")
);

const token = JSON.parse(
    fs.readFileSync(TOKEN_PATH, "utf8")
);

// Supports both Desktop OAuth and Web OAuth

const oauth =
    credentials.installed || credentials.web;

if (!oauth) {
    throw new Error(
        "Invalid oauth.json. 'installed' or 'web' section missing."
    );
}

const oauth2Client = new google.auth.OAuth2(
    oauth.client_id,
    oauth.client_secret,
    oauth.redirect_uris[0]
);

oauth2Client.setCredentials(token);

// ============================
// Google Drive Client
// ============================

const drive = google.drive({
    version: "v3",
    auth: oauth2Client,
});

// ============================
// Upload Function
// ============================

async function uploadFile(file, meta = {}) {

    try {

        console.log("==================================");
        console.log("Uploading File to Google Drive");
        console.log("Name :", file.originalname);
        console.log("Path :", file.path);
        console.log("==================================");


        const sanitize = (text) =>
            String(text || "")
                .replace(/[\\/:*?"<>|]/g, "_")
                .trim();
        
        const contact =
            sanitize(meta.contactName) ||
            sanitize(meta.phoneNumber) ||
            "Unknown";
        
        const callType =
            sanitize(meta.callType) || "Unknown";
        
        const callDate =
            sanitize(meta.callDate) || "UnknownDate";
        
        const callTime =
            sanitize(meta.callTime) || "UnknownTime";
        
        const duration =
            sanitize(meta.duration) || "00m00s";
        
        const extension =
            path.extname(file.originalname) || ".mp3";
        
        const driveFileName =
        `${callType}_${contact}_${callDate}_${callTime}_${duration}${extension}`;

        const response = await drive.files.create({

            requestBody: {
                name: driveFileName,
                parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
            },

            media: {
                mimeType: file.mimetype,
                body: fs.createReadStream(file.path),
            },

            fields: "id,name,webViewLink",
        });

        console.log("✅ Upload Successful");
        console.log("File ID :", response.data.id);

        if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }

        return response.data;

    } catch (err) {

        console.error("==================================");
        console.error("GOOGLE DRIVE UPLOAD FAILED");
        console.error(err.message);

        if (err.response) {
            console.error(err.response.data);
        }

        console.error("==================================");

        throw err;
    }
}

module.exports = {
    uploadFile,
};