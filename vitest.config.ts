/**
 * @fileoverview Configures Vitest for testing within the ref-tools project. Sets the root directory and enables global test variables.
 */

import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

let root = process.cwd()
if (!root.endsWith('ref-tools')) {
  root = resolve(root, 'ref-tools')
}

export default defineConfig({
  root,
  test: {
    globals: true,
  },
})
