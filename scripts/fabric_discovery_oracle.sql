-- =============================================================================
-- Fabric Migration Assessment Accelerator
-- Discovery script : Oracle Database 11g R2+ (incl. RAC, Exadata, OCI, PDBs)
-- Script version   : 2026.11
-- -----------------------------------------------------------------------------
-- What it does : Reads data dictionary (DBA_*) and V$ views only. No business
--                data is read. Does NOT touch AWR/ASH, so no Diagnostics Pack
--                licence is needed. Nothing is created or changed.
-- Permissions  : SELECT_CATALOG_ROLE (or SELECT ANY DICTIONARY).
-- How to run   : sqlplus user/password@service @fabric_discovery_oracle.sql
--                SQLcl works too. In a multitenant CDB, connect to the PDB.
-- Output       : fabric_discovery_oracle.csv in the current directory.
--                Import it in the accelerator: Automate -> Discovery scripts.
-- Privacy      : Set v_names := FALSE below to omit the top-25 table names.
-- =============================================================================
SET SERVEROUTPUT ON SIZE UNLIMITED FORMAT WRAPPED
SET FEEDBACK OFF HEADING OFF PAGESIZE 0 LINESIZE 4000 TRIMSPOOL ON TRIMOUT ON VERIFY OFF ECHO OFF TERMOUT OFF
SPOOL fabric_discovery_oracle.csv
DECLARE
  v_names BOOLEAN := TRUE;
  -- Oracle-maintained and sample schemas excluded from every count
  x CONSTANT VARCHAR2(4000) := q'[ NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','AUDSYS','CTXSYS','DVSYS','DVF',
    'GSMADMIN_INTERNAL','GSMCATUSER','GSMUSER','GSMROOTUSER','LBACSYS','MDSYS','MDDATA','OJVMSYS','OLAPSYS','ORDDATA',
    'ORDPLUGINS','ORDSYS','SI_INFORMTN_SCHEMA','WMSYS','XDB','EXFSYS','ORACLE_OCM','SPATIAL_CSW_ADMIN_USR',
    'SPATIAL_WFS_ADMIN_USR','ANONYMOUS','XS$NULL','DIP','SYSBACKUP','SYSDG','SYSKM','SYSRAC','REMOTE_SCHEDULER_AGENT',
    'DBSFWUSER','GGSYS','PDBADMIN','OWBSYS','OWBSYS_AUDIT','SYSMAN','MGMT_VIEW','TSMSYS','DGPDB_INT','VECSYS','PUBLIC',
    'FLOWS_FILES','APEX_PUBLIC_USER','SCOTT','HR','OE','PM','IX','SH','BI')
    AND {c} NOT LIKE 'APEX\_%' ESCAPE '\' AND {c} NOT LIKE 'FLOWS\_%' ESCAPE '\' ]';

  FUNCTION ex(p_col VARCHAR2) RETURN VARCHAR2 IS
  BEGIN
    RETURN ' ' || p_col || REPLACE(x, '{c}', p_col) || ' ';
  END;

  PROCEDURE emit(s VARCHAR2, m VARCHAR2, v VARCHAR2) IS
  BEGIN
    DBMS_OUTPUT.PUT_LINE(s || ',' || m || ',' || REPLACE(REPLACE(REPLACE(v, ',', ' '), CHR(10), ' '), CHR(13), ' '));
  END;

  -- single value
  PROCEDURE q(s VARCHAR2, m VARCHAR2, p_sql VARCHAR2) IS
    v VARCHAR2(4000);
  BEGIN
    EXECUTE IMMEDIATE p_sql INTO v;
    emit(s, m, NVL(v, '0'));
  EXCEPTION WHEN OTHERS THEN
    emit('error', m, SUBSTR(SQLERRM, 1, 300));
  END;

  -- several rows: the query returns (metric, value)
  PROCEDURE qm(s VARCHAR2, p_sql VARCHAR2) IS
    c SYS_REFCURSOR;
    m VARCHAR2(400);
    v VARCHAR2(4000);
  BEGIN
    OPEN c FOR p_sql;
    LOOP
      FETCH c INTO m, v;
      EXIT WHEN c%NOTFOUND;
      emit(s, m, v);
    END LOOP;
    CLOSE c;
  EXCEPTION WHEN OTHERS THEN
    emit('error', s, SUBSTR(SQLERRM, 1, 300));
  END;
