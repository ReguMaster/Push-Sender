/*
 *   Push Sender
 *   Copyright 2023. Seo Yong Ha All rights reserved.
 */

'use strict';

// 기존 노드 util 모듈 로드
const nodeUtil = require( "util" );

let util = {};
const path = require( "path" );
const fileStream = require( "fs" );

util.sleep = ( ms ) => new Promise( resolve => setTimeout( resolve, ms ) );

util.joinObject = function( obj, separator )
{
    let keys = Object.keys( obj );
    let length = keys.length;
    let result = "{";

    for ( let i = 0; i < length; i++ )
    {
        let k = keys[ i ];
        let v = obj[ k ];
        let type = typeof v;

        if ( v === undefined || v === null )
            result += `${k}: ${v} [type: Null]${i === length - 1 ? "" : separator}`;
        else
        {
            if ( type === "object" )
                result += `${k}: ${Array.isArray(v) ? `Array [${v.length}]` : `Object [${Object.keys(v).length} keys]`} ${i === length - 1 ? "" : separator}`;
            else
                result += `${k}: ${v} [type: ${type}]${i === length - 1 ? "" : separator}`;
        }
    }

    return result + "}";
}

util.codeMatcher = function( code, matcher, defaultValue )
{
    let keys = Object.keys( matcher );
    let keyLength = keys.length;

    for ( let i = 0; i < keyLength; i++ )
    {
        if ( code == keys[ i ] )
            return matcher[ keys[ i ] ];
    }

    return defaultValue;
}

util.leadingZeros = function( n, digits )
{
    var zero = "";

    n = n.toString( );

    if ( n.length < digits )
    {
        for ( var i = 0; i < digits - n.length; i++ )
            zero += "0";
    }

    return zero + n;
}

util.loadJSON = async function( location, defaultValue )
{
    var result = await this.readFile( location, true,
    {
        encoding: "utf8"
    } );

    if ( !result.success )
        return defaultValue;

    return this.safeParseJSON( result.data.toString( ), defaultValue );
}

util.safeParseJSON = function( text, defaultValue )
{
    if ( !text )
        return defaultValue;

    try
    {
        return JSON.parse( text );
    }
    catch ( exception )
    {
        return defaultValue;
    }
}

util.safeStringifyJSON = function( obj )
{
    try
    {
        return JSON.stringify( obj );
    }
    catch ( exception )
    {
        return false;
    }
}

util.isObject = function( obj )
{
    return obj.constructor === Object;
}

util.isEmptyObject = function( obj )
{
    return obj.constructor === Object && Object.keys( obj )
        .length === 0;
}

util.forEach = function( arr, callback )
{
    var length = arr.length;
    var breaked = false;

    for ( let i = 0; i < length; i++ )
    {
        if ( callback( arr[ i ], i ) === true )
        {
            breaked = true;
            break;
        }
    }

    return breaked;
}

util.isFileExistsAndValid = async function( location )
{
    try
    {
        var stats = await fileStream.promises.stat( location );

        return stats && stats.isFile( );
    }
    catch ( exception )
    {
        return false;
    }
}

util.isDirectoryExistsAndValid = async function( location )
{
    try
    {
        var stats = await fileStream.promises.stat( location );

        return stats && stats.isDirectory( );
    }
    catch ( exception )
    {
        return false;
    }
}

util.createDirectory = async function( location, errorHandle = false, recursive = false )
{
    try
    {
        await fileStream.promises.mkdir( location,
        {
            recursive: recursive
        } );

        return errorHandle ?
        {
            success: true
        } : true;
    }
    catch ( exception )
    {
        return errorHandle ?
        {
            success: false,
            exception: exception
        } : false;
    }
}

util.getAllFileInDirectory = async function( location )
{
    try
    {
        var result = [ ];
        const list = await fileStream.promises.readdir( location );
        const length = list.length;

        for ( let i = 0; i < length; i++ )
        {
            let v = list[ i ];

            if ( await this.isFileExistsAndValid( path.join( location, v ) ) )
                result.push( v );
        }

        return {
            success: true,
            data: result
        };
    }
    catch ( exception )
    {
        return {
            success: false,
            exception: exception
        };
    }
}

util.writeFile = async function( location, data, errorHandle = false, options = null )
{
    try
    {
        await fileStream.promises.writeFile( location, data, options );

        return errorHandle ?
        {
            success: true
        } : true;
    }
    catch ( exception )
    {
        return errorHandle ?
        {
            success: false,
            exception: exception
        } : false;
    }
}

util.readFile = async function( location, errorHandle = false, options = null )
{
    try
    {
        var data = await fileStream.promises.readFile( location, options );

        return errorHandle ?
        {
            success: true,
            data: data
        } : data;
    }
    catch ( exception )
    {
        return errorHandle ?
        {
            success: false,
            exception: exception
        } : null;
    }
}

util.copyFile = async function( source, dest, errorHandle = false, flags = null )
{
    try
    {
        await fileStream.promises.copyFile( source, dest, flags );

        return errorHandle ?
        {
            success: true
        } : true;
    }
    catch ( exception )
    {
        return errorHandle ?
        {
            success: false,
            exception: exception
        } : false;
    }
}

util.deleteFile = async function( location, errorHandle = false )
{
    try
    {
        await fileStream.promises.unlink( location );

        return errorHandle ?
        {
            success: true
        } : true;
    }
    catch ( exception )
    {
        return errorHandle ?
        {
            success: false,
            exception: exception
        } : false;
    }
}

Math.clamp = function( value, min, max )
{
    if ( value < min )
        return min;
    else if ( value > max )
        return max;

    return value;
}

Math.randomNumber = function( min, max )
{
    return Math.floor( Math.random( ) * ( max - min + 1 ) ) + min;
}

Array.prototype.insert = function( index, item )
{
    this.splice( index, 0, item );
}

Array.prototype.random = function( )
{
    return this[ Math.randomNumber( 0, this.length ) ];
}

JSON.empty = JSON.stringify(
{} );

String.prototype.replaceAll = function( org, dest )
{
    return this.split( org )
        .join( dest );
}

// 기존 nodejs 자체 util 모듈 상속
util = Object.assign( util, nodeUtil );

module.exports = util;