/*
 *   Push Sender
 *   Copyright 2023. Seo Yong Ha All rights reserved.
 */

'use strict';

const PPROMover = {};

// 필수 모듈 로드
const Log = require( "../log" );
const Database = require( "../database/main" );
const timer = require( "../timer" );
const ServerConfig = require( "../service/serverConfig" );
const AlertManager = require( "../service/alertManager" );
const PPROCore = require( "./main" );

const MODULE_ID = ServerConfig.get( "module/MODULE_ID" );

PPROMover.vars = {
    mainName: "PPRO-Module.Mover.Main"
};

PPROMover._RUNNING_MOVER = false;

PPROMover.initialize = function( )
{
    Database.EventHandler.on( "online", ( ) =>
    {
        if ( !timer.isRunning( this.vars.mainName ) )
            timer.resume( this.vars.mainName, "데이터베이스 온라인" );
    } );

    Database.EventHandler.on( "offline", ( ) =>
    {
        if ( timer.isRunning( this.vars.mainName ) )
            timer.pause( this.vars.mainName, "데이터베이스 오프라인" );
    } );

    timer.create( this.vars.mainName, ServerConfig.get( "module/MOVER/MOVE_INTERVAL", 1000 * 60 ), 0, this._executeMover.bind( this ) );
}

PPROMover._executeMover = async function( )
{
    if ( this._RUNNING_MOVER )
        return;

    this._RUNNING_MOVER = true;

    try
    {
        let
        {
            returnValue,
            rows
        } = await Database.executeProcedure( "Proc_MODULE_Log_Process",
            [
                {
                    name: "MODULE_ID",
                    type: Database.TYPES.TinyInt,
                    value: MODULE_ID
                }
            ],
            null,
            {
                noSuccessLog: true
            } );
    }
    catch ( exception )
    {
        Log.error( Log.category.error, "PPROMover", `오류!: 프로세싱 실행 오류 (exception: ${exception.stack})` );
        AlertManager.alert( exception );
    }
    finally
    {
        this._RUNNING_MOVER = false;
    }
}

module.exports = PPROMover;