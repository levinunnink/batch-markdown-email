# Batch Markdown Email

[![npm version](https://img.shields.io/npm/v/batch-markdown-email.svg?style=flat-square)](https://www.npmjs.com/package/batch-markdown-email)

A CLI tool for sending markdown-based newsletters via Postmark. This tool converts a Markdown file into HTML and sends it as an email newsletter to a list of recipients using Postmark's batch API.

## Features

- **Secure Credentials:** Uses [keytar](https://github.com/atom/node-keytar) to securely store your Postmark API credentials and broadcast stream.
- **Markdown to HTML:** Converts Markdown files to HTML using [markdown-it](https://github.com/markdown-it/markdown-it).
- **CSV Parsing:** Reads recipient emails from a CSV file.
- **Batch Processing:** Automatically splits messages into batches of up to 500 to comply with Postmark limits.
- **CLI Commands:** Offers `validate` and `send` commands for configuration testing and sending emails.

## Installation

Install the package globally from npm:

```bash
npm install -g batch-markdown-email
```

## Usage

The CLI provides two commands: `validate` and `send`.

## Send

The send command sends your newsletter via Postmark. You can optionally provide the --apiKey and --broadcastStream flags; if omitted, you’ll be prompted to enter them.

```bash
batch-markdown-email send --markdown ./path/to/newsletter.md --subject "Your Subject" --to ./path/to/recipients.csv [--apiKey YOUR_POSTMARK_API_KEY] [--broadcastStream YOUR_FROM_EMAIL]
```

You should format your email csv like this:

```csv
Emails
test@email.com
test2@email.com
"Testing Name" <testingname@email.com>
```

## Development

Clone the repository and install dependencies:

```bash
git clone https://github.com/yourusername/batch-markdown-email.git
cd batch-markdown-email
npm install
```

## Building

Compile the TypeScript source code to JavaScript:

```bash
npm run build
```

### Testing

You can test the CLI commands locally using:

```bash
npm run validate -- --markdown ./path/to/newsletter.md --subject "Test Subject" --to ./path/to/recipients.csv
npm run send -- --markdown ./path/to/newsletter.md --subject "Test Subject" --to ./path/to/recipients.csv
```

### License

This project is licensed under the MIT License.
