/* Demo assessment: a fictional retailer with Teradata, SAP ECC, SAP BW, SQL Server and Oracle. */
(function (root) {
  'use strict';
  const TD = 'section,metric,value\nplatform,platform,teradata\nplatform,version,17.20.03.09\nsize,total_size_gb,61440.50\nsize,largest_table_gb,6120.44\ninventory,table_count,6120\ninventory,nopi_table_count,310\ninventory,view_count,9880\ninventory,proc_count,388\ninventory,macro_count,1904\ninventory,function_count,61\ninventory,trigger_count,3\ninventory,join_index_count,44\ninventory,ppi_table_count,1122\ninventory,database_count,212\ncode,proc_macro_chars,4120330\ncode,qualify_objects,812\ncode,recursive_objects,9\ncode,volatile_table_objects,388\ncode,set_table_explicit,1210\ntypes,period_columns,96\ntypes,not_casespecific_columns,48211\ntypes,json_columns,12\ntypes,other_columns,212004\nworkload,user_count,2410\nworkload,queries_30d,4821000\nworkload,dbql_days,30\nworkload,peak_hour_queries,21400\nclient_app,BTEQ,1843221\nclient_app,INFORMATICA,922140\nclient_app,MSTRSVR,611204\nclient_app,TPTLOAD,88120\ntable_top,SALES.TRANSACTION_LINE,6120.44\ntable_top,SALES.TRANSACTION_HDR,2210.10';
  const MS = 'section,metric,value\nplatform,platform,mssql\nplatform,version,15.0.4365.2\nplatform,edition,Enterprise Edition (64-bit)\nsize,used_size_gb,2280.55\nsize,largest_table_gb,412.20\ninventory,table_count,1450\ninventory,view_count,512\ninventory,proc_count,802\ninventory,function_count,120\ninventory,trigger_count,14\ninventory,sequence_count,6\ninventory,linked_server_count,3\ninventory,database_count,9\ncode,code_lines,188220\ncode,cursor_objects,61\ncode,dynamic_sql_objects,140\ncode,xml_objects,12\ncode,cross_db_objects,77\ntypes,col_nvarchar,8120\ntypes,col_datetime,4410\ntypes,col_money,210\ntypes,unsupported_type_columns,12740\nworkload,login_count,412\nworkload,daily_batches,184300\nworkload,user_sessions_now,88\netl,agent_jobs,140\netl,ssisdb_packages,388\nbi,ssrs_reports,940\nbi,ssrs_reports_used_recent,512\ncdc,cdc_enabled_dbs,0\nsecurity,rls_policy_count,4\ntable_top,SalesDW.dbo.FactSales,412.20|2102330441';

  const ORA = 'section,metric,value\nplatform,platform,oracle\nplatform,version,19.0.0.0.0\ncdc,archivelog_mode,ARCHIVELOG\ncdc,supplemental_logging,NO\nsize,total_size_gb,14336.2\nsize,largest_table_gb,980.4\ninventory,table_count,3820\ninventory,view_count,1460\ninventory,mview_count,74\ninventory,package_count,410\ninventory,proc_count,160\ninventory,function_count,240\ninventory,trigger_count,180\ninventory,sequence_count,620\ninventory,dblink_count,12\ncode,code_lines,612000\ncode,connect_by_objects,41\ntypes,number_noprecision_columns,3120\ntypes,lob_columns,410\nworkload,user_count,910\nworkload,sessions_max,620\nworkload,daily_user_calls,880000\nsecurity,vpd_policies,14\nclient_app,pmdtm,40\nclient_app,JDBC Thin Client,120';
  const SAP = 'platform,platform,sap_erp\nplatform,db,hana\nsize,total_size_gb,7340.5\nsap,custom_tabl,1820\nsap,custom_ddls,140\nsap,custom_prog,5400\nsap,dialog_users,8120\nsap,active_datasources,2210\ntable_top,ACDOCA,1220.4\ntable_top,MATDOC,610.2\ntable_top,VBAP,140.0\ntable_top,BSEG,980.0';

  root.FMA_DEMO = {
    build(E) {
      const st = E.newState();
      st.name = 'Harborview Retail Group · Fabric migration assessment (demo)';
      const g = (id, v, src) => { st.g[id] = { v, src: src || 'user' }; };
      g('org_name', 'Harborview Retail Group (demo)');
      g('org_industry', 'retail'); g('org_size', 'l'); g('org_region', 'na');
      g('org_drivers', ['cost', 'eol', 'ai', 'consol', 'sap']);
      g('org_ms', ['e3', 'pbipro', 'azure', 'entra']);
      g('org_deadline', '2028-06');
      g('org_legacy_cost', 4200000);
      g('etl_tools', ['infa', 'ssis', 'bteq']); g('etl_jobs', 1800); g('etl_mix', 'balanced'); g('etl_scheduler', 'controlm'); g('etl_latency', 'hourly'); g('etl_daily_gb', 900);
      g('bi_tools', ['mstr', 'ssrs', 'bex', 'pbi', 'excel']); g('bi_reports', 3000); g('bi_viewers', 7500); g('bi_authors', 420); g('bi_concurrency', 520); g('bi_unused', 40);
      g('sec_regs', ['pci', 'ccpa', 'sox']); g('sec_pii', 'extensive'); g('sec_network', 'private'); g('sec_identity', 'hybrid'); g('ops_envs', '3'); g('ops_devops', 'partial');
      g('ops_skill_spark', 'low'); g('ops_skill_sql', 'high'); g('ops_team_fte', 12); g('bi_models', 180); g('tgt_parallel_weeks', 8); g('sec_rls', 'complex'); g('sec_masking', 'yes'); g('etl_feeds', 140);
      const add = (platform, name, ans) => { const s = E.newSystem(platform, name); Object.keys(ans || {}).forEach((k) => { s.a[k] = { v: ans[k], src: 'user' }; }); st.systems.push(s); return s; };
      const td = add('teradata', 'Teradata EDW', { s_role: 'edw', s_deploy: 'appliance', s_renewal: '2028-06' });
      const ecc = add('sap_ecc', 'SAP ECC 6.0 EHP8', { s_sap_extract: ['bw_odp', 'adf_cdc'], s_datasphere: 'planned', s_s4: 'planned', s_sap_tables: 340 });
      const bw = add('sap_bw', 'SAP BW 7.5', { s_bw_providers: 320, s_bw_queries: 1100, s_bw_chains: 140, s_bw_transforms: 610, s_bw_abap: 'medium', s_sap_extract: ['bw_odp'], s_data_tb: 18, s_datasphere: 'planned' });
      const ms = add('mssql', 'SQL Server sales mart', { s_role: 'mart', s_deploy: 'onprem' });
      const ora = add('oracle', 'Oracle supply-chain ODS', { s_role: 'ods', s_deploy: 'onprem' });
      const imp = (sys, txt, file) => { const p = E.parseDiscovery(txt); const m = E.mapDiscovery(p, sys.platform); E.applyDiscovery(st, sys, m, { file, rows: p.rows }); };
      imp(td, TD, 'fabric_discovery_teradata.csv');
      imp(ms, MS, 'sqlserver_discovery.csv');
      imp(ora, ORA, 'fabric_discovery_oracle.csv');
      imp(ecc, SAP, 'sap_erp_discovery.csv');
      // a few validations already done, to show the workflow
      st.validations['d:inventory'] = { status: 'confirmed', by: 'Assessment lead', at: new Date().toISOString(), note: 'Five systems confirmed in the kickoff workshop.' };
      st.validations['d:drivers'] = { status: 'confirmed', by: 'Client sponsor', at: new Date().toISOString(), note: 'Teradata renewal in June 2028 is the hard date.' };
      st.validations['d:disc:' + td.id] = { status: 'confirmed', by: 'Teradata DBA', at: new Date().toISOString(), note: 'Totals match Viewpoint.' };
      void ecc; void bw;
      return st;
    },
    samples: { teradata: TD, mssql: MS, oracle: ORA, sap_erp: SAP }
  };
})(typeof window !== 'undefined' ? window : globalThis);
