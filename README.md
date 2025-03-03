# ChatGPT Tests

Use ChatGPT to write your unit tests!

Recursively searches through the provided directory looking for `.js` and `.ts` files.

Presently, it only tests exported functions. It creates one file per exported function in the same directory.

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
  --model <string>     Model to use (default: "o1-mini")
  --ai <string>        AI to use (default: "chatGPT, claude")
  --rootDir <string>   Root directory (default: "./")
  --language <string>  Coding language (default: "typescript")
  -h, --help           display help for command

$ npm run dev -- run ./examples \
--model=claude-3-7-sonnet-20250219 \
--ai=claude \
--rootDir=./examples
```

## LICENSE

[MIT](LICENSE)