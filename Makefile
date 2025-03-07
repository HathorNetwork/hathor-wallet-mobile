.PHONY: all
all:
	@echo Available make targets:
	@echo - check_version - Validates all version numbers in the project
	@echo - i18n - Updates all translation files based on the source files
	@echo - check_i18n - Validates the current translation files
	@echo - bump - Bumps the version number of the project
	@echo

.PHONY: check_version
check_version:
	./scripts/check_version

.PHONY: i18n
i18n:
	node ./scripts/update_translations.js

.PHONY: check_i18n
check_i18n:
	node ./scripts/update_translations.js --ci-validation

# Usage:
#`3.0.1` -> make bump updateType=major -> `4.0.0`
#`3.0.1` -> make bump updateType=major bumpRc=true -> `4.0.0-rc.1`
#`3.0.1` -> make bump updateType=minor bumpRc=true -> `3.1.0-rc.1`
#`3.2.1` -> make bump updateType=patch -> `3.2.2`
#`3.2.1` -> make bump updateType=rc -> `3.2.1-rc.1`
#`3.2.1-rc.3` -> make bump updateType=release -> `3.2.1`
.PHONY: bump
bump:
	node scripts/bump-version.js $(updateType) $(if $(bumpRc),--bumpRc)
