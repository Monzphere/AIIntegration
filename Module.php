<?php declare(strict_types = 1);

namespace Modules\AIIntegration;

use Zabbix\Core\CModule,
	APP,
	CMenuItem,
	CWebUser;

class Module extends CModule {
	public function init(): void {
		if (CWebUser::getType() >= USER_TYPE_ZABBIX_USER) {
			APP::Component()->get('menu.main')
				->findOrAdd(_('Administration'))
				->getSubmenu()
				->insertAfter(_('Scripts'),
					(new CMenuItem(_('AI Integration')))
						->setAction('aiintegration.settings')
						->setIcon(\ZBX_ICON_COG_FILLED)
				);
		}
	}
}
