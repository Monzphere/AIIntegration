<?php declare(strict_types = 1);

namespace Modules\AIIntegration\Classes;

use CProfile;
use CWebUser;

class ConfigManager {
	private const PROFILE_KEY_GLOBAL = 'modules.aiintegration.global';
	private const PROFILE_KEY_USER = 'modules.aiintegration.user';

	/**
	 * Load configuration merged from global and user settings.
	 */
	public static function load(): array {
		$global_config = self::getGlobalConfig();
		$user_config = self::getUserConfig();

		$config = $global_config;

		// Merge user-specific provider settings
		if (isset($user_config['providers'])) {
			foreach ($user_config['providers'] as $name => $u_provider) {
				if (isset($config['providers'][$name])) {
					// User can override api_key and preference, but 'enabled' status is global or merged
					if (!empty($u_provider['api_key'])) {
						$config['providers'][$name]['api_key'] = $u_provider['api_key'];
					}
					// If user has a specific model or other pref, we could merge it here too
					if (isset($u_provider['model']) && $u_provider['model'] !== '') {
						$config['providers'][$name]['model'] = $u_provider['model'];
					}
				}
			}
		}

		if (isset($user_config['default_provider'])) {
			$config['default_provider'] = $user_config['default_provider'];
		}

		return $config;
	}

	/**
	 * Get only global configuration.
	 */
	public static function getGlobalConfig(): array {
		$data = CProfile::get(self::PROFILE_KEY_GLOBAL);
		if ($data === null || $data === '') {
			return self::getDefaults();
		}

		$config = json_decode($data, true);
		if (!is_array($config)) {
			return self::getDefaults();
		}

		$config = array_merge(self::getDefaults(), $config);
		self::decryptApiKeys($config);

		return $config;
	}

	/**
	 * Get only current user's configuration.
	 */
	public static function getUserConfig(): array {
		$data = CProfile::get(self::PROFILE_KEY_USER);
		if ($data === null || $data === '') {
			return ['providers' => []];
		}

		$config = json_decode($data, true);
		if (!is_array($config)) {
			return ['providers' => []];
		}

		self::decryptApiKeys($config);

		return $config;
	}

	/**
	 * Save global configuration.
	 */
	public static function saveGlobal(array $config): bool {
		if (CWebUser::getType() < USER_TYPE_SUPER_ADMIN) {
			return false;
		}

		self::encryptApiKeys($config);

		$json = json_encode($config);
		CProfile::update(self::PROFILE_KEY_GLOBAL, $json, PROFILE_TYPE_STR);
		return true;
	}

	/**
	 * Save current user's configuration.
	 */
	public static function saveUser(array $config): bool {
		self::encryptApiKeys($config);

		$json = json_encode($config);
		CProfile::update(self::PROFILE_KEY_USER, $json, PROFILE_TYPE_STR);
		return true;
	}

	/**
	 * Encrypt all API keys in the config array.
	 */
	private static function encryptApiKeys(array &$config): void {
		if (!isset($config['providers'])) {
			return;
		}

		foreach ($config['providers'] as &$provider) {
			if (isset($provider['api_key']) && $provider['api_key'] !== '' && $provider['api_key'] !== '********') {
				$provider['api_key'] = self::encrypt($provider['api_key']);
			}
		}
	}

	/**
	 * Decrypt all API keys in the config array.
	 */
	private static function decryptApiKeys(array &$config): void {
		if (!isset($config['providers'])) {
			return;
		}

		foreach ($config['providers'] as &$provider) {
			if (isset($provider['api_key']) && $provider['api_key'] !== '' && $provider['api_key'] !== '********') {
				$decrypted = self::decrypt($provider['api_key']);
				if ($decrypted !== false) {
					$provider['api_key'] = $decrypted;
				}
			}
		}
	}

	/**
	 * Encrypt plain text using AES-256-GCM.
	 */
	private static function encrypt(string $plaintext): string {
		$key = self::getMasterKey();
		$ivlen = openssl_cipher_iv_length($cipher = "AES-256-GCM");
		$iv = openssl_random_pseudo_bytes($ivlen);
		$ciphertext = openssl_encrypt($plaintext, $cipher, $key, $options = 0, $iv, $tag);
		
		return base64_encode($iv . $tag . $ciphertext);
	}

	/**
	 * Decrypt cipher text using AES-256-GCM.
	 */
	private static function decrypt(string $ciphertext_base64): string|false {
		$key = self::getMasterKey();
		$data = base64_decode($ciphertext_base64);
		$ivlen = openssl_cipher_iv_length($cipher = "AES-256-GCM");
		
		$iv = substr($data, 0, $ivlen);
		$tag = substr($data, $ivlen, 16);
		$ciphertext = substr($data, $ivlen + 16);
		
		return openssl_decrypt($ciphertext, $cipher, $key, $options = 0, $iv, $tag);
	}

	/**
	 * Get the master key for encryption.
	 */
	private static function getMasterKey(): string {
		// 1. Prioridade máxima: Variável de Ambiente
		$key = getenv('ZBX_AI_MASTER_KEY');
		if ($key) {
			return hash('sha256', $key, true);
		}

		// 2. Tentar usar uma Macro Global do Zabbix ({$AI_MASTER_KEY})
		// Isso permite ao usuário gerenciar a chave pela UI do Zabbix sem arquivos.
		try {
			$macros = \API::UserMacro()->get([
				'globalmacro' => true,
				'output' => ['value'],
				'filter' => ['macro' => '{$AI_MASTER_KEY}']
			]);
			if ($macros) {
				return hash('sha256', $macros[0]['value'], true);
			}
		} catch (\Exception $e) {
			// Silenciosamente falha se a API não estiver pronta
		}

		// 3. Fallback sem arquivos: Derivado das credenciais do banco do Zabbix.
		// Único por instalação, mas não requer novos arquivos no disco.
		global $DB;
		$seed = ($DB['DATABASE'] ?? 'zbx_default') . ($DB['USER'] ?? 'zbx_user');
		return hash('sha256', 'zbx_ai_integration_fallback' . $seed, true);
	}

	private static function getDefaults(): array {
		return [
			'providers' => [
				'openai' => [
					'enabled' => false,
					'endpoint' => 'https://api.openai.com/v1/chat/completions',
					'model' => 'gpt-4o-mini',
					'temperature' => 0.7,
					'max_tokens' => 2048,
					'api_key' => ''
				],
				'anthropic' => [
					'enabled' => false,
					'endpoint' => 'https://api.anthropic.com/v1/messages',
					'model' => 'claude-3-haiku-20240307',
					'temperature' => 0.7,
					'max_tokens' => 2048,
					'api_key' => ''
				],
				'gemini' => [
					'enabled' => false,
					'endpoint' => 'https://generativelanguage.googleapis.com/v1beta/models',
					'model' => 'gemini-pro',
					'temperature' => 0.7,
					'max_tokens' => 2048,
					'api_key' => ''
				],
				'custom' => [
					'enabled' => false,
					'endpoint' => '',
					'model' => '',
					'temperature' => 0.7,
					'max_tokens' => 2048,
					'headers' => '{}',
					'api_key' => ''
				]
			],
			'default_provider' => 'openai',
			'quick_actions' => [
				'problems' => true,
				'triggers' => true,
				'items' => true,
				'hosts' => true
			]
		];
	}
}
