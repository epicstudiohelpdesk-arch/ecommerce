#!/usr/bin/env bash
set -euo pipefail

echo "=========================================="
echo "Running Handcrafted Marketplace Verification"
echo "=========================================="

echo "[1/6] Checking Node and pnpm versions..."
node --version
pnpm --version

echo "[2/6] Verifying pnpm frozen lockfile..."
pnpm install --frozen-lockfile

echo "[3/6] Verifying code formatting..."
pnpm format:check

echo "[4/6] Running linters across workspaces..."
pnpm lint

echo "[5/6] Running TypeScript type checks..."
pnpm typecheck

echo "[6/6] Running automated test suites..."
pnpm test

echo "[+] Building all monorepo workspaces..."
pnpm build

echo "=========================================="
echo "All Monorepo Verification Checks Passed!"
echo "=========================================="
