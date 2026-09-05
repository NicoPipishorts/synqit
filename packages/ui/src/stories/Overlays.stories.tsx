import type { Story } from '@ladle/react';
import { useState } from 'react';

import { AccordionSection } from '../components/AccordionSection';
import { CTAButton } from '../components/cta';
import { Modal } from '../components/Modal';
import { SlideOverPanel } from '../components/SlideOverPanel';
import { ToastProvider } from '../components/ToastProvider';
import { useToast } from '../hooks/useToast';

export const ModalStory: Story = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <CTAButton variant="primary" onClick={() => setOpen(true)}>
        Open modal
      </CTAButton>
      <Modal open={open} onClose={() => setOpen(false)} title="Rename playlist" closeLabel="Close">
        <p className="text-sm text-app-text-secondary">
          Resize the viewport below 640px to see the bottom-sheet presentation.
        </p>
      </Modal>
    </>
  );
};
ModalStory.storyName = 'Modal';

export const SlideOver: Story = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <CTAButton onClick={() => setOpen(true)}>Open panel</CTAButton>
      <SlideOverPanel open={open} onClose={() => setOpen(false)} title="User details">
        <AccordionSection title="Security" defaultOpen>
          <p className="text-sm">Sessions, password, 2FA…</p>
        </AccordionSection>
        <AccordionSection title="Playlists">
          <p className="text-sm">Owned and shared playlists.</p>
        </AccordionSection>
      </SlideOverPanel>
    </>
  );
};

const ToastButtons = () => {
  const { showToast } = useToast();
  return (
    <div className="flex gap-3">
      <CTAButton
        variant="primary"
        onClick={() => showToast('Playlist synced', { variant: 'success' })}
      >
        Success
      </CTAButton>
      <CTAButton
        variant="danger"
        onClick={() => showToast('Spotify rejected the token', { variant: 'error' })}
      >
        Error
      </CTAButton>
      <CTAButton onClick={() => showToast('Working on it…')}>Info</CTAButton>
    </div>
  );
};

export const Toasts: Story = () => (
  <ToastProvider>
    <ToastButtons />
  </ToastProvider>
);
