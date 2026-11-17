-- =============================================================================
-- Fabric Migration Assessment Accelerator
-- Discovery script : IBM Db2 for z/OS 11 / 12 / 13
-- Script version   : 2026.11
-- -----------------------------------------------------------------------------
-- What it does : Reads SYSIBM catalog tables and real-time statistics only.
--                No business data is read. Nothing is created or changed.
-- Permissions  : SELECT on the SYSIBM catalog (SYSADM, SYSCTRL or a catalog
--                read role).
-- How to run   : SPUFI, DSNTEP2/DSNTEP4 batch, IBM Data Studio / Db2 Developer
--                Extension, or any JDBC client through Db2 Connect.
--                Save every result row into one .csv or .txt file (SPUFI output
--                is fine: the importer reads lines that start with a section name).
-- Mainframe    : Workload (MIPS), CICS/IMS usage, VSAM/sequential files and
--                COBOL copybooks are not in the catalog: record them in the
--                accelerator's intake for this system.
-- =============================================================================
SELECT 'platform,platform,db2zos' FROM SYSIBM.SYSDUMMY1;
SELECT 'platform,script_version,2026.11' FROM SYSIBM.SYSDUMMY1;
SELECT 'platform,version,' || GETVARIABLE('SYSIBM.VERSION') FROM SYSIBM.SYSDUMMY1;

SELECT 'inventory,' || CASE TYPE WHEN 'T' THEN 'table_count' WHEN 'V' THEN 'view_count' WHEN 'M' THEN 'mqt_count'
                                 WHEN 'A' THEN 'alias_count' WHEN 'G' THEN 'created_temp_count' WHEN 'X' THEN 'aux_table_count'
                                 ELSE 'type_' || TYPE END || ',' || STRIP(CHAR(COUNT(*)))
  FROM SYSIBM.SYSTABLES WHERE CREATOR NOT LIKE 'SYS%' AND CREATOR NOT LIKE 'DSN%' GROUP BY TYPE;
SELECT 'inventory,schema_count,' || STRIP(CHAR(COUNT(DISTINCT CREATOR)))
  FROM SYSIBM.SYSTABLES WHERE TYPE = 'T' AND CREATOR NOT LIKE 'SYS%' AND CREATOR NOT LIKE 'DSN%';
SELECT 'inventory,database_count,' || STRIP(CHAR(COUNT(*))) FROM SYSIBM.SYSDATABASE WHERE NAME NOT LIKE 'DSN%';
SELECT 'inventory,proc_count,' || STRIP(CHAR(COUNT(*)))
  FROM SYSIBM.SYSROUTINES WHERE ROUTINETYPE = 'P' AND SCHEMA NOT LIKE 'SYS%' AND SCHEMA NOT LIKE 'DSN%';
SELECT 'inventory,native_sql_proc_count,' || STRIP(CHAR(COUNT(*)))
  FROM SYSIBM.SYSROUTINES WHERE ROUTINETYPE = 'P' AND ORIGIN = 'N' AND SCHEMA NOT LIKE 'SYS%' AND SCHEMA NOT LIKE 'DSN%';
SELECT 'inventory,external_routine_count,' || STRIP(CHAR(COUNT(*)))
  FROM SYSIBM.SYSROUTINES WHERE ORIGIN = 'E' AND SCHEMA NOT LIKE 'SYS%' AND SCHEMA NOT LIKE 'DSN%';
SELECT 'inventory,function_count,' || STRIP(CHAR(COUNT(*)))
  FROM SYSIBM.SYSROUTINES WHERE ROUTINETYPE = 'F' AND SCHEMA NOT LIKE 'SYS%' AND SCHEMA NOT LIKE 'DSN%';
SELECT 'inventory,trigger_count,' || STRIP(CHAR(COUNT(*)))
  FROM SYSIBM.SYSTRIGGERS WHERE SCHEMA NOT LIKE 'SYS%' AND SCHEMA NOT LIKE 'DSN%';
SELECT 'inventory,sequence_count,' || STRIP(CHAR(COUNT(*)))
  FROM SYSIBM.SYSSEQUENCES WHERE SEQTYPE = 'S' AND SCHEMA NOT LIKE 'SYS%' AND SCHEMA NOT LIKE 'DSN%';
