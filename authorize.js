const fs = require("fs");
const path = require("path");

const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");

const SCOPES = [
    "https://www.googleapis.com/auth/drive.file"
];

const CREDENTIALS_PATH = path.join(
    __dirname,
    "credentials",
    "oauth.json"
);

async function authorize() {

    const client = await authenticate({
        scopes: SCOPES,
        keyfilePath: CREDENTIALS_PATH
    });

    const tokenPath = path.join(__dirname, "token.json");

    fs.writeFileSync(
        tokenPath,
        JSON.stringify(client.credentials, null, 2)
    );

    console.log("=================================");
    console.log("Authentication Successful!");
    console.log("token.json created.");
    console.log("=================================");
}

authorize().catch(console.error);