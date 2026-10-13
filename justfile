# List available recipes
default:
    @just --list

# Install dependencies (clean, from the lockfile)
install:
    npm ci

# Run the dev server, reachable from other devices on the local network (e.g. a phone)
dev:
    npm run dev -- --host

# Build the static site into dist/
build:
    npm run build

# Serve the production build locally
preview: build
    npm run preview

# Run unit tests
test:
    npm test

# Type-check with tsc
typecheck:
    npm run typecheck

# Auto-format and fix lint issues
fmt:
    npm run fmt

# Lint TypeScript, JavaScript and YAML
lint-js:
    npx eslint .

# Check formatting
lint-format:
    npx prettier --check .

# Lint markdown
lint-markdown:
    npx markdownlint-cli "**/*.md" --ignore node_modules --ignore dist

# Lint css
lint-css:
    npx stylelint "src/**/*.css"

# Lint the built html
lint-html: build
    npx html-validate dist/index.html

# Lint source files, then check the built html
lint: lint-js lint-format lint-markdown lint-css lint-html

# Everything CI runs
ci: install lint typecheck test build

# Remove build artifacts and caches
clean:
    rm -rf dist coverage
