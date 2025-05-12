/**
 * @fileoverview LinkedIn automation tools using Puppeteer.
 */

import { Page, type Cookie } from 'puppeteer'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import fs from 'fs'
import path from 'path'
import { cleanUrlQueryParams } from '../utils/url'

puppeteer.use(StealthPlugin())

import { z } from 'zod'
import { GoogleAI } from './google'

export const ProfileSchema = z.object({
  name: z.string(),
  role: z.string(),
  company: z.string(),
  profileUrl: z.string(),
})

export type Profile = z.infer<typeof ProfileSchema>

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
          // console.log('Previous cookies loaded')
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
    const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(companyName)}&network=["${networkParam}"]`
    const screenshotName = `${companyName.replace(/\s+/g, '_')}_connections`
    return this.extractProfilesFromLinkedin(searchUrl, screenshotName)
  }

  /**
   * Find a profile by name and company
   * @param personName Name of the person to search for
   * @param companyName Company to search for
   */
  async findProfile(personName: string, companyName?: string): Promise<Profile> {
    const query = companyName ? `${companyName} ${personName}` : personName
    const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`
    const screenshotName = `${query.replace(/\s+/g, '_')}_person`

    const profileUrl = await this.withLinkedin(searchUrl, async (page) => {
      const viewProfileLinks = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'))
        return links
          .filter((link) => {
            const text = link.textContent?.trim()
            return text === 'View full profile'
          })
          .map((link) => link.getAttribute('href'))
          .filter((href) => href !== null) as string[]
      })

      if (viewProfileLinks.length === 1) {
        return viewProfileLinks[0]
      } else {
        return null
      }
    })

    if (profileUrl && typeof profileUrl === 'string') {
      return { name: personName, profileUrl, role: '', company: '' }
    }

    const profiles = await this.extractProfilesFromLinkedin(searchUrl, screenshotName)
    const nameMatchingProfile = profiles.filter((profile) =>
      profile.name.toLowerCase().includes(personName.toLowerCase()),
    )[0]
    if (nameMatchingProfile) {
      return nameMatchingProfile
    }

    throw new Error(`No profile found for ${personName}`)
  }

  /**
   * Find people I know that know a person
   * @param personName Name of the person to search for
   * @param companyName Company to search for
   */
  async findMutualConnections(
    personName: string,
    companyName?: string,
  ): Promise<{ mutuals: Profile[]; person: Profile }> {
    const person = await this.findProfile(personName, companyName)
    const profileUrl = person.profileUrl

    const mutualConnectionsUrl = await this.withLinkedin<string | null>(
      profileUrl,
      async (page) => {
        return await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a[href*="facetNetwork"]'))
          for (const link of links) {
            const href = link.getAttribute('href')
            if (
              href &&
              href.includes('facetNetwork=%22F%22') &&
              href.includes('facetConnectionOf=')
            ) {
              return href
            }
          }
          return null
        })
      },
    )

    if (mutualConnectionsUrl && typeof mutualConnectionsUrl === 'string') {
      const mutuals = await this.extractProfilesFromLinkedin(
        mutualConnectionsUrl,
        `${personName.replace(/\s+/g, '_')}_mutual_connections`,
      )
      return { mutuals, person }
    }

    return { mutuals: [], person }
  }

  private async extractProfilesFromLinkedin(url: string, name: string): Promise<Profile[]> {
    return await this.withLinkedin(url, async (page) => {
      const screenshotPath = path.join(process.cwd(), 'search_screenshots', `${name}.png`)
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
      })
      // console.log(`Search results screenshot saved to ${screenshotPath}`)

      const profileUrls: string[] = (
        await page.evaluate(() => {
          const results: string[] = []
          const profileLinks = Array.from(document.querySelectorAll('a[href*="linkedin.com/in/"]'))
            .map((link) => link.getAttribute('href'))
            .filter((href) => href && href.match(/https:\/\/www\.linkedin\.com\/in\/[\w-]+/))
            .filter((href, index, self) => self.indexOf(href) === index) as string[]
          profileLinks.forEach((profileUrl) => {
            results.push(profileUrl)
          })
          return results
        })
      ).map(cleanUrlQueryParams)

      const google = new GoogleAI()
      const profiles = await google.generateStructuredData(
        'Here is a screenshot of a LinkedIn search results page and some urls that appear on that page. Match the urls to the profiles in the screenshot. Return a list of profiles with the following fields: name, role, company, profileUrl. If a url does not match any profile in the screenshot, do not include it in the list. The role is typically on the line in line "Current: <role> at <company>", only include the role. \n\n' +
          profileUrls.join('\n'),
        z.array(ProfileSchema),
        screenshotPath,
      )

      return profiles
    })
  }

  private async withLinkedin<T>(url: string, fn: (page: Page) => Promise<T>) {
    const browser = await puppeteer.launch({
      headless: true,
      defaultViewport: { width: 1280, height: 800 },
      args: ['--window-size=1280,800'],
    })

    const page = await browser.newPage()

    try {
      if (fs.existsSync(this.cookiesPath)) {
        try {
          const cookiesStr = fs.readFileSync(this.cookiesPath, 'utf8')
          const cookiesArr = JSON.parse(cookiesStr)
          await page.setCookie(...cookiesArr)
          // console.log('Previous cookies loaded')
        } catch (err) {
          console.warn('Error loading cookies:', err)
        }
      } else {
        console.error('No cookies found. Please run the login method first.')
        await browser.close()
        return []
      }

      await page.goto(url, { waitUntil: 'load' })
      await new Promise((resolve) => setTimeout(resolve, 5000))

      return await fn(page)
    } finally {
      await browser.close()
    }
  }
}
