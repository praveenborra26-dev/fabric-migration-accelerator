# Fabric Migration Assessment Accelerator

A self-contained web app that assesses an analytics migration to **Microsoft Fabric** from any source platform. It has built-in knowledge (features, Fabric gaps, migration routes) and a read-only discovery script for 28 platform types:

- **Microsoft:** SQL Server, Azure SQL Database / Managed Instance, Azure Synapse dedicated SQL pool
- **Cloud data platforms:** Snowflake, Databricks (Azure, AWS, GCP), Amazon Redshift, Google BigQuery
- **Enterprise warehouses and databases:** Oracle, Teradata, IBM Db2 (LUW, z/OS, IBM i), IBM Netezza, Vertica, Exasol, Greenplum
- **SAP:** ECC, S/4HANA, BW, BW/4HANA, HANA, ASE (Sybase), IQ
- **Open source:** PostgreSQL (incl. Aurora, Azure, Cloud SQL, AlloyDB), MySQL / MariaDB, ClickHouse
- **Data lakes:** Hadoop / Hive / Impala (Cloudera, HDP, EMR, HDInsight, Dataproc)
- **Anything else:** a generic INFORMATION_SCHEMA script plus manual intake for any SQL database

The accelerator drafts most of the assessment automatically. Every question accepts *Not sure*, read-only discovery scripts measure each platform, and an engine produces the results. A reviewer then confirms the remaining items on a validation checklist and signs off.

| Step | What happens |
|---|---|
| **1 · Capture** | Intake for the organization, source systems, ETL, BI, security, operations and target preferences. Every answer shows its source: provided, discovered, AI-extracted, derived or default. |
| **2 · Automate** | Read-only discovery scripts per platform. Import their `section,metric,value` output to answer most system questions. Optional AI agent for documents and code samples. |
| **3 · Results** | Complexity, migration pattern per system, target architecture, F-SKU sizing and run cost, effort and team, roadmap, risks and assumptions. |
| **4 · Validate & share** | Checklist of decisions and estimated inputs for a person to confirm, adjust or reject. Sign-off. Exports: report (.html), workbook (.xlsx), assessment file (.json), CSVs, scripts (.zip). |

The completion meter separates the work done by the accelerator from the work validated by people. With discovery imported for most systems, the accelerator typically covers 70–80% and a reviewer closes the rest.

---

## Run it

The whole app is one file: **`docs/index.html`**. It has no server, database or build step at run time.

- **On your computer:** open `docs/index.html` in Chrome, Edge, Firefox or Safari.
- **On a website:** host `docs/index.html` on any static host (below).

### Host on GitHub Pages

1. Create a repository on GitHub, for example `fabric-migration-accelerator`.
2. Upload the contents of this folder:
   - **Web:** *Add file → Upload files*, drag in the files and folders, then commit.
   - **Command line:**
     ```bash
     git init -b main
     git add .
     git commit -m "Fabric Migration Assessment Accelerator"
     git remote add origin https://github.com/praveenborra26-dev/fabric-migration-accelerator.git
     git push -u origin main
     ```
3. Go to *Settings → Pages → Build and deployment*. Set the source to **Deploy from a branch**, the branch to **main** and the folder to **/docs**, then save.
4. After a minute or two the site is live at `https://praveenborra26-dev.github.io/fabric-migration-accelerator/`.

Plan notes:
- **GitHub Free:** Pages works only from public repositories.
- **GitHub Pro, Team and Enterprise:** Pages also works from private repositories, but the site itself stays public on the internet.
- **Access-controlled site:** limiting who can open it needs an organization on GitHub Enterprise Cloud.

A public site exposes the tool, not your clients' data, because assessments never leave the user's browser (see *Data and privacy*).

### Other hosts

Copy `docs/index.html` to any static host:
- **Azure Static Web Apps:** supports Microsoft Entra ID sign-in, so you can limit access to your organization.
- **Azure Storage static website**
- **Netlify** or **Cloudflare Pages**
- **IIS or any intranet web server**

---

## What works where

| Feature | As a Claude artifact | Self-hosted (GitHub Pages, Azure, intranet, local file) |
|---|---|---|
| Intake, discovery import, all results, validation, sign-off | Yes | Yes |
| Report, workbook, JSON, CSV and scripts downloads | Yes, through Claude's download prompt | Yes, as normal browser downloads |
| Saving | Claude account (private to you) and this browser | This browser, plus the `.json` assessment file |
| AI agent (documents, code analysis, narrative, Q&A) | Yes, uses Claude | Not connected. See *Adding AI to a self-hosted copy*. |

### Adding AI to a self-hosted copy

The AI features call one function, `APP.caps.sample`, which Claude provides inside an artifact. To enable them on your own site:

1. Create a small server-side endpoint, for example an Azure Function, that calls the Anthropic API or Azure OpenAI. Keep the API key on the server. Never put a key in the page.
2. In `src/ui_core.js`, in the `initCaps()` branch for `host = 'web'`, assign a function with the same shape:
   - `sample(prompt, { signal, onText })` resolves to `{ text }`.
   - `sample.json(prompt, { signal })` resolves to the parsed JSON object the prompt asks for.
3. Rebuild with `python3 build.py`.

---

