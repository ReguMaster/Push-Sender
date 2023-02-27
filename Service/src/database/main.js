/*
 *   Push Sender
 *   Copyright 2023. Seo Yong Ha All rights reserved.
 */

'use strict';

const Database = {};

// 필수 모듈 로드
const tedious = require( "tedious" );
const timer = require( "../timer" );
const uniqid = require( "uniqid" );
const Log = require( "../log" );
const util = require( "../util" );
const ServerConfig = require( "../service/serverConfig" );
const event = require( "events" );
const path = require( "path" );

Database.EventHandler = new event.EventEmitter( );

Database.TYPES = tedious.TYPES;

Database.REQUEST_TYPE = {
    PROCEDURE: 1,
    SQL: 2
};

Database._isConnected = false;
Database._isConnecting = false;
Database._connectionObj = null;
Database._connectionInfo = null;
Database._queueProcessing = false;
Database._lastQueueProcess = Date.now( );

// 설정 값 상수 선언
Database.vars = {
    queueProcessorTimerName: `Database-queueProcessor`,
    queueProcessorHibernateTimerName: "Database-queueProcessor-HIBERNATE"
};

// 큐 변경 이벤트 핸들러 등록
Database._requestQueue = new Proxy(
{},
{
    set: function( obj, prop, value )
    {
        if ( !timer.isRunning( Database.vars.queueProcessorTimerName ) )
            timer.resume( Database.vars.queueProcessorTimerName );

        obj[ prop ] = value;

        return true;
    }
} );

// 데이터베이스 초기화
Database.initialize = function( )
{
    return new Promise( async ( resolve, reject ) =>
    {
        let config = ServerConfig.get( "database", null );

        if ( !config )
        {
            Log.warn( Log.category.database, "Database", `경고!: 연결 정보 없음` );
            reject( new Error( "연결 정보 없음" ) );
            return;
        }

        this._isConnecting = true;
        this._connectionInfo = config;

        let _obj = new tedious.Connection(
        {
            server: config.host,

            authentication:
            {
                type: "default",
                options:
                {
                    userName: config.user,
                    password: config.password
                }
            },
            options:
            {
                appName: "NodeJS Tedious",
                requestTimeout: config.vars.requestTimeout || 15000,
                connectTimeout: config.vars.connectTimeout || 5000,
                database: config.database,
                port: config.port,
                encrypt: false,
                useUTC: false
            }
        } );


        Log.info( Log.category.database, "Database", `연결 정보 (host: ${config.host}:${config.port}, user: ${config.user}, password: ${"*".repeat(config.password.length)}, database: ${config.database})` );
        Log.info( Log.category.database, "Database", `연결 중 ...` );

        _obj.connect( );

        this._registerEventHandler( _obj, false, resolve );

        // try
        // {

        // }
        // catch ( exception )
        // {
        //     reject( exception );
        //     return;
        // }

        this._initializeQueueProcessor( );

        this._connectionObj = _obj;
    } );
}

// 데이터베이스 재 연결
Database.reconnect = function( )
{
    this._isConnecting = true;

    if ( this._connectionObj )
        this._connectionObj = null;

    let config = this._connectionInfo;

    let _obj = new tedious.Connection(
    {
        server: config.host,
        authentication:
        {
            type: "default",
            options:
            {
                userName: config.user,
                password: config.password
            }
        },
        options:
        {
            appName: "NodeJS Tedious",
            requestTimeout: config.vars.requestTimeout || 15000,
            connectTimeout: config.vars.connectTimeout || 5000,
            database: config.database,
            port: config.port,
            encrypt: false,
            useUTC: false
        }
    } );

    Log.info( Log.category.database, "Database", `재 연결 중 ...` );

    _obj.connect( );

    this._registerEventHandler( _obj, true );

    this._connectionObj = _obj;
}

