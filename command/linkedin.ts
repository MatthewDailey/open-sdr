/**
 * @fileoverview LinkedIn automation tools using Puppeteer.
 */

import { type Cookie } from 'puppeteer'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import fs from 'fs'
import path from 'path'
import { cleanUrlQueryParams } from '../utils/url'

puppeteer.use(StealthPlugin())

export type Profile = {
  name: string
  role: string
  image: string
  profileLink: string
}

/**
 * Class for LinkedIn automation
 */
export class LinkedIn {
  private cookiesPath: string

  constructor(cookiesPath: string = path.join(process.cwd(), 'linkedin-cookies.json')) {
    this.cookiesPath = cookiesPath
  }

  /**
   * Opens a headed browser to LinkedIn for login
   * Saves cookies when the browser is closed by the user
   */
  async login(): Promise<void> {
    // Launch a headed browser
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: ['--start-maximized'],
    })

    const page = await browser.newPage()

    try {
      // Load cookies if they exist
      if (fs.existsSync(this.cookiesPath)) {
        try {
          const cookiesStr = fs.readFileSync(this.cookiesPath, 'utf8')
          const cookiesArr = JSON.parse(cookiesStr)
          await page.setCookie(...cookiesArr)
          console.log('Previous cookies loaded')
        } catch (err) {
          console.warn('Error loading cookies:', err)
        }
      }

      await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle2' })

      console.log('Please log in to LinkedIn. The browser will stay open until you close it.')

      let cookies: Cookie[] = []
      setInterval(async () => {
        cookies = await page.cookies()
        if (cookies.length > 0) {
          console.log('Cookies updated...')
          fs.writeFileSync(this.cookiesPath, JSON.stringify(cookies, null, 2))
        }
      }, 5000)

      await browser.waitForTarget((target) => target.opener() === null, { timeout: 0 })
    } catch (error: any) {
      if (!error?.message?.includes('Navigating frame was detached')) {
        console.error('Error during LinkedIn login:', error)
      }
    }
  }

  /**
   * Find connections at a specific company with specified connection degree
   * @param companyName Company to search for
   * @param degree Connection degree (first or second)
   */
  async findConnectionsAtCompany(
    companyName: string,
    degree: 'first' | 'second',
  ): Promise<Profile[]> {
    // Network parameter is "F" for first-degree connections, "S" for second-degree
    const networkParam = degree === 'first' ? 'F' : 'S'

    const browser = await puppeteer.launch({
      headless: true,
      defaultViewport: { width: 1280, height: 800 },
      args: ['--window-size=1280,800'],
    })

    const page = await browser.newPage()

    try {
      // Load cookies if they exist
      if (fs.existsSync(this.cookiesPath)) {
        try {
          const cookiesStr = fs.readFileSync(this.cookiesPath, 'utf8')
          const cookiesArr = JSON.parse(cookiesStr)
          await page.setCookie(...cookiesArr)
          console.log('Previous cookies loaded')
        } catch (err) {
          console.warn('Error loading cookies:', err)
        }
      } else {
        console.error('No cookies found. Please run the login method first.')
        await browser.close()
        return []
      }

      // Construct the search URL
      const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(companyName)}&network=["${networkParam}"]`

      console.log(`Finding ${degree} degree connections at ${companyName}...`)
      console.log(`Navigating to: ${searchUrl}`)

      await page.goto(searchUrl, { waitUntil: 'load' })
      await new Promise((resolve) => setTimeout(resolve, 5000))

      // Take a screenshot and save it with the company name
      const screenshotFilename = `${companyName.replace(/\s+/g, '_')}_connections.png`
      await page.screenshot({
        path: path.join('search_screenshots', screenshotFilename),
        fullPage: true,
      })
      console.log(`Screenshot saved to ${screenshotFilename}`)

      console.log('Browser open with search results. Close the browser when finished.')

      const profiles: Profile[] = await page.evaluate(() => {
        const results: Profile[] = []

        // Find all links on the page that match LinkedIn profile URLs
        const profileLinks = Array.from(document.querySelectorAll('a[href*="linkedin.com/in/"]'))
          .map((link) => link.getAttribute('href'))
          .filter((href) => href && href.match(/https:\/\/www\.linkedin\.com\/in\/[\w-]+/))
          // Remove duplicates
          .filter((href, index, self) => self.indexOf(href) === index) as string[]

        // Create profile objects with just the links
        // Other fields are empty as we're only collecting links now
        profileLinks.forEach((profileLink) => {
          results.push({
            name: '',
            role: '',
            image: '',
            profileLink,
          })
        })

        return results
      })

      // Clean profile links by removing query parameters
      profiles.forEach((profile) => {
        profile.profileLink = cleanUrlQueryParams(profile.profileLink)
      })

      console.log(profiles)

      return profiles
    } catch (error) {
      console.error(`Error finding connections at ${companyName}:`, error)
      return []
    } finally {
      if (browser && browser.isConnected()) {
        await browser.close()
      }
    }
  }
}
