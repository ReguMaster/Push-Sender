/*
 *   Push Sender
 *   Copyright 2023. Seo Yong Ha All rights reserved.
 */

'use strict';

const PPROCore = {};

// 필수 모듈 로드
const Log = require("../log");
const Database = require("../database/main");
const AlertManager = require("../service/alertManager");

PPROCore._processQueue = [];
PPROCore._processQueueVars = {};

PPROCore.initialize = async function () {
    const PPROSender = require("./sender");

    PPROSender.initialize();

    const PPROMover = require("./mover");

    PPROMover.initialize();
}

PPROCore.getQueueVariable = function (IDX, key, defaultValue) {
    try {
        let dataTable = this._processQueueVars[IDX];

        if (!dataTable)
            return defaultValue;

        if (this._processQueueVars[IDX].hasOwnProperty(key))
            return this._processQueueVars[IDX][key];
        else
            return defaultValue;
    } catch (exception) {
        return defaultValue;
    }
}

PPROCore.setQueueVariable = function (IDX, key, value) {
    try {
        if (!this._processQueueVars.hasOwnProperty(IDX))
            this._processQueueVars[IDX] = {};

        Log.info(Log.category.normal, "PPROCore", `[${IDX}] VARS ${key}: -> ${value}`);

        this._processQueueVars[IDX][key] = value;
    } catch (exception) {
        Log.error(Log.category.error, "PPROCore", `오류!: 데이터 임시변수 [${IDX}] 설정 오류 (key: ${key}, value: ${value}, exception: ${exception.stack})`);
        AlertManager.alert(exception);
    }
}

PPROCore.removeQueueVariable = function (IDX) {
    this._processQueueVars[IDX] = null;
    delete this._processQueueVars[IDX];

    Log.info(Log.category.normal, "PPROCore", `[${IDX}] VARS 삭제`);
}

PPROCore.pushQueue = function (rows) {
    this._processQueue.push(...rows);
}

PPROCore.getQueue = function (filter) {
    if (filter === "BEGIN_SEND") {
        return this._processQueue.filter((v) => {
            if (v.CUR_STATE !== "INIT" && v.CUR_STATE !== "READY")
                return false;

            if (this.getQueueVariable(v.IDX, "WORKING", false))
                return false;

            return true;
        });
    }
}

PPROCore.removeFromQueue = function (IDX) {
    try {
        for (let i = this._processQueue.length - 1; i >= 0; i--) {
            let v = this._processQueue[i];

            if (v.IDX === IDX) {
                this._processQueue.splice(i, 1);
                this.removeQueueVariable(IDX);

                Log.info(Log.category.normal, "PPROCore", `[${IDX}] 데이터 삭제 (position: ${i})`);

                break;
            }
        }
    } catch (exception) {
        Log.error(Log.category.error, "PPROCore", `오류!: [${IDX}] 데이터 삭제 오류 (exception: ${exception.stack})`);
        AlertManager.alert(exception);
    }
}

PPROCore.getIndexFromQueue = function (IDX) {
    return this._processQueue.findIndex((v) => v.IDX === IDX);
}

PPROCore.updateData = async function (dataTable, setQuery) {
    try {
        let IDX = dataTable.IDX;

        let sql = `
            UPDATE TOP(1) [dbo].[Tbl_Push_Data] SET ${setQuery} WHERE IDX = '${dataTable.IDX}'
            SELECT TOP 1 * FROM [dbo].[Tbl_Push_Data] WHERE IDX = '${dataTable.IDX}'
        `;

        let {
            rows
        } = await Database.executeSQL(sql, {
            noSuccessLog: true
        });

        let dbData = rows[0];
        let index = this.getIndexFromQueue(IDX);

        let newData = {
            ...dataTable,
            ...dbData
        };

        this._processQueue[index] = newData;

        Log.info(Log.category.normal, "PPROCore", `[${IDX}] -> UPDATE ${setQuery}`);
    } catch (exception) {
        Log.error(Log.category.error, "PPROCore", `오류!: 데이터 [${IDX}] 업데이트 처리 오류 (exception: ${exception.stack})`);
        AlertManager.alert(exception);
    }
}

module.exports = PPROCore;