import { eventResponseSchema, providerSchema } from '@synqit/shared';
import { FormEvent, useState } from 'react';

import { callApi, toApiError } from '../lib/api';
import { getAccessToken } from '../lib/auth';
import { Provider } from '../lib/types';

export const EventCreatePage = () => {
  const [provider, setProvider] = useState<Provider>('spotify');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('Create an event to generate a magic link.');
  const [magicLinkUrl, setMagicLinkUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const createEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus('Login required to create events.');
      return;
    }

    setIsLoading(true);
    setMagicLinkUrl('');
    try {
      const result = await callApi(
        '/v1/events',
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            provider,
            name,
            description,
          }),
        },
        (payload) => eventResponseSchema.parse(payload),
      );

      setStatus(`Event "${result.event.name}" created.`);
      setMagicLinkUrl(result.magicLinkUrl);
      setName('');
      setDescription('');
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '0.75rem', maxWidth: '36rem' }}>
      <h2>Create Event Playlist</h2>
      <form onSubmit={createEvent} style={{ display: 'grid', gap: '0.75rem' }}>
        <label>
          Provider
          <select
            value={provider}
            onChange={(event) => setProvider(event.target.value as Provider)}
            style={{ marginLeft: '0.5rem' }}
          >
            {providerSchema.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label>
          Event name
          <input
            required
            maxLength={100}
            value={name}
            onChange={(nextEvent) => setName(nextEvent.target.value)}
            style={{ width: '100%' }}
          />
        </label>
        <label>
          Description
          <textarea
            maxLength={500}
            value={description}
            onChange={(nextEvent) => setDescription(nextEvent.target.value)}
            style={{ width: '100%', minHeight: '5rem' }}
          />
        </label>
        <button disabled={isLoading} type="submit">
          {isLoading ? 'Creating...' : 'Create event'}
        </button>
      </form>
      <p>{status}</p>
      {magicLinkUrl ? (
        <p>
          Magic link: <a href={magicLinkUrl}>{magicLinkUrl}</a>
        </p>
      ) : null}
    </div>
  );
};
