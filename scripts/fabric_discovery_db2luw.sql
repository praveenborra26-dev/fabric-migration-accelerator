-- =============================================================================
-- Fabric Migration Assessment Accelerator
-- Discovery script : IBM Db2 for Linux, UNIX and Windows 10.5 / 11.1 / 11.5 / 12.1
-- Script version   : 2026.11
-- -----------------------------------------------------------------------------
-- What it does : Reads SYSCAT catalog views and MON_* table functions only.
--                No business data is read. Nothing is created or changed.
-- Permissions  : CONNECT + catalog SELECT (granted to PUBLIC by default) and
--                EXECUTE on the MON_GET_* functions (SYSMON authority covers it).
-- How to run   : db2 connect to <database>
--                db2 -x -tf fabric_discovery_db2luw.sql -z fabric_discovery_db2luw.csv
-- Output       : fabric_discovery_db2luw.csv. Error lines from statements that
--                do not apply to your version are ignored by the importer.
-- Note         : ADMINTABINFO (largest tables) can take a few minutes on very
--                large catalogs.
-- =============================================================================
SELECT 'platform,platform,db2luw' FROM SYSIBM.SYSDUMMY1;
SELECT 'platform,script_version,2026.11' FROM SYSIBM.SYSDUMMY1;
SELECT 'platform,version,' || SERVICE_LEVEL FROM SYSIBMADM.ENV_INST_INFO;
SELECT 'platform,os,' || OS_NAME || ' ' || OS_VERSION FROM SYSIBMADM.ENV_SYS_INFO;
SELECT 'platform,cpu_count,' || TRIM(CHAR(TOTAL_CPUS)) FROM SYSIBMADM.ENV_SYS_INFO;
SELECT 'platform,memory_gb,' || TRIM(CHAR(DECIMAL(TOTAL_MEMORY / 1024.0, 18, 1))) FROM SYSIBMADM.ENV_SYS_INFO;
SELECT 'platform,db_partitions,' || TRIM(CHAR(COUNT(*))) FROM TABLE(DB_PARTITIONS()) AS T;

-- Size
SELECT 'size,total_size_gb,' || TRIM(CHAR(DECIMAL(SUM(TBSP_USED_PAGES * TBSP_PAGE_SIZE) / 1073741824.0, 18, 2)))
  FROM TABLE(MON_GET_TABLESPACE('', -2)) AS T WHERE TBSP_CONTENT_TYPE IN ('ANY', 'LARGE');
SELECT 'size,total_rows,' || TRIM(CHAR(SUM(BIGINT(CARD))))
  FROM SYSCAT.TABLES WHERE TYPE = 'T' AND CARD > 0
   AND TABSCHEMA NOT LIKE 'SYS%' AND TABSCHEMA NOT IN ('SQLJ','NULLID','DB2QP','IBM_RTMON','ASN','DB2GSE','DB2OE','IBMOTS');
SELECT 'size,largest_table_gb,' || TRIM(CHAR(DECIMAL(MAX(DATA_OBJECT_P_SIZE + INDEX_OBJECT_P_SIZE + LONG_OBJECT_P_SIZE + LOB_OBJECT_P_SIZE + XML_OBJECT_P_SIZE) / 1048576.0, 18, 2)))
  FROM SYSIBMADM.ADMINTABINFO WHERE TABSCHEMA NOT LIKE 'SYS%';

-- Inventory
SELECT 'inventory,' || CASE TYPE WHEN 'T' THEN 'table_count' WHEN 'V' THEN 'view_count' WHEN 'S' THEN 'mqt_count'
                                 WHEN 'A' THEN 'alias_count' WHEN 'N' THEN 'nickname_count' WHEN 'G' THEN 'created_temp_count'
                                 ELSE 'type_' || TYPE END || ',' || TRIM(CHAR(COUNT(*)))
  FROM SYSCAT.TABLES
 WHERE TABSCHEMA NOT LIKE 'SYS%' AND TABSCHEMA NOT IN ('SQLJ','NULLID','DB2QP','IBM_RTMON','ASN','DB2GSE','DB2OE','IBMOTS')
 GROUP BY TYPE;
SELECT 'inventory,schema_count,' || TRIM(CHAR(COUNT(DISTINCT TABSCHEMA)))
  FROM SYSCAT.TABLES WHERE TYPE = 'T'
   AND TABSCHEMA NOT LIKE 'SYS%' AND TABSCHEMA NOT IN ('SQLJ','NULLID','DB2QP','IBM_RTMON','ASN','DB2GSE','DB2OE','IBMOTS');
