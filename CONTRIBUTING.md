# Contributing to MCPX

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing.

## Development Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/0xtresser/mcpx.git
   cd mcpx
   ```

2. **Install dependencies**

   ```bash
   cd packages/mcpx
   npm install
   ```

3. **Run tests**

   ```bash
   npm test
   ```

4. **Build**

   ```bash
   npm run build
   ```

## Code Style

- We use **ESLint** and **Prettier** for code formatting
- Run `npm run lint` to check for issues
- Run `npm run lint:fix` to auto-fix issues
- Run `npm run format` to format code

## Pull Request Process

1. Fork the repository and create your branch from `main`
2. Make your changes and add tests if applicable
3. Ensure all tests pass: `npm test`
4. Ensure linting passes: `npm run lint`
5. Update documentation if needed
6. Submit a pull request

## Commit Messages

We follow conventional commits:

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation changes
- `test:` adding or updating tests
- `refactor:` code refactoring
- `chore:` maintenance tasks

Example: `feat: add retry logic for failed settlements`

## Reporting Issues

When reporting issues, please include:

- A clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node.js version, OS, etc.)

## Questions?

Feel free to open an issue for any questions or discussions.

