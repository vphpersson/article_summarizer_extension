.PHONY: build extension-build extension-xpi extension-update

build: extension-xpi

extension-build:
	cd extension && npm run build

extension-xpi: extension-build
	cd extension/dist && zip -r -FS ../../article_summarizer.xpi *

extension-update:
	cd extension && npx ncu --upgrade && npm install
