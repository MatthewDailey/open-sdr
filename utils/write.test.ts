import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { writeMarkdown } from './write'

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  promises: {
    writeFile: vi.fn(),
  },
}))

// Mock path module
vi.mock('path', () => ({
  join: vi.fn((a, b, c) => (c ? `${a}/${b}/${c}` : `${a}/${b}`)),
}))

describe('writeMarkdown', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Mock process.cwd()
    vi.spyOn(process, 'cwd').mockReturnValue('/test/directory')

    // Default behavior for fs.existsSync
    vi.mocked(fs.existsSync).mockReturnValue(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates the SDR notes directory if it does not exist', async () => {
    await writeMarkdown('Test content')

    expect(fs.existsSync).toHaveBeenCalledWith('/test/directory/SDR notes')
    expect(fs.mkdirSync).toHaveBeenCalledWith('/test/directory/SDR notes', { recursive: true })
  })

  it('does not create the SDR notes directory if it already exists', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)

    await writeMarkdown('Test content')

    expect(fs.existsSync).toHaveBeenCalledWith('/test/directory/SDR notes')
    expect(fs.mkdirSync).not.toHaveBeenCalled()
  })

  it('creates a subdirectory if specified', async () => {
    await writeMarkdown('Test content', { subdirectory: 'company' })

    expect(fs.existsSync).toHaveBeenCalledWith('/test/directory/SDR notes/company')
    expect(fs.mkdirSync).toHaveBeenCalledWith('/test/directory/SDR notes/company', {
      recursive: true,
    })
  })

  it('uses the provided filename if specified', async () => {
    await writeMarkdown('Test content', { filename: 'my-notes' })

    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      '/test/directory/SDR notes/my-notes.md',
      'Test content',
      'utf8',
    )
  })

  it('adds .md extension if not present in filename', async () => {
    await writeMarkdown('Test content', { filename: 'my-notes' })

    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      '/test/directory/SDR notes/my-notes.md',
      'Test content',
      'utf8',
    )
  })

  it('does not add duplicate .md extension', async () => {
    await writeMarkdown('Test content', { filename: 'my-notes.md' })

    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      '/test/directory/SDR notes/my-notes.md',
      'Test content',
      'utf8',
    )
  })

  it('returns the file path and a success message', async () => {
    const result = await writeMarkdown('Test content', { filename: 'my-notes' })

    expect(result).toEqual({
      filePath: '/test/directory/SDR notes/my-notes.md',
      message: 'Successfully wrote markdown to /test/directory/SDR notes/my-notes.md',
    })
  })
})
