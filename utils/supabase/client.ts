import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

function getCookie(name: string) {
  if (typeof document === "undefined") return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift();
  return undefined;
}

class ConvexQueryBuilder extends Promise<{ data: any; error: any }> {
  private table: string;
  private eqFilters: Array<{ field: string; value: any }> = [];
  private inFilters: Array<{ field: string; values: any[] }> = [];
  private orderField?: string;
  private orderDesc?: boolean;
  private client: ConvexHttpClient;
  private resolveFn?: (val: any) => void;

  constructor(table: string, client: ConvexHttpClient) {
    let resolveRef: (val: any) => void;
    super((resolve) => {
      resolveRef = resolve;
    });
    this.table = table;
    this.client = client;
    this.resolveFn = resolveRef!;
  }

  select(columns?: string) {
    return this;
  }

  eq(field: string, value: any) {
    this.eqFilters.push({ field, value });
    return this;
  }

  ilike(field: string, value: any) {
    this.eqFilters.push({ field, value });
    return this;
  }

  neq(field: string, value: any) {
    return this;
  }

  in(field: string, values: any[]) {
    this.inFilters.push({ field, values });
    return this;
  }

  order(field: string, options?: { ascending?: boolean; foreignTable?: string }) {
    this.orderField = field;
    this.orderDesc = options?.ascending === false;
    return this;
  }

  limit(count: number) {
    return this;
  }

  async single() {
    const { data, error } = await this.execute();
    return { data: data && data.length > 0 ? data[0] : null, error };
  }

  async maybeSingle() {
    const { data, error } = await this.execute();
    return { data: data && data.length > 0 ? data[0] : null, error };
  }

  private async execute() {
    try {
      const data = await this.client.query(api.db.genericQuery as any, {
        table: this.table,
        eqFilters: this.eqFilters,
        inFilters: this.inFilters,
        orderField: this.orderField,
        orderDesc: this.orderDesc,
      });
      return { data: data || [], error: null };
    } catch (err: any) {
      console.error(`Client error querying Convex table ${this.table}:`, err);
      return { data: [], error: err };
    }
  }

  async then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    const result = await this.execute();
    this.resolveFn!(result);
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }
}

class ConvexMutationBuilder extends Promise<{ data: any; error: any }> {
  private table: string;
  private operation: "insert" | "update" | "delete" | "upsert";
  private document?: any;
  private targetId?: string;
  private targetIds?: string[];
  private client: ConvexHttpClient;
  private uniqueKeys?: string[];
  private resolveFn?: (val: any) => void;

  constructor(
    table: string,
    operation: "insert" | "update" | "delete" | "upsert",
    client: ConvexHttpClient,
    options: { document?: any; targetId?: string; targetIds?: string[]; uniqueKeys?: string[] } = {}
  ) {
    let resolveRef: (val: any) => void;
    super((resolve) => {
      resolveRef = resolve;
    });
    this.table = table;
    this.operation = operation;
    this.client = client;
    this.document = options.document;
    this.targetId = options.targetId;
    this.targetIds = options.targetIds;
    this.uniqueKeys = options.uniqueKeys;
    this.resolveFn = resolveRef!;
  }

  eq(field: string, value: any) {
    if (field === "id") {
      this.targetId = String(value);
    }
    return this;
  }

  neq(field: string, value: any) {
    return this;
  }

  in(field: string, values: any[]) {
    if (field === "id") {
      this.targetIds = values.map(String);
    }
    return this;
  }

  select(columns?: string) {
    return this;
  }

  async single() {
    const res = await this.execute();
    return res;
  }

  private async execute() {
    try {
      let res: any = null;
      if (this.operation === "insert") {
        res = await this.client.mutation(api.db.genericInsert, {
          table: this.table,
          document: this.document,
        });
      } else if (this.operation === "upsert") {
        res = await this.client.mutation(api.db.genericUpsert, {
          table: this.table,
          document: this.document,
          uniqueKeys: this.uniqueKeys,
        });
      } else if (this.operation === "update") {
        if (this.targetId || this.targetIds) {
          await this.client.mutation(api.db.genericUpdate, {
            table: this.table,
            id: this.targetId,
            ids: this.targetIds,
            document: this.document,
          });
        }
      } else if (this.operation === "delete") {
        if (this.targetId || this.targetIds) {
          await this.client.mutation(api.db.genericDelete, {
            table: this.table,
            id: this.targetId,
            ids: this.targetIds,
          });
        }
      }
      return { data: res, error: null };
    } catch (err: any) {
      console.error(`Client error in Convex mutation ${this.operation} on table ${this.table}:`, err);
      return { data: null, error: err };
    }
  }

  async then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    const result = await this.execute();
    this.resolveFn!(result);
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }
}

class ConvexTableBuilder {
  private table: string;
  private client: ConvexHttpClient;

  constructor(table: string, client: ConvexHttpClient) {
    this.table = table;
    this.client = client;
  }

  select(columns?: string) {
    return new ConvexQueryBuilder(this.table, this.client).select(columns);
  }

  insert(document: any) {
    const doc = Array.isArray(document) ? document[0] : document;
    return new ConvexMutationBuilder(this.table, "insert", this.client, { document: doc });
  }

  upsert(document: any, options?: { onConflict?: string }) {
    const doc = Array.isArray(document) ? document[0] : document;
    const uniqueKeys = options?.onConflict ? options.onConflict.split(",") : undefined;
    return new ConvexMutationBuilder(this.table, "upsert", this.client, { document: doc, uniqueKeys });
  }

  update(document: any) {
    return new ConvexMutationBuilder(this.table, "update", this.client, { document });
  }

  delete() {
    return new ConvexMutationBuilder(this.table, "delete", this.client);
  }
}

export function createClient() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "https://tame-finch-608.convex.cloud";
  const client = new ConvexHttpClient(convexUrl);

  const token = getCookie("convexAuthToken");
  if (token) {
    client.setAuth(token);
  }

  return {
    auth: {
      getUser: async () => {
        if (!token) return { data: { user: null }, error: null };
        try {
          const payload = JSON.parse(
            Buffer.from(token.split(".")[1], "base64").toString()
          );
          const email = payload.email || "";
          let role = "alumno";
          try {
            role = await client.query(api.legacyAuth.getRoleByEmail, { email });
          } catch (e) {
            console.error("Error fetching user role client-side:", e);
          }

          const userMetadata: any = {
            full_name: payload.name || payload.email?.split("@")[0],
            role: role,
          };

          return {
            data: {
              user: {
                id: payload.sub,
                email: payload.email,
                user_metadata: userMetadata,
                created_at: new Date().toISOString(),
              },
            },
            error: null,
          };
        } catch {
          return { data: { user: null }, error: null };
        }
      },
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: async () => {},
    },
    channel: (_name?: string, _opts?: any) => ({
      on: function(..._args: any[]) { return this; },
      subscribe: function(cb?: any) { if (cb) cb('SUBSCRIBED'); return this; },
      unsubscribe: function() {},
      track: async () => {},
      presenceState: () => ({}),
    }),
    removeChannel: (_channel?: any) => {},
    removeAllChannels: () => {},
    from: (table: string) => new ConvexTableBuilder(table, client),
  };
}
