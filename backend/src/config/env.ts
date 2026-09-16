import dotenv from "dotenv";
import fs from "fs";
import path from "path";

const candidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, "../../../.env"),
];

const envFile = candidates.find((candidate) => fs.existsSync(candidate));
if (envFile) dotenv.config({ path: envFile });
