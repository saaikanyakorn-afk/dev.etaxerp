import pg from "pg";
import os from "os";
import { getConfig } from "./config-bootstrap";

interface ResolvedDbUrl {
  url: string;
  label: string;
  path: "lan" | "fqdn" | "wan" | "config" | "env" | "fallback";
  host: string;
  port: number;
  dbName: string;
  latencyMs?: number;
}

interface MachineRow {
  id: number;
  local_name: string;
  windows_name: string | null;
  fqdn: string | null;
  domain_name: string | null;
  lan_ip: string | null;
  wan_ip: string | null;
  db_port: string;
  db_name: string;
  db_user: string;
  db_password: string;
  enc_hostname: string | null;
  target_db_machine_id: number | null;
}

interface NicRow {
  id: number;
  machine_id: number;
  ip_address: string;
  subnet_mask: string;
}

interface NicIpRow {
  nic_id: number;
  ip_address: string;
  subnet_mask: string;
}

function ipToInt(ip: string): number {
  return ip.split(".").reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
}

function sameSubnet(ip1: string, ip2: string, mask1: string, mask2: string): boolean {
  const m1 = ipToInt(mask1);
  const m2 = ipToInt(mask2);
  if (m1 !== m2) return false;
  return (ipToInt(ip1) & m1) === (ipToInt(ip2) & m1);
}

function getLocalIps(): { ip: string; mac: string; iface: string }[] {
  const nets = os.networkInterfaces();
  const result: { ip: string; mac: string; iface: string }[] = [];
  for (const [name, ifaces] of Object.entries(nets)) {
    if (!ifaces) continue;
    for (const iface of ifaces) {
      if (iface.family === "IPv4" && !iface.internal && iface.mac !== "00:00:00:00:00:00") {
        result.push({ ip: iface.address, mac: iface.mac, iface: name });
      }
    }
  }
  return result;
}

async function probeDb(host: string, port: number, dbName: string, user: string, password: string, timeoutMs: number = 5000): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  const client = new pg.Client({
    host, port, database: dbName, user, password,
    connectionTimeoutMillis: timeoutMs,
    query_timeout: timeoutMs,
  });
  try {
    await client.connect();
    await client.query("SELECT 1");
    const latencyMs = Date.now() - start;
    await client.end();
    return { ok: true, latencyMs };
  } catch {
    try { await client.end(); } catch {}
    return { ok: false, latencyMs: Date.now() - start };
  }
}

