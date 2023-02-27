/*
 *   Push Sender
 *   Copyright 2023. Seo Yong Ha All rights reserved.
 */

'use strict';

const AlertManager = {}

// 필수 모듈 로드
const util = require( "../util" );
const moment = require( "moment" );
const path = require( "path" );
const Log = require( "../log" );
const ServerConfig = require( "./serverConfig" );
const nodemailer = require( "nodemailer" );

AlertManager.alert = function( )
{
    // Todo;
}

module.exports = AlertManager;