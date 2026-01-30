# AI Integration for Zabbix

Zabbix frontend module that adds AI-powered analysis and quick actions across monitoring workflows. Developed by [Monzphere](https://monzphere.com).

<img width="633" height="405" alt="image" src="https://github.com/user-attachments/assets/7316f3d9-d092-40cd-a819-0f06245148b4" />
<img width="611" height="383" alt="image" src="https://github.com/user-attachments/assets/0451a658-6ac2-4c1a-acf1-9332a194ab91" />
<img width="787" height="561" alt="image" src="https://github.com/user-attachments/assets/d072079f-e0b1-4a63-90dd-ce1443648372" />

**Base platform:** Zabbix 7.0.x (official frontend module structure).

## Features

- **Problems** – Sparkle action on each row to run AI analysis with enriched context (event, host, trigger, recurrence, acknowledges, metrics).
- **Latest data** – Per-item sparkle to detect deviations and anomalies from history/trends (statistics, z-score, patterns).
- **Triggers** – Quick-fill form from a natural-language request (e.g. “CPU > 80% for 5 min in business hours”).
- **Hosts** – Health view with active problems, top incidents, metrics summary, and health score.
- **Modern Analysis UI**:
  - **Markdown Rendering**: Results are richly formatted with headers, lists, tables, and code blocks.
  - **Integrated Translation**: Select your preferred language (Portuguese/English) directly in the analysis modal.
  - **Glassmorphism Design**: High-performance, modern modal design with backdrop blur and smooth animations.
  - **Dark Mode Support**: Seamlessly adapts to Zabbix's light and dark themes.
  - **Copy to Clipboard**: Quick action to copy the full analysis report.

## Security & Storage

- **Database-Driven**: All configuration is stored securely in the Zabbix database (`profiles` table). No external configuration files or writable directories are required.
- **Strong Encryption**: Sensitive data like API Keys are encrypted using **AES-256-GCM**.
- **Master Key Configuration**: To ensure the security of your encrypted keys, it is highly recommended to configure a custom Master Key. The system prioritizes sources in this order:
    1. **Environment Variable**: Set `ZBX_AI_MASTER_KEY` in your web server or PHP-FPM environment.
    2. **Zabbix Global Macro**: Go to **Administration → General → Macros** and create a secret macro `{$AI_MASTER_KEY}`.
    3. **Automatic Fallback**: If neither is set, a key derived from your Zabbix database credentials is used as a fallback.
- **Permissions**: Menu and settings are strictly limited to Super Admins. Context JSON visibility is restricted to Super Admins only.

## Requirements

- Zabbix 7.0.x
- PHP with `openssl`, `json` and `curl` extensions.
- At least one configured AI provider with a valid API key.

## Installation

1. Clone or copy the `AIIntegration` folder into the Zabbix frontend modules directory:
   ```bash
   cp -r AIIntegration /usr/share/zabbix/modules/
   ```
2. In the Zabbix UI: **Administration → General → Modules**, enable **AI Integration**.
3. Go to **Administration → AI Integration**, set up your providers and enable desired quick actions.

## Configuration

- **Default provider** – Default AI engine for new analysis.
- **Quick actions** – Toggle AI columns in Problems, Latest data, and forms.
- **Providers** – OpenAI, Anthropic, Gemini, DeepSeek, and Custom (compatible with n8n and self-hosted LLMs).
- **Advanced Headers** – Custom providers support optional JSON headers for specific API requirements.

## File layout

```
AIIntegration/
├── manifest.json
├── Module.php
├── Classes/                 # Logic classes (ConfigManager, etc.)
├── actions/                 # Controller actions
├── views/                   # PHP UI templates
└── assets/
    ├── css/                 # Modern styling (glassmorphism/markdown)
    └── js/                  # Page handlers and core AI logic
```

## License

MIT. See [LICENSE](LICENSE).

## Author

Monzphere
