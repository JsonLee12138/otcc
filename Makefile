.PHONY: tag

tag:
	@test -n "$(VERSION)" || (echo "VERSION is required, use: make tag VERSION=vX.Y.Z" && exit 1)
	bun run tag -- $(VERSION)
