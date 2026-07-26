const driveService = require("../services/driveService");

exports.uploadRecording = async (req, res) => {

    console.log("\n========================================");
    console.log("📥 NEW UPLOAD REQUEST");
    console.log("========================================");

    try {

        // -------------------------------------------------
        // Validate uploaded file
        // -------------------------------------------------

        if (!req.file) {
            console.error("❌ No recording file received.");

            return res.status(400).json({
                success: false,
                message: "No recording uploaded"
            });
        }

        // -------------------------------------------------
        // Parse metadata
        // -------------------------------------------------

        let meta = {};

        try {

            if (req.body.metadata) {
                meta = JSON.parse(req.body.metadata);
            }

        } catch (e) {

            console.warn("⚠ Invalid metadata JSON.");
            console.warn(e.message);

            meta = {};
        }

        // -------------------------------------------------
        // Log upload details
        // -------------------------------------------------

        console.log("File Information");
        console.log("------------------------------");
        console.log("Original Name :", req.file.originalname);
        console.log("Mime Type     :", req.file.mimetype);
        console.log("Size          :", req.file.size, "bytes");
        console.log("Temp Path     :", req.file.path);

        console.log("\nMetadata");
        console.log("------------------------------");
        console.log(meta);

        // -------------------------------------------------
        // Upload to Google Drive
        // -------------------------------------------------

        const uploadedFile = await driveService.uploadFile(
            req.file,
            meta
        );

        console.log("\n✅ Upload Successful");
        console.log("Drive File ID   :", uploadedFile.id);
        console.log("Drive File Name :", uploadedFile.name);
        console.log("========================================\n");

        // -------------------------------------------------
        // Response
        // -------------------------------------------------

        return res.status(200).json({
            success: true,
            fileId: uploadedFile.id,
            fileName: uploadedFile.name,
            webViewLink: uploadedFile.webViewLink
        });

    } catch (err) {

        console.error("\n========================================");
        console.error("❌ Upload Failed");
        console.error("========================================");
        console.error(err);

        return res.status(500).json({
            success: false,
            error: err.message || "Unknown server error"
        });
    }
};