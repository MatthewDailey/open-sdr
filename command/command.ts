/**
 * @fileoverview This file defines a command-line interface using yargs. It provides a 'hello' command that prints "Hello, world!".
 */

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { SDR } from './linkedin'

yargs(hideBin(process.argv))
  .command('hello', 'Say hello', {}, (argv) => {
    console.log('Hello, world!')
  })
  .command('login', 'Login to LinkedIn and save cookies', {}, async (argv) => {
    const sdr = new SDR()
    await sdr.login()
  })
  .demandCommand(1)
  .help().argv
