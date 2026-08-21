const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const babel = require('@babel/core');
const path = './src/utils/formInputUtils.js'; const source = fs.readFileSync(path, 'utf8'); const code = babel.transformSync(source, { plugins: ['@babel/plugin-transform-modules-commonjs'] }).code; const loaded = new Module(path, module); loaded.filename = path; loaded.paths = module.paths; loaded._compile(code, path);
const { applyTimeToDate, clamp, durationToMinutes, getTimeParts, normalizeWheelMinutes, splitDuration, stepValue, usesIntegerStepper } = loaded.exports;

assert.equal(clamp(0, 0, 10), 0); assert.equal(clamp(10, 0, 10), 10); assert.equal(clamp(7, 0, 10), 7);
assert.equal(stepValue(6, 1, 0, 10), 7); assert.equal(stepValue(0, -1, 0, 10), 0); assert.equal(stepValue(10, 1, 0, 10), 10);
assert.equal(durationToMinutes(0, 30), 30); assert.equal(durationToMinutes(2, 35), 155); assert.deepEqual(splitDuration(155), { hours: 2, minutes: 35 }); assert.equal(durationToMinutes(1, 45), 105);
const oldDate = '2026-08-21T14:35:22.000Z'; const oldParts = getTimeParts(oldDate); assert.equal(getTimeParts(applyTimeToDate(oldDate, oldParts.hours, oldParts.minutes)).hours, oldParts.hours);
const changedDate = applyTimeToDate(oldDate, 9, 25); assert.deepEqual(getTimeParts(changedDate), { hours: 9, minutes: 25 }); assert.equal(new Date(changedDate).getSeconds(), 22);
assert.equal(normalizeWheelMinutes(0), 0); assert.equal(normalizeWheelMinutes(34), 35); assert.equal(normalizeWheelMinutes(59), 55);
assert.deepEqual(getTimeParts(applyTimeToDate(oldDate, 0, 0)), { hours: 0, minutes: 0 }); assert.deepEqual(getTimeParts(applyTimeToDate(oldDate, 14, 35)), { hours: 14, minutes: 35 }); assert.deepEqual(getTimeParts(applyTimeToDate(oldDate, 23, 55)), { hours: 23, minutes: 55 });
assert.equal(usesIntegerStepper('verre(s)'), true); assert.equal(usesIntegerStepper('joint(s)'), true); assert.equal(usesIntegerStepper('gramme(s)'), false); assert.equal(stepValue(2, 1, 1, 100), 3); assert.equal(stepValue(1, -1, 0, 99), 0);
const formSource = fs.readFileSync('./src/screens/EntryFormScreen.js', 'utf8'); assert.ok(formSource.includes('moneySpent')); assert.ok(formSource.includes('selectedTargets')); assert.ok(formSource.includes('Slider')); assert.ok(formSource.includes('durationToMinutes')); assert.equal(/\}[^\S\r\n]+\{!!pendingConfig/.test(formSource), false); assert.equal(/&&\s*['"][^'"]+['"]/.test(formSource), false);
const wheelSource = fs.readFileSync('./src/components/TimeWheelPicker.js', 'utf8'); assert.ok(wheelSource.includes('snapToInterval')); assert.ok(wheelSource.includes('nestedScrollEnabled')); assert.ok(wheelSource.includes('.scrollTo(')); assert.equal(/FlatList|SectionList|VirtualizedList/.test(wheelSource), false); assert.ok(wheelSource.includes('<Text style={styles.separator}>:</Text>'));
console.log('Curseur, durées, heure, quantités, épisodes et argent validés.');