function buildUrl(host: string, port: number, dbName: string, user: string, password: string): string {
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${dbName}`;
}

export async function resolveDbFromMachineRegistry(configDbUrl: string): Promise<ResolvedDbUrl | null> {
  const machineName = process.env.MACHINE_NAME;
  if (!machineName) {
    console.log("[MachineResolver] MACHINE_NAME not set, skipping machine registry");
    return null;
  }

  const pool = new pg.Pool({
    connectionString: configDbUrl,
    max: 2,
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000,
  });

  try {
    const machinesResult = await pool.query<MachineRow>(
      `SELECT id, local_name, windows_name, fqdn, domain_name, lan_ip, wan_ip,
              db_port, db_name, db_user, db_password, enc_hostname, target_db_machine_id
       FROM machines`
    );
    const allMachines = machinesResult.rows;

    const me = allMachines.find(m =>
      m.local_name === machineName ||
      m.windows_name === machineName ||
      m.enc_hostname === machineName
    );

    if (!me) {
      console.log(`[MachineResolver] Machine "${machineName}" not found in registry (${allMachines.length} machines)`);
      await pool.end();
      return null;
    }

    console.log(`[MachineResolver] Identified as: "${me.local_name}" (id=${me.id}), targetDbMachineId=${me.target_db_machine_id}`);

    const targetId = me.target_db_machine_id;
    const targetMachine = targetId ? allMachines.find(m => m.id === targetId) : null;

    if (!targetMachine) {
      if (me.target_db_machine_id) {
        console.log(`[MachineResolver] Target DB machine id=${me.target_db_machine_id} not found`);
      } else {
        console.log(`[MachineResolver] No targetDbMachineId set for "${me.local_name}", will use self`);
      }
      await pool.end();
      return null;
    }

    const dbPort = parseInt(targetMachine.db_port || "5432", 10);
    const dbName = targetMachine.db_name;
    const dbUser = targetMachine.db_user;
    const dbPassword = targetMachine.db_password;

    if (!dbUser || !dbPassword || !dbName) {
      console.log(`[MachineResolver] Target "${targetMachine.local_name}" missing DB credentials`);
      await pool.end();
      return null;
    }

    const nicsResult = await pool.query<NicRow>(
      `SELECT id, machine_id, ip_address, subnet_mask FROM machine_nics WHERE machine_id IN ($1, $2)`,
      [me.id, targetMachine.id]
    );
    const allNics = nicsResult.rows;

    const nicIds = allNics.map(n => n.id);
    let allNicIps: NicIpRow[] = [];
    if (nicIds.length > 0) {
      const nicIpResult = await pool.query<NicIpRow>(
        `SELECT nic_id, ip_address, subnet_mask FROM nic_ip_addresses WHERE nic_id = ANY($1)`,
        [nicIds]
      );
      allNicIps = nicIpResult.rows;
    }

    await pool.end();

    const myNics = allNics.filter(n => n.machine_id === me.id);
    const targetNics = allNics.filter(n => n.machine_id === targetMachine.id);

    const getAllIps = (nics: NicRow[]): { ip: string; mask: string }[] => {
      const result: { ip: string; mask: string }[] = [];
      for (const nic of nics) {
        result.push({ ip: nic.ip_address, mask: nic.subnet_mask });
        const extras = allNicIps.filter(x => x.nic_id === nic.id);
        for (const extra of extras) {
          result.push({ ip: extra.ip_address, mask: extra.subnet_mask });
        }
      }
      return result;
    };

    const myIps = getAllIps(myNics);
    const targetIps = getAllIps(targetNics);
    const localIps = getLocalIps();

    const lanCandidates: { myIp: string; targetIp: string }[] = [];

    for (const myIpEntry of myIps) {
      const localMatch = localIps.some(l => l.ip === myIpEntry.ip);
      if (!localMatch) continue;

      for (const targetIpEntry of targetIps) {
        if (sameSubnet(myIpEntry.ip, targetIpEntry.ip, myIpEntry.mask, targetIpEntry.mask)) {
          lanCandidates.push({ myIp: myIpEntry.ip, targetIp: targetIpEntry.ip });
        }
      }
    }

    console.log(`[MachineResolver] My NICs: ${myIps.length} IPs, Target NICs: ${targetIps.length} IPs, Local OS IPs: ${localIps.length}, LAN candidates: ${lanCandidates.length}`);

    for (const candidate of lanCandidates) {
      console.log(`[MachineResolver] Probing LAN: ${candidate.myIp} → ${candidate.targetIp}:${dbPort} ...`);
      const probe = await probeDb(candidate.targetIp, dbPort, dbName, dbUser, dbPassword, 5000);
      if (probe.ok) {
        console.log(`[MachineResolver] LAN probe OK (${probe.latencyMs}ms): ${candidate.targetIp}:${dbPort}/${dbName}`);
        return {
          url: buildUrl(candidate.targetIp, dbPort, dbName, dbUser, dbPassword),
          label: `${targetMachine.local_name} (LAN ${candidate.targetIp})`,
          path: "lan",
          host: candidate.targetIp,
          port: dbPort,
          dbName,
          latencyMs: probe.latencyMs,
        };
      }
      console.log(`[MachineResolver] LAN probe FAILED: ${candidate.targetIp}:${dbPort}`);
    }

    const fqdnHosts: { host: string; label: string; path: "fqdn" | "wan" }[] = [];
    if (targetMachine.fqdn) fqdnHosts.push({ host: targetMachine.fqdn, label: "FQDN", path: "fqdn" });
    if (targetMachine.domain_name && targetMachine.domain_name !== targetMachine.fqdn) {
      fqdnHosts.push({ host: targetMachine.domain_name, label: "Domain", path: "fqdn" });
    }
    if (targetMachine.wan_ip) fqdnHosts.push({ host: targetMachine.wan_ip, label: "WAN", path: "wan" });

    for (const fh of fqdnHosts) {
      console.log(`[MachineResolver] Probing ${fh.label}: ${fh.host}:${dbPort} ...`);
      const probe = await probeDb(fh.host, dbPort, dbName, dbUser, dbPassword, 8000);
      if (probe.ok) {
        console.log(`[MachineResolver] ${fh.label} probe OK (${probe.latencyMs}ms): ${fh.host}:${dbPort}/${dbName}`);
        return {
          url: buildUrl(fh.host, dbPort, dbName, dbUser, dbPassword),
          label: `${targetMachine.local_name} (${fh.label} ${fh.host})`,
          path: fh.path,
          host: fh.host,
          port: dbPort,
          dbName,
          latencyMs: probe.latencyMs,
        };
      }
      console.log(`[MachineResolver] ${fh.label} probe FAILED: ${fh.host}:${dbPort}`);
    }

    console.error(`[MachineResolver] All paths to "${targetMachine.local_name}" failed — machine unreachable`);
    return null;
  } catch (err: any) {
    console.error(`[MachineResolver] Error: ${err.message}`);
    try { await pool.end(); } catch {}
    return null;
  }
}
