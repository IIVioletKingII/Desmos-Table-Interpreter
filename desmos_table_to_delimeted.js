state = Calc.getState();

const columnDelimiter = '\t';
const rowDelimiter = '\n';

const groupedExpressionList = state.expressions.list.reduce((acc, expr) => {
	if (!acc[expr.type]) acc[expr.type] = [];
	acc[expr.type].push(expr);
	return acc;
}, {});

const tables = groupedExpressionList['table'] || [];
const expressions = groupedExpressionList['expression'] || [];

const analysis = {};
for (const [k, v] of Object.entries(Calc.expressionAnalysis))
	if (v?.evaluation) analysis[k] = v.evaluation;

function printTable(columns) {
	const maxLen = Math.max(...columns.map(c => c.length));
	let output = '';
	for (let i = 0; i < maxLen; i++)
		output += columns.map(col => col[i] ?? '').join(columnDelimiter) + rowDelimiter;
	console.log(output);
}

function waitForStability(delay = 30, checks = 3) {
	return new Promise(resolve => {
		let last = null;
		let stable = 0;

		function tick() {
			const snap = JSON.stringify(Calc.expressionAnalysis);
			if (snap === last) {
				stable++;
				if (stable >= checks) return resolve();
			} else {
				stable = 0;
				last = snap;
			}
			setTimeout(tick, delay);
		}

		tick();
	});
}

async function evalLatex(latex) {
	const id = '_tmp_eval_' + Math.random().toString(36).slice(2);

	Calc.setExpression({ id, latex });
	await waitForStability();

	const evalObj = Calc.expressionAnalysis[id]?.evaluation;

	Calc.removeExpression({ id });

	if (evalObj?.type === 'ListOfNumber') return evalObj.value;

	return evalObj?.type === 'Number' ? evalObj.value : undefined;
}

async function resolveCell(str) {
	if (/^-?\d*\.?\d+$/.test(str)) return Number(str);

	const cleaned = str.replace(/\\left|\\right/g, '');
	const value = await evalLatex(cleaned);

	return value ?? str;
}

for (const table of tables) {
	console.log(`-- table ${table.id}  (${table.columns.map(c => c.latex).join(', ')}) --`);
	const tableColumns = [];

	for (const col of table.columns) {
		if (col.values?.length > 0) {
			// raw or expression cells
			tableColumns.push(await Promise.all(col.values.map(resolveCell)));
			continue;
		}

		if (col.latex) {
			// calcultead column (list literal)
			// evaluate the latex of the list header
			tableColumns.push(await resolveCell(col.latex));
			continue;
		}

		tableColumns.push([]);
	}

	printTable(tableColumns);
}
