-- =============================================================================
-- Fabric Migration Assessment Accelerator
-- Discovery script : IBM Db2 for i (IBM i 7.3 / 7.4 / 7.5 / 7.6)
-- Script version   : 2026.11
-- -----------------------------------------------------------------------------
-- What it does : Reads QSYS2 catalog views and services only. No business data
--                is read. Nothing is created or changed.
-- Permissions  : *USE on QSYS2 services; *ALLOBJ is not required, but objects you
--                cannot see are not counted.
-- How to run   : IBM i Access Client Solutions -> Run SQL Scripts -> Run All,
--                then export the results to CSV (or save the output as .txt).
-- Note         : OBJECT_STATISTICS over *ALLUSR can take several minutes.
-- =============================================================================
SELECT 'platform,platform,db2i' FROM SYSIBM.SYSDUMMY1;
SELECT 'platform,script_version,2026.11' FROM SYSIBM.SYSDUMMY1;
SELECT 'platform,version,' || OS_VERSION || '.' || OS_RELEASE FROM SYSIBMADM.ENV_SYS_INFO;

SELECT 'inventory,' || CASE TABLE_TYPE WHEN 'T' THEN 'table_count' WHEN 'P' THEN 'dds_physical_file_count'
                                       WHEN 'L' THEN 'logical_file_count' WHEN 'V' THEN 'view_count'
                                       WHEN 'M' THEN 'mqt_count' WHEN 'A' THEN 'alias_count'
                                       ELSE 'type_' || TABLE_TYPE END || ',' || TRIM(CHAR(COUNT(*)))
  FROM QSYS2.SYSTABLES WHERE TABLE_SCHEMA NOT LIKE 'Q%' AND TABLE_SCHEMA NOT LIKE 'SYS%' GROUP BY TABLE_TYPE;
SELECT 'inventory,schema_count,' || TRIM(CHAR(COUNT(DISTINCT TABLE_SCHEMA)))
  FROM QSYS2.SYSTABLES WHERE TABLE_SCHEMA NOT LIKE 'Q%' AND TABLE_SCHEMA NOT LIKE 'SYS%';
SELECT 'inventory,proc_count,' || TRIM(CHAR(COUNT(*)))
  FROM QSYS2.SYSROUTINES WHERE ROUTINE_TYPE = 'PROCEDURE' AND ROUTINE_SCHEMA NOT LIKE 'Q%' AND ROUTINE_SCHEMA NOT LIKE 'SYS%';
SELECT 'inventory,function_count,' || TRIM(CHAR(COUNT(*)))
  FROM QSYS2.SYSROUTINES WHERE ROUTINE_TYPE = 'FUNCTION' AND ROUTINE_SCHEMA NOT LIKE 'Q%' AND ROUTINE_SCHEMA NOT LIKE 'SYS%';
SELECT 'inventory,trigger_count,' || TRIM(CHAR(COUNT(*)))
  FROM QSYS2.SYSTRIGGERS WHERE TRIGGER_SCHEMA NOT LIKE 'Q%' AND TRIGGER_SCHEMA NOT LIKE 'SYS%';
SELECT 'inventory,program_count,' || TRIM(CHAR(COUNT(*))) FROM TABLE(QSYS2.OBJECT_STATISTICS('*ALLUSR', '*PGM')) X;

SELECT 'size,total_size_gb,' || TRIM(CHAR(DECIMAL(SUM(DATA_SIZE) / 1073741824.0, 18, 2)))
  FROM QSYS2.SYSTABLESTAT WHERE TABLE_SCHEMA NOT LIKE 'Q%' AND TABLE_SCHEMA NOT LIKE 'SYS%';
SELECT 'size,total_rows,' || TRIM(CHAR(SUM(NUMBER_ROWS)))
  FROM QSYS2.SYSTABLESTAT WHERE TABLE_SCHEMA NOT LIKE 'Q%' AND TABLE_SCHEMA NOT LIKE 'SYS%';
SELECT 'size,largest_table_gb,' || TRIM(CHAR(DECIMAL(MAX(DATA_SIZE) / 1073741824.0, 18, 2)))
  FROM QSYS2.SYSTABLESTAT WHERE TABLE_SCHEMA NOT LIKE 'Q%' AND TABLE_SCHEMA NOT LIKE 'SYS%';

SELECT 'types,' || K || ',' || TRIM(CHAR(COUNT(*))) FROM (
  SELECT CASE
           WHEN DATA_TYPE = 'DECIMAL' THEN 'packed_decimal_columns'
           WHEN DATA_TYPE = 'NUMERIC' THEN 'zoned_decimal_columns'
           WHEN DATA_TYPE IN ('GRAPHIC','VARG','VARGRAPHIC','DBCLOB') THEN 'graphic_columns'
           WHEN DATA_TYPE IN ('BLOB','CLOB') THEN 'lob_columns'
           WHEN DATA_TYPE = 'XML' THEN 'xml_columns'
           WHEN DATA_TYPE IN ('CHAR','VARCHAR') AND CCSID NOT IN (1208, 1200, 13488, 65535) THEN 'ebcdic_char_columns'
           ELSE 'other_columns' END AS K
    FROM QSYS2.SYSCOLUMNS WHERE TABLE_SCHEMA NOT LIKE 'Q%' AND TABLE_SCHEMA NOT LIKE 'SYS%'
) X GROUP BY K;
SELECT 'cdc,journaled_files,' || TRIM(CHAR(COUNT(*)))
  FROM TABLE(QSYS2.OBJECT_STATISTICS('*ALLUSR', '*FILE')) X WHERE JOURNALED = 'YES';

-- Largest tables (wave planning). Delete this statement to omit names.
SELECT 'table_top,' || RTRIM(TABLE_SCHEMA) || '.' || RTRIM(TABLE_NAME) || ',' || TRIM(CHAR(DECIMAL(DATA_SIZE / 1073741824.0, 18, 2)))
  FROM QSYS2.SYSTABLESTAT WHERE TABLE_SCHEMA NOT LIKE 'Q%' AND TABLE_SCHEMA NOT LIKE 'SYS%'
 ORDER BY DATA_SIZE DESC FETCH FIRST 25 ROWS ONLY;
