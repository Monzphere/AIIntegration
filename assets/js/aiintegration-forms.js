(function () {
	'use strict';

	function waitForCore(callback) {
		if (typeof window.AIIntegrationCore !== 'undefined' &&
			typeof window.AIIntegrationInit !== 'undefined') {
			callback();
		}
		else {
			setTimeout(() => waitForCore(callback), 100);
		}
	}

	function getDialogTitle(node) {
		const header = node.querySelector('.overlay-dialogue-header');
		return header ? header.textContent.trim() : '';
	}

	function getHostIdFromDialog(node) {
		const hostIdField = node.querySelector('input[name="hostid"]') || node.querySelector('input[id*="hostid"]');
		if (hostIdField && hostIdField.value) {
			return hostIdField.value;
		}

		const params = new URLSearchParams(window.location.search);
		return params.get('hostid') || params.get('filter_hostids[0]') || '';
	}

	const hostNameCache = {};

	function fetchHostNameByApi(hostId) {
		if (!hostId) {
			return Promise.resolve('');
		}

		if (hostNameCache[hostId]) {
			return Promise.resolve(hostNameCache[hostId]);
		}

		return fetch('api_jsonrpc.php', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json-rpc' },
			credentials: 'same-origin',
			body: JSON.stringify({
				jsonrpc: '2.0',
				method: 'host.get',
				params: {
					output: ['host', 'name'],
					hostids: [hostId]
				},
				id: 1
			})
		})
			.then((response) => response.json())
			.then((data) => {
				if (data && data.result && data.result.length > 0) {
					const hostName = data.result[0].host || data.result[0].name || '';
					hostNameCache[hostId] = hostName;
					return hostName;
				}
				return '';
			})
			.catch(() => '');
	}

	function normalizeTriggerExpression(expression, hostName, hostId) {
		if (!expression || !hostName) {
			return expression;
		}

		const safeHost = hostName.trim();
		if (!safeHost || safeHost.includes('/')) {
			return expression;
		}

		let normalized = expression;

		if (hostId) {
			const escapedId = hostId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			normalized = normalized.replace(new RegExp(`/${escapedId}/`, 'g'), `/${safeHost}/`);
		}

		normalized = normalized.replace(/\/(\d{4,})\//g, `/${safeHost}/`);

		return normalized;
	}

	function getBaseContext(node, type, hostName) {
		const hostId = getHostIdFromDialog(node);
		const context = {
			form_type: type,
			page_url: window.location.href,
			dialog_title: getDialogTitle(node)
		};

		if (hostName) {
			context.host_name = hostName;
		}

		const hostField = node.querySelector('input[name="host"]');
		if (hostField && hostField.value) {
			context.host = hostField.value;
		}

		if (hostId) {
			context.hostid = hostId;
		}

		return context;
	}

	function fillField(field, value) {
		if (!field || value === undefined || value === null || value === '') {
			return false;
		}
		field.value = value;
		field.dispatchEvent(new Event('input', { bubbles: true }));
		field.dispatchEvent(new Event('change', { bubbles: true }));
		return true;
	}

	function selectByText(select, text) {
		if (!select || !text) {
			return false;
		}
		const textLower = String(text).toLowerCase();
		const options = select.querySelectorAll('option');
		for (const option of options) {
			if (option.textContent.toLowerCase().includes(textLower)) {
				select.value = option.value;
				select.dispatchEvent(new Event('change', { bubbles: true }));
				return true;
			}
		}
		return false;
	}

	function openQuickFillModal(options) {
		const core = window.AIIntegrationCore;

		const providerSelect = document.createElement('select');
		providerSelect.name = 'aiintegration-provider';

		const container = document.createElement('div');

		const requestField = document.createElement('div');
		requestField.className = 'aiintegration-field';
		requestField.innerHTML = '<label>Request</label>';
		const requestInput = document.createElement('textarea');
		requestInput.rows = 3;
		requestInput.placeholder = options.placeholder || 'Describe what you need';
		requestField.appendChild(requestInput);
		container.appendChild(requestField);

		let contextInput = null;
		if (options.is_super_admin) {
			const contextField = document.createElement('div');
			contextField.className = 'aiintegration-field';
			contextField.innerHTML = '<label>Context (JSON)</label>';
			contextInput = document.createElement('textarea');
			contextInput.rows = 6;
			contextInput.value = JSON.stringify(options.context || {}, null, 2);
			contextField.appendChild(contextInput);
			container.appendChild(contextField);
		}

		const resultBox = document.createElement('div');
		container.appendChild(resultBox);

		const langSelect = core.createLanguageSelect();
		const headerWrapper = document.createElement('div');
		headerWrapper.appendChild(providerSelect);
		headerWrapper.appendChild(langSelect);

		const modal = core.openModal(options.title, container, [
			{
				label: 'Generate',
				className: 'btn-primary',
				onClick: () => {
					const userRequest = requestInput.value.trim();
					if (!userRequest) {
						resultBox.innerHTML = '<div class="aiintegration-error">Request is required.</div>';
						return;
					}

					let parsedContext = options.context || {};
					if (contextInput) {
						try {
							parsedContext = JSON.parse(contextInput.value || '{}');
						}
						catch (e) {
							resultBox.innerHTML = '<div class="aiintegration-error">Invalid JSON.</div>';
							return;
						}
					}

					let question = options.buildQuestion(userRequest);
					if (langSelect.value === 'pt-BR') {
						question += '\n\nIMPORTANT: Please provide the response in Portuguese (Brazil).';
					}

					resultBox.innerHTML = '<div class="aiintegration-response"><div class="aiintegration-loading-context">Generating...</div></div>';

					core.callAI(question, parsedContext, providerSelect.value)
						.then((data) => {
							const responseText = data.response || '';
							const parsed = core.tryParseJSON(responseText);
							if (!parsed) {
								resultBox.innerHTML = `<div class="aiintegration-error">Could not parse response.</div><div class="aiintegration-response">${core.renderMarkdown(responseText)}</div>`;
								return;
							}

							const preview = options.renderPreview(parsed, core);
							resultBox.innerHTML = '';
							resultBox.appendChild(preview);

							modal.setActions([
								{
									label: 'Apply',
									className: 'btn-primary',
									onClick: (close) => {
										options.applyResult(parsed);
										close();
									}
								},
								{
									label: 'Copy Result',
									className: 'btn-alt',
									onClick: (close, btn) => core.copyToClipboard(responseText, btn)
								},
								{
									label: 'Close',
									className: 'btn-alt',
									onClick: (close) => close()
								}
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
		], { headerExtra: headerWrapper });

		core.loadSettings().then((settings) => {
			const providers = settings.providers || [];
			const defaultProvider = settings.default_provider || 'openai';
			providerSelect.innerHTML = '';
			if (providers.length > 0) {
				providers.forEach((provider) => {
					const option = document.createElement('option');
					option.value = provider.name;
					option.textContent = `${provider.name}${provider.model ? ' - ' + provider.model : ''}`;
					if (provider.name === defaultProvider) option.selected = true;
					providerSelect.appendChild(option);
				});
			}
			else {
				const option = document.createElement('option');
				option.value = defaultProvider;
				option.textContent = defaultProvider;
				providerSelect.appendChild(option);
			}
		});

		return modal;
	}

	function handleTriggerModal(dialogueNode) {
		const core = window.AIIntegrationCore;
		core.loadSettings().then((settings) => {
			if (!settings.quick_actions || !settings.quick_actions.triggers) {
				return;
			}

			const footer = dialogueNode.querySelector('.overlay-dialogue-footer');
			if (!footer || footer.querySelector('.aiintegration-trigger-btn')) {
				return;
			}

			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'btn-alt aiintegration-btn aiintegration-trigger-btn';
			button.textContent = 'AI Quick Fill';

			button.addEventListener('click', () => {
				const hostId = getHostIdFromDialog(dialogueNode);

				fetchHostNameByApi(hostId).then((hostName) => {
					const context = getBaseContext(dialogueNode, 'trigger', hostName);

					openQuickFillModal({
						title: 'AI Trigger Helper',
						context: context,
						placeholder: 'Example: Alert when CPU usage is above 80% for 5 minutes',
						hostId: hostId,
						hostName: hostName,
						is_super_admin: settings.is_super_admin,
						buildQuestion: (request) => {
							const hostHint = hostName
								? `Host name: "${hostName}". Use this EXACT host name in the expression (format: /hostname/item.key). Do NOT use hostid.\n`
								: '';
							return `You are a Zabbix expert. Generate a trigger configuration based on the request.

IMPORTANT - Time-based conditions:
- "horário comercial" / "business hours" = Mon-Fri 8AM-6PM: add "and dayofweek()>=1 and dayofweek()<=5 and time()>=080000 and time()<=180000"
- "fins de semana" / "weekends" = Sat-Sun: add "and (dayofweek()=6 or dayofweek()=7)"
- "noite" / "night" = 6PM-8AM: add "and (time()>=180000 or time()<=080000)"
- "madrugada" = 0AM-6AM: add "and time()>=000000 and time()<=060000"

IMPORTANT - Expression best practices:
- For CPU/Memory/Network: use avg() with 5m period, NOT last()
- Always use format: function(/hostname/item.key,period)operator threshold
- Add nodata check when appropriate: "and nodata(/hostname/item.key,5m)=0"

Common Zabbix item keys:
- CPU: system.cpu.util[,idle], system.cpu.util[,user], system.cpu.load[percpu,avg5]
- Memory: vm.memory.util, vm.memory.size[available]
- Disk: vfs.fs.size[/,pfree], vfs.fs.size[/,pused]
- Network: net.if.in[eth0], net.if.out[eth0]

Return ONLY valid JSON:
{
  "name": "descriptive trigger name including all conditions",
  "expression": "complete expression with ALL conditions from request",
  "severity": 0-5 (3=Average for most alerts, 4=High for critical),
  "description": "explain what this trigger monitors and when",
  "recovery_expression": "recovery with hysteresis if applicable"
}

${hostHint}User request: "${request}"`;
						},
						renderPreview: (data, helper) => {
							const wrapper = document.createElement('div');
							wrapper.innerHTML = `
							<table class="aiintegration-summary-table">
								<tr><td>Name</td><td>${helper.escapeHtml(data.name || '')}</td></tr>
								<tr><td>Expression</td><td>${helper.escapeHtml(data.expression || '')}</td></tr>
								<tr><td>Severity</td><td>${helper.escapeHtml(String(data.severity ?? ''))}</td></tr>
								<tr><td>Description</td><td>${helper.escapeHtml(data.description || '')}</td></tr>
								${data.recovery_expression ? `<tr><td>Recovery</td><td>${helper.escapeHtml(data.recovery_expression)}</td></tr>` : ''}
							</table>
						`;
							return wrapper;
						},
						applyResult: (data) => {
							const nameField = dialogueNode.querySelector('input[name="name"]') || dialogueNode.querySelector('#name');
							const exprField = dialogueNode.querySelector('textarea[name="expression"]') || dialogueNode.querySelector('#expression');
							const descField = dialogueNode.querySelector('textarea[name="description"]')
								|| dialogueNode.querySelector('textarea[name="comments"]')
								|| dialogueNode.querySelector('#description');
							const recoveryField = dialogueNode.querySelector('textarea[name="recovery_expression"]')
								|| dialogueNode.querySelector('#recovery_expression');

							const normalizedExpression = normalizeTriggerExpression(data.expression, hostName, hostId);
							const normalizedRecovery = data.recovery_expression
								? normalizeTriggerExpression(data.recovery_expression, hostName, hostId)
								: '';

							fillField(nameField, data.name);
							fillField(exprField, normalizedExpression);
							fillField(descField, data.description);
							if (normalizedRecovery) {
								fillField(recoveryField, normalizedRecovery);
							}

							if (data.severity !== undefined) {
								const severityRadios = dialogueNode.querySelectorAll('input[name="priority"]');
								severityRadios.forEach((radio) => {
									if (String(radio.value) === String(data.severity)) {
										radio.checked = true;
										radio.dispatchEvent(new Event('change', { bubbles: true }));
									}
								});
							}
						}
					});
				});
			});

			footer.insertBefore(button, footer.firstChild);
		});
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

	function fetchHostDetails(hostid) {
		return callZabbixApi('host.get', {
			hostids: [hostid],
			output: ['hostid', 'host', 'name', 'description', 'status', 'maintenance_status', 'active_available'],
			selectGroups: ['groupid', 'name'],
			selectInterfaces: ['ip', 'dns', 'port', 'type', 'main'],
			selectParentTemplates: ['templateid', 'name'],
			selectTags: 'extend',
			selectMacros: ['macro', 'value', 'description']
		}).then((hosts) => hosts && hosts.length > 0 ? hosts[0] : null);
	}

	function fetchHostProblemsCount(hostid) {
		const severities = [0, 1, 2, 3, 4, 5];
		const promises = severities.map((severity) =>
			callZabbixApi('problem.get', {
				hostids: [hostid],
				source: 0,
				object: 0,
				suppressed: false,
				severities: [severity],
				countOutput: true
			}).then((count) => ({ severity, count: parseInt(count, 10) || 0 }))
		);

		return Promise.all(promises).then((results) => {
			const bySeverity = {};
			let total = 0;
			results.forEach((r) => {
				bySeverity[r.severity] = r.count;
				total += r.count;
			});
			return { total, by_severity: bySeverity };
		});
	}

	function fetchHostProblems(hostid) {
		return callZabbixApi('problem.get', {
			hostids: [hostid],
			source: 0,
			object: 0,
			suppressed: false,
			output: ['eventid', 'objectid', 'clock', 'name', 'severity', 'acknowledged'],
			selectAcknowledges: ['clock', 'message', 'action', 'username'],
			selectTags: 'extend',
			sortfield: ['severity', 'clock'],
			sortorder: ['DESC', 'DESC'],
			limit: 20
		});
	}

	function fetchHostTopIncidents(hostid) {
		const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);

		return callZabbixApi('event.get', {
			hostids: [hostid],
			source: 0,
			object: 0,
			time_from: thirtyDaysAgo,
			output: ['eventid', 'clock', 'name', 'severity'],
			sortfield: 'clock',
			sortorder: 'DESC',
			limit: 100
		}).then((events) => {
			if (!events || events.length === 0) return [];

			const incidentCount = {};
			events.forEach((e) => {
				const key = e.name;
				if (!incidentCount[key]) {
					incidentCount[key] = { name: e.name, severity: e.severity, count: 0, last: e.clock };
				}
				incidentCount[key].count++;
			});

			return Object.values(incidentCount)
				.sort((a, b) => b.count - a.count)
				.slice(0, 10);
		});
	}

	function fetchHostMetrics(hostid) {
		return callZabbixApi('item.get', {
			hostids: [hostid],
			output: ['itemid', 'name', 'key_', 'lastvalue', 'units', 'lastclock', 'value_type', 'state', 'error'],
			filter: { status: 0 },
			search: {
				key_: 'system.cpu,vm.memory,vfs.fs.size,net.if,system.uptime,agent.ping'
			},
			searchByAny: true,
			sortfield: 'name',
			limit: 50
		});
	}

	function fetchHostTriggers(hostid) {
		return callZabbixApi('trigger.get', {
			hostids: [hostid],
			output: ['triggerid', 'description', 'priority', 'value', 'lastchange', 'state', 'error'],
			filter: { status: 0 },
			sortfield: 'priority',
			sortorder: 'DESC',
			limit: 30
		});
	}

	function analyzeHostMetrics(items) {
		if (!items || items.length === 0) return { anomalies: [], summary: {} };

		const anomalies = [];
		const summary = {
			cpu: null,
			memory: null,
			disk: [],
			network: [],
			uptime: null
		};

		items.forEach((item) => {
			const key = item.key_.toLowerCase();
			const value = parseFloat(item.lastvalue);
			const name = item.name;

			if (key.includes('cpu.util') || key.includes('cpu.load')) {
				if (!summary.cpu) summary.cpu = { name, value, units: item.units };
				if (key.includes('util') && value > 80) {
					anomalies.push({ type: 'HIGH_CPU', item: name, value: value, units: item.units, threshold: 80 });
				}
				if (key.includes('load') && value > 5) {
					anomalies.push({ type: 'HIGH_LOAD', item: name, value: value, units: item.units, threshold: 5 });
				}
			}

			if (key.includes('memory.util') || key.includes('memory.size')) {
				if (key.includes('util')) {
					summary.memory = { name, value, units: '%' };
					if (value > 85) {
						anomalies.push({ type: 'HIGH_MEMORY', item: name, value: value, units: '%', threshold: 85 });
					}
				}
			}

			if (key.includes('vfs.fs.size') && key.includes('pfree')) {
				summary.disk.push({ name, value, units: '%' });
				if (value < 10) {
					anomalies.push({ type: 'LOW_DISK', item: name, value: value, units: '%', threshold: 10 });
				}
			}

			if (key.includes('net.if')) {
				summary.network.push({ name, value, units: item.units });
			}

			if (key.includes('uptime')) {
				const days = Math.floor(value / 86400);
				summary.uptime = { name, value: days, units: 'days' };
			}
		});

		return { anomalies, summary };
	}

	function getSeverityName(severity) {
		const names = ['Not classified', 'Information', 'Warning', 'Average', 'High', 'Disaster'];
		return names[parseInt(severity, 10)] || 'Unknown';
	}

	async function loadHostAnalysisContext(hostid) {
		const [hostDetails, problemsCount, problems, topIncidents, metrics, triggers] = await Promise.all([
			fetchHostDetails(hostid),
			fetchHostProblemsCount(hostid),
			fetchHostProblems(hostid),
			fetchHostTopIncidents(hostid),
			fetchHostMetrics(hostid),
			fetchHostTriggers(hostid)
		]);

		const metricsAnalysis = analyzeHostMetrics(metrics);

		const context = {
			host: null,
			active_problems_count: problemsCount,
			active_problems: [],
			top_incidents_30d: [],
			metrics_summary: metricsAnalysis.summary,
			anomalies: metricsAnalysis.anomalies,
			triggers_status: { total: 0, firing: 0, ok: 0 },
			health_score: 100
		};

		if (hostDetails) {
			context.host = {
				hostid: hostDetails.hostid,
				name: hostDetails.name || hostDetails.host,
				technical_name: hostDetails.host,
				description: hostDetails.description || '',
				status: hostDetails.status === '0' ? 'Enabled' : 'Disabled',
				maintenance: hostDetails.maintenance_status === '1',
				availability: hostDetails.active_available === '1' ? 'Available' : 'Unavailable',
				groups: (hostDetails.groups || []).map((g) => g.name),
				templates: (hostDetails.parentTemplates || []).map((t) => t.name),
				interfaces: (hostDetails.interfaces || []).map((i) => ({
					type: ['', 'Agent', 'SNMP', 'IPMI', 'JMX'][i.type] || 'Unknown',
					ip: i.ip,
					dns: i.dns,
					port: i.port,
					main: i.main === '1'
				})),
				tags: hostDetails.tags || [],
				macros: (hostDetails.macros || []).map((m) => ({ macro: m.macro, description: m.description }))
			};
		}

		if (problems && problems.length > 0) {
			context.active_problems = problems.map((p) => ({
				eventid: p.eventid,
				name: p.name,
				severity: getSeverityName(p.severity),
				severity_num: parseInt(p.severity, 10),
				time: new Date(parseInt(p.clock, 10) * 1000).toISOString(),
				acknowledged: p.acknowledged === '1',
				tags: p.tags || [],
				acknowledges: (p.acknowledges || []).map((a) => ({
					time: new Date(parseInt(a.clock, 10) * 1000).toISOString(),
					user: a.username,
					message: a.message
				}))
			}));
		}

		if (problemsCount && problemsCount.by_severity) {
			const sev = problemsCount.by_severity;
			if (sev[5] > 0) context.health_score -= sev[5] * 25;
			if (sev[4] > 0) context.health_score -= sev[4] * 20;
			if (sev[3] > 0) context.health_score -= sev[3] * 10;
			if (sev[2] > 0) context.health_score -= sev[2] * 5;
			if (sev[1] > 0) context.health_score -= sev[1] * 2;
		}

		if (topIncidents && topIncidents.length > 0) {
			context.top_incidents_30d = topIncidents.map((i) => ({
				name: i.name,
				severity: getSeverityName(i.severity),
				occurrences: i.count,
				last_occurrence: new Date(parseInt(i.last, 10) * 1000).toISOString()
			}));
		}

		if (triggers && triggers.length > 0) {
			context.triggers_status.total = triggers.length;
			triggers.forEach((t) => {
				if (t.value === '1') context.triggers_status.firing++;
				else context.triggers_status.ok++;
			});
		}

		context.anomalies.forEach((a) => {
			if (a.type.includes('HIGH') || a.type.includes('LOW')) {
				context.health_score -= 10;
			}
		});

		context.health_score = Math.max(0, context.health_score);

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

	function openHostAnalysisModal(hostid, hostName, settings) {
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

		const modal = core.openModal('AI Host Analysis', container, [
			{ label: 'Close', className: 'btn-alt', onClick: (close) => close() }
		], { headerExtra: headerWrapper });

		loadHostAnalysisContext(hostid).then((context) => {
			container.innerHTML = '';

			const healthScore = Math.max(0, context.health_score);
			const healthColor = healthScore >= 80 ? '#4caf50' : healthScore >= 50 ? '#ff9800' : '#f44336';

			const problemsCount = context.active_problems_count || { total: 0, by_severity: {} };
			const sev = problemsCount.by_severity || {};
			const problemsBreakdown = [];
			if (sev[5]) problemsBreakdown.push(`<span style="color:#e45959">${sev[5]} Disaster</span>`);
			if (sev[4]) problemsBreakdown.push(`<span style="color:#e97659">${sev[4]} High</span>`);
			if (sev[3]) problemsBreakdown.push(`<span style="color:#eea259">${sev[3]} Average</span>`);
			if (sev[2]) problemsBreakdown.push(`<span style="color:#eec759">${sev[2]} Warning</span>`);
			if (sev[1]) problemsBreakdown.push(`<span style="color:#87ceeb">${sev[1]} Info</span>`);
			if (sev[0]) problemsBreakdown.push(`<span style="color:#999">${sev[0]} N/C</span>`);

			const summaryHtml = `
				<table class="aiintegration-summary-table">
					<tr><td>Host</td><td>${core.escapeHtml(context.host?.name || hostName || 'N/A')}</td></tr>
					<tr><td>Status</td><td>${core.escapeHtml(context.host?.status || 'N/A')} ${context.host?.maintenance ? '(In maintenance)' : ''}</td></tr>
					<tr><td>Health Score</td><td><strong style="color:${healthColor}">${healthScore}/100</strong></td></tr>
					<tr><td>Active Problems</td><td><strong>${problemsCount.total}</strong>${problemsBreakdown.length ? ' (' + problemsBreakdown.join(', ') + ')' : ''}</td></tr>
					<tr><td>Triggers</td><td>${context.triggers_status.firing} firing / ${context.triggers_status.total} total</td></tr>
					<tr><td>Anomalies Detected</td><td>${context.anomalies.length}</td></tr>
					<tr><td>Top Incident (30d)</td><td>${context.top_incidents_30d[0]?.name || 'None'} (${context.top_incidents_30d[0]?.occurrences || 0}x)</td></tr>
				</table>
			`;

			container.innerHTML = summaryHtml;

			const questionField = document.createElement('div');
			questionField.className = 'aiintegration-field';
			questionField.innerHTML = '<label>Question</label>';

			const questionInput = document.createElement('textarea');
			questionInput.rows = 3;
			questionInput.value = `Analyze this Zabbix host and provide:
1. Overall health assessment based on metrics and active problems
2. Analysis of detected anomalies and their potential impact
3. Top recurring incidents and patterns
4. Recommended actions to improve stability
5. Preventive measures and monitoring recommendations`;
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
							finalQuestion += '\n\nIMPORTANT: Please provide the entire response in Portuguese (Brazil).';
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
			container.innerHTML = `<div class="aiintegration-error">Failed to load host data: ${core.escapeHtml(error.message || 'Unknown error')}</div>`;
		});

		return modal;
	}

	function handleHostModal(dialogueNode) {
		const core = window.AIIntegrationCore;
		core.loadSettings().then((settings) => {
			if (!settings.quick_actions || !settings.quick_actions.hosts) {
				return;
			}

			const header = dialogueNode.querySelector('.overlay-dialogue-header');
			if (!header || header.querySelector('.aiintegration-host-btn')) {
				return;
			}

			const hostIdField = dialogueNode.querySelector('input[name="hostid"]');
			const hostid = hostIdField ? hostIdField.value : null;

			if (!hostid) {
				return;
			}

			const hostNameField = dialogueNode.querySelector('input[name="host"]');
			const hostName = hostNameField ? hostNameField.value : '';

			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'btn-icon aiintegration-host-btn';
			button.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" style="display:block; filter: drop-shadow(0 0 3px #a855f7);">
				<defs>
					<linearGradient id="aiSparkleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" style="stop-color:#a855f7"/>
						<stop offset="50%" style="stop-color:#6366f1"/>
						<stop offset="100%" style="stop-color:#3b82f6"/>
					</linearGradient>
				</defs>
				<path d="M12 0L13.5 8.5L22 10L13.5 11.5L12 20L10.5 11.5L2 10L10.5 8.5L12 0Z" fill="url(#aiSparkleGrad)"/>
				<path d="M19 14L19.75 17.25L23 18L19.75 18.75L19 22L18.25 18.75L15 18L18.25 17.25L19 14Z" fill="#a855f7" opacity="0.9"/>
				<path d="M5 14L5.5 16.5L8 17L5.5 17.5L5 20L4.5 17.5L2 17L4.5 16.5L5 14Z" fill="#6366f1" opacity="0.8"/>
			</svg>`;
			button.title = 'AI Host Analysis';
			button.style.cssText = 'position: absolute; right: 40px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 5px; transition: all 0.2s ease;';

			button.addEventListener('mouseenter', () => {
				button.style.transform = 'translateY(-50%) scale(1.2)';
				button.querySelector('svg').style.filter = 'drop-shadow(0 0 6px #a855f7) drop-shadow(0 0 10px #6366f1)';
			});
			button.addEventListener('mouseleave', () => {
				button.style.transform = 'translateY(-50%) scale(1)';
				button.querySelector('svg').style.filter = 'drop-shadow(0 0 3px #a855f7)';
			});

			button.addEventListener('click', () => {
				openHostAnalysisModal(hostid, hostName, settings);
			});

			header.style.position = 'relative';
			header.appendChild(button);
		});
	}

	waitForCore(() => {
		window.AIIntegrationInit.registerHandler('triggers', handleTriggerModal);
		window.AIIntegrationInit.registerHandler('hosts', handleHostModal);
	});
})();
