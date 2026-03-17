import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const requiredPaths = [
  ".gitignore",
  "README.md",
  "extensions/pi-tutor/index.ts",
  "package.json",
  "prompts",
  "skills",
  "src",
  "test",
  "tsconfig.json",
];

for (const relativePath of requiredPaths) {
  test(`${relativePath} exists`, () => {
    assert.equal(existsSync(resolve(packageRoot, relativePath)), true);
  });
}

test("package.json exposes phase-1 bootstrap scripts", () => {
  const pkg = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));

  assert.equal(pkg.name, "pi-tutor");
  assert.equal(pkg.type, "module");

  for (const scriptName of ["build", "typecheck", "test", "check", "pack:smoke"]) {
    assert.equal(typeof pkg.scripts?.[scriptName], "string");
    assert.notEqual(pkg.scripts[scriptName].trim(), "");
  }
});

test("bootstrap directories are directories", () => {
  for (const relativePath of ["extensions", "prompts", "skills", "src", "test"]) {
    const stats = statSync(resolve(packageRoot, relativePath));
    assert.equal(stats.isDirectory(), true, `${relativePath} should be a directory`);
  }
});

test("tsconfig is self-contained and targets modern node", () => {
  const tsconfig = JSON.parse(readFileSync(resolve(packageRoot, "tsconfig.json"), "utf8"));

  assert.equal(tsconfig.extends, undefined);
  assert.equal(tsconfig.compilerOptions?.target, "ES2022");
  assert.equal(tsconfig.compilerOptions?.module, "NodeNext");
  assert.equal(tsconfig.compilerOptions?.moduleResolution, "NodeNext");
});

test("extension entrypoint exports a default function", () => {
  const extensionSource = readFileSync(resolve(packageRoot, "extensions/pi-tutor/index.ts"), "utf8");

  assert.match(extensionSource, /export default function/);
});
