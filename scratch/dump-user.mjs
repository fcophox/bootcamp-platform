import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const client = new ConvexHttpClient("https://tame-finch-608.convex.cloud");

async function test() {
  console.log("Fetching all users via listAllUsersWithRoles...");
  const users = await client.query(api.users.listAllUsersWithRoles);
  const target = users.find(u => u.email === "fcojhormazabalh@gmail.com");
  console.log("Target user:", JSON.stringify(target, null, 2));
}

test();
