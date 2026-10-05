import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CTKTKT_INPUT_FIELDS} from '../lib/ctktkt-fields.generated.ts';
import {CTKTKT_EXTRA_INPUT_FIELDS} from '../lib/ctktkt-extra-fields.ts';
import {describeCtktktMissingField} from '../lib/data-completeness.ts';
import {shouldShowCtktktMissingField} from '../lib/ctktkt-missing-fields.ts';

const fields=[...CTKTKT_INPUT_FIELDS,...CTKTKT_EXTRA_INPUT_FIELDS];
const unused=['D183','E183','F183','K183','L183','N183','O183','P183','Q183','R183','D184','F184','K184','L184','N184','O184'];

test('all 16 unused PMIS helper cells are excluded while the actual plant row remains available',()=>{
  const excluded=fields.filter(f=>describeCtktktMissingField(f)===null).map(f=>f.cell);
  assert.deepEqual([...new Set(excluded)].sort(),unused.toSorted());
  for(const cell of ['D181','E181','F181','K181','L181','N181','T181']) {
    const field=fields.find(f=>f.cell===cell);
    assert.ok(field,cell);
    assert.match(describeCtktktMissingField(field),/Hàng: Duyên Hải 1 · Cột:/);
  }
});

test('the UI filters workbook-only fields before warnings, red borders and the generic input grid',()=>{
  const source=readFileSync(new URL('../components/ctktkt-report.tsx',import.meta.url),'utf8');
  const start=source.indexOf('const editableFields =');
  const end=source.indexOf('const numberFormat =',start);
  assert.match(source.slice(start,end),/describeCtktktMissingField\(field\) !== null/);
  assert.match(source,/const description = describeCtktktMissingField\(field\);/);
  assert.match(source,/label: `\$\{date\.split/);
  assert.doesNotMatch(source.slice(source.indexOf('const missingCtktktForExport'),source.indexOf('const coalStock =')),/for \(let day/);
});

test('grinding-ball defaults and automatic NH3 opening stock never produce manual missing warnings',()=>{
  for(const cell of ['E39','H39','P73']) assert.equal(shouldShowCtktktMissingField(cell,'2026-10-04',{}),false,cell);
  for(const cell of ['P72','P74','N181']) assert.equal(shouldShowCtktktMissingField(cell,'2026-10-04',{}),true,cell);
});
