#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const inquirer_1 = __importDefault(require("inquirer"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const markdown_it_1 = __importDefault(require("markdown-it"));
const postmark_1 = require("postmark");
const csv_parser_1 = __importDefault(require("csv-parser"));
const keytar = __importStar(require("keytar"));
const arrays_1 = require("./utils/arrays");
const program = new commander_1.Command();
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
function getCredential(account, flagValue, promptMessage) {
    return __awaiter(this, void 0, void 0, function* () {
        if (flagValue) {
            yield keytar.setPassword(SERVICE_NAME, account, flagValue);
            return flagValue;
        }
        let credential = yield keytar.getPassword(SERVICE_NAME, account);
        if (!credential) {
            const answers = yield inquirer_1.default.prompt([
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
            yield keytar.setPassword(SERVICE_NAME, account, credential);
        }
        // TypeScript now knows credential is a non-null string
        return credential;
    });
}
// Parse the recipients CSV file. This example assumes either a header "email" or uses the first column.
function getRecipients(csvPath) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            const results = [];
            fs.createReadStream(csvPath)
                .on('error', (err) => reject(err))
                .pipe((0, csv_parser_1.default)())
                .on('data', (data) => {
                if (data.email) {
                    results.push(data.email);
                }
                else {
                    // Use the first column if no header is available
                    const firstKey = Object.keys(data)[0];
                    results.push(data[firstKey]);
                }
            })
                .on('end', () => {
                resolve(results);
            });
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Get Postmark API credentials and broadcast stream, allowing CLI overrides.
            const apiKey = yield getCredential(API_KEY_ACCOUNT, options.apiKey, 'Enter your Postmark API Key:');
            const broadcastStream = yield getCredential(BROADCAST_STREAM_ACCOUNT, options.broadcastStream, 'Enter your Postmark Broadcast Stream (From address):');
            // Read and parse the Markdown file to HTML.
            const markdownFilePath = path.resolve(options.markdown);
            if (!fs.existsSync(markdownFilePath)) {
                console.error(`Markdown file not found at path: ${markdownFilePath}`);
                process.exit(1);
            }
            const markdownContent = fs.readFileSync(markdownFilePath, 'utf8');
            const md = new markdown_it_1.default();
            const htmlBody = md.render(markdownContent);
            // Read the recipients list from the CSV file.
            const csvFilePath = path.resolve(options.to);
            if (!fs.existsSync(csvFilePath)) {
                console.error(`CSV file not found at path: ${csvFilePath}`);
                process.exit(1);
            }
            const recipients = yield getRecipients(csvFilePath);
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
            const client = new postmark_1.ServerClient(apiKey);
            // Chunk messages into batches of 500 or less
            const batches = (0, arrays_1.chunkArray)(messages, 500);
            console.log(`Sending ${messages.length} messages in ${batches.length} batch(es).`);
            for (let i = 0; i < batches.length; i++) {
                try {
                    const response = yield client.sendEmailBatch(batches[i]);
                    console.log(`Batch ${i + 1} sent successfully:`, response);
                }
                catch (error) {
                    console.error(`Error sending batch ${i + 1}:`, error);
                }
            }
        }
        catch (error) {
            console.error('Error sending emails:');
            console.error(error);
            process.exit(1);
        }
    });
}
main();
