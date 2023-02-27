/*
 *   Push Sender
 *   Copyright 2023. Seo Yong Ha All rights reserved.
 */

'use strict';

const Log = {};

// 필수 모듈 로드
const chalk = require( "chalk" );
const moment = require( "moment" );
const path = require( "path" );
// const fileStreamRotator = require( "file-stream-rotator" );
const fileStreamRotator = require( "./external/FileStreamRotator" );

Log.vars = {
    location: path.join( GLOBAL_VAR.rootPath, "maintenance", "serverlog" )
};

Log._logStream = {};

// 로그 타입 상수 선언
Log.level = {
    info: 0,
    important: 1,
    warning: 2,
    error: 3,
    critical: 4
};

Log.category = {
    normal: 0,
    database: 1,
    error: 2,
    critical: 3,
    serviceException: 4,
    push: 5
};

// 로그 함수 시작
Log.info = function( category, type, message )
{
    this._print( category, this.level.info, type, message );
}

Log.important = function( category, type, message )
{
    this._print( category, this.level.important, type, message );
}

Log.warn = function( category, type, message )
{
    this.warning( category, type, message );
}

Log.warning = function( category, type, message )
{
    this._print( category, this.level.warning, type, message );
}

Log.error = function( category, type, message )
{
    this._print( category, this.level.error, type, message );
}

Log.critical = function( category, type, message )
{
    this._print( category, this.level.critical, type, message );
}
// 로그 함수 끝

// 로그 시스템 초기화
Log.initialize = function( )
{
    this._logStream[ "ALL" ] = fileStreamRotator.getStream(
    {
        filename: ( ) => path.join( this.vars.location, moment( )
            .format( "YYYY-MM-DD" ), `ServerLog-ALL` ),
        frequency: "daily", // 1일 단위로 로테이션
        verbose: false,
        size: "10M",
        extension: ".log",
        watch_log: true
    } );

    Object.keys( this.category )
        .forEach( ( v, i ) =>
        {
            this._logStream[ v ] = fileStreamRotator.getStream(
            {
                filename: ( ) => path.join( this.vars.location, moment( )
                    .format( "YYYY-MM-DD" ), `ServerLog-${ v }` ),
                frequency: "daily", // 1일 단위로 로테이션
                verbose: false,
                size: "10M",
                extension: ".log",
                watch_log: true
            } );
        } );
}

// *Private: 로그 파일에 작성
Log._writeFile = function( category, body )
{
    try
    {
        this._logStream[ "ALL" ].write( body + GLOBAL_VAR.newLine );

        if ( Array.isArray( category ) )
        {
            for ( let i = 0; i < category.length; i++ )
            {
                let key = Object.keys( this.category )[ category[ i ] ];

                if ( this._logStream.hasOwnProperty( key ) )
                    this._logStream[ key ].write( body + GLOBAL_VAR.newLine );
            }
        }
        else
        {
            let key = Object.keys( this.category )[ category ];

            if ( this._logStream.hasOwnProperty( key ) )
                this._logStream[ key ].write( body + GLOBAL_VAR.newLine );
        }
    }
    catch ( exception )
    {

    }
}

// 기존 콘솔 출력 함수 백업
const console_Log = console.log.bind( console );

// *Private: 로그 출력 처리
// production 환경일 경우 console 로그 출력 비활성
if ( process.env.NODE_ENV === "production" )
{
    console.log = function( ) {}

    Log._print = function( category, level, type, message )
    {
        let bodyForLogFile = `[${ moment( ).format( "HH:mm:ss:SSS" ) }] `;

        switch ( level )
        {
            case this.level.info:
                bodyForLogFile += `[     INFO     ]:::${ type } ${ message }`;

                break;
            case this.level.important:
                bodyForLogFile += `[     IMPO     ]:::${ type } ${ message }`;

                break;
            case this.level.warning:
                bodyForLogFile += `[     WARN     ]:::${ type } ${ message }`;

                break;
            case this.level.error:
                bodyForLogFile += `[     ERRR     ]:::${ type } ${ message }`;

                break;
            case this.level.critical:
                bodyForLogFile += `[     CRIT     ]:::${ type } ${ message }`;

                break;
        }

        this._writeFile( category, bodyForLogFile );
    }
}
else
{
    // console.log = function( ...args )
    // {
    //     Log._print( Log.category.normal, Log.level.info, "*NATIVE*", ...args );
    // }

    Log._print = function( category, level, type, message )
    {
        let body = `${ chalk.bold.bgCyan( `[${ moment( ).format( "HH:mm:ss:SSSS" ) }]` ) } `;
        let bodyForLogFile = `[${ moment( ).format( "HH:mm:ss:SSSS" ) }] `;

        switch ( level )
        {
            case this.level.info:
                body += `${ chalk.bold.white( `[     INFO     ]:::${ type }` ) } ${ chalk.grey( message ) }`;
                bodyForLogFile += `[     INFO     ]:::${ type } ${ message }`;

                break;
            case this.level.important:
                body += `${ chalk.white.bold.bgGray( `[     IMPO     ]:::${ type } ${ message }` ) }`;
                bodyForLogFile += `[     IMPO     ]:::${ type } ${ message }`;

                break;
            case this.level.warning:
                body += `${ chalk.white.bold.bgYellow( `[     WARN     ]:::${ type } ${ message }` ) }`;
                bodyForLogFile += `[     WARN     ]:::${ type } ${ message }`;

                break;
            case this.level.error:
                body += `${ chalk.white.bold.bgRed( `[     ERRR     ]:::${ type } ${ message }` ) }`;
                bodyForLogFile += `[     ERRR     ]:::${ type } ${ message }`;

                break;
            case this.level.critical:
                body += `${ chalk.white.bold.bgRedBright( `[     CRIT     ]:::${ type } ${ message }` ) }`;
                bodyForLogFile += `[     CRIT     ]:::${ type } ${ message }`;

                break;
        }

        console_Log( body );

        this._writeFile( category, bodyForLogFile );
    }
}

module.exports = Log;