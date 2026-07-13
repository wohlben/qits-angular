import { readFileSync } from 'node:fs';

const root = JSON.parse(readFileSync('package.json', 'utf8'));
const dist = JSON.parse(readFileSync('dist/qits-angular/package.json', 'utf8'));

let failed = false;
const rootEntry = root.exports['.'];
const distEntry = dist.exports['.'];
for (const key of ['types', 'default']) {
  const expected = './dist/qits-angular/' + distEntry[key].replace(/^\.\//, '');
  if (rootEntry[key] !== expected) {
    console.error(`exports drift: root exports['.'].${key} is ${rootEntry[key]}, dist says ${expected}`);
    failed = true;
  }
}
for (const [pkg, range] of Object.entries(dist.peerDependencies ?? {})) {
  if (root.peerDependencies?.[pkg] !== range) {
    console.error(`peer drift: dist declares ${pkg}@${range}, root has ${root.peerDependencies?.[pkg]}`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log('manifests in sync: root mirrors dist (exports + peers)');
