(function () {
	'use strict';

	function waitForCore(callback) {
		if (typeof window.AIIntegrationCore !== 'undefined') {
			callback();
		}
		else {
			setTimeout(() => waitForCore(callback), 100);
		}
	}

	function isProblemsPage() {
		return window.location.href.includes('action=problem.view') ||
			document.querySelector('[data-page="problem"]') !== null;
	}

	function init() {
		if (!isProblemsPage()) {
			return;
		}

		waitForCore(() => {
			const core = window.AIIntegrationCore;
			core.loadSettings().then((settings) => {
				if (!settings.quick_actions || !settings.quick_actions.problems) {
					return;
				}
				initProblemButtons(settings);
			});
		});
	}

	function initProblemButtons(settings) {
		const table = document.querySelector('table.list-table');
		if (!table) {
			setTimeout(() => initProblemButtons(settings), 500);
			return;
		}

		addHeaderColumn(table);
		addButtonsToRows(table, settings);
		observeTableChanges(settings);
		observePageRefresh(settings);
	}

	function getSparkleIcon(size) {
		return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="display:block; filter: drop-shadow(0 0 3px #a855f7);">
			<defs>
				<linearGradient id="aiSparkleGradProb" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" style="stop-color:#a855f7"/>
					<stop offset="50%" style="stop-color:#6366f1"/>
					<stop offset="100%" style="stop-color:#3b82f6"/>
				</linearGradient>
			</defs>
			<path d="M12 0L13.5 8.5L22 10L13.5 11.5L12 20L10.5 11.5L2 10L10.5 8.5L12 0Z" fill="url(#aiSparkleGradProb)"/>
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

			const problemData = extractBasicProblemData(row);
			if (!problemData || !problemData.eventid) {
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
				openProblemModal(problemData, settings);
			});

			td.appendChild(button);
			row.appendChild(td);
			row.classList.add('aiintegration-btn-added');
		});
	}

	function observeTableChanges(settings) {
		const container = document.querySelector('.wrapper, main, #page-content, body');
		if (!container) {
			return;
		}

		const observer = new MutationObserver(() => {
			setTimeout(() => {
				const table = document.querySelector('table.list-table');
				if (table) {
					addHeaderColumn(table);
					addButtonsToRows(table, settings);
				}
			}, 100);
		});

		observer.observe(container, {
			childList: true,
			subtree: true
		});
	}

	function observePageRefresh(settings) {
		setInterval(() => {
			const table = document.querySelector('table.list-table');
			if (!table) return;

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

	function extractBasicProblemData(row) {
		try {
			const cells = row.querySelectorAll('td');
			if (cells.length < 4) {
				return null;
			}

			const data = {
				eventid: '',
				time: '',
				severity: '',
				host: '',
				problem: '',
				duration: '',
				ack: '',
				tags: [],
				opdata: ''
			};

			const checkbox = row.querySelector('input[type="checkbox"][name*="eventids"]');
			if (checkbox) {
				data.eventid = checkbox.value;
			}

			cells.forEach((cell, index) => {
				const text = cell.textContent.trim();

				if (index === 1 || cell.classList.contains('timeline-date')) {
					data.time = text;
				}

				if (cell.querySelector('[class*="severity"]') || cell.querySelector('.status-indicator')) {
					data.severity = text || cell.querySelector('.status-indicator')?.title || '';
				}

				const hostLink = cell.querySelector('a[href*="hostid"]');
				if (hostLink && !data.host) {
					data.host = hostLink.textContent.trim();
				}

				const problemLink = cell.querySelector('a[href*="eventid"]');
				if (problemLink && !data.problem) {
					data.problem = problemLink.textContent.trim();
				}

				if (text.match(/\d+[smhd]/)) {
					data.duration = text;
				}

				if (cell.querySelector('.zi-check') || text.toLowerCase().includes('yes')) {
					data.ack = 'Yes';
				}
				else if (text.toLowerCase().includes('no')) {
					data.ack = 'No';
				}

				const tags = cell.querySelectorAll('.tag');
				if (tags.length > 0) {
					tags.forEach((tag) => {
						data.tags.push(tag.textContent.trim());
					});
				}

				if (cell.classList.contains('opdata') || cell.querySelector('.opdata')) {
					data.opdata = text;
				}
			});

			return data;
		}
		catch (error) {
			return null;
		}
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

	function fetchEnrichedEventData(eventid) {
		return callZabbixApi('event.get', {
			eventids: [eventid],
			output: 'extend',
			selectAcknowledges: ['clock', 'message', 'action', 'username', 'userid'],
			selectTags: 'extend',
			selectHosts: ['hostid', 'host', 'name', 'description', 'status'],
			selectRelatedObject: ['triggerid', 'description', 'expression', 'recovery_expression', 'priority', 'comments', 'manual_close'],
			selectSuppressionData: 'extend'
		}).then((events) => {
			if (events && events.length > 0) {
				return events[0];
			}
			return null;
		});
	}

	function fetchSimilarEvents(triggerid, currentEventid) {
		const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);

		return callZabbixApi('event.get', {
			objectids: [triggerid],
			source: 0,
			object: 0,
			time_from: thirtyDaysAgo,
			output: ['eventid', 'clock', 'ns', 'severity', 'acknowledged', 'name'],
			sortfield: ['clock'],
			sortorder: 'DESC',
			limit: 50
		}).then((events) => {
			if (events && events.length > 0) {
				return events.filter((e) => e.eventid !== currentEventid);
			}
			return [];
		});
	}

	function fetchHostItems(hostid, limit) {
		return callZabbixApi('item.get', {
			hostids: [hostid],
			output: ['itemid', 'name', 'key_', 'lastvalue', 'units', 'lastclock', 'state', 'status'],
			filter: { status: 0, state: 0 },
			sortfield: 'lastclock',
			sortorder: 'DESC',
			limit: limit || 20
		});
	}

	function fetchTriggerDependencies(triggerid) {
		return callZabbixApi('trigger.get', {
			triggerids: [triggerid],
			output: ['triggerid', 'description'],
			selectDependencies: ['triggerid', 'description'],
			selectItems: ['itemid', 'name', 'key_', 'lastvalue', 'units']
		}).then((triggers) => {
			if (triggers && triggers.length > 0) {
				return triggers[0];
			}
			return null;
		});
	}

	function analyzeRecurrence(similarEvents) {
		if (!similarEvents || similarEvents.length === 0) {
			return {
				total_occurrences_30d: 0,
				pattern: 'No previous occurrences in last 30 days'
			};
		}

		const analysis = {
			total_occurrences_30d: similarEvents.length,
			first_occurrence: null,
			last_occurrence: null,
			hourly_distribution: {},
			daily_distribution: {},
			average_interval_hours: null,
			pattern: ''
		};

		const timestamps = similarEvents.map((e) => parseInt(e.clock, 10) * 1000);

		if (timestamps.length > 0) {
			analysis.first_occurrence = new Date(Math.min(...timestamps)).toISOString();
			analysis.last_occurrence = new Date(Math.max(...timestamps)).toISOString();
		}

		timestamps.forEach((ts) => {
			const date = new Date(ts);
			const hour = date.getHours();
			const day = date.toLocaleDateString('en-US', { weekday: 'long' });

			analysis.hourly_distribution[hour] = (analysis.hourly_distribution[hour] || 0) + 1;
			analysis.daily_distribution[day] = (analysis.daily_distribution[day] || 0) + 1;
		});

		if (timestamps.length >= 2) {
			const intervals = [];
			const sorted = [...timestamps].sort((a, b) => a - b);
			for (let i = 1; i < sorted.length; i++) {
				intervals.push((sorted[i] - sorted[i - 1]) / (1000 * 60 * 60));
			}
			analysis.average_interval_hours = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length * 10) / 10;
		}

		const peakHour = Object.entries(analysis.hourly_distribution)
			.sort((a, b) => b[1] - a[1])[0];
		const peakDay = Object.entries(analysis.daily_distribution)
			.sort((a, b) => b[1] - a[1])[0];

		const patterns = [];
		if (analysis.total_occurrences_30d > 10) {
			patterns.push('HIGH RECURRENCE - occurs frequently');
		}
		else if (analysis.total_occurrences_30d > 3) {
			patterns.push('MODERATE RECURRENCE');
		}

		if (peakHour) {
			patterns.push(`Peak hour: ${peakHour[0]}:00 (${peakHour[1]} occurrences)`);
		}
		if (peakDay) {
			patterns.push(`Peak day: ${peakDay[0]} (${peakDay[1]} occurrences)`);
		}
		if (analysis.average_interval_hours) {
			patterns.push(`Average interval: ${analysis.average_interval_hours} hours`);
		}

		analysis.pattern = patterns.join('; ') || 'No clear pattern detected';

		return analysis;
	}

	function formatAcknowledges(acknowledges) {
		if (!acknowledges || acknowledges.length === 0) {
			return [];
		}

		return acknowledges.map((ack) => ({
			time: new Date(parseInt(ack.clock, 10) * 1000).toISOString(),
			user: ack.username || `User ID: ${ack.userid}`,
			message: ack.message || '',
			action: getAckActionText(ack.action)
		}));
	}

	function getAckActionText(action) {
		const actions = [];
		const actionInt = parseInt(action, 10);
		if (actionInt & 1) actions.push('Close problem');
		if (actionInt & 2) actions.push('Acknowledge');
		if (actionInt & 4) actions.push('Add message');
		if (actionInt & 8) actions.push('Change severity');
		if (actionInt & 16) actions.push('Unacknowledge');
		if (actionInt & 32) actions.push('Suppress');
		if (actionInt & 64) actions.push('Unsuppress');
		if (actionInt & 128) actions.push('Change to cause');
		if (actionInt & 256) actions.push('Change to symptom');
		return actions.length > 0 ? actions.join(', ') : 'Unknown action';
	}

	function buildEnrichedContext(basicData, eventData, similarEvents, triggerData, hostItems) {
		const context = {
			event: {
				eventid: basicData.eventid,
				name: eventData?.name || basicData.problem,
				severity: getSeverityName(eventData?.severity),
				severity_number: eventData?.severity,
				clock: eventData?.clock ? new Date(parseInt(eventData.clock, 10) * 1000).toISOString() : basicData.time,
				acknowledged: eventData?.acknowledged === '1',
				suppressed: eventData?.suppressed === '1',
				opdata: eventData?.opdata || basicData.opdata
			},
			host: null,
			trigger: null,
			acknowledges: [],
			tags: [],
			recurrence_analysis: null,
			related_items: [],
			suppression_data: null
		};

		if (eventData?.hosts && eventData.hosts.length > 0) {
			const host = eventData.hosts[0];
			context.host = {
				hostid: host.hostid,
				name: host.name || host.host,
				technical_name: host.host,
				description: host.description || '',
				status: host.status === '0' ? 'Enabled' : 'Disabled'
			};
		}

		if (eventData?.relatedObject) {
			const trigger = eventData.relatedObject;
			context.trigger = {
				triggerid: trigger.triggerid,
				description: trigger.description,
				expression: trigger.expression,
				recovery_expression: trigger.recovery_expression || '',
				priority: getSeverityName(trigger.priority),
				comments: trigger.comments || '',
				manual_close: trigger.manual_close === '1'
			};
		}

		if (eventData?.acknowledges) {
			context.acknowledges = formatAcknowledges(eventData.acknowledges);
		}

		if (eventData?.tags) {
			context.tags = eventData.tags.map((t) => ({ tag: t.tag, value: t.value }));
		}

		if (eventData?.suppression_data && eventData.suppression_data.length > 0) {
			context.suppression_data = eventData.suppression_data;
		}

		context.recurrence_analysis = analyzeRecurrence(similarEvents);

		if (triggerData?.items) {
			context.trigger_items = triggerData.items.map((item) => ({
				name: item.name,
				key: item.key_,
				last_value: item.lastvalue,
				units: item.units
			}));
		}

		if (triggerData?.dependencies && triggerData.dependencies.length > 0) {
			context.trigger_dependencies = triggerData.dependencies.map((d) => d.description);
		}

		if (hostItems && hostItems.length > 0) {
			context.recent_host_metrics = hostItems.slice(0, 10).map((item) => ({
				name: item.name,
				key: item.key_,
				last_value: item.lastvalue,
				units: item.units,
				last_update: item.lastclock ? new Date(parseInt(item.lastclock, 10) * 1000).toISOString() : null
			}));
		}

		return context;
	}

	function getSeverityName(severity) {
		const names = ['Not classified', 'Information', 'Warning', 'Average', 'High', 'Disaster'];
		return names[parseInt(severity, 10)] || 'Unknown';
	}

	async function loadFullContext(basicData) {
		const eventid = basicData.eventid;

		const eventData = await fetchEnrichedEventData(eventid);

		let triggerid = null;
		let hostid = null;

		if (eventData) {
			triggerid = eventData.objectid;
			if (eventData.hosts && eventData.hosts.length > 0) {
				hostid = eventData.hosts[0].hostid;
			}
		}

		const [similarEvents, triggerData, hostItems] = await Promise.all([
			triggerid ? fetchSimilarEvents(triggerid, eventid) : Promise.resolve([]),
			triggerid ? fetchTriggerDependencies(triggerid) : Promise.resolve(null),
			hostid ? fetchHostItems(hostid, 20) : Promise.resolve([])
		]);

		return buildEnrichedContext(basicData, eventData, similarEvents, triggerData, hostItems);
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

	function openProblemModal(basicData, settings) {
		const core = window.AIIntegrationCore;
		const providers = settings.providers || [];
		const defaultProvider = settings.default_provider || 'openai';

		const providerSelect = createProviderSelect(providers, defaultProvider);
		const langSelect = core.createLanguageSelect();

		const headerWrapper = document.createElement('div');
		headerWrapper.appendChild(providerSelect);
		headerWrapper.appendChild(langSelect);

		const container = document.createElement('div');
		container.innerHTML = '<div class="aiintegration-loading-context"><p>Loading...</p></div>';

		const modal = core.openModal('AI Problem Analysis', container, [
			{ label: 'Close', className: 'btn-alt', onClick: (close) => close() }
		], { headerExtra: headerWrapper });

		loadFullContext(basicData).then((enrichedContext) => {
			container.innerHTML = '';

			const summaryHtml = `
				<table class="aiintegration-summary-table">
					<tr><td>Event ID</td><td>${core.escapeHtml(enrichedContext.event.eventid)}</td></tr>
					<tr><td>Problem</td><td>${core.escapeHtml(enrichedContext.event.name)}</td></tr>
					<tr><td>Severity</td><td>${core.escapeHtml(enrichedContext.event.severity)}</td></tr>
					<tr><td>Host</td><td>${core.escapeHtml(enrichedContext.host?.name || 'N/A')}</td></tr>
					<tr><td>Time</td><td>${core.escapeHtml(enrichedContext.event.clock)}</td></tr>
					<tr><td>Acknowledged</td><td>${enrichedContext.event.acknowledged ? 'Yes' : 'No'}</td></tr>
					<tr><td>Recurrence (30d)</td><td>${enrichedContext.recurrence_analysis?.total_occurrences_30d || 0} occurrences</td></tr>
					<tr><td>Pattern</td><td>${core.escapeHtml(enrichedContext.recurrence_analysis?.pattern || 'N/A')}</td></tr>
					${enrichedContext.acknowledges.length > 0 ? `<tr><td>Last ACK</td><td>${core.escapeHtml(enrichedContext.acknowledges[0].message || enrichedContext.acknowledges[0].action)}</td></tr>` : ''}
				</table>
			`;

			container.innerHTML = summaryHtml;

			const questionField = document.createElement('div');
			questionField.className = 'aiintegration-field';
			questionField.innerHTML = '<label>Question</label>';

			const questionInput = document.createElement('textarea');
			questionInput.rows = 3;
			questionInput.value = `Analyze this Zabbix problem with the enriched context provided. Consider:
1. Root cause analysis based on trigger expression and item values
2. Recurrence patterns and temporal analysis
3. Acknowledge history and previous actions taken
4. Impact assessment and recommended actions
5. Preventive measures to avoid recurrence`;
			questionField.appendChild(questionInput);
			container.appendChild(questionField);

			let contextInput = null;
			if (settings.is_super_admin) {
				const contextField = document.createElement('div');
				contextField.className = 'aiintegration-field';
				contextField.innerHTML = '<label>Context (JSON)</label>';

				contextInput = document.createElement('textarea');
				contextInput.rows = 12;
				contextInput.value = JSON.stringify(enrichedContext, null, 2);
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
						let context = enrichedContext;
						if (contextInput) {
							try {
								context = JSON.parse(contextInput.value || '{}');
							}
							catch (e) {
								resultBox.innerHTML = '<div class="aiintegration-error">Invalid JSON in context.</div>';
								return;
							}
						}

						resultBox.innerHTML = '<div class="aiintegration-response"><div class="aiintegration-loading-context">Analyzing...</div></div>';

						let finalQuestion = questionInput.value.trim();
						if (langSelect.value === 'pt-BR') {
							finalQuestion += '\n\nIMPORTANT: Please provide the entire response in Portuguese (Brazil). Maintain all technical Zabbix terms if appropriate, but explain them in Portuguese.';
						}

						core.callAI(finalQuestion, context, providerSelect.value)
							.then((data) => {
								const responseText = data.response || '';
								resultBox.innerHTML = `<div class="aiintegration-response">${core.renderMarkdown(responseText)}</div>`;

								// Update actions to include Copy
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
				{
					label: 'Close',
					className: 'btn-alt',
					onClick: (close) => close()
				}
			]);
		}).catch((error) => {
			container.innerHTML = `<div class="aiintegration-error">Failed to load context: ${core.escapeHtml(error.message || 'Unknown error')}</div>`;
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
