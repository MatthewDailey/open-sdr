/**
 * @fileoverview This file defines a command-line interface using yargs. It provides a 'hello' command that prints "Hello, world!".
 */




import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

yargs(hideBin(process.argv))
  .command('hello', 'Say hello', {}, (argv) => {
    console.log('Hello, world!')
  })
  .demandCommand(1)
  .help()
  .argv
