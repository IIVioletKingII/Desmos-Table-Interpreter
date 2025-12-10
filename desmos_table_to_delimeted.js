state = Calc.getState();

const tables = state.expressions.list.filter((expr) => expr.type === 'table');
const expressions = state.expressions.list.filter((expr) => expr.type === 'expression');

const analysis = {};
for (const [k, v] of Object.entries(Calc.expressionAnalysis))
	if (v?.evaluation) analysis[k] = v.evaluation;

function extractBetweenBrackets(str) {
	const firstBracket = str.indexOf('[');
	const lastBracket = str.lastIndexOf(']');
	if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket)
		return str.slice(firstBracket + 1, lastBracket);
	return '';
}

function printTable(columns) {
	const maxLen = Math.max(...columns.map(c => c.length));
	let output = "";
	for (let i = 0; i < maxLen; i++)
		output += columns.map(col => col[i] ?? "").join("\t") + "\n";
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
	const id = "_tmp_eval_" + Math.random().toString(36).slice(2);

	Calc.setExpression({ id, latex });
	await waitForStability();

	const evalObj = Calc.expressionAnalysis[id]?.evaluation;

	Calc.removeExpression({ id });

	return evalObj?.type === "Number" ? evalObj.value : undefined;
}

async function resolveCell(str) {
	if (/^-?\d*\.?\d+$/.test(str)) return Number(str);

	const cleaned = str.replace(/\\left|\\right/g, "");
	const value = await evalLatex(cleaned);

	return value ?? str;
}

(async () => {
	for (const table of tables) {
		console.log('--', 'table', table.id, `(${table.columns[0].latex})`, '--');
		const tableColumns = [];

		for (const col of table.columns) {
			if (col.values?.length > 0) {
				// raw or expression cells
				tableColumns.push(await Promise.all(col.values.map(resolveCell)));
				continue;
			}
			if (col.latex) {
				// calcultead column (list literal)

				const query = `${col.latex}=`;
				const matchingExpr = expressions.filter(exp => exp.latex.startsWith(query));
				if (matchingExpr.length > 0) {
					const formula = matchingExpr[0].latex.replace(query, '').replace('\\right', '');
					const listExpr = extractBetweenBrackets(formula);
					tableColumns.push(listExpr.split(',').map(Number));
				}

			}


			tableColumns.push([]);
		}

		printTable(tableColumns);
	}
})();
