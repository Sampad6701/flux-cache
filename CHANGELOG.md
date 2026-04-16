# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-04-10

### Added
- TypeScript type definitions (`src/index.d.ts`)
- Expanded Notes section in README with detailed guidance on:
  - Key serialization behavior and custom key functions
  - TTL behavior across different configurations
  - Memory management best practices for long-running processes
- CHANGELOG.md for tracking releases

### Changed
- Enhanced README Notes section with more practical examples and guidance

## [0.1.0] - 2026-04-10

### Added
- Initial release of flux cache
- Zero-config caching for sync and async functions
- Async call deduplication with Promise reuse
- TTL-based cache expiration
- Custom key generation support
- Manual cache invalidation (`clear()`, `delete()`)
- Optional hooks (`onHit`, `onMiss`)
- Comprehensive test suite (5 tests covering all features)
- Production-ready implementation (1.2KB gzipped)
- README with installation, usage, and API documentation
