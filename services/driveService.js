const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const TOKEN_PATH = path.join(__dirname, "../token.json");
const CREDENTIALS_PATH = path.join(__dirname, "../credentials/oauth.json");

const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
const token = JSON.parse(fs.readFileSync(TOKEN_PATH));

const { client_secret, client_id } = credentials.installed;

const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    "http://localhost"
);

oauth2Client.setCredentials(token);

const drive = google.drive({
    version: "v3",
    auth: oauth2Client
});

exports.uploadFile = async (file) => {

    try {

        console.log("Uploading:", file.originalname);

        const response = await drive.files.create({

            requestBody: {
                name: file.originalname,
                parents: [process.env.GOOGLE_DRIVE_FOLDER_ID]
            },

            media: {
                mimeType: file.mimetype,
                body: fs.createReadStream(file.path)
            }

        });

        console.log("✅ Upload Successful");
        console.log("Google File ID:", response.data.id);

        fs.unlinkSync(file.path);

        return response.data.id;

    } catch (err) {

        console.error("UPLOAD FAILED");
        console.error(err);

        throw err;
    }
};