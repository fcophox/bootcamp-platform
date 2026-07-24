import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const client = new ConvexHttpClient("https://tame-finch-608.convex.cloud");

async function main() {
  const email = "fcojhormazabalh@gmail.com";
  console.log(`Checking role for ${email}...`);
  try {
    const role = await client.query(api.legacyAuth.getRoleByEmail, { email });
    console.log(`Role in Convex: "${role}"`);
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
