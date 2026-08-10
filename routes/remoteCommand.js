const express = require("express");

const {
    getAuth
} = require("firebase-admin/auth");

const {
    getFirestore,
    FieldValue
} = require("firebase-admin/firestore");

const {
    getMessaging
} = require("firebase-admin/messaging");

const router = express.Router();


// =====================================================
// FIREBASE SERVICES
// =====================================================

const auth = getAuth();
const db = getFirestore();
const messaging = getMessaging();


// =====================================================
// REMOTE COMMAND
// =====================================================

router.post("/", async (req, res) => {

    try {

        console.log(
            "========== REMOTE COMMAND REQUEST =========="
        );


        // =================================================
        // AUTHORIZATION HEADER
        // =================================================

        const authorization =
            req.headers.authorization || "";

        if (
            !authorization.startsWith("Bearer ")
        ) {

            console.warn(
                "Remote command rejected: missing Bearer token"
            );

            return res.status(401).json({
                success: false,
                error: "Missing Firebase ID token"
            });
        }


        const idToken =
            authorization
                .substring("Bearer ".length)
                .trim();


        if (!idToken) {

            return res.status(401).json({
                success: false,
                error: "Empty Firebase ID token"
            });
        }


        // =================================================
        // VERIFY FIREBASE USER
        // =================================================

        const decodedToken =
            await auth.verifyIdToken(
                idToken
            );

        const viewerUid =
            decodedToken.uid;


        console.log(
            `Authenticated dashboard user: ${viewerUid}`
        );


        // =================================================
        // REQUEST BODY
        // =================================================

        const {
            ownerUid,
            command
        } = req.body;


        if (!ownerUid) {

            return res.status(400).json({
                success: false,
                error: "ownerUid is required"
            });
        }


        if (!command) {

            return res.status(400).json({
                success: false,
                error: "command is required"
            });
        }


        // =================================================
        // ALLOWED COMMANDS
        // =================================================

        const allowedCommands = [
            "SCAN_NOW",
            "RETRY_FAILED"
        ];


        if (
            !allowedCommands.includes(
                command
            )
        ) {

            return res.status(400).json({
                success: false,
                error:
                    `Unsupported command: ${command}`
            });
        }


        console.log(
            `Remote command: ${command}`
        );

        console.log(
            `Target owner: ${ownerUid}`
        );


        // =================================================
        // CHECK DASHBOARD AUTHORIZATION
        // =================================================

        const authorizationRef =
            db
                .collection("users")
                .doc(ownerUid)
                .collection("authorizedViewers")
                .doc(viewerUid);


        const authorizationSnapshot =
            await authorizationRef.get();


        if (
            !authorizationSnapshot.exists
        ) {

            console.warn(
                "Dashboard user is not authorized"
            );

            return res.status(403).json({
                success: false,
                error:
                    "Dashboard account is not authorized"
            });
        }


        const authorizationData =
            authorizationSnapshot.data() || {};


        /*
         * Your existing dashboard uses permissions
         * for remote access.
         *
         * We accept an explicit active=false as
         * revoked access.
         *
         * If the document does not contain "active",
         * the existing authorization document remains
         * usable.
         */

        if (
            authorizationData.active === false
        ) {

            return res.status(403).json({
                success: false,
                error:
                    "Dashboard access has been revoked"
            });
        }


        // =================================================
        // CHECK COMMAND PERMISSION
        // =================================================

        const permissions =
            authorizationData.permissions || {};


        if (
            command === "SCAN_NOW" &&
            permissions.scan === false
        ) {

            return res.status(403).json({
                success: false,
                error:
                    "Dashboard account does not have scan permission"
            });
        }


        if (
            command === "RETRY_FAILED" &&
            permissions.retry === false
        ) {

            return res.status(403).json({
                success: false,
                error:
                    "Dashboard account does not have retry permission"
            });
        }


        // =================================================
        // GET FCM TOKEN
        // =================================================

        const fcmRef =
            db
                .collection("users")
                .doc(ownerUid)
                .collection("remote")
                .doc("fcm");


        const fcmSnapshot =
            await fcmRef.get();


        if (
            !fcmSnapshot.exists
        ) {

            console.warn(
                "No FCM registration found"
            );

            return res.status(404).json({
                success: false,
                error:
                    "CallSync device has not registered an FCM token"
            });
        }


        const fcmData =
            fcmSnapshot.data() || {};


        const token =
            typeof fcmData.token === "string"
                ? fcmData.token.trim()
                : "";


        if (!token) {

            return res.status(404).json({
                success: false,
                error:
                    "CallSync FCM token is empty"
            });
        }


        // =================================================
        // FIRESTORE COMMAND
        // =================================================

        const commandRef =
            db
                .collection("users")
                .doc(ownerUid)
                .collection("remote")
                .doc("commands");


        await commandRef.set(
            {
                command: command,

                status: "pending",

                requestedBy: viewerUid,

                requestedByEmail:
                    decodedToken.email || "",

                requestedAt:
                    FieldValue.serverTimestamp(),

                fcmSent: false
            },
            {
                merge: true
            }
        );


        console.log(
            "Firestore command marked PENDING"
        );


        // =================================================
        // SEND FCM
        // =================================================

        const message = {

            token: token,

            data: {

                type:
                    "REMOTE_COMMAND",

                command:
                    command,

                ownerUid:
                    ownerUid,

                requestedBy:
                    viewerUid
            },

            android: {

                priority:
                    "high"
            }
        };


        const messageId =
            await messaging.send(
                message
            );


        console.log(
            `FCM message sent successfully: ${messageId}`
        );


        // =================================================
        // RECORD FCM DELIVERY
        // =================================================

        await commandRef.set(
            {
                fcmSent: true,

                fcmMessageId:
                    messageId,

                fcmSentAt:
                    FieldValue.serverTimestamp()
            },
            {
                merge: true
            }
        );


        console.log(
            "========== REMOTE COMMAND COMPLETE =========="
        );


        return res.status(200).json({

            success:
                true,

            command:
                command,

            messageId:
                messageId
        });


    } catch (error) {

        console.error(
            "========== REMOTE COMMAND ERROR =========="
        );

        console.error(
            error
        );


        // =================================================
        // FIREBASE AUTH ERRORS
        // =================================================

        if (
            error?.code ===
            "auth/id-token-expired"
        ) {

            return res.status(401).json({
                success: false,
                error:
                    "Firebase ID token expired"
            });
        }


        if (
            error?.code ===
                "auth/argument-error" ||
            error?.code ===
                "auth/invalid-id-token"
        ) {

            return res.status(401).json({
                success: false,
                error:
                    "Invalid Firebase ID token"
            });
        }


        // =================================================
        // INVALID FCM TOKEN
        // =================================================

        if (
            error?.code ===
            "messaging/registration-token-not-registered"
        ) {

            return res.status(410).json({
                success: false,
                error:
                    "FCM token is no longer valid. Open CallSync to register a new token."
            });
        }


        // =================================================
        // GENERAL ERROR
        // =================================================

        return res.status(500).json({

            success:
                false,

            error:
                error?.message ||
                "Remote command failed"
        });
    }
});


module.exports = router;