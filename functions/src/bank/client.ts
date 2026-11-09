import { createSign } from "node:crypto";

/**
 * Minimal Enable Banking client (https://enablebanking.com/docs/api/reference/).
 * Every call is authenticated by a short-lived JWT signed with the application's
 * private key; `kid` is the application id.
 */
const API = "https://api.enablebanking.com";

const b64url = (data: string | Buffer) => Buffer.from(data).toString("base64url");

export function signJwt(appId: string, privateKeyPem: string, now = new Date()): string {
  const iat = Math.floor(now.getTime() / 1000);
  const header = b64url(JSON.stringify({ typ: "JWT", alg: "RS256", kid: appId }));
  // The API refuses tokens living longer than 24 h; one hour is plenty for a sync.
  const body = b64url(JSON.stringify({ iss: "enablebanking.com", aud: "api.enablebanking.com", iat, exp: iat + 3600 }));
  const signature = createSign("RSA-SHA256").update(`${header}.${body}`).sign(privateKeyPem);
  return `${header}.${body}.${b64url(signature)}`;
}

export interface Amount {
  amount: string;
  currency: string;
}

export interface ApiAccount {
  uid: string;
  account_id?: { iban?: string | null } | null;
  name?: string | null;
  product?: string | null;
  cash_account_type?: string | null;
  currency?: string | null;
}

export interface ApiTransaction {
  entry_reference?: string | null;
  transaction_id?: string | null;
  transaction_amount: Amount;
  credit_debit_indicator: "CRDT" | "DBIT";
  status: string;
  booking_date?: string | null;
  value_date?: string | null;
  transaction_date?: string | null;
  remittance_information?: string[] | null;
  creditor?: { name?: string | null } | null;
  debtor?: { name?: string | null } | null;
  creditor_account?: { iban?: string | null } | null;
  debtor_account?: { iban?: string | null } | null;
  bank_transaction_code?: { description?: string | null; code?: string | null; sub_code?: string | null } | null;
}

export interface ApiBalance {
  name?: string | null;
  balance_amount: Amount;
  balance_type: string;
  reference_date?: string | null;
}

export interface Aspsp {
  name: string;
  country: string;
  maximum_consent_validity?: number | null;
  psu_types?: string[];
}

export class BankApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Enable Banking ${status}: ${body.slice(0, 300)}`);
  }
}

export class EnableBanking {
  constructor(
    private readonly appId: string,
    private readonly privateKeyPem: string,
  ) {}

  private async call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${signJwt(this.appId, this.privateKeyPem)}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw new BankApiError(res.status, text);
    return JSON.parse(text) as T;
  }

  aspsps(country: string) {
    return this.call<{ aspsps: Aspsp[] }>("GET", `/aspsps?country=${encodeURIComponent(country)}&psu_type=personal`);
  }

  /** Starts a consent: returns the bank page to open. */
  startAuth(input: { aspsp: { name: string; country: string }; validUntil: Date; redirectUrl: string; state: string }) {
    return this.call<{ url: string; authorization_id?: string }>("POST", "/auth", {
      access: { valid_until: input.validUntil.toISOString() },
      aspsp: input.aspsp,
      state: input.state,
      redirect_url: input.redirectUrl,
      psu_type: "personal",
    });
  }

  /** Turns the code the bank sent back into a session holding the accounts. */
  createSession(code: string) {
    return this.call<{ session_id: string; accounts: ApiAccount[]; access: { valid_until: string } }>("POST", "/sessions", { code });
  }

  balances(accountUid: string) {
    return this.call<{ balances: ApiBalance[] }>("GET", `/accounts/${encodeURIComponent(accountUid)}/balances`);
  }

  /** Every page of booked and pending lines from `dateFrom` (YYYY-MM-DD). */
  async transactions(accountUid: string, dateFrom: string): Promise<ApiTransaction[]> {
    const all: ApiTransaction[] = [];
    let key: string | null = null;
    for (let page = 0; page < 50; page++) {
      const params = new URLSearchParams({ date_from: dateFrom });
      if (key) params.set("continuation_key", key);
      const res: { transactions: ApiTransaction[]; continuation_key?: string | null } = await this.call(
        "GET",
        `/accounts/${encodeURIComponent(accountUid)}/transactions?${params}`,
      );
      all.push(...res.transactions);
      key = res.continuation_key ?? null;
      if (!key) break;
    }
    return all;
  }
}
