/**
 * @fileoverview LinkedIn automation tools using Puppeteer.
 */

import { Browser, Page, type Cookie } from 'puppeteer'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import fs from 'fs'
import path from 'path'
import { cleanUrlQueryParams } from './url.js'

puppeteer.use(StealthPlugin())

import { z } from 'zod'
import { GoogleAI } from './google.js'
import chalk from 'chalk'

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
    if (!fs.existsSync(this.cookiesPath)) {
      console.log(
        chalk.yellow(
          'A browser will open to LinkedIn, please sign in. This is the browser OpenSDR will use to access LinkedIn.\n\nPress [Enter] to proceed.',
        ),
      )
      await new Promise((resolve) => process.stdin.once('data', resolve))
    }

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

      let cookies: Cookie[] = []
      const interval = setInterval(async () => {
        cookies = await page.cookies()
        if (cookies.length > 0) {
          fs.writeFileSync(this.cookiesPath, JSON.stringify(cookies, null, 2))
        }
      }, 5000)

      await page.waitForFunction(
        () => window.location.href.includes('https://www.linkedin.com/feed/'),
        { timeout: 0 }, // No timeout - wait indefinitely until user logs in and reaches feed
      )
      console.log(chalk.green('✔︎ Successfully logged in'))

      await new Promise((resolve) => setTimeout(resolve, 3000))
      clearInterval(interval)
      await browser.close()
      process.exit(0)
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
    const profiles = await this.extractProfilesFromLinkedin(
      searchUrl,
      screenshotName,
      `VERY IMPORTANT: Only include profiles of people that work at the company '${companyName}' and be sure this is correct, ignore other profiles.`,
    )
    return profiles.filter((profile) =>
      profile.company.toLowerCase().includes(companyName.toLowerCase()),
    )
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
   * Open a browser to a LinkedIn profile with the message draft open and filled in.
   * @param profileUrl LinkedIn profile URL
   * @param message Message to draft
   */
  async draftMessage(profileUrl: string, message: string): Promise<boolean> {
    return (
      (await this.withLinkedin(
        profileUrl,
        async (page) => {
          // Wait for the message button and click it
          // Try multiple selector strategies to find the message button
          try {
            await page.waitForSelector(`button[aria-label*="Message"]`, {
              timeout: 5000,
            })
          } catch (error) {
            console.error('No message button found on ' + profileUrl)
            return false
          }

          const messageButtons = await page.$$(`button[aria-label*="Message"]`)

          // Click the second button if it exists, otherwise click the first one
          if (messageButtons.length >= 2) {
            await messageButtons[1].click()
          } else if (messageButtons.length === 1) {
            await messageButtons[0].click()
          } else {
            throw new Error(`No message button found`)
          }

          await new Promise((resolve) => setTimeout(resolve, 2000))

          await page.keyboard.type(message)
          return true
        },
        { headless: false, useExistingBrowser: true },
      )) || false
    )
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

    const mutualConnectionsUrl = await this.withLinkedin(profileUrl, async (page) => {
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
    })

    if (mutualConnectionsUrl && typeof mutualConnectionsUrl === 'string') {
      const mutuals = await this.extractProfilesFromLinkedin(
        mutualConnectionsUrl,
        `${personName.replace(/\s+/g, '_')}_mutual_connections`,
      )
      return { mutuals, person }
    }

    return { mutuals: [], person }
  }

  private async extractProfilesFromLinkedin(
    url: string,
    name: string,
    additionalInstructions: string = '',
  ): Promise<Profile[]> {
    return (
      (await this.withLinkedin(url, async (page) => {
        const screenshotPath = path.join(process.cwd(), 'search_screenshots', `${name}.png`)

        // Remove summary elements that include a bunch of random text that can confuse the LLM
        await page.evaluate(() => {
          const summaryElements = document.querySelectorAll(
            'p[class*="entity-result__summary--2-lines"]',
          )
          summaryElements.forEach((el) => el.remove())
        })

        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
        })
        // console.log(`Search results screenshot saved to ${screenshotPath}`)

        const profileUrls: string[] = (
          await page.evaluate(() => {
            const results: string[] = []
            const profileLinks = Array.from(
              document.querySelectorAll('a[href*="linkedin.com/in/"]'),
            )
              .map((link) => link.getAttribute('href'))
              .filter((href) => href && href.match(/https:\/\/www\.linkedin\.com\/in\/[\w-]+/))
              .filter((href, index, self) => self.indexOf(href) === index) as string[]
            profileLinks.forEach((profileUrl) => {
              results.push(profileUrl)
            })
            return results
          })
        )
          .map(cleanUrlQueryParams)
          .filter((url) => {
            // Filter out URLs with final slug >38 characters and containing numbers
            // Extract the slug (the part after /in/)
            const match = url.match(/linkedin\.com\/in\/([\w-]+)/)
            if (!match) return false

            const slug = match[1]

            // Check if slug is >38 characters and contains numbers
            if (slug.length > 38 && /\d/.test(slug)) {
              return false
            }

            return true
          })

        // const google = new GoogleAI('gemini-2.5-pro-preview-05-06')
        const google = new GoogleAI('gemini-2.0-flash')
        const profiles = await google.generateStructuredData(
          `Here is a screenshot of a LinkedIn search results page and some urls that appear on that page. Match the urls to the profiles in the screenshot. Return a list of profiles with the following fields: name, role, company, profileUrl. If no profiles are found, return an empty list.` +
            additionalInstructions +
            '\n\n' +
            profileUrls.join('\n'),
          z.array(ProfileSchema),
          screenshotPath,
        )

        return profiles
      })) || []
    )
  }

  private async withLinkedin<T>(
    url: string,
    fn: (page: Page) => Promise<T>,
    options: { headless: boolean; useExistingBrowser: boolean } = {
      headless: true,
      useExistingBrowser: false,
    },
  ) {
    const browser =
      options.useExistingBrowser && this.browser
        ? this.browser
        : await puppeteer.launch({
            headless: options.headless,
            defaultViewport: options.headless ? { width: 1280, height: 800 } : null,
            args: options.headless ? ['--window-size=1280,800'] : [],
          })
    this.browser = browser

    const pages = await browser.pages()
    const page =
      pages.length > 0 && !options.useExistingBrowser ? pages[0] : await browser.newPage()

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
        return undefined
      }

      await page.goto(url, { waitUntil: 'load' })
      await new Promise((resolve) => setTimeout(resolve, 5000))

      const result = await fn(page)

      if (!options.headless) {
        await browser.waitForTarget((target) => target.opener() === null, { timeout: 0 })
      }

      return result
    } finally {
      await browser.close()
      this.browser = undefined
    }
  }

  private browser: Browser | undefined = undefined
}
