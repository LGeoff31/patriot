import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ORIGIN = "https://dibbs2.bsm.dla.mil";

/** One RFQ line item from the daily DIBBS index. */

// https://dibbs2.bsm.dla.mil/Downloads/RFQ/Archive/in261108.txt

export type Rfq = {
  solicitation: string;
  nsn: string | null;
  name: string;
  quantity: number;
  unit: string;
  /** Day the index file was posted, YYYY-MM-DD. */
  posted: string;
  returnBy: string;
  url: string;
};

/**
 * The daily file is fixed-width, 140 characters, one line item per line:
 * solicitation 1-13, NSN or part number 14-62, return-by 73-80,
 * quantity 100-106, unit 107-108, name 109-129.
 */
export function parseIndex(text: string, posted: string): Rfq[] {
  const rfqs: Rfq[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.length !== 140) continue;
    const id = line.slice(0, 13).trim();
    const item = line.slice(13, 62).trim();
    const [month, day, year] = line.slice(72, 80).split("/");
    rfqs.push({
      solicitation: `${id.slice(0, 6)}-${id.slice(6, 8)}-${id.slice(8, 9)}-${id.slice(9)}`,
      nsn: /^\d{13}$/.test(item)
        ? `${item.slice(0, 4)}-${item.slice(4, 6)}-${item.slice(6, 9)}-${item.slice(9)}`
        : null,
      name: line.slice(108, 129).trim(),
      quantity: Number(line.slice(99, 106)),
      unit: line.slice(106, 108).trim(),
      posted,
      returnBy: `20${year}-${month}-${day}`,
      url: `https://www.dibbs.bsm.dla.mil/rfq/rfqrec.aspx?sn=${id}`,
    });
  }
  return rfqs;
}

/** Download one posted day. With no date, use the newest file from the last 10 days. */
export async function fetchRfqs(date?: string): Promise<Rfq[]> {
  const start = date ?? new Date().toISOString().slice(0, 10);
  const days = date ? 1 : 10;
  for (let i = 0; i < days; i++) {
    const day = shift(start, -i);
    const text = await downloadIndex(day);
    if (text) return parseIndex(text, day);
  }
  throw new Error(date ? `No DIBBS index for ${date}` : "No DIBBS index in the last 10 days");
}

const cookies = new Map<string, string>();

async function downloadIndex(isoDate: string): Promise<string | null> {
  const stamp = isoDate.slice(2).replaceAll("-", "");
  const url = `${ORIGIN}/Downloads/RFQ/Archive/in${stamp}.txt`;
  const first = await request(url);
  if (first.status === 404) return null;
  const body = first.text.includes("butAgree") ? await agree(first.text, url) : first;
  if (body.status !== 200 || body.text.includes("<html")) return null;
  return body.text;
}

async function agree(html: string, pageUrl: string): Promise<Got> {
  const action = html.match(/action="([^"]+)"/)?.[1];
  if (!action) throw new Error("DIBBS consent page has no form");
  const value = (name: string) => html.match(new RegExp(`name="${name}"[^>]*value="([^"]*)"`))?.[1] ?? "";
  return request(new URL(action, pageUrl).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      __VIEWSTATE: value("__VIEWSTATE"),
      __VIEWSTATEGENERATOR: value("__VIEWSTATEGENERATOR"),
      __EVENTVALIDATION: value("__EVENTVALIDATION"),
      butAgree: "OK",
    }),
  });
}

type Got = { status: number; text: string };

async function request(url: string, init: RequestInit = {}): Promise<Got> {
  const headers = new Headers(init.headers);
  headers.set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
  if (cookies.size) headers.set("Cookie", [...cookies].map(([k, v]) => `${k}=${v}`).join("; "));
  const response = await fetch(url, { ...init, headers, redirect: "manual" });
  for (const cookie of response.headers.getSetCookie?.() ?? []) {
    const pair = cookie.split(";")[0] ?? "";
    const eq = pair.indexOf("=");
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (name && value) cookies.set(name, value);
  }
  if (response.status >= 300 && response.status < 400) {
    const next = new URL(response.headers.get("location") ?? "", url);
    if (next.protocol === "http:") next.protocol = "https:";
    if (next.pathname.toLowerCase().includes("filenotfound")) return { status: 404, text: "" };
    return request(next.toString());
  }
  return { status: response.status, text: Buffer.from(await response.arrayBuffer()).toString("latin1") };
}

function shift(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const dateFlag = process.argv.indexOf("--date");
  const date = dateFlag === -1 ? undefined : process.argv[dateFlag + 1];
  const rfqs = await fetchRfqs(date);
  const out = path.join("data", "rfqs.json");
  await mkdir("data", { recursive: true });
  await writeFile(out, `${JSON.stringify(rfqs, null, 2)}\n`);
  const withNsn = rfqs.filter((rfq) => rfq.nsn).length;
  console.log(`${rfqs.length} RFQs, ${withNsn} with an NSN, written to ${out}`);
}
