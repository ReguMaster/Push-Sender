/*
 *   Push Sender
 *   Copyright 2023. Seo Yong Ha All rights reserved.
 */

'use strict';

// 필수 모듈 로드
const path = require( "path" );

global.GLOBAL_VAR = {
    rootPath: path.join( __dirname, "../" ), // 서버 루트 경로 저장
    newLine: require( "os" ) // NewLine 문자 저장
        .EOL
};