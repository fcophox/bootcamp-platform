import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const client = new ConvexHttpClient("https://tame-finch-608.convex.cloud");

async function test() {
  const sub = "p17as1agwqthmnwkwc6gjrrxkh8b0wkn";
  console.log(`Checking role for sub '${sub}'...`);
  const role = await client.query(api.legacyAuth.getRoleByEmail, { email: sub });
  console.log(`Result for sub '${sub}': '${role}'`);
}

test();
