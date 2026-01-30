<?php declare(strict_types = 1);

namespace Modules\AIIntegration\Actions;

use CController;

class AIIntegrationProviders extends CController {
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
		header('Content-Type: application/json; charset=utf-8');

		try {
			$config = $this->loadConfig();

			$providers = [];
			foreach ($config['providers'] ?? [] as $name => $provider) {
				if (!empty($provider['enabled'])) {
					$providers[] = [
						'name' => $name,
						'model' => $provider['model'] ?? '',
						'endpoint' => $provider['endpoint'] ?? '',
						'has_api_key' => !empty($provider['api_key'])
					];
				}
			}

			echo json_encode([
				'success' => true,
				'providers' => $providers,
				'default_provider' => $config['default_provider'] ?? 'openai',
				'quick_actions' => $this->resolveQuickActions($config['quick_actions'] ?? []),
				'is_super_admin' => $this->getUserType() == USER_TYPE_SUPER_ADMIN
			], JSON_UNESCAPED_UNICODE);
		}
		catch (\Exception $e) {
			http_response_code(500);
			echo json_encode([
				'success' => false,
				'error' => $e->getMessage()
			]);
		}

		exit;
	}

	private function loadConfig(): array {
		return \Modules\AIIntegration\Classes\ConfigManager::load();
	}

	private function resolveQuickActions(array $quick_actions): array {
		$defaults = [
			'problems' => true,
			'triggers' => true,
			'items' => true,
			'hosts' => true
		];

		return array_merge($defaults, $quick_actions);
	}
}
