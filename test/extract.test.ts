import assert from "node:assert/strict";
import test from "node:test";
import { parseIndex } from "../src/extract.ts";

const BELT =
  "SPE1C127T00868465015607905                                    701900776711/16/26SPE1C127T0086.pdf  0000150EABELT,INDIVIDUAL EQU  PCPQDD1N000";
const PART =
  "SPEFA127T00181710LN0025556                                    701902875011/13/26SPEFA127T0018.pdf  0000002EAMOTOR/BRAKE ASSY 0100DDH00L1H100";

test("reads solicitation, NSN, and the DIBBS record link", () => {
  const [rfq] = parseIndex(`${BELT}\r\n`, "2026-11-06");
  assert.equal(rfq.solicitation, "SPE1C1-27-T-0086");
  assert.equal(rfq.nsn, "8465-01-560-7905");
  assert.equal(rfq.name, "BELT,INDIVIDUAL EQU");
  assert.equal(rfq.quantity, 150);
  assert.equal(rfq.unit, "EA");
  assert.equal(rfq.posted, "2026-11-06");
  assert.equal(rfq.returnBy, "2026-11-16");
  assert.equal(rfq.url, "https://www.dibbs.bsm.dla.mil/rfq/rfqrec.aspx?sn=SPE1C127T0086");
});

test("leaves nsn empty when the line is a part number", () => {
  const [rfq] = parseIndex(PART, "2026-11-06");
  assert.equal(rfq.nsn, null);
  assert.equal(rfq.name, "MOTOR/BRAKE ASSY 0100");
});
