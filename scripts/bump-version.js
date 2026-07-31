#!/usr/bin/env node
/**
 * Bumps the patch version in src/manifest.json (and mirrors it into
 * package.json) so every build pushed to main is a distinct, detectable
 * version — the extension's update-checker compares against this.
 *
 * Usage: node scripts/bump-version.js [patch|minor|major]  (default: patch)
 */
const fs = require('fs')
const path = require('path')

const bumpKind = process.argv[2] || 'patch'
const manifestPath = path.join(__dirname, '..', 'src', 'manifest.json')
const packagePath = path.join(__dirname, '..', 'package.json')

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const [major, minor, patch] = manifest.version.split('.').map(Number)

const nextVersion =
  bumpKind === 'major'
    ? `${major + 1}.0.0`
    : bumpKind === 'minor'
      ? `${major}.${minor + 1}.0`
      : `${major}.${minor}.${patch + 1}`

manifest.version = nextVersion
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
pkg.version = nextVersion
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n')

console.log(nextVersion)
