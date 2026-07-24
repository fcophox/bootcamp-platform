import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const client = new ConvexHttpClient("https://tame-finch-608.convex.cloud");

async function main() {
  console.log("Calling checkLegacyUser on Convex...");
  try {
    const res = await client.action(api.legacyAuth.checkLegacyUser, {
      email: "fcojhormazabalh@gmail.com",
      password: "admin123",
    });
    console.log("Result:", res);
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
