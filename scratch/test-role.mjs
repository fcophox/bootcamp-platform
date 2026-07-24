import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const client = new ConvexHttpClient("https://tame-finch-608.convex.cloud");

async function test() {
  const email = "fcojhormazabalh@gmail.com";
  console.log(`Checking role for '${email}'...`);
  const role1 = await client.query(api.legacyAuth.getRoleByEmail, { email });
  console.log(`Result 1: '${role1}'`);

  const users = await client.query(api.users.listAllUsersWithRoles);
  console.log("All users in listAllUsersWithRoles:");
  console.log(JSON.stringify(users, null, 2));
}

test();