BEGIN
  emit('section', 'metric', 'value');
  emit('platform', 'platform', 'oracle');
  emit('platform', 'script_version', '2026.11');

  -- Platform
  q('platform', 'version',        'SELECT version FROM v$instance');
  q('platform', 'banner',         'SELECT banner FROM v$version WHERE ROWNUM = 1');
  q('platform', 'cpu_count',      q'[SELECT value FROM v$parameter WHERE name = 'cpu_count']');
  q('platform', 'sga_gb',         'SELECT TO_CHAR(ROUND(SUM(value) / 1073741824, 1)) FROM v$sga');
  q('platform', 'instance_count', 'SELECT TO_CHAR(COUNT(*)) FROM gv$instance');
  q('platform', 'exadata_cells',  'SELECT TO_CHAR(COUNT(*)) FROM v$cell');
  q('platform', 'is_cdb',         'SELECT cdb FROM v$database');
  q('platform', 'charset',        q'[SELECT value FROM nls_database_parameters WHERE parameter = 'NLS_CHARACTERSET']');
  q('platform', 'uptime_days',    'SELECT TO_CHAR(ROUND(SYSDATE - startup_time, 1)) FROM v$instance');

  -- Change data capture readiness (Fabric mirroring for Oracle needs LogMiner + ARCHIVELOG)
  q('cdc', 'archivelog_mode',      'SELECT log_mode FROM v$database');
  q('cdc', 'supplemental_logging', 'SELECT supplemental_log_data_min FROM v$database');
  q('cdc', 'goldengate_enabled',   q'[SELECT value FROM v$parameter WHERE name = 'enable_goldengate_replication']');

  -- Size
  q('size', 'total_size_gb',    'SELECT TO_CHAR(ROUND(SUM(bytes) / 1073741824, 2)) FROM dba_segments WHERE' || ex('owner'));
  q('size', 'datafile_size_gb', 'SELECT TO_CHAR(ROUND(SUM(bytes) / 1073741824, 2)) FROM dba_data_files');
  q('size', 'lob_size_gb',      q'[SELECT TO_CHAR(ROUND(SUM(bytes) / 1073741824, 2)) FROM dba_segments WHERE segment_type LIKE 'LOB%' AND]' || ex('owner'));
  q('size', 'largest_table_gb', q'[SELECT TO_CHAR(ROUND(MAX(s) / 1073741824, 2)) FROM (SELECT owner, segment_name, SUM(bytes) s
                                   FROM dba_segments WHERE segment_type LIKE 'TABLE%' AND]' || ex('owner') || ' GROUP BY owner, segment_name)');
  q('size', 'total_rows',       'SELECT TO_CHAR(SUM(num_rows)) FROM dba_tables WHERE' || ex('owner'));

  -- Inventory
  q('inventory', 'schema_count',            'SELECT TO_CHAR(COUNT(DISTINCT owner)) FROM dba_objects WHERE' || ex('owner'));
  q('inventory', 'table_count',             q'[SELECT TO_CHAR(COUNT(*)) FROM dba_tables WHERE temporary = 'N' AND secondary = 'N' AND nested = 'NO' AND dropped = 'NO' AND]' || ex('owner'));
  q('inventory', 'gtt_count',               q'[SELECT TO_CHAR(COUNT(*)) FROM dba_tables WHERE temporary = 'Y' AND]' || ex('owner'));
  q('inventory', 'external_table_count',    'SELECT TO_CHAR(COUNT(*)) FROM dba_external_tables WHERE' || ex('owner'));
  q('inventory', 'partitioned_table_count', 'SELECT TO_CHAR(COUNT(*)) FROM dba_part_tables WHERE' || ex('owner'));
  q('inventory', 'iot_count',               q'[SELECT TO_CHAR(COUNT(*)) FROM dba_tables WHERE iot_type = 'IOT' AND]' || ex('owner'));
  q('inventory', 'view_count',              'SELECT TO_CHAR(COUNT(*)) FROM dba_views WHERE' || ex('owner'));
  q('inventory', 'mview_count',             'SELECT TO_CHAR(COUNT(*)) FROM dba_mviews WHERE' || ex('owner'));
  qm('inventory', q'[SELECT CASE object_type
        WHEN 'PACKAGE' THEN 'package_count' WHEN 'PACKAGE BODY' THEN 'package_body_count'
        WHEN 'PROCEDURE' THEN 'proc_count' WHEN 'FUNCTION' THEN 'function_count'
        WHEN 'TRIGGER' THEN 'trigger_count' WHEN 'SEQUENCE' THEN 'sequence_count'
        WHEN 'SYNONYM' THEN 'synonym_count' WHEN 'TYPE' THEN 'type_count'
        WHEN 'JAVA CLASS' THEN 'java_class_count' END, TO_CHAR(COUNT(*))
      FROM dba_objects
      WHERE object_type IN ('PACKAGE','PACKAGE BODY','PROCEDURE','FUNCTION','TRIGGER','SEQUENCE','SYNONYM','TYPE','JAVA CLASS') AND]'
      || ex('owner') || ' GROUP BY object_type');
  q('inventory', 'dblink_count',         q'[SELECT TO_CHAR(COUNT(*)) FROM dba_db_links WHERE owner <> 'SYS']');
  q('inventory', 'invalid_object_count', q'[SELECT TO_CHAR(COUNT(*)) FROM dba_objects WHERE status = 'INVALID' AND]' || ex('owner'));

  -- Scheduling
  q('etl', 'scheduler_jobs', q'[SELECT TO_CHAR(COUNT(*)) FROM dba_scheduler_jobs WHERE enabled = 'TRUE' AND]' || ex('owner'));
  q('etl', 'legacy_jobs',    'SELECT TO_CHAR(COUNT(*)) FROM dba_jobs WHERE' || ex('schema_user'));

  -- PL/SQL code volume and feature usage (distinct program units)
  q('code', 'code_lines', q'[SELECT TO_CHAR(COUNT(*)) FROM dba_source WHERE type IN ('PACKAGE','PACKAGE BODY','PROCEDURE','FUNCTION','TRIGGER','TYPE BODY') AND]' || ex('owner'));
  q('code', 'wrapped_objects', q'[SELECT TO_CHAR(COUNT(*)) FROM dba_source WHERE line = 1 AND UPPER(text) LIKE '%WRAPPED%' AND]' || ex('owner'));
  qm('code', q'[SELECT f, TO_CHAR(COUNT(DISTINCT owner || '.' || name || '.' || type)) FROM (
        SELECT owner, name, type, CASE
          WHEN UPPER(text) LIKE '%CONNECT BY%' THEN 'connect_by_objects'
          WHEN UPPER(text) LIKE '%AUTONOMOUS_TRANSACTION%' THEN 'autonomous_tx_objects'
          WHEN UPPER(text) LIKE '%BULK COLLECT%' OR UPPER(text) LIKE '%FORALL %' THEN 'bulk_objects'
          WHEN UPPER(text) LIKE '%EXECUTE IMMEDIATE%' OR UPPER(text) LIKE '%DBMS_SQL.%' THEN 'dynamic_sql_objects'
          WHEN UPPER(text) LIKE '%UTL_FILE.%' OR UPPER(text) LIKE '%UTL_HTTP.%' OR UPPER(text) LIKE '%UTL_SMTP.%' THEN 'utl_objects'
          WHEN UPPER(text) LIKE '%MERGE INTO%' THEN 'merge_objects'
          WHEN UPPER(text) LIKE '%REF CURSOR%' OR UPPER(text) LIKE '%SYS_REFCURSOR%' THEN 'refcursor_objects'
          WHEN UPPER(text) LIKE '%CURSOR %' THEN 'cursor_objects'
        END f
        FROM dba_source WHERE]' || ex('owner') || q'[) WHERE f IS NOT NULL GROUP BY f]');
  q('code', 'connect_by_views', q'[SELECT TO_CHAR(COUNT(*)) FROM dba_views WHERE UPPER(text_vc) LIKE '%CONNECT BY%' AND]' || ex('owner'));

  -- Column data types that need attention in Fabric
  qm('types', q'[SELECT k, TO_CHAR(COUNT(*)) FROM (
        SELECT CASE
          WHEN c.data_type = 'NUMBER' AND c.data_precision IS NULL AND c.data_scale IS NULL THEN 'number_noprecision_columns'
          WHEN c.data_type IN ('CLOB','NCLOB','BLOB','BFILE','LONG','LONG RAW') THEN 'lob_columns'
          WHEN c.data_type = 'XMLTYPE' THEN 'xml_columns'
          WHEN c.data_type = 'SDO_GEOMETRY' THEN 'spatial_columns'
          WHEN c.data_type IN ('NCHAR','NVARCHAR2') THEN 'nchar_columns'
          WHEN c.data_type LIKE 'TIMESTAMP%TIME ZONE' THEN 'tz_columns'
          WHEN c.data_type LIKE 'INTERVAL%' THEN 'interval_columns'
          WHEN c.data_type IN ('ROWID','UROWID') THEN 'rowid_columns'
          WHEN c.data_type_owner IS NOT NULL AND c.data_type_owner NOT IN ('SYS','PUBLIC','MDSYS') THEN 'udt_columns'
          ELSE 'other_columns' END k
        FROM dba_tab_columns c
        WHERE EXISTS (SELECT 1 FROM dba_tables t WHERE t.owner = c.owner AND t.table_name = c.table_name) AND]' || ex('c.owner') || q'[) GROUP BY k]');

  -- Workload (no AWR: counters since instance startup)
  q('workload', 'user_count',       q'[SELECT TO_CHAR(COUNT(*)) FROM dba_users WHERE account_status = 'OPEN' AND]' || ex('username'));
  q('workload', 'sessions_max',     q'[SELECT TO_CHAR(max_utilization) FROM v$resource_limit WHERE resource_name = 'sessions']');
  q('workload', 'daily_user_calls', q'[SELECT TO_CHAR(ROUND(s.value / GREATEST(SYSDATE - i.startup_time, 1))) FROM v$sysstat s, v$instance i WHERE s.name = 'user calls']');
  q('workload', 'daily_executions', q'[SELECT TO_CHAR(ROUND(s.value / GREATEST(SYSDATE - i.startup_time, 1))) FROM v$sysstat s, v$instance i WHERE s.name = 'execute count']');
  -- Client programs connected right now (host names stripped) - helps detect ETL/BI tools
  qm('client_app', q'[SELECT * FROM (
        SELECT NVL(TRIM(REGEXP_SUBSTR(program, '^[^@(]+')), '(unknown)'), TO_CHAR(COUNT(*))
        FROM v$session WHERE type = 'USER'
        GROUP BY NVL(TRIM(REGEXP_SUBSTR(program, '^[^@(]+')), '(unknown)')
        ORDER BY COUNT(*) DESC) WHERE ROWNUM <= 25]');

  -- Security features
  q('security', 'vpd_policies',          'SELECT TO_CHAR(COUNT(*)) FROM dba_policies WHERE' || ex('object_owner'));
  q('security', 'redaction_policies',    'SELECT TO_CHAR(COUNT(*)) FROM redaction_policies');
  q('security', 'encrypted_tablespaces', q'[SELECT TO_CHAR(COUNT(*)) FROM dba_tablespaces WHERE encrypted = 'YES']');
  q('security', 'ols_installed',         q'[SELECT TO_CHAR(COUNT(*)) FROM dba_registry WHERE comp_id = 'OLS' AND status = 'VALID']');

  -- Largest tables (wave planning)
  IF v_names THEN
    qm('table_top', q'[SELECT owner || '.' || segment_name, TO_CHAR(ROUND(s / 1073741824, 2)) FROM (
          SELECT owner, segment_name, SUM(bytes) s FROM dba_segments
          WHERE segment_type LIKE 'TABLE%' AND]' || ex('owner') || q'[
          GROUP BY owner, segment_name ORDER BY s DESC) WHERE ROWNUM <= 25]');
  END IF;
END;
/
SPOOL OFF
SET TERMOUT ON
PROMPT Done. Output written to fabric_discovery_oracle.csv
