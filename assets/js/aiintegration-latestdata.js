(function () {
	'use strict';

	let observersStarted = false;

	function waitForCore(callback) {
		if (typeof window.AIIntegrationCore !== 'undefined') {
			callback();
		}
		else {
			setTimeout(() => waitForCore(callback), 100);
		}
	}

	function getLatestDataTable() {
		const form = document.querySelector('form[name="items"]');
		if (form) {
			const table = form.querySelector('table.list-table');
			if (table) return table;
		}
		return document.querySelector('table.list-table');
	}

	function isLatestDataPage() {
		if (window.location.href.includes('action=latest.view') ||
			window.location.href.includes('latest.php') ||
			document.querySelector('.latest-data-page') !== null) {
			return true;
		}
		if (getLatestDataTable() !== null) {
			return true;
		}
		return false;
	}

	function init() {
		waitForCore(() => {
			const core = window.AIIntegrationCore;
			core.loadSettings().then((settings) => {
				if (!settings.quick_actions || !settings.quick_actions.items) {
					return;
				}
				initLatestDataButtons(settings);
				startPoller(settings);
			});
		});
	}

	function startPoller(settings) {
		setInterval(() => {
			const table = getLatestDataTable();
			if (!table) return;
			if (!table.closest('form[name="items"]')) return;
			addHeaderColumn(table);
			addButtonsToRows(table, settings);
		}, 800);
	}

	function initLatestDataButtons(settings) {
		const table = getLatestDataTable();
		if (!table) {
			setTimeout(() => initLatestDataButtons(settings), 500);
			return;
		}

		addHeaderColumn(table);
		addButtonsToRows(table, settings);
		if (!observersStarted) {
			observersStarted = true;
			observeTableChanges(settings);
			observePageRefresh(settings);
		}
	}

	function getSparkleIcon(size) {
		return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="display:block; filter: drop-shadow(0 0 3px #a855f7);">
			<defs>
				<linearGradient id="aiSparkleGradLatest" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" style="stop-color:#a855f7"/>
					<stop offset="50%" style="stop-color:#6366f1"/>
					<stop offset="100%" style="stop-color:#3b82f6"/>
				</linearGradient>
			</defs>
			<path d="M12 0L13.5 8.5L22 10L13.5 11.5L12 20L10.5 11.5L2 10L10.5 8.5L12 0Z" fill="url(#aiSparkleGradLatest)"/>
			<path d="M19 14L19.75 17.25L23 18L19.75 18.75L19 22L18.25 18.75L15 18L18.25 17.25L19 14Z" fill="#a855f7" opacity="0.9"/>
			<path d="M5 14L5.5 16.5L8 17L5.5 17.5L5 20L4.5 17.5L2 17L4.5 16.5L5 14Z" fill="#6366f1" opacity="0.8"/>
		</svg>`;
	}

	function addHeaderColumn(table) {
		const thead = table.querySelector('thead');
		if (!thead || thead.classList.contains('aiintegration-header-added')) {
			return;
		}

		const headerRow = thead.querySelector('tr');
		if (headerRow) {
			const th = document.createElement('th');
			th.innerHTML = '<span title="AI Analysis">IA</span>';
			th.style.width = '50px';
			th.style.textAlign = 'center';
			headerRow.appendChild(th);
			thead.classList.add('aiintegration-header-added');
		}
	}

	function addButtonsToRows(table, settings) {
		const tbody = table.querySelector('tbody');
		if (!tbody) {
			return;
		}

		const rows = tbody.querySelectorAll('tr');
		rows.forEach((row) => {
			if (row.classList.contains('aiintegration-btn-added')) {
				return;
			}

			const itemData = extractItemData(row);
			if (!itemData || !itemData.itemid) {
				const td = document.createElement('td');
				td.style.textAlign = 'center';
				row.appendChild(td);
				row.classList.add('aiintegration-btn-added');
				return;
			}

			const td = document.createElement('td');
			td.style.textAlign = 'center';
			td.style.verticalAlign = 'middle';

			const button = document.createElement('button');
			button.type = 'button';
			button.innerHTML = getSparkleIcon(18);
			button.title = 'AI Analysis';
			button.style.cssText = 'background: none; border: none; cursor: pointer; padding: 4px; transition: all 0.2s ease; display: inline-flex; align-items: center; justify-content: center;';

			button.addEventListener('mouseenter', () => {
				button.style.transform = 'scale(1.2)';
				button.querySelector('svg').style.filter = 'drop-shadow(0 0 6px #a855f7) drop-shadow(0 0 10px #6366f1)';
			});
			button.addEventListener('mouseleave', () => {
				button.style.transform = 'scale(1)';
				button.querySelector('svg').style.filter = 'drop-shadow(0 0 3px #a855f7)';
			});

			button.addEventListener('click', (event) => {
				event.preventDefault();
				event.stopPropagation();
				openLatestDataModal(itemData, settings);
			});

			td.appendChild(button);
			row.appendChild(td);
			row.classList.add('aiintegration-btn-added');
		});
	}

	function extractItemData(row) {
		try {
			const cells = row.querySelectorAll('td');
			if (cells.length < 3) {
				return null;
			}

			const data = {
				itemid: '',
				hostid: '',
				host: '',
				name: '',
				key: '',
				lastvalue: '',
				lastclock: '',
				units: ''
			};

			const checkbox = row.querySelector('input[type="checkbox"][name*="itemids"]');
			if (checkbox) {
				data.itemid = checkbox.value || '';
				if (!data.itemid && checkbox.name) {
					const m = checkbox.name.match(/itemids\[(\d+)\]/);
					if (m) data.itemid = m[1];
				}
			}

			const itemNameEl = row.querySelector('.list-table-actions a, .action-container a, [class*="action"] a, td a');
			if (itemNameEl && itemNameEl.textContent) {
				data.name = data.name || itemNameEl.textContent.trim();
			}

			const itemLink = row.querySelector('a[href*="itemid"]');
			if (itemLink) {
				const match = itemLink.href.match(/itemid[s]?[=\[\]]*(\d+)/);
				if (match) data.itemid = data.itemid || match[1];
				if (itemLink.textContent) data.name = itemLink.textContent.trim();
			}

			const hostLink = row.querySelector('a[href*="hostid"]');
			if (hostLink) {
				data.host = hostLink.textContent.trim();
				const match = hostLink.href.match(/hostid=(\d+)/);
				if (match) {
					data.hostid = match[1];
				}
			}

			cells.forEach((cell) => {
				const text = cell.textContent.trim();

				if (cell.classList.contains('nowrap') && !data.lastclock) {
					if (text.match(/\d{4}-\d{2}-\d{2}|\d{2}:\d{2}:\d{2}/)) {
						data.lastclock = text;
					}
				}
			});

			const lastCell = cells[cells.length - 1];
			if (lastCell && !lastCell.querySelector('button')) {
				data.lastvalue = lastCell.textContent.trim();
			}

			return data;
		}
		catch (error) {
			return null;
		}
	}

	function observeTableChanges(settings) {
		const container = document.querySelector('.wrapper, main, #page-content, body');
		if (!container) {
			return;
		}

		const observer = new MutationObserver(() => {
			setTimeout(() => {
				const table = getLatestDataTable();
				if (table && table.closest('form[name="items"]')) {
					addHeaderColumn(table);
					addButtonsToRows(table, settings);
				}
			}, 150);
		});

		observer.observe(container, {
			childList: true,
			subtree: true
		});
	}

	function observePageRefresh(settings) {
		setInterval(() => {
			const table = getLatestDataTable();
			if (!table || !table.closest('form[name="items"]')) return;

			const thead = table.querySelector('thead');
			if (thead && !thead.classList.contains('aiintegration-header-added')) {
				addHeaderColumn(table);
			}

			const tbody = table.querySelector('tbody');
			if (tbody) {
				const rows = tbody.querySelectorAll('tr:not(.aiintegration-btn-added)');
				if (rows.length > 0) {
					addButtonsToRows(table, settings);
				}
			}
		}, 1000);
	}

	function callZabbixApi(method, params) {
		return fetch('api_jsonrpc.php', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json-rpc' },
			credentials: 'same-origin',
			body: JSON.stringify({
				jsonrpc: '2.0',
				method: method,
				params: params,
				id: 1
			})
		})
			.then((response) => response.json())
			.then((data) => {
				if (data && data.result) {
					return data.result;
				}
				return null;
			})
			.catch(() => null);
	}

	function fetchItemDetails(itemid) {
		return callZabbixApi('item.get', {
			itemids: [itemid],
			output: ['itemid', 'hostid', 'name', 'key_', 'value_type', 'units', 'description', 'delay', 'history', 'trends', 'status', 'state', 'error', 'lastvalue', 'lastclock', 'prevvalue'],
			selectHosts: ['hostid', 'host', 'name'],
			selectTriggers: ['triggerid', 'description', 'priority', 'value'],
			selectTags: 'extend'
		}).then((items) => items && items.length > 0 ? items[0] : null);
	}

	function fetchItemHistory(itemid, valueType, limit) {
		const historyType = parseInt(valueType, 10);
		return callZabbixApi('history.get', {
			itemids: [itemid],
			history: historyType,
			output: 'extend',
			sortfield: 'clock',
			sortorder: 'DESC',
			limit: limit || 100
		});
	}

	function fetchItemTrends(itemid, valueType) {
		const trendType = parseInt(valueType, 10);
		if (trendType === 1 || trendType === 2 || trendType === 4) {
			return Promise.resolve([]);
		}

		const sevenDaysAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
		return callZabbixApi('trend.get', {
			itemids: [itemid],
			time_from: sevenDaysAgo,
			output: 'extend',
			sortfield: 'clock',
			sortorder: 'DESC',
			limit: 168
		});
	}

	function analyzeData(history, trends, itemDetails) {
		const analysis = {
			current_value: itemDetails.lastvalue,
			previous_value: itemDetails.prevvalue,
			sample_count: history ? history.length : 0,
			statistics: null,
			anomalies: [],
			deviations: [],
			patterns: []
		};

		if (!history || history.length === 0) {
			return analysis;
		}

		const valueType = parseInt(itemDetails.value_type, 10);
		if (valueType === 1 || valueType === 2 || valueType === 4) {
			analysis.statistics = { type: 'text/log', unique_values: new Set(history.map(h => h.value)).size };
			return analysis;
		}

		const values = history.map(h => parseFloat(h.value)).filter(v => !isNaN(v));
		if (values.length === 0) {
			return analysis;
		}

		const sum = values.reduce((a, b) => a + b, 0);
		const avg = sum / values.length;
		const sortedValues = [...values].sort((a, b) => a - b);
		const min = sortedValues[0];
		const max = sortedValues[sortedValues.length - 1];
		const median = sortedValues[Math.floor(sortedValues.length / 2)];

		const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
		const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
		const stdDev = Math.sqrt(variance);

		analysis.statistics = {
			count: values.length,
			min: Math.round(min * 1000) / 1000,
			max: Math.round(max * 1000) / 1000,
			avg: Math.round(avg * 1000) / 1000,
			median: Math.round(median * 1000) / 1000,
			std_dev: Math.round(stdDev * 1000) / 1000,
			variance: Math.round(variance * 1000) / 1000
		};

		const currentValue = parseFloat(itemDetails.lastvalue);
		if (!isNaN(currentValue)) {
			const zScore = stdDev > 0 ? (currentValue - avg) / stdDev : 0;
			analysis.statistics.current_z_score = Math.round(zScore * 100) / 100;

			if (Math.abs(zScore) > 3) {
				analysis.anomalies.push({
					type: 'EXTREME_VALUE',
					message: `Current value (${currentValue}) is ${Math.abs(zScore).toFixed(1)} standard deviations from mean`,
					severity: 'high',
					z_score: zScore
				});
			}
			else if (Math.abs(zScore) > 2) {
				analysis.anomalies.push({
					type: 'UNUSUAL_VALUE',
					message: `Current value (${currentValue}) is ${Math.abs(zScore).toFixed(1)} standard deviations from mean`,
					severity: 'medium',
					z_score: zScore
				});
			}

			if (currentValue > max * 0.95 && max !== min) {
				analysis.deviations.push({
					type: 'NEAR_MAXIMUM',
					message: `Current value is within 5% of historical maximum (${max})`,
					severity: 'warning'
				});
			}
			if (currentValue < min * 1.05 && max !== min) {
				analysis.deviations.push({
					type: 'NEAR_MINIMUM',
					message: `Current value is within 5% of historical minimum (${min})`,
					severity: 'warning'
				});
			}
		}

		if (values.length >= 10) {
			const recentValues = values.slice(0, 10);
			const olderValues = values.slice(10);
			if (olderValues.length > 0) {
				const recentAvg = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
				const olderAvg = olderValues.reduce((a, b) => a + b, 0) / olderValues.length;
				const changePercent = olderAvg !== 0 ? ((recentAvg - olderAvg) / Math.abs(olderAvg)) * 100 : 0;

				if (Math.abs(changePercent) > 50) {
					analysis.patterns.push({
						type: 'SIGNIFICANT_TREND',
						message: `Recent values show ${changePercent > 0 ? 'increase' : 'decrease'} of ${Math.abs(changePercent).toFixed(1)}% compared to older data`,
						change_percent: changePercent
					});
				}
			}
		}

		if (trends && trends.length > 0) {
			const trendAvgs = trends.map(t => parseFloat(t.value_avg)).filter(v => !isNaN(v));
			if (trendAvgs.length >= 2) {
				const trendChange = trendAvgs[0] - trendAvgs[trendAvgs.length - 1];
				const trendPercent = trendAvgs[trendAvgs.length - 1] !== 0
					? (trendChange / Math.abs(trendAvgs[trendAvgs.length - 1])) * 100 : 0;

				if (Math.abs(trendPercent) > 30) {
					analysis.patterns.push({
						type: 'WEEKLY_TREND',
						message: `7-day trend shows ${trendPercent > 0 ? 'upward' : 'downward'} movement of ${Math.abs(trendPercent).toFixed(1)}%`,
						trend_percent: trendPercent
					});
				}
			}
		}

		return analysis;
	}

	async function loadItemAnalysisContext(itemid) {
		const itemDetails = await fetchItemDetails(itemid);
		if (!itemDetails) {
			throw new Error('Item not found');
		}

		const [history, trends] = await Promise.all([
			fetchItemHistory(itemid, itemDetails.value_type, 100),
			fetchItemTrends(itemid, itemDetails.value_type)
		]);

		const analysis = analyzeData(history, trends, itemDetails);

		const context = {
			item: {
				itemid: itemDetails.itemid,
				name: itemDetails.name,
				key: itemDetails.key_,
				value_type: ['Numeric (float)', 'Character', 'Log', 'Numeric (unsigned)', 'Text'][parseInt(itemDetails.value_type, 10)] || 'Unknown',
				units: itemDetails.units || '',
				description: itemDetails.description || '',
				update_interval: itemDetails.delay,
				history_days: itemDetails.history,
				trends_days: itemDetails.trends,
				status: itemDetails.status === '0' ? 'Enabled' : 'Disabled',
				state: itemDetails.state === '0' ? 'Normal' : 'Not supported',
				error: itemDetails.error || ''
			},
			host: null,
			current_data: {
				value: itemDetails.lastvalue,
				previous_value: itemDetails.prevvalue,
				last_update: itemDetails.lastclock ? new Date(parseInt(itemDetails.lastclock, 10) * 1000).toISOString() : null
			},
			analysis: analysis,
			triggers: [],
			tags: itemDetails.tags || []
		};

		if (itemDetails.hosts && itemDetails.hosts.length > 0) {
			const host = itemDetails.hosts[0];
			context.host = {
				hostid: host.hostid,
				name: host.name || host.host
			};
		}

		if (itemDetails.triggers && itemDetails.triggers.length > 0) {
			context.triggers = itemDetails.triggers.map(t => ({
				description: t.description,
				priority: ['Not classified', 'Information', 'Warning', 'Average', 'High', 'Disaster'][parseInt(t.priority, 10)] || 'Unknown',
				status: t.value === '1' ? 'PROBLEM' : 'OK'
			}));
		}

		return context;
	}

	function createProviderSelect(providers, defaultProvider) {
		const select = document.createElement('select');
		if (providers.length > 0) {
			providers.forEach((provider) => {
				const option = document.createElement('option');
				option.value = provider.name;
				option.textContent = `${provider.name}${provider.model ? ' - ' + provider.model : ''}`;
				if (provider.name === defaultProvider) option.selected = true;
				select.appendChild(option);
			});
		}
		else {
			const option = document.createElement('option');
			option.value = defaultProvider;
			option.textContent = defaultProvider;
			select.appendChild(option);
		}
		return select;
	}

	function openLatestDataModal(basicData, settings) {
		const core = window.AIIntegrationCore;
		const providers = settings.providers || [];
		const defaultProvider = settings.default_provider || 'openai';

		const providerSelect = createProviderSelect(providers, defaultProvider);
		const langSelect = core.createLanguageSelect();

		const headerWrapper = document.createElement('div');
		headerWrapper.appendChild(providerSelect);
		headerWrapper.appendChild(langSelect);

		const container = document.createElement('div');
		container.innerHTML = '<div class="aiintegration-loading-context"><p>Loading item analysis...</p></div>';

		const modal = core.openModal('AI Data Analysis', container, [
			{ label: 'Close', className: 'btn-alt', onClick: (close) => close() }
		], { headerExtra: headerWrapper });

		loadItemAnalysisContext(basicData.itemid).then((context) => {
			container.innerHTML = '';

			const stats = context.analysis.statistics || {};
			const anomalyCount = context.analysis.anomalies.length;
			const deviationCount = context.analysis.deviations.length;
			const patternCount = context.analysis.patterns.length;

			const statusColor = anomalyCount > 0 ? '#e45959' : deviationCount > 0 ? '#eea259' : '#4caf50';
			const statusText = anomalyCount > 0 ? 'Anomalies Detected' : deviationCount > 0 ? 'Deviations Found' : 'Normal';

			let findingsHtml = '';
			if (anomalyCount > 0 || deviationCount > 0 || patternCount > 0) {
				const findings = [
					...context.analysis.anomalies.map(a => `<span style="color:#e45959">${core.escapeHtml(a.message)}</span>`),
					...context.analysis.deviations.map(d => `<span style="color:#eea259">${core.escapeHtml(d.message)}</span>`),
					...context.analysis.patterns.map(p => `<span style="color:#6366f1">${core.escapeHtml(p.message)}</span>`)
				];
				findingsHtml = `<tr><td>Findings</td><td>${findings.join('<br>')}</td></tr>`;
			}

			const summaryHtml = `
				<table class="aiintegration-summary-table">
					<tr><td>Item</td><td>${core.escapeHtml(context.item.name)}</td></tr>
					<tr><td>Host</td><td>${core.escapeHtml(context.host?.name || 'N/A')}</td></tr>
					<tr><td>Current Value</td><td><strong>${core.escapeHtml(context.current_data.value || 'N/A')} ${core.escapeHtml(context.item.units)}</strong></td></tr>
					<tr><td>Status</td><td><strong style="color:${statusColor}">${statusText}</strong></td></tr>
					<tr><td>Statistics</td><td>Min: ${stats.min ?? 'N/A'} | Max: ${stats.max ?? 'N/A'} | Avg: ${stats.avg ?? 'N/A'} | StdDev: ${stats.std_dev ?? 'N/A'}</td></tr>
					<tr><td>Z-Score</td><td>${stats.current_z_score !== undefined ? stats.current_z_score : 'N/A'} (values > 2 or < -2 are unusual)</td></tr>
					<tr><td>Samples</td><td>${context.analysis.sample_count} data points analyzed</td></tr>
					${findingsHtml}
				</table>
			`;

			container.innerHTML = summaryHtml;

			const questionField = document.createElement('div');
			questionField.className = 'aiintegration-field';
			questionField.innerHTML = '<label>Question</label>';

			const questionInput = document.createElement('textarea');
			questionInput.rows = 3;
			questionInput.value = `Analyze this Zabbix item data and provide:
1. Assessment of current value compared to historical statistics
2. Explanation of any anomalies or deviations detected
3. Potential causes for unusual patterns
4. Recommended thresholds for alerting
5. Suggestions for improving monitoring of this metric`;
			questionField.appendChild(questionInput);
			container.appendChild(questionField);

			let contextInput = null;
			if (settings.is_super_admin) {
				const contextField = document.createElement('div');
				contextField.className = 'aiintegration-field';
				contextField.innerHTML = '<label>Context (JSON)</label>';

				contextInput = document.createElement('textarea');
				contextInput.rows = 12;
				contextInput.value = JSON.stringify(context, null, 2);
				contextField.appendChild(contextInput);
				container.appendChild(contextField);
			}

			const resultBox = document.createElement('div');
			container.appendChild(resultBox);

			modal.setActions([
				{
					label: 'Analyze',
					className: 'btn-primary',
					onClick: () => {
						let ctx = context;
						if (contextInput) {
							try {
								ctx = JSON.parse(contextInput.value || '{}');
							} catch (e) {
								resultBox.innerHTML = '<div class="aiintegration-error">Invalid JSON.</div>';
								return;
							}
						}

						resultBox.innerHTML = '<div class="aiintegration-response"><div class="aiintegration-loading-context">Analyzing...</div></div>';

						let finalQuestion = questionInput.value.trim();
						if (langSelect.value === 'pt-BR') {
							finalQuestion += '\n\nIMPORTANT: Please provide the entire response in Portuguese (Brazil). Maintain all technical Zabbix terms if appropriate, but explain them in Portuguese.';
						}

						core.callAI(finalQuestion, ctx, providerSelect.value)
							.then((data) => {
								const responseText = data.response || '';
								resultBox.innerHTML = `<div class="aiintegration-response">${core.renderMarkdown(responseText)}</div>`;

								modal.setActions([
									{
										label: 'Copy Result',
										className: 'btn-alt',
										onClick: (close, btn) => core.copyToClipboard(responseText, btn)
									},
									{ label: 'Close', className: 'btn-alt', onClick: (c) => c() }
								]);
							})
							.catch((error) => {
								resultBox.innerHTML = `<div class="aiintegration-error">${core.escapeHtml(error.message || 'Error')}</div>`;
							});
					}
				},
				{ label: 'Close', className: 'btn-alt', onClick: (close) => close() }
			]);
		}).catch((error) => {
			container.innerHTML = `<div class="aiintegration-error">Failed to load item data: ${core.escapeHtml(error.message || 'Unknown error')}</div>`;
		});

		return modal;
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	}
	else {
		init();
	}
})();
