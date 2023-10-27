locales := pt-br da ru-ru

locale_src = ./locale
src_files := $(foreach locale,$(locales),$(locale_src)/$(locale)/texts.po)

locale_out = ./src/locale
out_files := $(foreach locale,$(locales),$(locale_out)/$(locale)/texts.po.json)

.PHONY: all
all:
	@echo Available make targets:
	@echo - check_version
	@echo - i18n
	@echo - check_po
	@echo - check_pot
	@echo - update_pot
	@echo - check_missing_translations
	@echo

.PHONY: check_version
check_version:
	./scripts/check_version

.PHONY: update_pot
update_pot:
	npm run locale-update-pot

.PHONY: i18n
i18n: compile_msgs

.PHONY: compile_msgs
compile_msgs: $(out_files)

$(locale_out)/%/texts.po.json: $(locale_src)/%/texts.po
	mkdir -p $(dir $@)
	npx ttag po2json $< > $@

# check_po allow untranslated messages, it only checks that all .po files
# have all messages
check_po: STRICT = 0
.PHONY: check_po
check_po: _touch_pot $(src_files)

# check_po_strict does not allow untranslated messages
# it checks that all .po files have all messages and they are all translated
check_po_strict: STRICT = 1
.PHONY: check_po_strict
check_po_strict: _touch_pot $(src_files)

.PHONY: check_pot
check_pot:
	./scripts/check_pot

.PHONY: check_missing_translations
check_missing_translations:
	./scripts/check_missing_translations

.PHONY: _touch_pot
_touch_pot:
	touch $(locale_src)/texts.pot

%.po: $(locale_src)/texts.pot
	if [ $(STRICT) = 1 ]; then \
		msgcmp $@ $<; \
	else \
		msgcmp --use-untranslated $@ $<; \
	fi
	touch $@
