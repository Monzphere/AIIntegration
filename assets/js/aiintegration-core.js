window.AIIntegrationCore = (function () {
	'use strict';

	const CONFIG = {
		apiEndpoint: 'zabbix.php?action=aiintegration.query',
		providersEndpoint: 'zabbix.php?action=aiintegration.providers',
		modalOverlayClass: 'aiintegration-modal-overlay'
	};

	let settingsCache = null;
	let settingsPromise = null;

	function createLanguageSelect() {
		const select = document.createElement('select');
		select.className = 'aiintegration-lang-select';

		const languages = [
			{ val: 'en', label: 'English' },
			{ val: 'pt-BR', label: 'Português (Brasil)' }
		];

		languages.forEach(lang => {
			const opt = document.createElement('option');
			opt.value = lang.val;
			opt.textContent = lang.label;
			if (lang.val === 'pt-BR') opt.selected = true; // Default to PT-BR as per recent user request
			select.appendChild(opt);
		});

		return select;
	}

	function getCurrentTheme() {
		const body = document.body;
		if (body && (body.classList.contains('theme-dark') || body.classList.contains('dark-theme'))) {
			return 'dark';
		}
		const html = document.documentElement;
		const attrTheme = html.getAttribute('data-theme') || html.getAttribute('theme');
		if (html && (attrTheme === 'dark-theme' || attrTheme === 'dark')) {
			return 'dark';
		}
		return 'light';
	}

	function copyToClipboard(text, btn) {
		if (!navigator.clipboard) {
			const textArea = document.createElement("textarea");
			textArea.value = text;
			document.body.appendChild(textArea);
			textArea.select();
			try {
				document.execCommand('copy');
				showCopySuccess(btn);
			} catch (err) { }
			document.body.removeChild(textArea);
			return;
		}
		navigator.clipboard.writeText(text).then(() => {
			showCopySuccess(btn);
		});
	}

	function showCopySuccess(btn) {
		if (!btn) return;
		const originalText = btn.textContent;
		btn.textContent = 'Copied!';
		btn.classList.add('btn-success');
		setTimeout(() => {
			btn.textContent = originalText;
			btn.classList.remove('btn-success');
		}, 2000);
	}

	function renderMarkdown(text) {
		if (!text) return '';

		let html = text
			// Escape basic HTML
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');

		// Fenced code blocks
		html = html.replace(/```(?:[a-z]*)\n([\s\S]*?)\n```/g, '<pre><code>$1</code></pre>');

		// Inline code
		html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

		// Tables (simple implementation)
		html = html.replace(/^\|(.+)\|$/gim, (match, content) => {
			const cells = content.split('|').map(c => c.trim());
			const tag = match.includes('---') ? 'th' : 'td';
			return `<tr>${cells.map(c => `<${tag}>${c}</${tag}>`).join('')}</tr>`;
		});
		html = html.replace(/((?:<tr>.*<\/tr>\s*)+)/gms, '<table>$1</table>');
		// Clean up rows that are just separators
		html = html.replace(/<tr>\s*<td>-+\s*<\/td>\s*<td>-+\s*<\/td>.*?<\/tr>/gim, '');

		// Headers
		html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
		html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
		html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
		html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

		// Horizontal Rules
		html = html.replace(/^---$/gim, '<hr>');

		// Blockquotes (handle the escaped > which is now &gt;)
		html = html.replace(/^&gt; (.*$)/gim, '<blockquote>$1</blockquote>');

		// Bold and Italic
		html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
		html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

		// Lists
		html = html.replace(/^\s*[-*+] (.*$)/gim, '<li>$1</li>');
		html = html.replace(/(<li>.*<\/li>)/gms, '<ul>$1</ul>');
		html = html.replace(/<\/ul>\s*<ul>/g, '');

		// Better line breaks and paragraphs
		const blockTags = ['h1', 'h2', 'h3', 'h4', 'pre', 'ul', 'li', 'table', 'blockquote', 'hr'];
		const lines = html.split('\n');
		let result = '';
		let inPre = false;

		lines.forEach(line => {
			const trimmed = line.trim();
			if (trimmed.includes('<pre>')) inPre = true;
			if (trimmed.includes('</pre>')) {
				inPre = false;
				result += line + '\n';
				return;
			}

			if (inPre) {
				result += line + '\n';
				return;
			}

			const isBlock = blockTags.some(tag => trimmed.startsWith('<' + tag));

			if (trimmed === '') {
				result += '<br>';
			} else if (isBlock) {
				result += line + '\n';
			} else {
				result += '<p>' + line + '</p>';
			}
		});

		return result;
	}

	function tryParseJSON(text) {
		if (!text) {
			return null;
		}
		try {
			return JSON.parse(text);
		}
		catch (e) {
			// continue
		}

		const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
		try {
			return JSON.parse(cleaned);
		}
		catch (e) {
			// continue
		}

		const match = cleaned.match(/\{[\s\S]*\}/);
		if (match) {
			try {
				return JSON.parse(match[0]);
			}
			catch (e) {
				return null;
			}
		}

		return null;
	}

	function loadSettings(force) {
		if (settingsCache && !force) {
			return Promise.resolve(settingsCache);
		}
		if (settingsPromise) {
			return settingsPromise;
		}

		settingsPromise = fetch(CONFIG.providersEndpoint, { credentials: 'same-origin' })
			.then((response) => response.json())
			.then((data) => {
				if (!data || !data.success) {
					throw new Error(data && data.error ? data.error : 'Failed to load settings');
				}
				settingsCache = {
					providers: Array.isArray(data.providers) ? data.providers : [],
					default_provider: data.default_provider || 'openai',
					quick_actions: data.quick_actions || {
						problems: true,
						triggers: true,
						items: true,
						hosts: true
					}
				};
				return settingsCache;
			})
			.catch(() => {
				settingsCache = {
					providers: [],
					default_provider: 'openai',
					quick_actions: {
						problems: true,
						triggers: true,
						items: true,
						hosts: true
					}
				};
				return settingsCache;
			})
			.finally(() => {
				settingsPromise = null;
			});

		return settingsPromise;
	}

	function callAI(question, context, provider) {
		const payload = {
			question: question,
			context: context || {}
		};

		if (provider) {
			payload.provider = provider;
		}

		return fetch(CONFIG.apiEndpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(payload),
			credentials: 'same-origin'
		})
			.then((response) => response.json())
			.then((data) => {
				if (data && data.success) {
					return data;
				}
				throw new Error((data && data.error) || 'AI request failed');
			});
	}

	function openModal(title, content, actions, options) {
		options = options || {};
		const overlay = document.createElement('div');
		overlay.className = CONFIG.modalOverlayClass;
		if (getCurrentTheme() === 'dark') {
			overlay.setAttribute('theme', 'dark-theme');
		}

		const modal = document.createElement('div');
		modal.className = 'aiintegration-modal';

		const header = document.createElement('div');
		header.className = 'aiintegration-modal-header';

		const titleEl = document.createElement('div');
		titleEl.className = 'aiintegration-modal-title';
		titleEl.textContent = title;
		header.appendChild(titleEl);

		if (options.headerExtra) {
			const extraWrapper = document.createElement('div');
			extraWrapper.className = 'aiintegration-modal-header-extra';
			if (options.headerExtra instanceof Node) {
				extraWrapper.appendChild(options.headerExtra);
			}
			header.appendChild(extraWrapper);
		}

		const closeBtn = document.createElement('button');
		closeBtn.className = 'aiintegration-modal-close';
		closeBtn.type = 'button';
		closeBtn.setAttribute('aria-label', 'Close');
		closeBtn.innerHTML = '&times;';
		header.appendChild(closeBtn);

		const body = document.createElement('div');
		body.className = 'aiintegration-modal-body';
		if (typeof content === 'string') {
			body.innerHTML = content;
		}
		else if (content instanceof Node) {
			body.appendChild(content);
		}

		const footer = document.createElement('div');
		footer.className = 'aiintegration-modal-footer';

		function close() {
			overlay.remove();
		}

		closeBtn.addEventListener('click', close);
		overlay.addEventListener('click', (event) => {
			if (event.target === overlay) {
				close();
			}
		});

		modal.appendChild(header);
		modal.appendChild(body);
		modal.appendChild(footer);
		overlay.appendChild(modal);
		document.body.appendChild(overlay);

		setActions(footer, actions || [], close);

		return {
			overlay,
			body,
			footer,
			close,
			setContent: (newContent) => {
				body.innerHTML = '';
				if (typeof newContent === 'string') {
					body.innerHTML = newContent;
				}
				else if (newContent instanceof Node) {
					body.appendChild(newContent);
				}
			},
			setActions: (newActions) => setActions(footer, newActions || [], close)
		};
	}

	function setActions(footer, actions, close) {
		footer.innerHTML = '';

		const credits = document.createElement('span');
		credits.className = 'aiintegration-modal-credits';
		credits.textContent = 'Developed by MonZphere';
		footer.appendChild(credits);

		const actionsWrap = document.createElement('div');
		actionsWrap.className = 'aiintegration-modal-footer-actions';
		actions.forEach((action) => {
			const btn = document.createElement('button');
			btn.type = action.type || 'button';
			btn.textContent = action.label;
			btn.className = action.className || 'btn-alt';
			btn.addEventListener('click', () => {
				if (action.onClick) {
					action.onClick(close, btn);
				}
			});
			actionsWrap.appendChild(btn);
		});
		footer.appendChild(actionsWrap);
	}

	return {
		CONFIG,
		getCurrentTheme,
		escapeHtml: (text) => {
			const div = document.createElement('div');
			div.textContent = text == null ? '' : String(text);
			return div.innerHTML;
		},
		renderMarkdown,
		copyToClipboard,
		createLanguageSelect,
		tryParseJSON,
		loadSettings,
		callAI,
		openModal
	};
})();
