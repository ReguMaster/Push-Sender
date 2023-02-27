/*
 *   Push Sender
 *   Copyright 2023. Seo Yong Ha All rights reserved.
 */

'use strict';

const ErrorHandler = {}

// 필수 모듈 로드
const util = require("../util");
const moment = require("moment");
const path = require("path");
const Log = require("../log");
const ServerConfig = require("./serverConfig");
const nodemailer = require("nodemailer");

ErrorHandler._formatEnvPath = function () {
    const ENV = process.env;
    const keys = Object.keys(ENV);
    const length = keys.length;
    let body = ``;

    for (let i = 0; i < length; i++) {
        let v = keys[i];

        body += `${v}: ${ENV[v]}<br />`;
    }

    return body;
}

// 메일 보고를 전송합니다.
ErrorHandler.sendMailReport = async function (err) {
    let globalConfig = ServerConfig.get("global", {});
    let mailConfig = ServerConfig.get("errorHandler", {});

    let transporter = nodemailer.createTransport({
        host: mailConfig.host,
        port: mailConfig.port,
        secure: false, // SSL 보안 사용 여부
        auth: {
            user: mailConfig.user,
            pass: mailConfig.password
        },
        tls: {
            // 해당 옵션이 필요함
            secureProtocol: "TLSv1_method",
            rejectUnauthorized: false
        }
    });

    let templateFileReadResult = await util.readFile(path.join(GLOBAL_VAR.rootPath, "src", "service", "template.html"), true, {
        encoding: "utf-8"
    });

    if (!templateFileReadResult.success)
        return;

    let htmlData = templateFileReadResult.data;

    htmlData = htmlData.replaceAll("{DATETIME}", moment()
        .format("YYYY-MM-DD A HH:mm:ss:SSS"));
    htmlData = htmlData.replaceAll("{INSTANCE_NAME}", globalConfig.NAME);
    htmlData = htmlData.replaceAll("{INSTANCE_ID}", globalConfig.UNIQUE_ID);
    htmlData = htmlData.replaceAll("{SERVER_VERSION}", globalConfig.VERSION);
    htmlData = htmlData.replaceAll("{NODE_VERSION}", process.version);

    htmlData = htmlData.replaceAll("{ERROR_MESSAGE}", err.stack);
    htmlData = htmlData.replaceAll("{ENV_VAR}", this._formatEnvPath());

    let mailOption = {
        from: '"NodeJS 오류 보고"',
        to: mailConfig.to,
        subject: `${globalConfig.NAME}(${globalConfig.UNIQUE_ID}) - 서비스 오류 보고`,
        html: htmlData,
        encoding: "utf-8",
        priority: "high"
    };

    if (mailConfig.cc && typeof (mailConfig.cc) == "string")
        mailOption.cc = mailConfig.cc;

    try {
        transporter.sendMail(mailOption);
        Log.info(Log.category.normal, "ErrorHandler", `보고 메일 전송 완료 (to: ${ mailConfig.to})`);
    } catch (exception) {
        Log.critical(Log.category.critical, "Exception", `심각한 오류!: 보고 메일 전송 실패 (exception: ${exception.stack}`)
    }
}

process.on("uncaughtException", function (exception) {
    Log.critical([Log.category.critical, Log.category.serviceException], "Exception", `심각한 오류!: 서비스 코드 예외 (exception: ${exception.stack}`)

    if (process.env.NODE_ENV === "production")
        ErrorHandler.sendMailReport(exception);
});

process.on("unhandledRejection", function (exception, promise) {
    Log.critical([Log.category.critical, Log.category.serviceException], "Exception", `심각한 오류!: 서비스 코드 예외 (exception: ${exception.stack}`)

    if (process.env.NODE_ENV === "production")
        ErrorHandler.sendMailReport(exception);
});