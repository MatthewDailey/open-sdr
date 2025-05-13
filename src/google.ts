/**
 * @fileoverview Google AI integration using Vercel AI SDK.
 */

import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'

// Interface for message content types
interface TextPart {
  type: 'text'
  text: string
}

interface ImagePart {
  type: 'image'
  image: URL
}

type MessageContent = string | (TextPart | ImagePart)[]

/**
 * Class for Google AI integration
 */
export class GoogleAI {
  private apiKey: string

  constructor(private model: string = 'gemini-2.0-flash') {
    this.apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || ''
    if (!this.apiKey) {
      throw new Error(
        'Google Generative AI API key is required. Set it in the constructor or as GOOGLE_GENERATIVE_AI_API_KEY environment variable.',
      )
    }
  }

  /**
   * Generate structured data from a prompt with optional image
   * @param prompt Text prompt to send to the model
   * @param schema Zod schema representing the structure of the desired output
   * @param imagePath Optional path to a local image file to include with the prompt
   * @returns Generated structured data according to the provided schema
   */
  async generateStructuredData<T extends z.ZodType>(
    prompt: string,
    schema: T,
    imagePath?: string,
  ): Promise<z.infer<T>> {
    try {
      let content: MessageContent = prompt

      if (imagePath) {
        // Verify the image exists
        if (!fs.existsSync(imagePath)) {
          throw new Error(`Image not found at path: ${imagePath}`)
        }

        // Create a data URL from the image file
        const imageBuffer = fs.readFileSync(imagePath)
        const fileExtension = path.extname(imagePath).substring(1)
        const mimeType = `image/${fileExtension}`
        const base64Image = imageBuffer.toString('base64')
        const dataUrl = `data:${mimeType};base64,${base64Image}`

        content = [
          { type: 'text', text: prompt },
          { type: 'image', image: new URL(dataUrl) },
        ]
      }

      const result = await generateObject({
        model: google(this.model),
        schema,
        messages: [
          {
            role: 'user',
            content,
          },
        ],
      })

      return result.object as z.infer<T>
    } catch (error) {
      console.error('Error generating structured data:', error)
      throw error
    }
  }
}
