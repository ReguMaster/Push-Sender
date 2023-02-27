/*
 *   Push Sender
 *   Copyright 2023. Seo Yong Ha All rights reserved.
 */

'use strict';

const PPROSender = {};

// 필수 모듈 로드
const Log = require("../log");
const Database = require("../database/main");
const timer = require("../timer");
const path = require("path");
const ServerConfig = require("../service/serverConfig");
const AlertManager = require("../service/alertManager");
const PPROCore = require("./main");
const util = require("../util");
const firebaseAdmin = require("firebase-admin");

const MODULE_ID = ServerConfig.get("module/MODULE_ID");

PPROSender.vars = {
    fetchName: "PPRO-Module.Sender.Fetch",
    mainName: "PPRO-Module.Sender.Main"
};

PPROSender._RUNNING_FETCH = false;
PPROSender._RUNNING_SEND = false;
PPROSender._firebaseHandler = null;

PPROSender.initialize = function () {
    Database.EventHandler.on("online", () => {
        if (!timer.isRunning(this.vars.fetchName))
            timer.resume(this.vars.fetchName, "데이터베이스 온라인");

        if (!timer.isRunning(this.vars.mainName))
            timer.resume(this.vars.mainName, "데이터베이스 온라인");
    });

    Database.EventHandler.on("offline", () => {
        if (timer.isRunning(this.vars.fetchName))
            timer.pause(this.vars.fetchName, "데이터베이스 오프라인");

        if (timer.isRunning(this.vars.mainName))
            timer.pause(this.vars.mainName, "데이터베이스 오프라인");
    });

    firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(require(path.join(GLOBAL_VAR.rootPath, "maintenance", "firebase-certificate.json"))),
        databaseURL: ServerConfig.get("module/FIREBASE_URL")
    });

    this._firebaseHandler = firebaseAdmin.messaging();

    timer.create(this.vars.fetchName, ServerConfig.get("module/SENDER/FETCH_INTERVAL", 1000), 0, this._executeFetch.bind(this));
    timer.create(this.vars.mainName, ServerConfig.get("module/SENDER/SEND_INTERVAL", 3000), 0, this._executeSend.bind(this));
}

PPROSender._executeFetch = async function () {
    if (this._RUNNING_FETCH)
        return;

    this._RUNNING_FETCH = true;

    try {
        let {
            returnValue,
            rows
        } = await Database.executeProcedure("Proc_MODULE_Get_Init_Data",
            [{
                name: "MODULE_ID",
                type: Database.TYPES.TinyInt,
                value: MODULE_ID
            }],
            null, {
                noSuccessLog: true
            });

        if (rows.length > 0)
            PPROCore.pushQueue(rows);
    } catch (exception) {
        Log.error(Log.category.error, "PPROSender", `오류!: 프로세싱 실행 오류 (exception: ${exception.stack})`);
        AlertManager.alert(exception);
    } finally {
        this._RUNNING_FETCH = false;
    }
}

PPROSender._executeSend = async function () {
    if (this._RUNNING_SEND)
        return;

    this._RUNNING_SEND = true;

    try {
        let sendableQueue = PPROCore.getQueue("BEGIN_SEND");
        let length = sendableQueue.length;

        if (length > 0) {
            for (let i = 0; i < length; i++) {
                this._requestAPI(sendableQueue[i]);
            }
        }
    } catch (exception) {
        Log.error(Log.category.error, "PPROSender", `오류!: 프로세싱 실행 오류 (exception: ${exception.stack})`);
        AlertManager.alert(exception);
    } finally {
        this._RUNNING_SEND = false;
    }
}

PPROSender._buildFCMData = function (dataTable) {
    let data = {
        notification: {
            title: dataTable.TITLE,
            body: dataTable.BODY
        },

        data: {
            title: dataTable.TITLE,
            message: dataTable.BODY
        },

        token: dataTable.TOKEN,

        android: {
            priority: "high",
            ttl: 0,
            notification: {
                // channel_id: "import_noti",
                default_sound: true,
                default_vibrate_timings: true,
                default_light_settings: true
            }
        },

        apns: {
            headers: {
                "apns-priority": "10"
            },

            payload: {
                "aps": {
                    // "badge": 0,
                    "sound": "default"
                }
            }
        }
    };

    let extraData = {};

    if (dataTable.EXTRA_DATA) {
        extraData = util.safeParseJSON(dataTable.EXTRA_DATA, {});
    }

    return {
        ...data,
        ...extraData
    };
}

PPROSender._requestAPI = async function (dataTable) {
    let IDX = dataTable.IDX;

    if (PPROCore.getQueueVariable(IDX, "WORKING", false))
        return;

    PPROCore.setQueueVariable(IDX, "WORKING", true);

    let fcmData = this._buildFCMData(dataTable);

    await PPROCore.updateData(dataTable, `CUR_STATE = 'SENDING', SEND_DATE = GETDATE()`);

    try {
        let res = await this._firebaseHandler.send(fcmData);

        Log.info(Log.category.normal, "PPROSender", `[${IDX}] -> SUCCESS`);

        await PPROCore.updateData(dataTable, `CUR_STATE = 'DONE', RESULT_CODE = 'messaging/success'`);
    } catch (exception) {
        Log.warn(Log.category.normal, "PPROSender", `[${IDX}] -> REJECT (Firebase message: ${exception.message})`);

        await PPROCore.updateData(dataTable, `CUR_STATE = 'DONE', RESULT_CODE = '${exception.errorInfo.code}'`);
    }

    PPROCore.removeFromQueue(IDX);
}

module.exports = PPROSender;