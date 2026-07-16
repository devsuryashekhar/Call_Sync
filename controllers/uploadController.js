const driveService = require("../services/driveService");

exports.uploadRecording = async (req, res) => {

    console.log("========== REQUEST ==========");
    console.log("Headers:", req.headers);
    console.log("Body:", req.body);
    console.log("File:", req.file);

    try {

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No recording uploaded"
            });
        }

        const fileId = await driveService.uploadFile(req.file);

        res.json({
            success: true,
            fileId
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

};