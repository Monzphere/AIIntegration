<?php declare(strict_types = 1);

namespace Modules\AIIntegration\Actions;

use CController;
use CControllerResponseRedirect;
use CUrl;

class AIIntegrationSettingsSave extends CController {
	public function init(): void {
		$this->disableCsrfValidation();
	}

	protected function checkInput(): bool {
		return true;
	}

	public function checkPermissions(): bool {
		return $this->getUserType() >= USER_TYPE_ZABBIX_USER;
	}

	protected function doAction(): void {
		$is_super_admin = $this->getUserType() == USER_TYPE_SUPER_ADMIN;
		$existing_global = \Modules\AIIntegration\Classes\ConfigManager::getGlobalConfig();
		$existing_user = \Modules\AIIntegration\Classes\ConfigManager::getUserConfig();

		$providers = [
			'openai' => $this->buildProviderConfig('openai', [
				'enabled' => !empty($_POST['openai_enabled']),
				'endpoint' => trim($_POST['openai_endpoint'] ?? 'https://api.openai.com/v1/chat/completions'),
				'model' => trim($_POST['openai_model'] ?? 'gpt-4o-mini'),
				'temperature' => $this->toFloat($_POST['openai_temperature'] ?? 0.7),
				'max_tokens' => $this->toInt($_POST['openai_max_tokens'] ?? 2048)
			], $existing_global),
			'anthropic' => $this->buildProviderConfig('anthropic', [
				'enabled' => !empty($_POST['anthropic_enabled']),
				'endpoint' => trim($_POST['anthropic_endpoint'] ?? 'https://api.anthropic.com/v1/messages'),
				'model' => trim($_POST['anthropic_model'] ?? 'claude-3-haiku-20240307'),
				'temperature' => $this->toFloat($_POST['anthropic_temperature'] ?? 0.7),
				'max_tokens' => $this->toInt($_POST['anthropic_max_tokens'] ?? 2048)
			], $existing_global),
			'gemini' => $this->buildProviderConfig('gemini', [
				'enabled' => !empty($_POST['gemini_enabled']),
				'endpoint' => trim($_POST['gemini_endpoint'] ?? 'https://generativelanguage.googleapis.com/v1beta/models'),
				'model' => trim($_POST['gemini_model'] ?? 'gemini-pro'),
				'temperature' => $this->toFloat($_POST['gemini_temperature'] ?? 0.7),
				'max_tokens' => $this->toInt($_POST['gemini_max_tokens'] ?? 2048)
			], $existing_global),
			'custom' => $this->buildProviderConfig('custom', [
				'enabled' => !empty($_POST['custom_enabled']),
				'endpoint' => trim($_POST['custom_endpoint'] ?? ''),
				'model' => trim($_POST['custom_model'] ?? ''),
				'temperature' => $this->toFloat($_POST['custom_temperature'] ?? 0.7),
				'max_tokens' => $this->toInt($_POST['custom_max_tokens'] ?? 2048),
				'headers' => trim($_POST['custom_headers'] ?? '{}')
			], $existing_global)
		];

		if ($is_super_admin) {
			$global_config = [
				'providers' => $providers,
				'default_provider' => trim($_POST['default_provider'] ?? 'openai'),
				'quick_actions' => [
					'problems' => !empty($_POST['qa_problems']),
					'triggers' => !empty($_POST['qa_triggers']),
					'items' => !empty($_POST['qa_items']),
					'hosts' => !empty($_POST['qa_hosts'])
				],
				'updated_at' => date('Y-m-d H:i:s')
			];
			\Modules\AIIntegration\Classes\ConfigManager::saveGlobal($global_config);
		}

		// Save user settings (personal API keys and default provider)
		$user_config = [
			'providers' => [],
			'default_provider' => trim($_POST['default_provider'] ?? '')
		];

		foreach (['openai', 'anthropic', 'gemini', 'custom'] as $p) {
			$user_key = trim($_POST[$p . '_api_key'] ?? '');
			if ($user_key !== '' && $user_key !== '********') {
				$user_config['providers'][$p]['api_key'] = $user_key;
			}
			elseif ($user_key === '' && isset($existing_user['providers'][$p]['api_key'])) {
				// If user explicitly clears it, we should probably keep it empty or remove it
			}
			else {
				// Keep existing user key if masked
				$user_config['providers'][$p]['api_key'] = $existing_user['providers'][$p]['api_key'] ?? '';
			}

			// Users might also want to override the model they use
			$user_model = trim($_POST[$p . '_model'] ?? '');
			if ($user_model !== '' && $user_model !== ($existing_global['providers'][$p]['model'] ?? '')) {
				$user_config['providers'][$p]['model'] = $user_model;
			}
		}

		\Modules\AIIntegration\Classes\ConfigManager::saveUser($user_config);

		info(_('AI Integration settings saved successfully.'));

		$this->setResponse(new CControllerResponseRedirect(
			(new CUrl('zabbix.php'))->setArgument('action', 'aiintegration.settings')
		));
	}

	private function buildProviderConfig(string $provider, array $input, array $existing): array {
		$api_key = trim($_POST[$provider . '_api_key'] ?? '');

		if ($api_key === '' || $api_key === '********') {
			$api_key = $existing['providers'][$provider]['api_key'] ?? '';
		}

		$input['api_key'] = $api_key;
		return $input;
	}

	private function loadConfig(): array {
		$config_path = $this->resolveConfigPath();

		if (!file_exists($config_path)) {
			return ['providers' => []];
		}

		$content = file_get_contents($config_path);
		$config = json_decode($content, true);

		return is_array($config) ? $config : ['providers' => []];
	}

	private function saveConfig(array $config): bool {
		$config_path = $this->resolveConfigPath();
		$dir = dirname($config_path);

		if (!is_dir($dir)) {
			@mkdir($dir, 0750, true);
		}

		$json = json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
		return @file_put_contents($config_path, $json) !== false;
	}

	private function resolveConfigPath(): string {
		return __DIR__ . '/../config/aiintegration_config.json';
	}

	private function toFloat($value, float $default = 0.0): float {
		if ($value === null || $value === '') {
			return $default;
		}
		return (float) $value;
	}

	private function toInt($value, int $default = 0): int {
		if ($value === null || $value === '') {
			return $default;
		}
		return (int) $value;
	}
}
