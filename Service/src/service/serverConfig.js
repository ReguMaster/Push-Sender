/*
 *   Push Sender
 *   Copyright 2023. Seo Yong Ha All rights reserved.
 */

'use strict';

const ServerConfig = {};

// 필수 모듈 로드
const util = require( "../util" );
const path = require( "path" );
const Log = require( "../log" );

ServerConfig._config = {};

ServerConfig.initialize = async function( )
{
    let location = path.join( GLOBAL_VAR.rootPath, "maintenance", "server-config.cfg" );

    let configReadResult = await util.readFile( location, true,
    {
        encoding: "utf-8"
    } );

    if ( !configReadResult.success )
    {
        Log.critical( Log.category.critical, "ServerConfig", `서버 설정 값 불러올 수 없음 (err: ${configReadResult.exception.stack})` );
        return false;
    }

    this._config = util.safeParseJSON( configReadResult.data,
    {} );

    let keys = Object.keys( this._config );
    let length = keys.length;

    for ( let i = 0; i < length; i++ )
    {
        let v = keys[ i ];

        Log.info( Log.category.normal, "ServerConfig", `카테고리 ${v} -> 로드 완료` );
    }

    return true;
}

// 서버 설정 값을 가져옵니다.
// ex: global/NAME 의 문법을 사용합니다.
ServerConfig.get = function( location, defaultValue )
{
    try
    {
        let locationArray = location.split( "/" );
        let length = locationArray.length;

        if ( length === 1 )
        {
            return this._config.hasOwnProperty( locationArray[ 0 ] ) ? this._config[ locationArray[ 0 ] ] : defaultValue;
        }
        else
        {
            let result = this._config[ locationArray[ 0 ] ];

            if ( result === undefined )
                return defaultValue;

            for ( let i = 1; i < length; i++ )
            {
                let v = locationArray[ i ];

                if ( result.hasOwnProperty( v ) )
                    result = result[ v ];
                else
                    return defaultValue;
            }

            return result;
        }
    }
    catch ( exception )
    {
        return defaultValue;
    }
}

module.exports = ServerConfig;