## Data and privacy

- **No backend and no telemetry.** Assessment data stays in the browser's local storage (key `fma.current.v1`) and in the files a user exports. Clearing the browser data removes it, so export the `.json` file to keep or share an assessment.
- **One external call:** fonts load from Google Fonts. To avoid it, delete the three font `<link>` lines in `src/index.template.html` and rebuild. The app falls back to system fonts.
- **Discovery scripts are read-only.** They query catalog views, statistics and query logs, never business data. The SQL Server, Teradata, Snowflake and BigQuery scripts create session-only temporary tables that disappear when the session ends.

| Script | Platform | Run with | Permissions |
|---|---|---|---|
| `fabric_discovery_sqlserver.sql` | SQL Server / Azure SQL MI | SSMS or Azure Data Studio | VIEW SERVER STATE, VIEW ANY DEFINITION |
| `fabric_discovery_oracle.sql` | Oracle | SQL*Plus or SQLcl | SELECT_CATALOG_ROLE |
| `fabric_discovery_teradata.bteq` | Teradata | BTEQ (or Teradata Studio) | SELECT on DBC views and DBC.QryLogV |
| `fabric_discovery_db2luw.sql` | Db2 LUW | Db2 CLP (db2 -x -tf) | CONNECT, catalog SELECT, SYSMON |
| `fabric_discovery_db2zos.sql` | Db2 z/OS | SPUFI, DSNTEP2 or Data Studio | SELECT on the SYSIBM catalog |
| `fabric_discovery_db2i.sql` | Db2 for i | ACS Run SQL Scripts | *USE on QSYS2 services |
| `fabric_discovery_sap_erp_hana.sql` | SAP ECC / S/4HANA | HANA Database Explorer / Studio | Read-only user on the ABAP schema (check licence) |
| `fabric_discovery_sap_bw_hana.sql` | SAP BW / BW/4HANA | HANA Database Explorer / Studio | Read-only user on the BW schema (check licence) |
| `fabric_discovery_hana_native.sql` | SAP HANA native | HANA Database Explorer / Studio | CATALOG READ |
| `fabric_discovery_synapse.sql` | Azure Synapse | sqlcmd or SSMS | VIEW DATABASE STATE, VIEW DEFINITION |
| `fabric_discovery_snowflake.sql` | Snowflake | Snowsight worksheet or SnowSQL | IMPORTED PRIVILEGES on the SNOWFLAKE database |
| `fabric_discovery_databricks.py` | Databricks | Databricks notebook (Python) | Catalog metadata access; SELECT on system tables |
| `fabric_discovery_redshift.sql` | Amazon Redshift | psql or Query editor v2 | Superuser, or sys:monitor + ACCESS SYSTEM TABLE |
| `fabric_discovery_bigquery.sql` | Google BigQuery | BigQuery console (one run per region) | BigQuery Metadata Viewer + Resource Viewer |
| `fabric_discovery_postgres.sql` | PostgreSQL / Greenplum | psql (one run per database) | Login; pg_read_all_stats for workload |
| `fabric_discovery_mysql.sql` | MySQL / MariaDB | mysql client (--batch --force) | PROCESS, SELECT on information_schema |
| `fabric_discovery_netezza.sql` | Netezza | nzsql | ADMIN or LIST/SELECT on _V_ views |
| `fabric_discovery_vertica.sql` | Vertica | vsql | dbadmin or SYSMONITOR role |
| `fabric_discovery_exasol.sql` | Exasol | DBeaver or another SQL client | SELECT ANY DICTIONARY |
| `fabric_discovery_clickhouse.sql` | ClickHouse | clickhouse-client (--format CSV) | SELECT on system tables |
| `fabric_discovery_hive_metastore.sql` | Hadoop / Hive metastore | mysql or psql on the metastore database | Read-only login on the metastore database |
| `fabric_discovery_generic.sql` | Any other database (ANSI) | Any SQL client | Read access to INFORMATION_SCHEMA |
| `fabric_discovery_sap_checklist.csv` | SAP transaction checklist | SAP GUI transactions | Basis / BW administrator |

---

## Change it

| To change | Edit |
|---|---|
| Fabric facts, feature gaps, platforms, questions, effort rates, activity baselines, default prices | `src/kb.js` |
| Inference, sizing, effort, roadmap, risk rules, completion model | `src/engine.js` |
| Demo assessment (fictional company) | `src/demo.js` |
| Screens | `src/ui_core.js` (state, saving, navigation), `src/ui_input.js` (intake), `src/ui_auto.js` (discovery, AI agent), `src/ui_results.js` (results, diagrams), `src/ui_validate.js` (validation, exports, rates) |
| Look and feel | `src/styles.css`, `src/index.template.html` |
| Discovery scripts | `scripts/` (bundled into the page at build time) |

Then rebuild and test:

```bash
python3 build.py              # writes docs/index.html (Python 3.8+)
node test/engine_test.js      # engine checks (Node.js 18+)
```

Users can also change prices and day rates in the app under *Rates & assumptions*. The Fabric facts in `src/kb.js` (pricing, mirroring sources, connector support, SAP notes) reflect Microsoft's documentation as of November 2026, so review them periodically.

## Licence

See [LICENSE](LICENSE).
