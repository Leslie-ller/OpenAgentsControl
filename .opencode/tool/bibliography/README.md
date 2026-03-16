# Bibliography Tooling

This tool validates whether the bibliography workflow has the external tooling it needs.

## Supported capabilities

- `discovery`
  - `BIBLIOGRAPHY_DISCOVERY_CMD`
  - fallback alias: `BIBLIOGRAPHY_SEARCH_CMD`
- `pdf_extract`
  - `BIBLIOGRAPHY_PDF_EXTRACT_CMD`
  - fallback aliases: `BIBLIOGRAPHY_PDF_CMD`, `MINERU_CMD`
- `reference_manager`
  - `BIBLIOGRAPHY_REFERENCE_MANAGER_CMD`
  - fallback aliases: `BIBLIOGRAPHY_ZOTERO_CMD`, `ZOTERO_CMD`

## Stage requirements

- `screening`: `discovery`, `reference_manager`
- `review`: `pdf_extract`, `reference_manager`
- `decision`: `reference_manager`
- `audit`: `reference_manager`

The tool checks whether each configured command exists on `PATH` or as an executable file path.
