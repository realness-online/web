/**
 * Making and unmaking a host on GCE, with the gcloud wrapper supplied.
 *
 * Every call `up` and `down` make goes through the `cloud` object they are
 * given, so a stand-in reaches the whole create sequence. What is not covered
 * is the stage-and-copy step: `push` shells out to `harness-stage.sh` against
 * the real tree, so each case here stops before it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { down, held, up } from "../../src/control/host-gcp.js";

const config = {
  project: "realness-development",
  zone: "us-central1-a",
  imageFamily: "realness-host",
  machineType: "n2-standard-4",
  bootSize: "20GB",
  actorsSize: "50GB",
  root: "/srv/realness",
};

/** A gcloud stand-in that records what it was asked. */
const fake_cloud = (answers = {}) => {
  const asked = [];
  const record = (kind, argv) => {
    asked.push([kind, argv]);
    return Array.isArray(argv) ? argv.join(" ") : String(argv);
  };
  return {
    asked,
    exists: async (argv) => {
      record("exists", argv);
      return answers.exists?.(argv) ?? false;
    },
    try: async (argv) => {
      record("try", argv);
      return answers.try?.(argv) ?? { ok: true, out: "", err: "" };
    },
    value: async (argv) => {
      record("value", argv);
      return answers.value?.(argv) ?? "x";
    },
    call: async (argv) => {
      record("call", argv);
      return answers.call?.(argv) ?? "table";
    },
    stream: async (argv) => {
      record("stream", argv);
      await answers.stream?.(argv);
    },
    ssh: async (name, command) => {
      record("ssh", `${name} ${command}`);
      await answers.ssh?.(name, command);
    },
    ip: async () => "34.1.2.3",
  };
};

const kinds = (cloud) => cloud.asked.map(([kind]) => kind);

test("up refuses a name that is taken before it makes anything", async () => {
  const cloud = fake_cloud({
    exists: (argv) => argv.join(" ") === "instances describe h1",
  });
  await assert.rejects(
    up(cloud, config, "h1"),
    /instances describe h1 already exists - pick another name/,
  );
  assert.deepEqual(kinds(cloud), ["exists", "exists"]);
});

const refused_create = () =>
  fake_cloud({
    try: (argv) =>
      argv[1] === "create"
        ? { ok: false, out: "", err: "ZONE_RESOURCE_POOL_EXHAUSTED" }
        : { ok: true, out: "", err: "" },
  });

const boot_stream = (cloud) =>
  cloud.asked
    .find(([kind, argv]) => kind === "stream" && argv[1] === "create")[1]
    .join(" ");

test("up sizes the boot disk from the config unless the call overrides it", async () => {
  const cloud = refused_create();
  await assert.rejects(up(cloud, config, "h1"), /instance create failed/);
  assert.match(
    boot_stream(cloud),
    /^disks create h1-boot --size=20GB --type=pd-standard --image-family=realness-host/,
  );

  const overridden = refused_create();
  await assert.rejects(
    up(overridden, config, "h1", {
      bootSize: "40GB",
      imageFamily: "custom-host",
      machineType: "n2-standard-8",
    }),
    /instance create failed/,
  );
  assert.match(
    boot_stream(overridden),
    /^disks create h1-boot --size=40GB --type=pd-standard --image-family=custom-host/,
  );
  assert.match(
    overridden.asked
      .find(([, argv]) => argv[0] === "instances" && argv[1] === "create")[1]
      .join(" "),
    /--machine-type=n2-standard-8/,
  );
});

test("up takes the boot disk away when the instance create is refused", async () => {
  const cloud = fake_cloud({
    try: (argv) =>
      argv[1] === "create"
        ? {
            ok: false,
            out: "",
            err: "WARNING: quota\nZONE_RESOURCE_POOL_EXHAUSTED",
          }
        : { ok: true, out: "", err: "" },
  });
  await assert.rejects(
    up(cloud, config, "h1"),
    /instance create failed: ZONE_RESOURCE_POOL_EXHAUSTED/,
  );
  assert.deepEqual(cloud.asked.at(-1), [
    "try",
    ["disks", "delete", "h1-boot", "--quiet"],
  ]);
});

