# AI Automated Unit Tests

Use AI to write your unit tests! Presently supports chatGPT and claude.

Recursively searches through the provided directory looking for `.js` and `.ts` files. It then tests any exported functions or exported classes with public methods. It creates one file per instance in the same directory.

## Usage

```
$ cp .env.example .env

# make the necessary changes to .env

$ npm i
$ npm run dev -- run --help

> chatgpt-tests@1.0.0 dev
> tsx src/index.ts run --help

Usage: index run [options] <testDir>

Run the CLI with specified options

Options:
  --maxTries <number>  Maximum number of tries (default: 5)
  --model <string>     Model to use (default: "claude-3-7-sonnet-20250219")
  --ai <string>        AI to use (chatGPT or claude) (default: "claude")
  --rootDir <string>   Root directory (default: "./")
  --language <string>  Coding language (default: "typescript")
  --sleep <number>     Sleep time between api calls (ms) (default: 1000)
  --export             Modify the sourcefile to export all top level declarations (default: false)
  -h, --help           display help for command

$ npm run dev -- run ./examples \
--model=claude-3-7-sonnet-20250219 \
--ai=claude \
--rootDir=./examples
```

## LICENSE

[MIT](LICENSE)