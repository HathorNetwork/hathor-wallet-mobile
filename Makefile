locales := pt-br

locale_src = ./locale
src_files := $(foreach locale,$(locales),$(locale_src)/$(locale)/texts.po)

locale_out = ./src/locale
out_files := $(foreach locale,$(locales),$(locale_out)/$(locale)/texts.json)

.PHONY: all
all:
	@echo Available make targets:
	@echo - i18n
	@echo

.PHONY: i18n
i18n: compile_msgs

.PHONY: compile_msgs
compile_msgs: $(out_files)

$(locale_out)/%/texts.json: $(locale_src)/%/texts.po
	npx ttag po2json $< > $@

.PHONY: check_po
check_po: $(src_files)

%.po: $(locale_src)/texts.pot
	msgcmp $@ $<
	touch $@
