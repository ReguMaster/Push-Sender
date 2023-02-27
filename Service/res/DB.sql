/****** Object:  UserDefinedFunction [dbo].[Zerofill]    Script Date: 2023-02-27 월요일 오전 10:44:42 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE FUNCTION [dbo].[Zerofill]
     (@input INT,
     @length INT)
RETURNS VARCHAR(20)
AS
BEGIN
     DECLARE @s AS VARCHAR(20) = SUBSTRING('00000000000000000000', 1, @length)
     RETURN RIGHT(@s + CONVERT(VARCHAR, @input), @length)
END
GO
/****** Object:  Table [dbo].[Tbl_Push_Data]    Script Date: 2023-02-27 월요일 오전 10:44:42 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Tbl_Push_Data](
	[IDX] [int] IDENTITY(1,1) NOT NULL,
	[CUR_STATE] [varchar](20) NOT NULL,
	[TOKEN] [varchar](300) NOT NULL,
	[TITLE] [nvarchar](50) NOT NULL,
	[BODY] [nvarchar](500) NOT NULL,
	[REQ_DATE] [datetime] NOT NULL,
	[SEND_DATE] [datetime] NULL,
	[RESULT_CODE] [varchar](100) NULL,
	[MODULE_ID] [tinyint] NOT NULL,
	[EXTRA_DATA] [nvarchar](1000) NULL,
 CONSTRAINT [PK_Tbl_Push_Data] PRIMARY KEY CLUSTERED 
(
	[IDX] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
ALTER TABLE [dbo].[Tbl_Push_Data] ADD  DEFAULT ('INIT') FOR [CUR_STATE]
GO
ALTER TABLE [dbo].[Tbl_Push_Data] ADD  DEFAULT ('푸시') FOR [TITLE]
GO
ALTER TABLE [dbo].[Tbl_Push_Data] ADD  DEFAULT (getdate()) FOR [REQ_DATE]
GO
/****** Object:  StoredProcedure [dbo].[Proc_MODULE_Get_Init_Data]    Script Date: 2023-02-27 월요일 오전 10:44:42 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
/*
[Push Sender]

작성자: 서용하 (Seo Yong Ha)
작업일자: 2021-11-01
작업내용: 최초 구현

관련 테이블:
SELECT * FROM Tbl_Push_Data WITH(NOLOCK) ORDER BY INPUT_DATE ASC

실행:
EXEC Proc_MODULE_Get_Init_Data
*/

CREATE PROCEDURE [dbo].[Proc_MODULE_Get_Init_Data]
	@MODULE_ID		TINYINT
AS
BEGIN
	SET NOCOUNT ON

    DECLARE @Data TABLE (
		IDX		INT
	)

	INSERT INTO @Data
    	SELECT TOP 1000 IDX FROM [dbo].[Tbl_Push_Data] WITH(NOLOCK)
        	WHERE CUR_STATE = 'INIT'
            	AND MODULE_ID = @MODULE_ID
            ORDER BY REQ_DATE ASC
                
    IF NOT EXISTS (SELECT IDX FROM @Data)
   		BEGIN
        	RETURN
        END
        
    UPDATE [dbo].[Tbl_Push_Data] SET CUR_STATE = 'READY'
    	WHERE IDX IN (SELECT IDX FROM @Data)

    SELECT * FROM [dbo].[Tbl_Push_Data] WITH(NOLOCK)
    	WHERE IDX IN (SELECT IDX FROM @Data)
END
GO
/****** Object:  StoredProcedure [dbo].[Proc_MODULE_Log_Process]    Script Date: 2023-02-27 월요일 오전 10:44:42 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
/*
[Push Sender]

작성자: 서용하 (Seo Yong Ha)
작업일자: 2021-11-01
작업내용: 최초 구현

관련 테이블:
SELECT * FROM Tbl_Push_Data WITH(NOLOCK) ORDER BY INPUT_DATE ASC
SELECT * FROM Tbl_ WITH(NOLOCK) ORDER BY INPUT_DATE ASC

실행:
EXEC Proc_MODULE_Log_Process 1
*/

CREATE PROCEDURE [dbo].[Proc_MODULE_Log_Process]
	@MODULE_ID		TINYINT
AS
BEGIN
	SET NOCOUNT ON

    DECLARE @Current_DateTime DATETIME
    DECLARE @Table_Name CHAR(20)

    SET @Current_DateTime = GETDATE()
    SET @Table_Name = 'Tbl_Push_Log_' + CONVERT(CHAR(4), YEAR(@Current_DateTime)) + '_' + CONVERT(CHAR(2), dbo.Zerofill(MONTH(@Current_DateTime), 2))

    CREATE TABLE #TARGET (
    	IDX		INT
    )

    INSERT INTO #TARGET
    	SELECT IDX FROM [dbo].[Tbl_Push_Data] WITH(NOLOCK)
    		WHERE CUR_STATE = 'DONE'
            	AND MODULE_ID = @MODULE_ID
                
    IF NOT EXISTS (SELECT IDX FROM #TARGET WITH(NOLOCK))
    	BEGIN
        	DROP TABLE #TARGET
        	RETURN
        END
        
	BEGIN TRY
		DECLARE @SQL NVARCHAR(4000)
        
        BEGIN TRANSACTION

	    IF (NOT EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = @Table_Name))
			BEGIN
		   		SET @SQL = '
				    CREATE TABLE [dbo].[' + @Table_Name + '] (
					    IDX             INT, 
					    CUR_STATE       VARCHAR(20), 
					    TOKEN           VARCHAR(300), 
					    TITLE           NVARCHAR(50),
					    BODY            NVARCHAR(500), 
					    REQ_DATE        DATETIME, 
					    SEND_DATE       DATETIME,
					    RESULT_CODE     VARCHAR(100),
                        MODULE_ID		TINYINT,
                        EXTRA_DATA		NVARCHAR(1000)
					)'
                
		   		EXEC SP_EXECUTESQL @SQL
			END

	    SET @SQL = 'INSERT INTO [dbo].[' + @Table_Name + '] SELECT * FROM [dbo].[Tbl_Push_Data] WHERE IDX IN (SELECT IDX FROM #TARGET)'
        
	    EXEC SP_EXECUTESQL @SQL

	    DELETE FROM [dbo].[Tbl_Push_Data]
	    	WHERE IDX IN (SELECT IDX FROM #TARGET)

	    DROP TABLE #TARGET

        COMMIT TRANSACTION
	END TRY
    
    BEGIN CATCH
    	IF @@TRANCOUNT > 0
        	BEGIN
        		ROLLBACK TRANSACTION
			END
        
        DROP TABLE #TARGET
    END CATCH
END
GO