Database._registerEventHandler = function( obj, isReconnect, resolve )
{
    // DB 연결 되었을 때 호출
    obj.on( "connect", ( exception ) =>
    {
        this._isConnecting = false;

        if ( exception )
            Log.error( [ Log.category.error, Log.category.database ], "Database", `오류!: 연결 오류 (exception: ${exception.stack})` );
        else
        {
            this._isConnected = true;
            Log.info( Log.category.database, "Database", `${isReconnect ? "재 " : ""}연결 성공` );

            if ( timer.exists( this.vars.queueProcessorTimerName ) && !timer.isRunning( this.vars.queueProcessorTimerName ) )
                timer.resume( this.vars.queueProcessorTimerName );

            if ( timer.exists( this.vars.queueProcessorHibernateTimerName ) && !timer.isRunning( this.vars.queueProcessorHibernateTimerName ) )
                timer.resume( this.vars.queueProcessorHibernateTimerName );

            if ( isReconnect && timer.exists( "Database.ReconnectTimer" ) )
                timer.remove( "Database.ReconnectTimer", "연결 완료" );

            this.EventHandler.emit( "online" );
        }

        if ( !isReconnect && resolve )
            resolve( );
    } );

    // DB 연결 오류 시 호출
    obj.on( "error", ( exception ) =>
    {
        Log.error( [ Log.category.error, Log.category.database ], "Database", `오류!: 서버 오류 (exception: ${exception.stack})` );
    } );

    // DB 연결 종료 시 호출
    obj.on( "end", ( ) =>
    {
        this._isConnected = false;
        this._isConnecting = false;

        Log.warning( Log.category.database, "Database", `경고!: 연결 종료됨, 잠시 후 재시도 ...` );

        if ( timer.exists( this.vars.queueProcessorTimerName ) )
            timer.pause( this.vars.queueProcessorTimerName );

        if ( timer.exists( this.vars.queueProcessorHibernateTimerName ) )
            timer.pause( this.vars.queueProcessorHibernateTimerName );

        if ( !timer.exists( "Database.ReconnectTimer" ) )
        {
            timer.create( "Database.ReconnectTimer", this._connectionInfo.reconnectInterval || 5000, 0, ( ) =>
            {
                if ( !this._isConnecting )
                    this.reconnect( );
            } );
        }

        this.EventHandler.emit( "offline" );
    } );
}

// 프로시저 실행 큐 초기화
Database._initializeQueueProcessor = function( )
{
    let config = this._connectionInfo;

    timer.create( this.vars.queueProcessorTimerName, config.vars.processSpeed || 50, 0, async ( ) =>
    {
        try
        {
            if ( this._queueProcessing )
                return;

            if ( Object.keys( this._requestQueue )
                .length <= 0 )
            {
                return;
            }

            this._queueProcessing = true;

            await this._processQueue( );

            this._queueProcessing = false;

            this._lastQueueProcess = Date.now( );
        }
        catch ( exception )
        {
            Log.critical( [ Log.category.critical, Log.category.database ], "Database", `심각한 오류!: 프로세싱 오류 (exception: ${exception.stack})` );
        }
    } );

    if ( config.vars.hibernateActive )
    {
        timer.create( this.vars.queueProcessorHibernateTimerName, 1000, 0, ( ) =>
        {
            if ( !timer.isRunning( this.vars.queueProcessorTimerName ) )
                return;

            if ( Date.now( ) - this._lastQueueProcess >= config.vars.hibernateWait && !this._queueProcessing && Object.keys( this._requestQueue )
                .length <= 0 )
            {
                timer.pause( this.vars.queueProcessorTimerName, "HIBERNATE" );
            }
        } );
    }
}

// 프로시저 실행 루틴 큐에 등록
Database.executeProcedure = function( name, params, outputParams, options )
{
    return new Promise( ( resolve, reject ) =>
    {
        let uniqueID = uniqid( "DB-", `-${Math.randomNumber( 10000, 99999 )}` );

        let dataTable = {
            uniqueID: uniqueID,
            type: this.REQUEST_TYPE.PROCEDURE,

            name: name,
            params: params,
            outputParams: outputParams,

            options: options,
            resolve: resolve,
            reject: reject
        };

        this._requestQueue[ uniqueID ] = dataTable;
    } );
}

// SQL 실행 루틴 큐에 등록
Database.executeSQL = function( sql, options )
{
    return new Promise( ( resolve, reject ) =>
    {
        let uniqueID = uniqid( "DB-", `-${Math.randomNumber( 10000, 99999 )}` );

        let dataTable = {
            uniqueID: uniqueID,
            type: this.REQUEST_TYPE.SQL,

            sql: sql,

            options: options,
            resolve: resolve,
            reject: reject
        };

        this._requestQueue[ uniqueID ] = dataTable;
    } );
}

