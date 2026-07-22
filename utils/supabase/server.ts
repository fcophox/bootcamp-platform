import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery, fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

class ConvexQueryBuilder extends Promise<{ data: any; error: any }> {
  private table: string;
  private eqFilters: Array<{ field: string; value: any }> = [];
  private inFilters: Array<{ field: string; values: any[] }> = [];
  private orderField?: string;
  private orderDesc?: boolean;
  private token?: string;
  private resolveFn?: (val: any) => void;

  constructor(table: string, token?: string) {
    let resolveRef: (val: any) => void;
    super((resolve) => {
      resolveRef = resolve;
    });
    this.table = table;
    this.token = token;
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
      const data = await fetchQuery(
        api.db.genericQuery,
        {
          table: this.table,
          eqFilters: this.eqFilters,
          inFilters: this.inFilters,
          orderField: this.orderField,
          orderDesc: this.orderDesc,
        },
        this.token ? { token: this.token } : undefined
      );
      return { data: data || [], error: null };
    } catch (err: any) {
      console.error(`Error querying Convex table ${this.table}:`, err);
      return { data: [], error: err };
    }
  }

  // Override then to satisfy compiler when this object is directly awaited
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
  private token?: string;
  private uniqueKeys?: string[];
  private resolveFn?: (val: any) => void;

  constructor(
    table: string,
    operation: "insert" | "update" | "delete" | "upsert",
    options: { document?: any; targetId?: string; targetIds?: string[]; token?: string; uniqueKeys?: string[] } = {}
  ) {
    let resolveRef: (val: any) => void;
    super((resolve) => {
      resolveRef = resolve;
    });
    this.table = table;
    this.operation = operation;
    this.document = options.document;
    this.targetId = options.targetId;
    this.targetIds = options.targetIds;
    this.token = options.token;
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
        const insertRes = await fetchMutation(
          api.db.genericInsert,
          { table: this.table, document: this.document },
          this.token ? { token: this.token } : undefined
        );
        res = insertRes;
      } else if (this.operation === "upsert") {
        const upsertRes = await fetchMutation(
          api.db.genericUpsert,
          { table: this.table, document: this.document, uniqueKeys: this.uniqueKeys },
          this.token ? { token: this.token } : undefined
        );
        res = upsertRes;
      } else if (this.operation === "update") {
        if (this.targetId || this.targetIds) {
          await fetchMutation(
            api.db.genericUpdate,
            { table: this.table, id: this.targetId, ids: this.targetIds, document: this.document },
            this.token ? { token: this.token } : undefined
          );
        }
      } else if (this.operation === "delete") {
        if (this.targetId || this.targetIds) {
          await fetchMutation(
            api.db.genericDelete,
            { table: this.table, id: this.targetId, ids: this.targetIds },
            this.token ? { token: this.token } : undefined
          );
        }
      }
      return { data: res, error: null };
    } catch (err: any) {
      console.error(`Error in Convex mutation ${this.operation} on table ${this.table}:`, err);
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
  private token?: string;

  constructor(table: string, token?: string) {
    this.table = table;
    this.token = token;
  }

  select(columns?: string) {
    return new ConvexQueryBuilder(this.table, this.token).select(columns);
  }

  insert(document: any) {
    const doc = Array.isArray(document) ? document[0] : document;
    return new ConvexMutationBuilder(this.table, "insert", { document: doc, token: this.token });
  }

  upsert(document: any, options?: { onConflict?: string }) {
    const doc = Array.isArray(document) ? document[0] : document;
    const uniqueKeys = options?.onConflict ? options.onConflict.split(",") : undefined;
    return new ConvexMutationBuilder(this.table, "upsert", { document: doc, token: this.token, uniqueKeys });
  }

  update(document: any) {
    return new ConvexMutationBuilder(this.table, "update", { document, token: this.token });
  }

  delete() {
    return new ConvexMutationBuilder(this.table, "delete", { token: this.token });
  }
}

export async function createClient() {
  let currentUser: { id: string; email: string; user_metadata: any; created_at: string } | null = null;
  let token: string | undefined;

  try {
    token = await convexAuthNextjsToken();
    
    if (token) {
      // Get user info from Convex using getCurrentUserWithRole
      // This properly fetches email from the users table
      const userInfo = await fetchQuery(
        api.users.getCurrentUserWithRole,
        {},
        { token }
      );
      
      if (userInfo && userInfo.email) {
        currentUser = {
          id: userInfo.email, // Use email as id for compatibility
          email: userInfo.email,
          user_metadata: {
            full_name: userInfo.name || userInfo.email.split("@")[0] || "Usuario",
            role: userInfo.role || "alumno",
          },
          created_at: new Date().toISOString(),
        };
      }
    }
  } catch (err) {
    // Silently fail - user will be null
    currentUser = null;
  }

  return {
    auth: {
      getUser: async () => ({
        data: { user: currentUser },
        error: null as any,
      }),
      getSession: async () => ({
        data: { session: currentUser ? { user: currentUser } : null },
        error: null as any,
      }),
      updateUser: async (_attributes?: any) => ({
        data: { user: null as any },
        error: null as any,
      }),
      signInWithPassword: async (_credentials?: any) => ({
        data: { user: null as any, session: null as any },
        error: null as any,
      }),
      signUp: async (_credentials?: any) => ({
        data: { user: null as any, session: null as any },
        error: null as any,
      }),
      admin: {
        listUsers: async () => ({
          data: { users: [] as any[] },
          error: null as any,
        }),
        deleteUser: async () => ({ data: null as any, error: null as any }),
      },
    },
    from: (table: string) => new ConvexTableBuilder(table, token),
  };
}