SELECT 'inventory,package_count,' || STRIP(CHAR(COUNT(*)))
  FROM SYSIBM.SYSPACKAGE WHERE COLLID NOT LIKE 'DSN%' AND COLLID NOT LIKE 'SYS%';
SELECT 'inventory,plan_count,' || STRIP(CHAR(COUNT(*))) FROM SYSIBM.SYSPLAN WHERE NAME NOT LIKE 'DSN%';

-- Size from real-time statistics (SPACE is in KB)
SELECT 'size,total_size_gb,' || STRIP(CHAR(DECIMAL(SUM(SPACE) / 1048576.0, 18, 2)))
  FROM SYSIBM.SYSTABLESPACESTATS WHERE DBNAME NOT LIKE 'DSN%';
SELECT 'size,total_rows,' || STRIP(CHAR(BIGINT(SUM(TOTALROWS))))
  FROM SYSIBM.SYSTABLESPACESTATS WHERE DBNAME NOT LIKE 'DSN%';
SELECT 'size,largest_table_gb,' || STRIP(CHAR(DECIMAL(MAX(SPACE) / 1048576.0, 18, 2)))
  FROM SYSIBM.SYSTABLESPACESTATS WHERE DBNAME NOT LIKE 'DSN%';

-- Column data types, encoding and change data capture
SELECT 'types,' || K || ',' || STRIP(CHAR(COUNT(*))) FROM (
  SELECT CASE
           WHEN C.COLTYPE IN ('GRAPHIC','VARG','LONGVARG') THEN 'graphic_columns'
           WHEN C.COLTYPE IN ('BLOB','CLOB','DBCLOB') THEN 'lob_columns'
           WHEN C.COLTYPE = 'XML' THEN 'xml_columns'
           WHEN C.COLTYPE = 'DECFLOAT' THEN 'decfloat_columns'
           WHEN C.COLTYPE = 'ROWID' THEN 'rowid_columns'
           WHEN C.COLTYPE = 'TIMESTZ' THEN 'tz_columns'
           WHEN C.COLTYPE = 'DISTINCT' THEN 'udt_columns'
           ELSE 'other_columns' END AS K
    FROM SYSIBM.SYSCOLUMNS C
    JOIN SYSIBM.SYSTABLES T ON T.CREATOR = C.TBCREATOR AND T.NAME = C.TBNAME
   WHERE T.TYPE = 'T' AND T.CREATOR NOT LIKE 'SYS%' AND T.CREATOR NOT LIKE 'DSN%'
) X GROUP BY K;
SELECT 'types,ebcdic_tables,' || STRIP(CHAR(COUNT(*)))
  FROM SYSIBM.SYSTABLES WHERE TYPE = 'T' AND ENCODING_SCHEME = 'E' AND CREATOR NOT LIKE 'SYS%' AND CREATOR NOT LIKE 'DSN%';
SELECT 'cdc,data_capture_tables,' || STRIP(CHAR(COUNT(*)))
  FROM SYSIBM.SYSTABLES WHERE TYPE = 'T' AND DATACAPTURE = 'Y' AND CREATOR NOT LIKE 'SYS%' AND CREATOR NOT LIKE 'DSN%';
SELECT 'security,rcac_controls,' || STRIP(CHAR(COUNT(*))) FROM SYSIBM.SYSCONTROLS;
SELECT 'workload,user_count,' || STRIP(CHAR(COUNT(DISTINCT GRANTEE)))
  FROM SYSIBM.SYSTABAUTH WHERE GRANTEETYPE = ' ' AND GRANTEE <> 'PUBLIC';

-- Largest table spaces (wave planning). Delete this statement to omit names.
SELECT 'table_top,' || STRIP(DBNAME) || '.' || STRIP(NAME) || ',' || STRIP(CHAR(DECIMAL(SUM(SPACE) / 1048576.0, 18, 2)))
  FROM SYSIBM.SYSTABLESPACESTATS WHERE DBNAME NOT LIKE 'DSN%'
 GROUP BY DBNAME, NAME ORDER BY SUM(SPACE) DESC FETCH FIRST 25 ROWS ONLY;