SELECT 'inventory,column_organized_table_count,' || TRIM(CHAR(COUNT(*)))
  FROM SYSCAT.TABLES WHERE TYPE = 'T' AND TABLEORG = 'C' AND TABSCHEMA NOT LIKE 'SYS%';
SELECT 'inventory,partitioned_table_count,' || TRIM(CHAR(COUNT(DISTINCT TABSCHEMA || '.' || TABNAME)))
  FROM SYSCAT.DATAPARTITIONS WHERE SEQNO > 0 AND TABSCHEMA NOT LIKE 'SYS%';
SELECT 'inventory,' || CASE ROUTINETYPE WHEN 'P' THEN 'proc_count' WHEN 'F' THEN 'function_count' ELSE 'method_count' END
       || ',' || TRIM(CHAR(COUNT(*)))
  FROM SYSCAT.ROUTINES
 WHERE ROUTINESCHEMA NOT LIKE 'SYS%' AND ROUTINESCHEMA NOT IN ('SQLJ','NULLID','DB2QP','IBM_RTMON','ASN','DB2GSE','DB2OE','IBMOTS')
 GROUP BY ROUTINETYPE;
SELECT 'inventory,external_routine_count,' || TRIM(CHAR(COUNT(*)))
  FROM SYSCAT.ROUTINES WHERE ORIGIN = 'E' AND LANGUAGE <> 'SQL'
   AND ROUTINESCHEMA NOT LIKE 'SYS%' AND ROUTINESCHEMA NOT IN ('SQLJ','NULLID','DB2QP','IBM_RTMON','ASN','DB2GSE','DB2OE','IBMOTS');
SELECT 'inventory,trigger_count,' || TRIM(CHAR(COUNT(*))) FROM SYSCAT.TRIGGERS WHERE TRIGSCHEMA NOT LIKE 'SYS%';
SELECT 'inventory,sequence_count,' || TRIM(CHAR(COUNT(*))) FROM SYSCAT.SEQUENCES WHERE SEQTYPE = 'S' AND SEQSCHEMA NOT LIKE 'SYS%';
SELECT 'inventory,package_count,' || TRIM(CHAR(COUNT(*))) FROM SYSCAT.PACKAGES
 WHERE PKGSCHEMA NOT IN ('NULLID','NULLIDR1','NULLIDRA') AND PKGSCHEMA NOT LIKE 'SYS%';
SELECT 'inventory,federated_server_count,' || TRIM(CHAR(COUNT(*))) FROM SYSCAT.SERVERS;

-- SQL PL code volume and feature usage
SELECT 'code,code_chars,' || TRIM(CHAR(SUM(BIGINT(LENGTH(TEXT)))))
  FROM SYSCAT.ROUTINES WHERE LANGUAGE = 'SQL' AND ORIGIN = 'Q'
   AND ROUTINESCHEMA NOT LIKE 'SYS%' AND ROUTINESCHEMA NOT IN ('SQLJ','NULLID','DB2QP','IBM_RTMON','ASN','DB2GSE','DB2OE','IBMOTS');
SELECT 'code,code_lines,' || TRIM(CHAR(SUM(BIGINT(LENGTH(TEXT) - LENGTH(REPLACE(TEXT, CHR(10), '')) + 1))))
  FROM SYSCAT.ROUTINES WHERE LANGUAGE = 'SQL' AND ORIGIN = 'Q'
   AND ROUTINESCHEMA NOT LIKE 'SYS%' AND ROUTINESCHEMA NOT IN ('SQLJ','NULLID','DB2QP','IBM_RTMON','ASN','DB2GSE','DB2OE','IBMOTS');
SELECT 'code,trigger_chars,' || TRIM(CHAR(SUM(BIGINT(LENGTH(TEXT))))) FROM SYSCAT.TRIGGERS WHERE TRIGSCHEMA NOT LIKE 'SYS%';
SELECT 'code,cursor_objects,' || TRIM(CHAR(COUNT(*)))
  FROM SYSCAT.ROUTINES WHERE LANGUAGE = 'SQL' AND ORIGIN = 'Q' AND UPPER(TEXT) LIKE '%CURSOR%' AND ROUTINESCHEMA NOT LIKE 'SYS%';
SELECT 'code,dynamic_sql_objects,' || TRIM(CHAR(COUNT(*)))
  FROM SYSCAT.ROUTINES WHERE LANGUAGE = 'SQL' AND ORIGIN = 'Q'
   AND (UPPER(TEXT) LIKE '%EXECUTE IMMEDIATE%' OR UPPER(TEXT) LIKE '%PREPARE %') AND ROUTINESCHEMA NOT LIKE 'SYS%';
