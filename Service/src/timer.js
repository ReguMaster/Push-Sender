/*
 *   Push Sender
 *   Copyright 2023. Seo Yong Ha All rights reserved.
 */

'use strict';

const timer = {};
const Log = require( "./log" );

timer._list = {};

// 타이머 생성 함수
timer.create = function( id, interval, loopCount, callback )
{
    if ( this.exists( id ) )
    {
        Log.warning( Log.category.normal, "Timer", `${ id } -> 생성 불가 (reason: FAIL:ALREADY_EXISTS)` );
        return false;
    }

    let obj = {
        id: id,
        interval: interval,
        loopCount: loopCount,
        callback: callback,
        active: false,
        _intervalObj: null,
        _intervalFunc: null
    }

    let intervalFunc;

    if ( loopCount === 0 )
    {
        intervalFunc = function( )
        {
            obj.callback( );
        }
    }
    else
    {
        intervalFunc = function( )
        {
            if ( --obj.loopCount >= 0 )
            {
                obj.callback( );

                if ( obj.loopCount === 0 )
                    timer.remove( obj.id, "Loop limit reached" );
            }
        }
    }

    Log.info( Log.category.normal, "Timer", `${ id } -> 생성 완료 (interval: ${ interval }, loopCount: ${ loopCount || "무제한" })` );

    obj.active = true;
    obj._intervalFunc = intervalFunc;
    obj._intervalObj = setInterval( intervalFunc, interval );

    this._list[ id ] = obj;

    return true;
}

// 이미 존재하는 타이머인지 확인하는 함수
timer.exists = function( id )
{
    return this._list.hasOwnProperty( id );
}

// 타이머가 동작하고 있는지 확인하는 함수
timer.isRunning = function( id )
{
    if ( !this.exists( id ) )
        return false;

    let timerObj = this._list[ id ];

    return timerObj.active;
}

// 타이머 재개 함수
timer.resume = function( id, reason )
{
    if ( !this.exists( id ) )
    {
        Log.warning( Log.category.normal, "Timer", `${ id } -> 재개 불가 (reason: FAIL:NOT_EXISTS)` );
        return;
    }

    let timerObj = this._list[ id ];

    if ( !timerObj.active )
    {
        timerObj.active = true;
        timerObj._intervalObj = setInterval( timerObj._intervalFunc, timerObj.interval );

        Log.info( Log.category.normal, "Timer", `${ id } -> 재개 (reason: ${reason || "없음"})` );
    }
    else
        Log.warning( Log.category.normal, "Timer", `${ id } -> 재개 불가 (reason: FAIL:ALREADY_ACTIVE)` );
}

// 타이머 일시정지 함수
timer.pause = function( id, reason )
{
    if ( !this.exists( id ) )
    {
        Log.warning( Log.category.normal, "Timer", `${ id } -> 일시 중지 불가 (reason: FAIL:NOT_EXISTS)` );
        return;
    }

    let timerObj = this._list[ id ];

    if ( timerObj.active )
    {
        timerObj.active = false;
        clearInterval( timerObj._intervalObj );
        timerObj._intervalObj = null;

        Log.info( Log.category.normal, "Timer", `${ id } -> 일시 중지 (reason: ${reason || "없음"})` );
    }
    else
        Log.warning( Log.category.normal, "Timer", `${ id } -> 일시 중지 불가 (reason: FAIL_NOT_ACTIVE)` );
}

// 타이머 제거 함수
timer.remove = function( id, reason )
{
    if ( !this.exists( id ) )
    {
        Log.warning( Log.category.normal, "Timer", `${ id } -> 제거 불가 (reason: FAIL:NOT_EXISTS)` );
        return;
    }

    let timerObj = this._list[ id ];

    clearInterval( timerObj._intervalObj );
    this._list[ id ] = null;
    delete this._list[ id ];

    Log.info( Log.category.normal, "Timer", `${ id } -> 제거 (reason: ${ reason || "없음" }])` );
}

module.exports = timer;