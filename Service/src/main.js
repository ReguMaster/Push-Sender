/*
 *   Push Sender
 *   Copyright 2023. Seo Yong Ha All rights reserved.
 */

'use strict';

// 필수 모듈 로드
const moment = require( "moment" );

async function Init( )
{
    let Log;

    try
    {
        // 시작

        moment.locale( "ko" );

        // 전역 변수 로드
        require( "./globalvar" );

        // util 로드
        require( "./util" );

        // Log
        Log = require( "./log" );
        Log.initialize( );
        Log.info( Log.category.normal, "Main", "Log ---------- 완료" );

        // ServerConfig
        const ServerConfig = require( "./service/serverConfig" );
        await ServerConfig.initialize( );

        let globalConfig = ServerConfig.get( "global" );
        process.title = `${globalConfig.NAME} (${ globalConfig.UNIQUE_ID }) V${ globalConfig.VERSION } (Booted at ${ moment().format("YYYY-MM-DD HH:mm:ss") })`;

        Log.info( Log.category.normal, "Main", "ServerConfig ---------- 완료" );

        // Database
        const Database = require( "./database/main" );
        await Database.initialize( );

        Log.info( Log.category.normal, "Main", "Database ---------- 완료" );

        // PPROCore
        const PPROCore = require( "./core/main" );
        await PPROCore.initialize( );

        Log.info( Log.category.normal, "Main", "PPRO Core ---------- 완료" );

        // ErrorHandler
        require( "./service/errorHandler" );
        Log.info( Log.category.normal, "Main", "ErrorHandler ---------- 완료" );

        // Done
        Log.info( Log.category.normal, "Main", "Main ---------- 완료" );
    }
    catch ( exception )
    {
        Log.critical( [ Log.category.critical, Log.category.serviceException ], "Main", `심각한 오류!: 서비스 부팅 중 오류 발생 (exception: ${exception.stack})` );
    }
}

Init( );