#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import * as fs from 'fs';
import * as path from 'path';
import markdownIt from 'markdown-it';
import { ServerClient } from 'postmark';
import csv from 'csv-parser';
import * as keytar from 'keytar';
import { chunkArray } from './utils/arrays';

const program = new Command();

program
  .option('-k, --apiKey <apiKey>', 'Postmark API Key')
  .option('-b, --broadcastStream <broadcastStream>', 'Postmark Broadcast Stream (used as the From address)')
  .requiredOption('-m, --markdown <markdownFile>', 'Path to the Markdown file')
  .requiredOption('-s, --subject <subject>', 'Email subject')
  .requiredOption('-t, --to <csvFile>', 'Path to CSV file containing recipient emails')
  .parse(process.argv);

const options = program.opts();

// Define constants for secure storage
const SERVICE_NAME = 'postmark-cli';
const API_KEY_ACCOUNT = 'postmark_api_key';
const BROADCAST_STREAM_ACCOUNT = 'broadcast_stream';

async function getCredential(
  account: string,
  flagValue: string | undefined,
  promptMessage: string
): Promise<string> {
  if (flagValue) {
    await keytar.setPassword(SERVICE_NAME, account, flagValue);
    return flagValue;
  }
  let credential = await keytar.getPassword(SERVICE_NAME, account);
  if (!credential) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'credential',
        message: promptMessage,
      },
    ]);
    credential = answers.credential;
    // Optional: validate the credential is not empty
    if (!credential) {
      throw new Error("Credential cannot be empty");
    }
    await keytar.setPassword(SERVICE_NAME, account, credential);
  }
  // TypeScript now knows credential is a non-null string
  return credential;
}

// Parse the recipients CSV file. This example assumes either a header "email" or uses the first column.
async function getRecipients(csvPath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const results: string[] = [];
    fs.createReadStream(csvPath)
      .on('error', (err) => reject(err))
      .pipe(csv())
      .on('data', (data) => {
        if (data.email) {
          results.push(data.email);
        } else {
          // Use the first column if no header is available
          const firstKey = Object.keys(data)[0];
          results.push(data[firstKey]);
        }
      })
      .on('end', () => {
        resolve(results);
      });
  });
}

async function main() {
  try {
    // Get Postmark API credentials and broadcast stream, allowing CLI overrides.
    const apiKey = await getCredential(API_KEY_ACCOUNT, options.apiKey, 'Enter your Postmark API Key:');
    const broadcastStream = await getCredential(
      BROADCAST_STREAM_ACCOUNT,
      options.broadcastStream,
      'Enter your Postmark Broadcast Stream (From address):'
    );

    // Read and parse the Markdown file to HTML.
    const markdownFilePath = path.resolve(options.markdown);
    if (!fs.existsSync(markdownFilePath)) {
      console.error(`Markdown file not found at path: ${markdownFilePath}`);
      process.exit(1);
    }
    const markdownContent = fs.readFileSync(markdownFilePath, 'utf8');
    const md = new markdownIt();
    const htmlBody = md.render(markdownContent);

    // Read the recipients list from the CSV file.
    const csvFilePath = path.resolve(options.to);
    if (!fs.existsSync(csvFilePath)) {
      console.error(`CSV file not found at path: ${csvFilePath}`);
      process.exit(1);
    }
    const recipients = await getRecipients(csvFilePath);
    if (recipients.length === 0) {
      console.error('No recipients found in the CSV file.');
      process.exit(1);
    }

    // Build the array of email messages.
    const messages = recipients.map((email) => ({
      From: broadcastStream,
      To: email,
      Subject: options.subject,
      HtmlBody: htmlBody,
      MessageStream: 'broadcast'
    }));

    // Create a Postmark client and send the emails via sendEmailBatch.
    const client = new ServerClient(apiKey);
    // Chunk messages into batches of 500 or less
    const batches = chunkArray(messages, 500);
    console.log(`Sending ${messages.length} messages in ${batches.length} batch(es).`);

    for (let i = 0; i < batches.length; i++) {
      try {
        const response = await client.sendEmailBatch(batches[i]);
        console.log(`Batch ${i + 1} sent successfully:`, response);
      } catch (error) {
        console.error(`Error sending batch ${i + 1}:`, error);
      }
    }
  } catch (error) {
    console.error('Error sending emails:');
    console.error(error);
    process.exit(1);
  }
}

main();