// 프로시저 실제 실행 함수
Database._executeProcedure = function( name, params, outputParams, options = {} )
{
    return new Promise( ( resolve, reject ) =>
    {
        let rows = [ ];
        let returnValue = {};
        let isError = false;

        let request = new tedious.Request( name, ( exception ) =>
        {
            if ( exception )
            {
                isError = true;
                Log.error( [ Log.category.error, Log.category.database ], "Database", `오류!: 프로시저 ${name} -> 실행 오류 (exception: ${exception.stack})` );
                reject( exception );
            }
        } );

        // row 반환 결과 리스닝
        request.on( "row", ( row ) =>
        {
            let data = {};

            util.forEach( row, ( v, i ) =>
            {
                data[ v.metadata.colName ] = v.value;
            } );

            rows.push( data );
        } );

        // returnValue 리스닝
        request.on( "returnValue", ( name, value, metaData ) =>
        {
            returnValue[ name ] = value;
        } );

        // 요청 완료 리스닝
        request.on( "requestCompleted", ( ) =>
        {
            if ( isError )
                return;

            // output Params 값 없을 경우 기본 값 설정
            if ( outputParams && Array.isArray( outputParams ) )
            {
                util.forEach( outputParams, ( v, i ) =>
                {
                    if ( !returnValue.hasOwnProperty( v.name ) )
                        returnValue[ v.name ] = v.defaultValue;
                } );
            }

            if ( !options.noSuccessLog )
                Log.info( Log.category.database, "Database", `프로시저 ${name} -> 실행 완료 (${util.joinObject(returnValue, ", ")})` );

            resolve(
            {
                returnValue: returnValue,
                rows: rows
            } );
        } );

        // 파라메터 설정
        if ( params && Array.isArray( params ) )
        {
            util.forEach( params, ( v ) =>
            {
                let options = Object.assign(
                {}, v );

                delete options.name;
                delete options.type;
                delete options.value;

                request.addParameter( v.name, v.type, v.value, Object.keys( options )
                    .length > 0 ? options : undefined );
            } );
        }

        // Output 파라메터 설정
        if ( outputParams && Array.isArray( outputParams ) )
        {
            util.forEach( outputParams, function( v )
            {
                let options = Object.assign(
                {}, v );

                delete options.name;
                delete options.type;
                delete options.defaultValue;

                request.addOutputParameter( v.name, v.type, v.defaultValue, Object.keys( options )
                    .length > 0 ? options : undefined );
            } );
        }

        this._connectionObj.callProcedure( request );
    } );
}

// SQL 실제 실행 함수
Database._executeSQL = function( sql, options = {} )
{
    return new Promise( ( resolve, reject ) =>
    {
        let rows = [ ];
        let isError = false;

        let request = new tedious.Request( sql, ( exception ) =>
        {
            if ( exception )
            {
                isError = true;
                Log.error( [ Log.category.error, Log.category.database ], "Database", `오류!: SQL '${sql}' -> 실행 오류 (exception: ${exception.stack})` );
                reject( exception );
            }
        } );

        // row 반환 결과 리스닝
        request.on( "row", ( row ) =>
        {
            let data = {};

            util.forEach( row, ( v, i ) =>
            {
                data[ v.metadata.colName ] = v.value;
            } );

            rows.push( data );
        } );

        // 요청 완료 리스닝
        request.on( "requestCompleted", ( ) =>
        {
            if ( isError )
                return;

            if ( !options.noSuccessLog )
                Log.info( Log.category.database, "Database", `SQL '${sql}' -> 실행 완료` );

            resolve(
            {
                rows: rows
            } );
        } );

        this._connectionObj.execSql( request );
    } );
}

// 데이터베이스 프로시저 큐 처리
Database._processQueue = async function( )
{
    let keys = Object.keys( this._requestQueue );
    let length = keys.length;

    for ( let i = 0; i < length; i++ )
    {
        let v = this._requestQueue[ keys[ i ] ];

        try
        {
            let result;

            if ( v.type === this.REQUEST_TYPE.PROCEDURE )
                result = await this._executeProcedure( v.name, v.params, v.outputParams, v.options );
            else
                result = await this._executeSQL( v.sql, v.options );

            v.resolve( result );
        }
        catch ( exception )
        {
            v.reject( exception );
        }
        finally
        {
            this._requestQueue[ v.uniqueID ] = null;
            delete this._requestQueue[ v.uniqueID ];
        }
    }
}

module.exports = Database;