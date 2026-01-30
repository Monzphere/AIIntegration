<?php declare(strict_types = 1);

namespace Modules\AIIntegration\Actions;

use CController;
use CControllerResponseData;

class AIIntegrationSettings extends CController {
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
		$config = \Modules\AIIntegration\Classes\ConfigManager::load();
		$is_super_admin = $this->getUserType() == USER_TYPE_SUPER_ADMIN;

		$data = [
			'config' => $config,
			'is_super_admin' => $is_super_admin
		];

		$this->setResponse(new CControllerResponseData($data));
	}
}
