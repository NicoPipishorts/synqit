import { Modal as UiModal, type ModalProps as UiModalProps } from '@synqit/ui';

import { useI18n } from '../../hooks/useI18n';

type ModalProps = Omit<UiModalProps, 'closeLabel'>;

/** Admin-bound Modal: injects the localised close label. */
export const Modal = (props: ModalProps) => {
  const { t } = useI18n();
  return <UiModal {...props} closeLabel={t('modal.close')} />;
};