test("up waits for ssh, reads the block device, then attaches the actors disk", async () => {
  // The attach refuses so that the run stops before `push`, which stages the
  // real tree with harness-stage.sh.
  const cloud = fake_cloud({
    value: (argv) =>
      argv.join(" ").includes("lsblk") ? "sda 20G disk\nsdb 50G disk" : "x",
    stream: (argv) => {
      if (argv[1] === "attach-disk") throw new Error("stopped here");
    },
  });
  await assert.rejects(up(cloud, config, "h1"), /stopped here/);

  const streams = cloud.asked
    .filter(([kind]) => kind === "stream")
    .map(([, argv]) => argv.join(" "));
  assert.deepEqual(streams, [
    "disks create h1-boot --size=20GB --type=pd-standard --image-family=realness-host --labels=app=realness,role=actor-host",
    "disks create h1-actors --size=50GB --type=pd-standard --labels=app=realness,role=actors",
    "instances attach-disk h1 --disk=h1-actors --device-name=realness-actors",
  ]);
  const probes = cloud.asked.filter(
    ([kind, argv]) => kind === "try" && argv[0] === "ssh",
  );
  assert.equal(probes.length, 1, "ssh answers on the first try, so no waiting");
});

test("up --expire gives GCE a deadline that deletes the host and both disks", async () => {
  const cloud = fake_cloud({
    value: () => "sda 20G disk",
    stream: (argv) => {
      if (argv[1] === "set-disk-auto-delete") throw new Error("stopped here");
    },
  });
  await assert.rejects(
    up(cloud, config, "h1", { expire: "2h" }),
    /stopped here/,
  );
  const create = cloud.asked
    .find(([, argv]) => argv[0] === "instances" && argv[1] === "create")[1]
    .join(" ");
  assert.match(
    create,
    /--max-run-duration=2h --instance-termination-action=DELETE/,
  );
  assert.equal(
    cloud.asked.at(-1)[1].join(" "),
    "instances set-disk-auto-delete h1 --disk=h1-actors --auto-delete",
  );

  const plain = refused_create();
  await assert.rejects(up(plain, config, "h1"), /instance create failed/);
  assert.doesNotMatch(plain.asked.flat(2).join(" "), /max-run-duration/);
});

test("down stops the host and waits for it to report TERMINATED", async () => {
  const cloud = fake_cloud({ value: () => "TERMINATED" });
  await down(cloud, config, "h1");
  assert.deepEqual(kinds(cloud), ["stream", "value", "value", "call"]);
  assert.match(cloud.asked[3][1].join(" "), /disks list/);
});

test("down --delete removes the instance and shrugs at a missing volume", async () => {
  const cloud = fake_cloud({
    try: () => ({ ok: false, out: "", err: "not found" }),
  });
  await down(cloud, config, "h1", { mode: "delete" });
  assert.deepEqual(kinds(cloud), ["stream", "try", "call"]);
  assert.match(cloud.asked[0][1].join(" "), /instances delete h1/);
  assert.match(cloud.asked[1][1].join(" "), /disks delete h1-actors/);
});

test("a deploy wakes a parked host and holds it until the work ends", async () => {
  const cloud = fake_cloud({ value: () => "TERMINATED" });
  await assert.rejects(
    held(cloud, "h", async () => {
      cloud.asked.push(["work", ""]);
      throw new Error("push failed");
    }),
    /push failed/,
  );
  const steps = cloud.asked.map(([kind, argv]) =>
    kind === "stream"
      ? argv.slice(0, 2).join(" ")
      : kind === "ssh"
        ? argv
        : kind,
  );
  assert.deepEqual(
    steps.filter((s) => s !== "try" && s !== "value"),
    [
      "instances start",
      "h sudo touch /run/realness-hold",
      "work",
      "h sudo rm -f /run/realness-hold",
    ],
  );
});

test("a deploy to a running host does not start it again", async () => {
  const cloud = fake_cloud({ value: () => "RUNNING" });
  assert.equal(await held(cloud, "h", async () => "done"), "done");
  assert.ok(!cloud.asked.some(([kind]) => kind === "stream"));
});
