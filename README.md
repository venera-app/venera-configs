# venera-configs

Configuration file repository for venera

## Create a new configuration

1. Download `_template_.js`, `_venera_.js`, put them in the same directory
2. Rename `_template_.js` to `your_config_name.js`
3. Edit `your_config_name.js` to your needs. 
   - The `_template_.js` file contains comments to help you with that. 
   - The `_venera_.js` is used for code completion in your IDE.

## Pull request checks

Source IDs (`key`) and file names in `index.json` must be non-empty and unique
across the entire index. Use the same `key` in the source file and its index entry.
Run `node scripts/validate-config-ids.js` locally to check the index.

On every PR, `PR Version Check` checks these IDs before verifying source versions.
Changed source files must match their index versions and increase the version of
existing sources. `PR Source Validate` builds the latest `venera_cli` and validates
changed root-level source files (excluding `_`-prefixed templates and helpers).
Non-draft PRs have auto-merge enabled; merge requirements depend on the repository's
branch protection settings. Pushes to `main` purge changed JS/JSON files from jsDelivr.