SELECT 'code,merge_objects,' || TRIM(CHAR(COUNT(*)))
  FROM SYSCAT.ROUTINES WHERE LANGUAGE = 'SQL' AND ORIGIN = 'Q' AND UPPER(TEXT) LIKE '%MERGE INTO%' AND ROUTINESCHEMA NOT LIKE 'SYS%';

-- Column data types that need attention in Fabric
SELECT 'types,' || K || ',' || TRIM(CHAR(COUNT(*))) FROM (
  SELECT CASE
           WHEN C.TYPENAME IN ('GRAPHIC','VARGRAPHIC','LONG VARGRAPHIC') THEN 'graphic_columns'
           WHEN C.TYPENAME IN ('BLOB','CLOB','DBCLOB') THEN 'lob_columns'
           WHEN C.TYPENAME = 'XML' THEN 'xml_columns'
           WHEN C.TYPENAME = 'DECFLOAT' THEN 'decfloat_columns'
           WHEN C.TYPENAME = 'TIMESTAMP' AND C.SCALE > 6 THEN 'ts_precision_columns'
           WHEN C.TYPESCHEMA = 'DB2GSE' THEN 'spatial_columns'
           WHEN C.TYPESCHEMA NOT LIKE 'SYSIBM%' THEN 'udt_columns'
           ELSE 'other_columns' END AS K
    FROM SYSCAT.COLUMNS C
    JOIN SYSCAT.TABLES T ON T.TABSCHEMA = C.TABSCHEMA AND T.TABNAME = C.TABNAME
   WHERE T.TYPE = 'T'
     AND T.TABSCHEMA NOT LIKE 'SYS%' AND T.TABSCHEMA NOT IN ('SQLJ','NULLID','DB2QP','IBM_RTMON','ASN','DB2GSE','DB2OE','IBMOTS')
) X GROUP BY K;

-- Workload (counters since database activation)
SELECT 'workload,daily_activities,' || TRIM(CHAR(BIGINT(SUM(ACT_COMPLETED_TOTAL) / MAX(1, DAYS(CURRENT TIMESTAMP) - DAYS(MIN(DB_CONN_TIME))))))
  FROM TABLE(MON_GET_DATABASE(-2)) AS T;
SELECT 'workload,peak_connections,' || TRIM(CHAR(MAX(CONNECTIONS_TOP))) FROM TABLE(MON_GET_DATABASE(-2)) AS T;
SELECT 'workload,user_count,' || TRIM(CHAR(COUNT(DISTINCT GRANTEE))) FROM SYSCAT.DBAUTH WHERE GRANTEETYPE = 'U' AND CONNECTAUTH = 'Y';
SELECT 'client_app,' || COALESCE(APPLICATION_NAME, '(unknown)') || ',' || TRIM(CHAR(COUNT(*)))
  FROM TABLE(MON_GET_CONNECTION(NULL, -2)) AS T GROUP BY APPLICATION_NAME ORDER BY COUNT(*) DESC FETCH FIRST 25 ROWS ONLY;

-- Change data capture readiness and security
SELECT 'cdc,log_archive_method,' || COALESCE(VALUE, '') FROM SYSIBMADM.DBCFG WHERE NAME = 'logarchmeth1';
SELECT 'cdc,data_capture_tables,' || TRIM(CHAR(COUNT(*))) FROM SYSCAT.TABLES WHERE DATACAPTURE IN ('Y','L') AND TABSCHEMA NOT LIKE 'SYS%';
SELECT 'security,rcac_controls,' || TRIM(CHAR(COUNT(*))) FROM SYSCAT.CONTROLS;
SELECT 'security,lbac_policies,' || TRIM(CHAR(COUNT(*))) FROM SYSCAT.SECURITYPOLICIES;

-- Largest tables (wave planning). Delete this statement to omit table names.
SELECT 'table_top,' || RTRIM(TABSCHEMA) || '.' || RTRIM(TABNAME) || ','
       || TRIM(CHAR(DECIMAL((DATA_OBJECT_P_SIZE + INDEX_OBJECT_P_SIZE + LONG_OBJECT_P_SIZE + LOB_OBJECT_P_SIZE + XML_OBJECT_P_SIZE) / 1048576.0, 18, 2)))
  FROM SYSIBMADM.ADMINTABINFO WHERE TABSCHEMA NOT LIKE 'SYS%'
 ORDER BY (DATA_OBJECT_P_SIZE + INDEX_OBJECT_P_SIZE + LONG_OBJECT_P_SIZE + LOB_OBJECT_P_SIZE + XML_OBJECT_P_SIZE) DESC
 FETCH FIRST 25 ROWS ONLY;
