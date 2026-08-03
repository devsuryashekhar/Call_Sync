const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

// ========================================================
// CREDENTIAL PATHS
// ========================================================

const renderOAuth = "/etc/secrets/oauth.json";
const renderToken = "/etc/secrets/token.json";

const localOAuth = path.join(
    __dirname,
    "../credentials/oauth.json"
);

const localToken = path.join(
    __dirname,
    "../token.json"
);

const CREDENTIALS_PATH =
    fs.existsSync(renderOAuth)
        ? renderOAuth
        : localOAuth;

const TOKEN_PATH =
    fs.existsSync(renderToken)
        ? renderToken
        : localToken;


// ========================================================
// VALIDATE REQUIRED FILES
// ========================================================

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


// ========================================================
// LOAD GOOGLE OAUTH CREDENTIALS
// ========================================================

const credentials = JSON.parse(
    fs.readFileSync(
        CREDENTIALS_PATH,
        "utf8"
    )
);

const token = JSON.parse(
    fs.readFileSync(
        TOKEN_PATH,
        "utf8"
    )
);


// Supports Desktop OAuth and Web OAuth.

const oauth =
    credentials.installed ||
    credentials.web;

if (!oauth) {

    throw new Error(
        "Invalid oauth.json. 'installed' or 'web' section missing."
    );
}


// ========================================================
// CREATE OAUTH CLIENT
// ========================================================

const oauth2Client =
    new google.auth.OAuth2(
        oauth.client_id,
        oauth.client_secret,
        oauth.redirect_uris[0]
    );

oauth2Client.setCredentials(
    token
);


// ========================================================
// GOOGLE DRIVE CLIENT
// ========================================================

const drive =
    google.drive({
        version: "v3",
        auth: oauth2Client,
    });


// ========================================================
// SAFE ORIGINAL FILE NAME
// ========================================================

function getOriginalFileName(file) {

    if (
        !file ||
        !file.originalname
    ) {

        throw new Error(
            "Original recording filename is missing."
        );
    }

    /*
     * path.basename() prevents directory traversal while
     * preserving the actual filename sent by CallSync.
     *
     * Example:
     *
     * Phone:
     * Call Jhinku_260803_123235.m4a
     *
     * Drive:
     * Call Jhinku_260803_123235.m4a
     */

    const originalName =
        path.basename(
            String(file.originalname)
        );

    if (!originalName.trim()) {

        throw new Error(
            "Original recording filename is empty."
        );
    }

    return originalName;
}


// ========================================================
// DELETE TEMPORARY FILE
// ========================================================

function deleteTempFile(filePath) {

    if (!filePath) {
        return;
    }

    try {

        if (fs.existsSync(filePath)) {

            fs.unlinkSync(
                filePath
            );

            console.log(
                "Temporary upload file deleted:",
                filePath
            );
        }

    } catch (error) {

        console.error(
            "Unable to delete temporary file:",
            error.message
        );
    }
}


// ========================================================
// UPLOAD RECORDING
// ========================================================

async function uploadFile(
    file,
    meta = {}
) {

    if (!file) {

        throw new Error(
            "No recording file supplied."
        );
    }


    if (!file.path) {

        throw new Error(
            "Temporary recording path is missing."
        );
    }


    if (!fs.existsSync(file.path)) {

        throw new Error(
            `Temporary recording does not exist: ${file.path}`
        );
    }


    // ====================================================
    // PRESERVE ORIGINAL PHONE FILENAME
    // ====================================================

    const originalFileName =
    getOriginalFileName(file);

const rawCallType =
    String(meta.callType || "")
        .trim()
        .toLowerCase();

let direction = "";

if (rawCallType === "incoming") {
    direction = "Incoming";
} else if (rawCallType === "outgoing") {
    direction = "Outgoing";
} else if (rawCallType === "missed") {
    direction = "Missed";
}

const driveFileName =
    direction
        ? `${direction}_${originalFileName}`
        : originalFileName;


    console.log(
        "=================================="
    );

    console.log(
        "Uploading Recording to Google Drive"
    );

    console.log(
        "Original Phone Name :",
        file.originalname
    );

    console.log(
        "Drive File Name     :",
        driveFileName
    );

    console.log(
        "MIME Type           :",
        file.mimetype
    );

    console.log(
        "Size                :",
        file.size,
        "bytes"
    );

    console.log(
        "Temporary Path      :",
        file.path
    );

    console.log(
        "=================================="
    );


    try {

        // =================================================
        // UPLOAD ORIGINAL RECORDING BYTES
        // =================================================

        const response =
            await drive.files.create({

                requestBody: {

                    /*
                     * IMPORTANT:
                     *
                     * Do NOT generate another filename here.
                     *
                     * Google Drive receives exactly the
                     * filename CallSync sent.
                     */

                    name:
                        driveFileName,

                    parents: [
                        process.env
                            .GOOGLE_DRIVE_FOLDER_ID
                    ],
                },


                media: {

                    /*
                     * This does NOT convert or re-encode
                     * the recording.
                     *
                     * The temporary recording file is
                     * streamed directly to Google Drive.
                     */

                    mimeType:
                        file.mimetype ||
                        "application/octet-stream",

                    body:
                        fs.createReadStream(
                            file.path
                        ),
                },


                fields:
                    "id,name,size,mimeType,webViewLink",
            });


        // =================================================
        // SUCCESS
        // =================================================

        console.log(
            "=================================="
        );

        console.log(
            "✅ GOOGLE DRIVE UPLOAD SUCCESSFUL"
        );

        console.log(
            "Drive File ID   :",
            response.data.id
        );

        console.log(
            "Drive File Name :",
            response.data.name
        );

        console.log(
            "Drive File Size :",
            response.data.size ||
                "Not returned"
        );

        console.log(
            "=================================="
        );


        // =================================================
        // DELETE RENDER TEMP FILE
        // =================================================

        deleteTempFile(
            file.path
        );


        return response.data;


    } catch (error) {

        // =================================================
        // FAILURE
        // =================================================

        console.error(
            "=================================="
        );

        console.error(
            "❌ GOOGLE DRIVE UPLOAD FAILED"
        );

        console.error(
            "Original File:",
            driveFileName
        );

        console.error(
            "Error:",
            error.message
        );


        if (error.response) {

            console.error(
                "Google Response:",
                error.response.data
            );
        }


        console.error(
            "=================================="
        );


        /*
         * Don't delete the temporary file here.
         *
         * Let the route/error handling decide how a failed
         * upload should be handled.
         */

        throw error;
    }
}


// ========================================================
// EXPORTS
// ========================================================

module.exports = {
    uploadFile,
};