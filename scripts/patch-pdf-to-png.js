/**
 * Patches pdf-to-png-converter's normalizePath.js so it returns forward-slash
 * URL-style paths on Windows (pdfjs-dist rejects backslash paths).
 * Run automatically via the "postinstall" npm script.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetFile = path.join(
  __dirname,
  '../node_modules/pdf-to-png-converter/out/normalizePath.js'
);

if (!fs.existsSync(targetFile)) {
  console.log('patch-pdf-to-png: target file not found, skipping.');
  process.exit(0);
}

const original = fs.readFileSync(targetFile, 'utf8');
const patched = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePath = normalizePath;
const node_path_1 = require("node:path");
function normalizePath(path) {
    if (path === '') {
        throw new Error('Path cannot be empty');
    }
    const resolvedPath = (0, node_path_1.normalize)((0, node_path_1.resolve)(path));
    // pdfjs-dist requires forward-slash URL-style paths (Windows backslashes are rejected)
    const forwardSlashPath = resolvedPath.replace(/\\\\/g, '/');
    if (forwardSlashPath.endsWith('/')) {
        return forwardSlashPath;
    }
    return \`\${forwardSlashPath}/\`;
}
`;

if (original.includes('forwardSlashPath')) {
  console.log('patch-pdf-to-png: already patched, skipping.');
  process.exit(0);
}

fs.writeFileSync(targetFile, patched, 'utf8');
console.log('patch-pdf-to-png: normalizePath.js patched successfully.');
