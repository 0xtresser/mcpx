# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of MCPX
- `McpXServer` class extending MCP SDK with payment support
- `createX402Middleware` for Express-based payment protection
- `createMcpRequestHandler` for MCP HTTP transport
- `createX402Fetch` client helper with automatic payment signing
- Support for `payBeforeService` and `payThenService` payment modes
- Static and dynamic pricing support
- EVM (Base, Base Sepolia) network support
- Solana network support (experimental)

### Security
- Payment signature verification via x402 facilitator
- Session-based payment config caching

## [0.1.0] - 2025-01-XX

### Added
- Initial public release

