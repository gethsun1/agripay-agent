import { Writable } from "node:stream";
import { createInterface } from "node:readline/promises";
import { hashPassword } from "./index.js";
if (!process.stdin.isTTY) throw new Error("Password hashing requires an interactive terminal");
const muted = new Writable({
  write(_chunk, _encoding, callback) {
    callback();
  },
});
const prompt = createInterface({ input: process.stdin, output: muted, terminal: true });
process.stderr.write("Operator passphrase (input hidden): ");
const first = await prompt.question("");
process.stderr.write("\nConfirm passphrase (input hidden): ");
const second = await prompt.question("");
process.stderr.write("\n");
prompt.close();
if (first !== second) throw new Error("Passphrases do not match");
console.log(await hashPassword(first));
