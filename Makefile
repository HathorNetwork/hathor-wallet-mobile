locales := pt-br ru-ru

locale_src = ./locale
src_files := $(foreach locale,$(locales),$(locale_src)/$(locale)/texts.po)

locale_out = ./src/locale
out_files := $(foreach locale,$(locales),$(locale_out)/$(locale)/texts.json)

.PHONY: all
all:
	@echo Available make targets:
	@echo - i18n
	@echo - check_po
	@echo

.PHONY: i18n
i18n: compile_msgs

.PHONY: compile_msgs
compile_msgs: $(out_files)

$(locale_out)/%/texts.json: $(locale_src)/%/texts.po
	npx ttag po2json $< > $@

.PHONY: check_po
check_po: _touch_pot $(src_files)

.PHONY: _touch_pot
_touch_pot:
	touch $(locale_src)/texts.pot

%.po: $(locale_src)/texts.pot
	msgcmp $@ $<
	touch $@
