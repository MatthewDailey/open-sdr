/**
 * @fileoverview Utility for writing markdown files to the SDR notes directory
 */

import fs from 'fs'
import path from 'path'

/**
 * Options for writing a markdown file
 */
export interface WriteMarkdownOptions {
  /**
   * The filename to use (without extension)
   */
  filename?: string

  /**
   * Optional directory path relative to the SDR notes directory
   * Will be created if it doesn't exist
   */
  subdirectory?: string
}

/**
 * Result of the write operation
 */
export interface WriteMarkdownResult {
  /**
   * The full path to the written file
   */
  filePath: string

  /**
   * Success message describing the operation
   */
  message: string
}

/**
 * Writes markdown content to a file in the SDR notes directory
 *
 * @param content - The markdown content to write
 * @param options - Options for the write operation
 * @returns Information about the write operation
 */
export async function writeMarkdown(
  content: string,
  options: WriteMarkdownOptions = {},
): Promise<WriteMarkdownResult> {
  // Get the current working directory
  const cwd = process.cwd()

  // Create the base SDR notes directory if it doesn't exist
  const notesDir = path.join(cwd, 'sdr_notes')
  if (!fs.existsSync(notesDir)) {
    fs.mkdirSync(notesDir, { recursive: true })
  }

  // Handle subdirectory if provided
  let targetDir = notesDir
  if (options.subdirectory) {
    targetDir = path.join(notesDir, options.subdirectory)
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }
  }

  // Generate a default filename if not provided
  const filename = options.filename || `notes-${new Date().toISOString().replace(/[:.]/g, '-')}`

  // Ensure the filename has a .md extension
  const fullFilename = filename.endsWith('.md') ? filename : `${filename}.md`

  // Create the full file path
  const filePath = path.join(targetDir, fullFilename)

  // Write the content to the file
  await fs.promises.writeFile(filePath, content, 'utf8')

  return {
    filePath,
    message: `Successfully wrote markdown to ${filePath}`,
  }
}
