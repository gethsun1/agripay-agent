import {
  AccountCreateTransaction,
  AccountId,
  AccountInfoQuery,
  Hbar,
  PrivateKey,
  PublicKey,
} from "@hashgraph/sdk";
import { mkdir, open, readFile, rename, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createTestnetClient, hashscanAccountUrl, hashscanTransactionUrl } from "./index.js";

export const FUNDING = { buyer: 100, seller: 5, facilitator: 100 } as const;
export const MAX_PROVISIONING_HBAR = 211;
export const SECRETS_PATH = ".secrets/hedera-testnet.env";

export interface BootstrapConfig {
  network: string;
  accountId: string;
  privateKey: string;
}

export interface PublicProvisionedAccount {
  role: keyof typeof FUNDING;
  accountId: string;
  publicKey: string;
  initialBalanceHbar: number;
  accountUrl: string;
  transactionId: string;
  transactionUrl: string;
}

export function validateBootstrap(env: NodeJS.ProcessEnv): BootstrapConfig {
  if (env.HEDERA_NETWORK !== "testnet") throw new Error("Provisioning refuses non-testnet network");
  if (!/^0\.0\.\d+$/.test(env.HEDERA_BOOTSTRAP_ACCOUNT_ID ?? "")) {
    throw new Error("Missing or invalid HEDERA_BOOTSTRAP_ACCOUNT_ID");
  }
  if (!(env.HEDERA_BOOTSTRAP_PRIVATE_KEY ?? "").trim()) {
    throw new Error("Missing HEDERA_BOOTSTRAP_PRIVATE_KEY");
  }
  const accountId = env.HEDERA_BOOTSTRAP_ACCOUNT_ID;
  const privateKey = env.HEDERA_BOOTSTRAP_PRIVATE_KEY;
  if (!accountId || !privateKey) throw new Error("Missing bootstrap configuration");
  return {
    network: "testnet",
    accountId,
    privateKey,
  };
}

export function assertProvisioningAllowed(stateExists: boolean): void {
  if (stateExists) throw new Error("Provisioning state already exists; refusing rerun");
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function createRoleAccount(
  role: keyof typeof FUNDING,
  bootstrap: BootstrapConfig,
): Promise<{ public: PublicProvisionedAccount; privateKey: string }> {
  const client = createTestnetClient({
    accountId: bootstrap.accountId,
    privateKey: bootstrap.privateKey,
  });
  try {
    const key = PrivateKey.generateECDSA();
    const transaction = await new AccountCreateTransaction()
      .setKeyWithoutAlias(key.publicKey)
      .setInitialBalance(new Hbar(FUNDING[role]))
      .setMaxTransactionFee(new Hbar(2))
      .setTransactionValidDuration(120)
      .execute(client);
    const receipt = await Promise.race([
      transaction.getReceipt(client),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("Account creation receipt timeout"));
        }, 30_000);
      }),
    ]);
    const accountId = receipt.accountId?.toString();
    if (!accountId) throw new Error(`Account creation for ${role} returned no account ID`);
    const transactionId = transaction.transactionId.toString();
    return {
      privateKey: key.toStringDer(),
      public: {
        role,
        accountId,
        publicKey: key.publicKey.toStringDer(),
        initialBalanceHbar: FUNDING[role],
        accountUrl: hashscanAccountUrl(accountId),
        transactionId,
        transactionUrl: hashscanTransactionUrl(transactionId),
      },
    };
  } finally {
    client.close();
  }
}

async function writeSecrets(
  accounts: { public: PublicProvisionedAccount; privateKey: string }[],
): Promise<void> {
  await mkdir(".secrets", { mode: 0o700 });
  await import("node:fs/promises").then(({ chmod }) => chmod(".secrets", 0o700));
  const lines = accounts.flatMap(({ public: account, privateKey }) => {
    const prefix = `HEDERA_${account.role.toUpperCase()}`;
    return [`${prefix}_ACCOUNT_ID=${account.accountId}`, `${prefix}_PRIVATE_KEY=${privateKey}`];
  });
  const temporary = `${SECRETS_PATH}.${randomUUID()}.tmp`;
  const handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(`${lines.join("\n")}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporary, SECRETS_PATH);
}

export async function provisionAccounts(
  bootstrap: BootstrapConfig,
): Promise<PublicProvisionedAccount[]> {
  if (bootstrap.network !== "testnet") throw new Error("Provisioning refuses non-testnet network");
  assertProvisioningAllowed(await exists(SECRETS_PATH));
  const client = createTestnetClient({
    accountId: bootstrap.accountId,
    privateKey: bootstrap.privateKey,
  });
  try {
    const info = await new AccountInfoQuery()
      .setAccountId(AccountId.fromString(bootstrap.accountId))
      .setMaxQueryPayment(new Hbar(1))
      .execute(client);
    const configured = PrivateKey.fromStringECDSA(bootstrap.privateKey).publicKey.toBytes();
    if (
      !(info.key instanceof PublicKey) ||
      !Buffer.from(info.key.toBytes()).equals(Buffer.from(configured))
    )
      throw new Error("Bootstrap key does not match account");
  } finally {
    client.close();
  }

  const created: { public: PublicProvisionedAccount; privateKey: string }[] = [];
  try {
    for (const role of ["buyer", "seller", "facilitator"] as const) {
      created.push(await createRoleAccount(role, bootstrap));
    }
    await writeSecrets(created);
    return created.map((entry) => entry.public);
  } catch (error) {
    if (created.length > 0) {
      await mkdir(".secrets", { mode: 0o700 });
      await writeFile(
        ".secrets/provisioning-recovery.json",
        JSON.stringify(
          created.map((entry) => entry.public),
          null,
          2,
        ),
        { mode: 0o600, flag: "wx" },
      ).catch(() => undefined);
      throw new Error(
        "Provisioning partially succeeded; inspect the private recovery state safely",
      );
    }
    throw error;
  }
}

export async function loadEnvironmentFile(path: string): Promise<NodeJS.ProcessEnv> {
  const text = await readFile(path, "utf8");
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}
