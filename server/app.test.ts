/**
 * @fileoverview Tests the main application logic, specifically the /api/ping endpoint. Verifies the application returns a 200 status and "pong" response.
 */

import { expect } from 'vitest'
import { createApp } from './app.js'
import request from 'supertest'

describe('app', () => {
  it('should return pong', async () => {
    const app = await createApp()
    const response = await request(app).get('/api/ping')
    expect(response.status).toBe(200)
    expect(response.text).toBe('pong')
  })
})
