# Push-Sender

소개
=============
### Push-Sender 는 Firebase 기반으로 푸시 메세지를 편하게 보낼 수 있게 도와줍니다.
##### 간단한 쿼리문으로 푸시 메세지를 간편하게 보낼 수 있습니다.

* 큐(Queue) 기반 푸시 대기열 시스템
* Google Firebase 를 사용하여 비용 없음
* 로그 테이블 저장을 통해 월별 통계 기능

발송 방법
=============

### 푸시 메세지 발송
```sql
INSERT INTO dbo.Tbl_Push_Data (TOKEN, TITLE, BODY, MODULE_ID)
	VALUES ('', 'TITLE', 'BODY', 1)
```

라이선스
=============
[MIT 라이선스](https://ko.wikipedia.org/wiki/MIT_%ED%97%88%EA%B0%80%EC%84%9C)를 사용합니다.

> __참고__ <br>
> 이 리포지토리에는 여러 핵심 설정값 파일이 업로드되어 있지 않습니다. (접속 비밀번호 등)
